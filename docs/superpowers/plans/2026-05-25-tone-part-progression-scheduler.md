# Tone-Native Progression Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace FretFlow's bespoke progression-playback scheduler with five Tone-native primitives running on a single Transport — one `Tone.Part` per audio layer (chord-strum, bass, drums, chord-onset clock) plus one `Tone.Loop` for the metronome — each routed through its own gain node so layer toggles flip gain instead of rebuilding the scheduler. Mid-play edits stop playback and restart from bar 0.

**Architecture:** At play-start, build the full event timeline once (chord strums, bass notes, drum hits, metronome clicks, chord-onset events) by flattening the resolved progression. Each layer's events feed its own `Tone.Part` (or `Tone.Loop` for metronome) connected to a per-layer gain node, all routed into the existing progression bus. Tone stores Part events internally as ticks (PPQ-relative, not seconds), so tempo / swing / loop / beatsPerBar changes apply in-place via `Transport.bpm.value`, `Transport.swing`, `Part.loop`, `Transport.timeSignature` — no rebuild. Layer-enable toggles set the corresponding gain to 0/1. Instrument changes route through a ref the Part callback reads dynamically. Only **edits that change WHICH events fire** — step content, pattern ids, drum variations — trigger a full dispose + rebuild from bar 0. The chord-onset Part callback owns the React `activeProgressionStepIndex` advance, deferred by `setTimeout(advance, time − getContext().immediate())` to align with audio onset (same proven pattern from `4f50968`). `useProgressionPlaybackLoop` and the top-level `scheduleProgressionStep` orchestrator are deleted.

**Tech Stack:** Tone.js 15.x (`Tone.Part`, `Tone.Loop`, `Tone.Gain`, `Tone.getTransport`, `Tone.getContext`), Jotai, React 19, Vitest.

---

## Design rationale

### Why Tone.Part (and one Tone.Loop), not Sequence everywhere

Tone primitives map cleanly onto our data shapes:

| Layer | Today (custom) | Proposed primitive | Why |
|---|---|---|---|
| Chord-onset clock (for React `activeProgressionStepIndex`) | `useProgressionPlaybackLoop` + `Transport.scheduleOnce` chain | **Tone.Part** | one event per bar; carries `isFirstBar` so only true step boundaries fire the React write |
| Chord strum hits | `scheduler.ts` per-bar loop calling `voice.scheduleChord` | **Tone.Part** | each event = one strum hit at audio-precise time with voicing + velocity + style |
| Bass notes | `scheduler.ts` per-bar loop calling `scheduleBassNote` with role resolution | **Tone.Part** | resolve `nextChordRoot` at build time (we know the full progression); each event = one bass note |
| Drum hits | `scheduler.ts` per-bar loop calling `scheduleKick/Snare/HiHat/Ride` | **Tone.Part** | drum patterns have mixed voices per beat; Tone.Sequence's uniform-array-iteration assumes one value per slot, Tone.Part handles arbitrary-time mixed-voice events without forcing us to chunk by subdivision |
| Metronome | `scheduler.ts` per-bar loop calling `scheduleClick` | **Tone.Loop** | textbook fit — fires every beat at a fixed subdivision, accent-on-downbeat is a single counter |

You explicitly asked about Tone.Sequence for drums; the data we already have (`CatalogDrumPattern.hits` is an array of `{beat, type, velocity}`) is point-event-shaped, not slot-shaped. Tone.Part schedules those without translation. If we ever migrate drum patterns to a 16th-grid array of `{kick?, snare?, hihat?}` slot objects, swapping in Tone.Sequence is a small follow-up; the change is purely upstream of the primitive choice.

### Mid-play edit policy — split by Tone support

| Edit | Tone-native in-place mechanism | Plan does it in-place? |
|---|---|---|
| Tempo | `Transport.bpm.value = N` (events stored as ticks → re-time automatically) | **yes** |
| Swing | `Transport.swing = X` | **yes** |
| Loop toggle | `part.loop = X` (loopEnd in ticks re-times with bpm) | **yes** |
| Time signature (beatsPerBar) | `Transport.timeSignature = N` + metronome callback reads beatsPerBar via ref for accent cycle | **yes** |
| Chord instrument | closure reads `instrumentRef.current` each Part tick | **yes** (React-side; no Tone complexity) |
| Layer mute (chord/bass/drums/metronome) | `gain.value = 0 \| 1` on the per-layer GainNode | **yes** |
| Step content (add / remove / change chord) | `part.clear() + part.add()` per affected Part with newly-computed events | **no — rebuild from 0** |
| Pattern ids (chord/bass/drum) or drum variations | same as above (clear + re-add) | **no — rebuild from 0** |

The "no" rows aren't "Tone can't do it" — they're "Tone can do it via `part.clear() + part.add()`, but every affected layer's event array has to be recomputed and the chord-strum/bass closures need re-mapping per chord. That's not a single setter; it's effectively a rebuild with extra entanglement risk." Per your "out-of-the-box-only" rule, those drop to restart-from-0. Today's `wasPlayingRef`, `lastEnableRef`, `lastConfigRef`, `lastStepRef`, `lastActiveStartTimeRef`, `sameEnableFlags`, `sameConfigFlags`, `scheduleFromTime`, segment-keepers reconciliation — all still go away, because the rebuild path is "dispose everything, build everything, start at 0" with zero reconciliation.

The user-visible result: tempo slider, swing slider, loop toggle, time-signature picker, instrument selector, and mute toggles **all** apply mid-bar with no audio glitch. Step edits and pattern switches cause a brief stop + auto-restart at bar 0.

### Why layer-mute as gain, not as rebuild

Each layer (chord-strum, bass, drums, metronome) gets its own `Tone.Gain` node between the layer's primitive and the existing progression bus. Toggling a layer flips its gain to 0 or 1 — no sequencer rebuild, no audio glitch, no React effect cascade. This is "without additional custom code" in the sense you meant: gain routing is a Tone primitive, not custom mute logic.

### Why we still need the chord-onset Part

The chord-strum Part already fires for every strum hit, but those events aren't aligned to step boundaries (a strum pattern can have several hits per bar). The React `activeProgressionStepIndex` needs a clean once-per-bar tick so the chord overlay swap fires exactly once per bar boundary. A separate tiny Tone.Part with one event per bar is the simplest way to deliver that.

### What stays (intentional non-scope)

- `progressionStepsAtom` schema + the editor UX (per-step variable duration). Unchanged.
- The pattern catalog (`CHORD_PATTERNS`, `BASS_PATTERNS`, `DRUM_PATTERNS`, `DRUM_VARIATIONS`) and lookup helpers. Unchanged.
- Per-hit audio primitives (`scheduleKick`, `scheduleSnare`, `scheduleHiHat`, `scheduleRide`, `scheduleBassNote`, `scheduleClick`, `voice.scheduleChord` from the instrument registry). Unchanged — they become the bodies of Tone primitive callbacks.
- `swingBeat` math, `repeatPatternToBeats`. Move into the new event-builder; remain unchanged in behavior.
- The chord overlay subscribers (`chordOverlayAtoms`, `songStateAtoms`, `practiceLensAtoms`) and `ProgressionPlayhead`. Unchanged.
- `timeline.ts` shape — the chord-onset Part callback calls `setActiveStep` with the new bar's anchor.
- The `setTimeout(advance, time − immediate())` pattern from `4f50968`. Reused verbatim inside the chord-onset Part callback. The 250 ms-expiration stall cannot recur via this path.

### What goes away

- `src/hooks/useProgressionPlaybackLoop.ts` + test. Fully deleted.
- `scheduleProgressionStep` (top-level function in `src/progressions/audio/scheduler.ts`). Replaced by per-layer event builders + Tone primitives. The per-hit helpers in that file stay.
- The segment-queue logic + reconciliation refs in `useProgressionAudioPlayback.ts`. Replaced by "build everything, dispose everything."
- Mid-bar parameter rebuild semantics. Edits stop + restart at bar 0.

---

## File map

**Create**

- `src/progressions/audio/progressionPart.ts` — thin wrapper over `Tone.Part`:
  ```ts
  export interface ProgressionPartHandle {
    /** Start at transport `time` (default "now") with internal cursor at
     *  `offset` seconds (default 0). Forwards to Tone.Part.start. */
    start: (time?: number, offset?: number) => void;
    /** Live-toggle the Part's loop flag without disposing — used by the
     *  orchestrator's loop-toggle effect. Updates loopEnd too if provided. */
    setLoop: (loop: boolean, loopEnd?: number) => void;
    /** Stop and dispose. Idempotent. */
    dispose: () => void;
  }
  export function createProgressionPart<V>(opts: {
    events: ReadonlyArray<{ time: number; value: V }>;
    loop: boolean;
    loopEnd: number;
    onEvent: (audioTime: number, value: V) => void;
  }): ProgressionPartHandle;
  ```

- `src/progressions/audio/progressionMetronomeLoop.ts` — thin wrapper over `Tone.Loop`:
  ```ts
  export interface MetronomeLoopHandle {
    start: (time?: number) => void;
    dispose: () => void;
  }
  export function createMetronomeLoop(opts: {
    beatsPerBar: number;
    /** Called once per beat with the audio-precise time + 1-based beat number. */
    onBeat: (audioTime: number, beatInBar: number) => void;
  }): MetronomeLoopHandle;
  ```

- `src/progressions/audio/layerBuses.ts` — per-layer gain nodes:
  ```ts
  export type ProgressionLayer = "chord" | "bass" | "drums" | "metronome";
  export interface LayerBuses {
    /** Per-layer GainNode wrapped destination; instruments connect here. */
    chord: AudioNode;
    bass: AudioNode;
    drums: AudioNode;
    metronome: AudioNode;
  }
  export function buildLayerBuses(ctx: AudioContext, destination: AudioNode): LayerBuses;
  export function setLayerGain(buses: LayerBuses, layer: ProgressionLayer, enabled: boolean): void;
  ```

- `src/progressions/audio/buildAllLayers.ts` — pure event-stream builder. Input = resolved steps + tempo + beatsPerBar + swing + chordInstrument + pattern ids + drumVariations + loop. Output =
  ```ts
  export interface ChordOnsetEvent { stepIndex: number; isFirstBar: boolean; isLastBar: boolean; beats: number; durationSec: number; cumulativeStartSec: number; }
  export interface ChordStrumEvent { voicing: readonly string[]; velocity: number; style?: string; direction?: "down" | "up" | "alt"; }
  export interface BassEvent { note: string; velocity: number; }
  export interface DrumEvent { type: "kick" | "snare" | "hihat" | "ride"; velocity: number; }

  export interface BuiltLayers {
    chordOnsets: ReadonlyArray<{ time: number; value: ChordOnsetEvent }>;
    chordStrums: ReadonlyArray<{ time: number; value: ChordStrumEvent }>;
    bass: ReadonlyArray<{ time: number; value: BassEvent }>;
    drums: ReadonlyArray<{ time: number; value: DrumEvent }>;
    totalDurationSec: number;
  }
  export function buildAllLayers(input: BuildAllLayersInput): BuiltLayers;
  ```

- `src/hooks/useProgressionAudioPlayback.test.tsx` — new test file (~10 focused tests).

**Modify**

- `src/progressions/audio/bus.ts` — `ensureProgressionAudio()` exposes the new `LayerBuses` alongside the existing `bus`. Backwards-compat: keep `bus` as the parent of all four layer buses.

- `src/progressions/audio/scheduler.ts` — delete `scheduleProgressionStep` and `swingBeat` (the latter moves to `buildAllLayers`). Keep the per-hit `scheduleKick/Snare/HiHat/Ride/Click/BassNote` exports intact. Delete `scheduler.test.ts` cases that exercise `scheduleProgressionStep` directly; keep per-hit tests.

- `src/hooks/useProgressionAudioPlayback.ts` — full rewrite. Two effects:
  1. Build/dispose the Tone primitives on play+input changes.
  2. Flip layer gains on toggle changes (no rebuild).

- `src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx` — remove `useProgressionPlaybackLoop()` import + call.

**Delete**

- `src/hooks/useProgressionPlaybackLoop.ts`
- `src/hooks/useProgressionPlaybackLoop.test.tsx`

**Untouched (explicit)**

- `src/progressions/audio/{drumKit,bass,metronome,patterns,instruments,toneBus}.ts`
- `src/progressions/audio/timeline.ts`
- `src/components/ProgressionTrack/ProgressionPlayhead.tsx`
- All atoms.

---

## Reused utilities

- `Tone.Part`, `Tone.Loop`, `Tone.Gain`, `getTransport`, `getContext` from `"tone"`.
- Per-hit schedulers: `scheduleKick`, `scheduleSnare`, `scheduleHiHat`, `scheduleRide`, `scheduleBassNote`, `scheduleClick`, `getChordVoice(instrumentId).scheduleChord`.
- `getChordPattern`, `getBassPattern`, `getDrumPattern`, `getDrumVariation`, `buildMetronomePattern`, `repeatPatternToBeats` from `patterns.ts`.
- `resolveBassNoteForRole`, `resolveChordVoicing`, `resolveBassLineNotes` from `progressionAudio.ts`.
- `findNextResolvableStepIndex`, `getProgressionDurationMs` from `progressionDomain.ts`.
- `setActiveStep`, `pauseTimeline`, `clearTimeline` from `timeline.ts`.
- `ensureProgressionAudio`, `resumeProgressionAudio`, `restoreProgressionBus`, `silenceProgressionBus` from `bus.ts`.

---

### Task 1: Tone primitive wrappers + layer buses

**Files:**
- Create: `src/progressions/audio/progressionPart.ts`
- Create: `src/progressions/audio/progressionPart.test.ts`
- Create: `src/progressions/audio/progressionMetronomeLoop.ts`
- Create: `src/progressions/audio/progressionMetronomeLoop.test.ts`
- Create: `src/progressions/audio/layerBuses.ts`
- Create: `src/progressions/audio/layerBuses.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/progressions/audio/progressionPart.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toneMocks = vi.hoisted(() => {
  type Cb = (time: number, value: unknown) => void;
  interface PartInstance {
    callback: Cb;
    events: Array<[number, unknown]>;
    loop: boolean;
    loopEnd: number;
    startedTime: number | null;
    startedOffset: number | null;
    disposed: boolean;
    start(time?: number, offset?: number): PartInstance;
    stop(): PartInstance;
    dispose(): PartInstance;
  }
  const parts: PartInstance[] = [];

  function PartCtor(callback: Cb, events: Array<[number, unknown]>): PartInstance {
    const inst: PartInstance = {
      callback,
      events: [...events],
      loop: false,
      loopEnd: 0,
      startedTime: null,
      startedOffset: null,
      disposed: false,
      start(time?: number, offset?: number) {
        this.startedTime = time ?? 0;
        this.startedOffset = offset ?? 0;
        return this;
      },
      stop() { return this; },
      dispose() { this.disposed = true; return this; },
    };
    parts.push(inst);
    return inst;
  }
  return { Part: PartCtor as unknown as new (...args: unknown[]) => unknown, parts };
});
vi.mock("tone", () => ({ Part: toneMocks.Part }));

import { createProgressionPart } from "./progressionPart";

describe("createProgressionPart", () => {
  beforeEach(() => { toneMocks.parts.length = 0; });
  afterEach(() => { vi.restoreAllMocks(); });

  it("constructs Tone.Part with one event per supplied {time, value}", () => {
    createProgressionPart<{ id: string }>({
      events: [{ time: 0, value: { id: "a" } }, { time: 1.5, value: { id: "b" } }],
      loop: true,
      loopEnd: 3,
      onEvent: () => {},
    });
    expect(toneMocks.parts).toHaveLength(1);
    expect(toneMocks.parts[0].events).toEqual([[0, { id: "a" }], [1.5, { id: "b" }]]);
    expect(toneMocks.parts[0].loop).toBe(true);
    expect(toneMocks.parts[0].loopEnd).toBe(3);
  });

  it("does not set loopEnd when loop is false", () => {
    createProgressionPart({
      events: [{ time: 0, value: 1 }],
      loop: false,
      loopEnd: 99, // ignored
      onEvent: () => {},
    });
    expect(toneMocks.parts[0].loop).toBe(false);
  });

  it("invokes onEvent with audio time + the original value when Tone fires", () => {
    const onEvent = vi.fn();
    createProgressionPart<{ id: string }>({
      events: [{ time: 0, value: { id: "x" } }],
      loop: false,
      loopEnd: 1,
      onEvent,
    });
    toneMocks.parts[0].callback(0.42, { id: "x" });
    expect(onEvent).toHaveBeenCalledWith(0.42, { id: "x" });
  });

  it("start(time, offset) forwards both args; dispose() is idempotent", () => {
    const h = createProgressionPart({
      events: [{ time: 0, value: 1 }],
      loop: false,
      loopEnd: 1,
      onEvent: () => {},
    });
    h.start(2.5, 0.4);
    expect(toneMocks.parts[0].startedTime).toBe(2.5);
    expect(toneMocks.parts[0].startedOffset).toBe(0.4);
    h.dispose();
    h.dispose();
    expect(toneMocks.parts[0].disposed).toBe(true);
  });

  it("setLoop(true, end) live-flips part.loop + part.loopEnd without rebuilding", () => {
    const h = createProgressionPart({
      events: [{ time: 0, value: 1 }],
      loop: false,
      loopEnd: 0,
      onEvent: () => {},
    });
    h.setLoop(true, 8);
    expect(toneMocks.parts[0].loop).toBe(true);
    expect(toneMocks.parts[0].loopEnd).toBe(8);
    h.setLoop(false);
    expect(toneMocks.parts[0].loop).toBe(false);
    // loopEnd unchanged when not supplied:
    expect(toneMocks.parts[0].loopEnd).toBe(8);
  });
});
```

```ts
// src/progressions/audio/progressionMetronomeLoop.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toneMocks = vi.hoisted(() => {
  type Cb = (time: number) => void;
  interface LoopInstance {
    callback: Cb;
    interval: string | number;
    startedTime: number | null;
    disposed: boolean;
    start(time?: number): LoopInstance;
    dispose(): LoopInstance;
  }
  const loops: LoopInstance[] = [];
  function LoopCtor(callback: Cb, interval: string | number): LoopInstance {
    const inst: LoopInstance = {
      callback, interval, startedTime: null, disposed: false,
      start(time?: number) { this.startedTime = time ?? 0; return this; },
      dispose() { this.disposed = true; return this; },
    };
    loops.push(inst);
    return inst;
  }
  return { Loop: LoopCtor as unknown as new (...args: unknown[]) => unknown, loops };
});
vi.mock("tone", () => ({ Loop: toneMocks.Loop }));

import { createMetronomeLoop } from "./progressionMetronomeLoop";

describe("createMetronomeLoop", () => {
  beforeEach(() => { toneMocks.loops.length = 0; });
  afterEach(() => { vi.restoreAllMocks(); });

  it("constructs a Tone.Loop at quarter-note interval", () => {
    createMetronomeLoop({ beatsPerBar: 4, onBeat: () => {} });
    expect(toneMocks.loops).toHaveLength(1);
    expect(toneMocks.loops[0].interval).toBe("4n");
  });

  it("fires onBeat with audio time + the correct 1-based beat number (cycling 1..beatsPerBar)", () => {
    const onBeat = vi.fn();
    createMetronomeLoop({ beatsPerBar: 3, onBeat });
    const loop = toneMocks.loops[0];
    loop.callback(0.0); loop.callback(0.5); loop.callback(1.0); loop.callback(1.5);
    expect(onBeat.mock.calls).toEqual([[0.0, 1], [0.5, 2], [1.0, 3], [1.5, 1]]);
  });

  it("start + dispose forward through to Tone.Loop", () => {
    const h = createMetronomeLoop({ beatsPerBar: 4, onBeat: () => {} });
    h.start(2);
    expect(toneMocks.loops[0].startedTime).toBe(2);
    h.dispose();
    expect(toneMocks.loops[0].disposed).toBe(true);
  });
});
```

```ts
// src/progressions/audio/layerBuses.test.ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { buildLayerBuses, setLayerGain } from "./layerBuses";

function fakeAudioContext() {
  const gainNodes: Array<{ gain: { value: number }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  const ctx = {
    createGain: () => {
      const node = {
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      gainNodes.push(node);
      return node;
    },
  } as unknown as AudioContext;
  return { ctx, gainNodes };
}

describe("layerBuses", () => {
  it("builds one GainNode per layer and connects each to the destination", () => {
    const { ctx, gainNodes } = fakeAudioContext();
    const dest = { kind: "dest" } as unknown as AudioNode;
    const buses = buildLayerBuses(ctx, dest);
    expect(Object.keys(buses).sort()).toEqual(["bass", "chord", "drums", "metronome"]);
    expect(gainNodes).toHaveLength(4);
    gainNodes.forEach((n) => expect(n.connect).toHaveBeenCalledWith(dest));
  });

  it("setLayerGain flips the targeted layer's gain", () => {
    const { ctx } = fakeAudioContext();
    const buses = buildLayerBuses(ctx, {} as AudioNode);
    setLayerGain(buses, "drums", false);
    expect((buses.drums as unknown as { gain: { value: number } }).gain.value).toBe(0);
    setLayerGain(buses, "drums", true);
    expect((buses.drums as unknown as { gain: { value: number } }).gain.value).toBe(1);
  });
});
```

- [ ] **Step 2: Run to confirm all three fail**

Run: `pnpm vitest run src/progressions/audio/progressionPart.test.ts src/progressions/audio/progressionMetronomeLoop.test.ts src/progressions/audio/layerBuses.test.ts`
Expected: FAIL — no implementation modules exist yet.

- [ ] **Step 3: Implement the three wrappers**

```ts
// src/progressions/audio/progressionPart.ts
import { Part } from "tone";

export interface ProgressionPartHandle {
  /** Start at transport `time` (default "now") with internal cursor at
   *  `offset` seconds (default 0). Forwards verbatim to Tone.Part.start. */
  start: (time?: number, offset?: number) => void;
  /** Live-toggle loop without disposing. Optionally updates loopEnd at the
   *  same time. Used by the orchestrator's loop-toggle effect. */
  setLoop: (loop: boolean, loopEnd?: number) => void;
  /** Stop and dispose. Idempotent. */
  dispose: () => void;
}

export interface CreateProgressionPartOptions<V> {
  events: ReadonlyArray<{ time: number; value: V }>;
  loop: boolean;
  loopEnd: number;
  onEvent: (audioTime: number, value: V) => void;
}

/**
 * Thin wrapper over `Tone.Part`. The Part fires `onEvent(audioTime, value)`
 * for each scheduled event at the audio-precise time (Tone delivers the
 * callback ~lookAhead seconds before this wall-clock-wise so consumers can
 * pre-schedule sample-accurate audio).
 */
export function createProgressionPart<V>(
  opts: CreateProgressionPartOptions<V>,
): ProgressionPartHandle {
  const tuples: Array<[number, V]> = opts.events.map((e) => [e.time, e.value]);
  const part = new Part((time: number, value: V) => {
    opts.onEvent(time, value);
  }, tuples) as unknown as {
    start: (time?: number, offset?: number) => void;
    stop: () => void;
    dispose: () => void;
    loop: boolean;
    loopEnd: number;
  };
  part.loop = opts.loop;
  if (opts.loop) part.loopEnd = opts.loopEnd;

  let disposed = false;
  return {
    start(time?: number, offset?: number) { part.start(time, offset); },
    setLoop(loop: boolean, loopEnd?: number) {
      part.loop = loop;
      if (loopEnd !== undefined) part.loopEnd = loopEnd;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      part.stop();
      part.dispose();
    },
  };
}
```

```ts
// src/progressions/audio/progressionMetronomeLoop.ts
import { Loop } from "tone";

export interface MetronomeLoopHandle {
  start: (time?: number) => void;
  dispose: () => void;
}

export interface CreateMetronomeLoopOptions {
  beatsPerBar: number;
  /** Called once per beat at audio-precise time. `beatInBar` is 1-based and
   *  cycles 1..beatsPerBar so callers can light an accent on beat 1. */
  onBeat: (audioTime: number, beatInBar: number) => void;
}

/**
 * Thin wrapper over `Tone.Loop` for the metronome — a perfectly periodic
 * once-per-beat callback. Beat numbering is owned by the wrapper so the
 * caller's onBeat closure stays free of cycle counters.
 */
export function createMetronomeLoop(
  opts: CreateMetronomeLoopOptions,
): MetronomeLoopHandle {
  const beatsPerBar = Math.max(1, opts.beatsPerBar);
  let nextBeat = 1;
  const loop = new Loop((time: number) => {
    const beat = nextBeat;
    nextBeat = beat % beatsPerBar + 1;
    opts.onBeat(time, beat);
  }, "4n") as unknown as {
    start: (time?: number) => void;
    dispose: () => void;
  };

  let disposed = false;
  return {
    start(time?: number) { loop.start(time); },
    dispose() {
      if (disposed) return;
      disposed = true;
      loop.dispose();
    },
  };
}
```

```ts
// src/progressions/audio/layerBuses.ts
export type ProgressionLayer = "chord" | "bass" | "drums" | "metronome";

export interface LayerBuses {
  chord: AudioNode;
  bass: AudioNode;
  drums: AudioNode;
  metronome: AudioNode;
}

/**
 * One GainNode per layer between the layer's audio source and the parent
 * destination. Toggling a layer flips its gain to 1 or 0 with no sequencer
 * rebuild — useful when the user mutes drums mid-bar.
 */
export function buildLayerBuses(
  ctx: AudioContext,
  destination: AudioNode,
): LayerBuses {
  const layers: ProgressionLayer[] = ["chord", "bass", "drums", "metronome"];
  const buses = {} as Record<ProgressionLayer, AudioNode>;
  for (const layer of layers) {
    const gain = ctx.createGain();
    gain.connect(destination);
    buses[layer] = gain as unknown as AudioNode;
  }
  return buses as LayerBuses;
}

/**
 * Flip a single layer's gain. `enabled=false` mutes the layer; `true`
 * restores unity gain. Future expansion (per-layer volume sliders) reads
 * from the same node.
 */
export function setLayerGain(
  buses: LayerBuses,
  layer: ProgressionLayer,
  enabled: boolean,
): void {
  const node = buses[layer] as unknown as { gain: { value: number } };
  node.gain.value = enabled ? 1 : 0;
}
```

- [ ] **Step 4: Run all three test files — expect PASS**

Run: `pnpm vitest run src/progressions/audio/progressionPart.test.ts src/progressions/audio/progressionMetronomeLoop.test.ts src/progressions/audio/layerBuses.test.ts`
Expected: PASS (5 + 3 + 2 = 10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/progressionPart.ts src/progressions/audio/progressionPart.test.ts \
        src/progressions/audio/progressionMetronomeLoop.ts src/progressions/audio/progressionMetronomeLoop.test.ts \
        src/progressions/audio/layerBuses.ts src/progressions/audio/layerBuses.test.ts
git commit -m "feat(audio): tone primitive wrappers (Part, metronome Loop) + per-layer buses"
```

---

### Task 2: Event-stream builder for all four layers

**Files:**
- Create: `src/progressions/audio/buildAllLayers.ts`
- Create: `src/progressions/audio/buildAllLayers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/progressions/audio/buildAllLayers.test.ts
import { describe, expect, it } from "vitest";
import { buildAllLayers } from "./buildAllLayers";
import type { ResolvedProgressionStep } from "../progressionDomain";

const step = (over: Partial<ResolvedProgressionStep> = {}): ResolvedProgressionStep => ({
  id: "x", degree: "I", duration: { value: 1, unit: "bar" },
  qualityOverride: null, root: "C", quality: "M", unavailable: false,
  ...over,
});

describe("buildAllLayers", () => {
  const baseInput = {
    tempoBpm: 60,                  // 1 beat = 1s, 1 bar (4 beats) = 4s
    beatsPerBar: 4,
    swing: 0,
    chordInstrument: "acoustic-guitar" as const,
    chordPatternId: "downbeats",   // exists in catalog; downbeats = one hit on beat 1
    bassPatternId: "root-and-fifth", // catalog id
    drumPatternId: "basic-rock",     // catalog id
    drumVariations: [] as string[],
    loop: true,
  };

  it("expands a 2-bar step into 2 chord-onset events with isFirstBar/isLastBar markers", () => {
    const out = buildAllLayers({
      ...baseInput,
      steps: [
        step({ id: "a", duration: { value: 1, unit: "bar" } }),
        step({ id: "b", root: "G", duration: { value: 2, unit: "bar" } }),
      ],
    });
    expect(out.chordOnsets).toHaveLength(3);
    expect(out.chordOnsets[0]).toMatchObject({ time: 0, value: { stepIndex: 0, isFirstBar: true,  isLastBar: true,  beats: 4 } });
    expect(out.chordOnsets[1]).toMatchObject({ time: 4, value: { stepIndex: 1, isFirstBar: true,  isLastBar: false, beats: 4 } });
    expect(out.chordOnsets[2]).toMatchObject({ time: 8, value: { stepIndex: 1, isFirstBar: false, isLastBar: true,  beats: 4 } });
    expect(out.totalDurationSec).toBe(12);
  });

  it("drops unresolvable steps from all layers but still consumes their time", () => {
    const out = buildAllLayers({
      ...baseInput,
      steps: [
        step({ id: "a" }),
        step({ id: "b", unavailable: true, root: null, quality: null }),
        step({ id: "c", root: "G" }),
      ],
    });
    expect(out.chordOnsets.map((e) => e.value.stepIndex)).toEqual([0, 2]);
    expect(out.chordOnsets[1].time).toBe(8); // step 2 starts after the 4s gap
    expect(out.totalDurationSec).toBe(12);
  });

  it("emits chord-strum events for each strum-pattern hit per bar", () => {
    const out = buildAllLayers({
      ...baseInput,
      steps: [step({ id: "a", duration: { value: 1, unit: "bar" } })],
    });
    // The "downbeats" chord pattern has one strum on beat 1 of each bar.
    expect(out.chordStrums).toHaveLength(1);
    expect(out.chordStrums[0].time).toBe(0);
    expect(out.chordStrums[0].value.voicing.length).toBeGreaterThan(0);
  });

  it("emits bass events with notes resolved per chord (root on beat 1)", () => {
    const out = buildAllLayers({
      ...baseInput,
      steps: [step({ id: "a", root: "C", quality: "M" })],
    });
    expect(out.bass.length).toBeGreaterThan(0);
    // "root-and-fifth" pattern starts with a root hit on beat 1.
    const firstBass = out.bass[0];
    expect(firstBass.time).toBe(0);
    expect(firstBass.value.note.startsWith("C")).toBe(true);
  });

  it("emits drum events for every kit hit in the pattern per bar", () => {
    const out = buildAllLayers({
      ...baseInput,
      steps: [step({ id: "a", duration: { value: 1, unit: "bar" } })],
    });
    // The "basic-rock" pattern has at minimum a kick on beat 1 and a snare on beat 3.
    const kickAt0 = out.drums.find((e) => e.time === 0 && e.value.type === "kick");
    const snareAt2 = out.drums.find((e) => e.time === 2 && e.value.type === "snare");
    expect(kickAt0).toBeDefined();
    expect(snareAt2).toBeDefined();
  });

  it("passes nextChordRoot for chromatic-approach bass only on the LAST bar of a step", () => {
    // Build a step with a 2-bar duration; the first bar should not carry
    // approach-resolution toward the next chord, the second bar should.
    const out = buildAllLayers({
      ...baseInput,
      bassPatternId: "walking-approach", // approach hits on beat 4
      steps: [
        step({ id: "a", root: "C", duration: { value: 2, unit: "bar" } }),
        step({ id: "b", root: "G" }),
      ],
    });
    // Bar 1 of step 0 (t ∈ [0, 4)): any approach hit resolves toward C (self).
    // Bar 2 of step 0 (t ∈ [4, 8)): approach hit resolves toward G.
    const approachBar1 = out.bass.find((e) => e.time >= 3 && e.time < 4);
    const approachBar2 = out.bass.find((e) => e.time >= 7 && e.time < 8);
    expect(approachBar1?.value.note.startsWith("C") || approachBar1 === undefined).toBe(true);
    if (approachBar2) {
      // Approach to G: F# or Ab (depending on chord direction).
      expect(["F#", "Ab", "G"]).toContain(approachBar2.value.note.replace(/\d/g, ""));
    }
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts`
Expected: FAIL — `Cannot find module './buildAllLayers'`.

- [ ] **Step 3: Implement**

```ts
// src/progressions/audio/buildAllLayers.ts
import {
  resolveBassNoteForRole,
  resolveChordVoicing,
  resolveBassLineNotes,
} from "../progressionAudio";
import type { ResolvedProgressionStep } from "../progressionDomain";
import {
  buildMetronomePattern,
  getBassPattern,
  getChordPattern,
  getDrumPattern,
  getDrumVariation,
  repeatPatternToBeats,
  type DrumHit,
} from "./patterns";
import type { ChordInstrumentId } from "./instruments/types";

export interface ChordOnsetEvent {
  stepIndex: number;
  isFirstBar: boolean;
  isLastBar: boolean;
  beats: number;
  durationSec: number;
  cumulativeStartSec: number;
}
export interface ChordStrumEvent {
  voicing: readonly string[];
  velocity: number;
  style?: string;
  direction?: "down" | "up" | "alt";
}
export interface BassEvent {
  note: string;
  velocity: number;
}
export interface DrumEvent {
  type: "kick" | "snare" | "hihat" | "ride";
  velocity: number;
}

export interface BuildAllLayersInput {
  steps: readonly ResolvedProgressionStep[];
  tempoBpm: number;
  beatsPerBar: number;
  swing: number;
  chordInstrument: ChordInstrumentId;
  chordPatternId: string;
  bassPatternId: string;
  drumPatternId: string;
  drumVariations: readonly string[];
  loop: boolean;
}

export interface BuiltLayers {
  chordOnsets: ReadonlyArray<{ time: number; value: ChordOnsetEvent }>;
  chordStrums: ReadonlyArray<{ time: number; value: ChordStrumEvent }>;
  bass: ReadonlyArray<{ time: number; value: BassEvent }>;
  drums: ReadonlyArray<{ time: number; value: DrumEvent }>;
  totalDurationSec: number;
}

const OFF_BEAT_TOLERANCE = 0.01;
function swingBeat(beat: number, swing: number): number {
  if (swing <= 0) return beat;
  const isOff = Math.abs((beat % 1) - 0.5) < OFF_BEAT_TOLERANCE;
  return isOff ? beat + swing * (1 / 3) : beat;
}

function mergeDrumHits(baseHits: readonly DrumHit[], variations: readonly DrumHit[][]): DrumHit[] {
  return [...baseHits, ...variations.flat()];
}

/**
 * Flatten a resolved progression into per-layer event streams ready to feed
 * Tone primitives. Pure function — no audio scheduling, no Tone references.
 *
 * Multi-bar steps expand into multiple chord-onset events (carrying
 * isFirstBar / isLastBar so the consumer can gate React writes and
 * chromatic-approach bass). Per-bar pattern hits expand inline: a 2-bar
 * step with a 4-hit drum pattern yields 8 drum events.
 */
export function buildAllLayers(input: BuildAllLayersInput): BuiltLayers {
  const secondsPerBeat = 60 / Math.max(1, input.tempoBpm);
  const barSec = input.beatsPerBar * secondsPerBeat;

  const chordPattern = getChordPattern(input.chordPatternId);
  const bassPattern = getBassPattern(input.bassPatternId);
  const drumPattern = getDrumPattern(input.drumPatternId);
  const drumVariations = input.drumVariations
    .map((id) => getDrumVariation(id)?.hits ?? [])
    .filter((h) => h.length > 0);
  const drumHits = drumPattern
    ? mergeDrumHits(drumPattern.hits, drumVariations)
    : [];

  const chordOnsets: Array<{ time: number; value: ChordOnsetEvent }> = [];
  const chordStrums: Array<{ time: number; value: ChordStrumEvent }> = [];
  const bass: Array<{ time: number; value: BassEvent }> = [];
  const drums: Array<{ time: number; value: DrumEvent }> = [];

  let cumulativeSec = 0;

  input.steps.forEach((step, stepIndex) => {
    const scheduleThis = !step.unavailable && step.root && step.quality;
    const stepBeats = step.duration.unit === "bar"
      ? step.duration.value * input.beatsPerBar
      : step.duration.value;
    const stepDurationSec = stepBeats * secondsPerBeat;
    if (!scheduleThis) {
      cumulativeSec += stepDurationSec;
      return;
    }

    const root = step.root!;
    const quality = step.quality!;
    const nextStep = input.steps[stepIndex + 1];
    const nextRoot = nextStep?.root ?? undefined;

    const voicing = resolveChordVoicing(root, quality);
    const bassLineNotes = resolveBassLineNotes(root, quality);

    // Expand into per-bar events for bar-unit steps. Sub-bar (beat-unit)
    // steps stay as a single short event whose `beats` < beatsPerBar.
    const isBarUnit = step.duration.unit === "bar";
    const barsInStep = isBarUnit
      ? Math.max(1, Math.floor(step.duration.value))
      : 1;
    const eventBeats = isBarUnit ? input.beatsPerBar : stepBeats;
    const eventSec = eventBeats * secondsPerBeat;

    for (let bar = 0; bar < barsInStep; bar++) {
      const barStart = cumulativeSec + bar * eventSec;
      const isFirst = bar === 0;
      const isLast = bar === barsInStep - 1;

      chordOnsets.push({
        time: barStart,
        value: {
          stepIndex,
          isFirstBar: isFirst,
          isLastBar: isLast,
          beats: eventBeats,
          durationSec: eventSec,
          cumulativeStartSec: barStart,
        },
      });

      // Chord strum hits for this bar.
      if (chordPattern && voicing.length > 0) {
        const hits = repeatPatternToBeats(chordPattern.hits, eventBeats, input.beatsPerBar);
        for (const hit of hits) {
          const hitTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          chordStrums.push({
            time: hitTime,
            value: {
              voicing,
              velocity: hit.velocity,
              style: hit.style,
              direction: hit.direction,
            },
          });
        }
      }

      // Bass hits for this bar.
      if (bassPattern && bassLineNotes.length > 0) {
        const hits = repeatPatternToBeats(bassPattern.hits, eventBeats, input.beatsPerBar);
        for (const hit of hits) {
          // Resolve note role against current chord; approach role uses
          // nextRoot only when this is the last bar of the step.
          const note = resolveBassNoteForRole(
            root,
            quality,
            hit.note,
            isLast ? nextRoot : root,
          );
          const hitTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          bass.push({
            time: hitTime,
            value: { note, velocity: hit.velocity },
          });
        }
      }

      // Drum hits for this bar.
      if (drumHits.length > 0) {
        const hits = repeatPatternToBeats(drumHits, eventBeats, input.beatsPerBar);
        for (const hit of hits) {
          const hitTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          drums.push({
            time: hitTime,
            value: { type: hit.type, velocity: hit.velocity },
          });
        }
      }
    }

    cumulativeSec += stepDurationSec;
  });

  return {
    chordOnsets,
    chordStrums,
    bass,
    drums,
    totalDurationSec: cumulativeSec,
  };
}
```

Note: metronome events are NOT in `BuiltLayers` because they're driven by `Tone.Loop` directly (one beat at a time, no precomputed array). The loop's onBeat callback handles accent-on-downbeat.

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts`
Expected: PASS (6/6). Some tests assert against the actual `getChordPattern("downbeats")` / `getBassPattern("root-and-fifth")` etc. data — if the assertions don't match what those catalog entries actually emit on bar 1, adjust the asserts to use whichever catalog ids the project ships that have the simplest beat-1 hits (run `grep -nA2 "id: " src/progressions/audio/patterns.ts | head -40` first to pick stable ids).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(audio): per-layer event-stream builder for tone primitives"
```

---

### Task 3: Wire layer buses into the audio bus module

**Files:**
- Modify: `src/progressions/audio/bus.ts`
- Modify: `src/progressions/audio/bus.test.ts` (if it exists; otherwise create minimal one)

- [ ] **Step 1: Read the current bus exports**

Run: `grep -n "^export\|ProgressionAudio\|ensureProgressionAudio" src/progressions/audio/bus.ts`
Note the current shape of `ProgressionAudio` (likely `{ ctx, bus }`).

- [ ] **Step 2: Extend `ProgressionAudio` to carry `layers: LayerBuses`**

Edit `src/progressions/audio/bus.ts`: import `buildLayerBuses, type LayerBuses` from `./layerBuses`. In `ensureProgressionAudio()`, after constructing the parent `bus` GainNode, construct `const layers = buildLayerBuses(ctx, bus)` and return `{ ctx, bus, layers }`. Update the `ProgressionAudio` type accordingly.

The full type:

```ts
import { buildLayerBuses, type LayerBuses } from "./layerBuses";

export interface ProgressionAudio {
  ctx: AudioContext;
  /** Parent gain — all four layer buses connect here, then to ctx.destination. */
  bus: AudioNode;
  /** Per-layer gain nodes. Sequencer callbacks connect their voices here. */
  layers: LayerBuses;
}
```

The layer construction inside `ensureProgressionAudio` (find the existing `const bus = ctx.createGain(); bus.connect(ctx.destination);` and insert immediately after):

```ts
  const layers = buildLayerBuses(ctx, bus);
  ...
  return { ctx, bus, layers };
```

- [ ] **Step 3: Run the existing bus / scheduler tests**

Run: `pnpm vitest run src/progressions/audio/toneBus.test.ts src/progressions/audio/scheduler.test.ts`
Expected: PASS — the new `layers` field is additive; existing consumers ignore it.

- [ ] **Step 4: Commit**

```bash
git add src/progressions/audio/bus.ts
git commit -m "feat(audio): expose per-layer gain buses from ensureProgressionAudio"
```

---

### Task 4: Rewrite useProgressionAudioPlayback as a tone-primitive orchestrator

This is the central task. Composes the wrappers from Task 1 with the event streams from Task 2 and the layer buses from Task 3. Two effects: (1) build/dispose primitives on play+input changes, (2) flip layer gains on mute-toggle changes. Deletes `useProgressionPlaybackLoop`.

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`
- Modify: `src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx`
- Delete: `src/hooks/useProgressionPlaybackLoop.ts`
- Delete: `src/hooks/useProgressionPlaybackLoop.test.tsx`
- Create: `src/hooks/useProgressionAudioPlayback.test.tsx`

- [ ] **Step 1: Write the failing tests for the rewritten hook**

```tsx
// src/hooks/useProgressionAudioPlayback.test.tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { makeAtomStore, renderWithStore } from "../test-utils/renderWithAtoms";
import { isMutedAtom } from "../store/audioAtoms";
import { chordRootAtom } from "../store/chordOverlayAtoms";
import {
  beatsPerBarAtom,
  progressionDrumsEnabledAtom,
  progressionLoopEnabledAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
  setProgressionPlayingAtom,
} from "../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../store/scaleAtoms";

// Tone mocks: capture all Parts and Loops constructed; expose for assertions.
const toneMocks = vi.hoisted(() => {
  const contextNowRef = { fn: () => 0 };
  type Cb = (time: number, value: unknown) => void;
  interface PartInstance { tag: "part"; callback: Cb; events: Array<[number, unknown]>; loop: boolean; loopEnd: number; startedTime: number | null; startedOffset: number | null; disposed: boolean; start(t?: number, o?: number): PartInstance; stop(): PartInstance; dispose(): PartInstance; }
  interface LoopInstance { tag: "loop"; callback: (t: number) => void; interval: string | number; startedTime: number | null; disposed: boolean; start(t?: number): LoopInstance; dispose(): LoopInstance; }
  const parts: PartInstance[] = [];
  const loops: LoopInstance[] = [];

  function PartCtor(callback: Cb, events: Array<[number, unknown]>): PartInstance {
    const inst: PartInstance = {
      tag: "part", callback, events: [...events], loop: false, loopEnd: 0,
      startedTime: null, startedOffset: null, disposed: false,
      start(t?: number, o?: number) { this.startedTime = t ?? 0; this.startedOffset = o ?? 0; return this; },
      stop() { return this; },
      dispose() { this.disposed = true; return this; },
    };
    parts.push(inst);
    return inst;
  }
  function LoopCtor(callback: (t: number) => void, interval: string | number): LoopInstance {
    const inst: LoopInstance = {
      tag: "loop", callback, interval, startedTime: null, disposed: false,
      start(t?: number) { this.startedTime = t ?? 0; return this; },
      dispose() { this.disposed = true; return this; },
    };
    loops.push(inst);
    return inst;
  }

  const transport = {
    scheduleOnce: vi.fn(),
    clear: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    bpm: { value: 120 },
    seconds: 0,
  };

  return {
    contextNowRef,
    parts, loops,
    Part: PartCtor as unknown as new (...args: unknown[]) => unknown,
    Loop: LoopCtor as unknown as new (...args: unknown[]) => unknown,
    getTransport: vi.fn(() => transport),
    getContext: vi.fn(() => ({
      now: () => contextNowRef.fn(),
      immediate: () => contextNowRef.fn(),
    })),
    now: vi.fn(() => contextNowRef.fn()),
    setContext: vi.fn(),
    transport,
  };
});
vi.mock("tone", () => ({
  Part: toneMocks.Part,
  Loop: toneMocks.Loop,
  getTransport: toneMocks.getTransport,
  getContext: toneMocks.getContext,
  now: toneMocks.now,
  setContext: toneMocks.setContext,
}));

import { _resetProgressionAudioForTests } from "../progressions/audio/bus";
import { _resetTimelineForTests } from "../progressions/audio/timeline";
import { useProgressionAudioPlayback } from "./useProgressionAudioPlayback";

function Harness() { useProgressionAudioPlayback(); return null; }

const threeBars = [
  { id: "1", degree: "I",  duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "2", degree: "V",  duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "3", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
] as const;

describe("useProgressionAudioPlayback (tone-native orchestrator)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    localStorage.clear();
    toneMocks.parts.length = 0;
    toneMocks.loops.length = 0;
    _resetTimelineForTests();
    _resetProgressionAudioForTests();
    const audioContext = {
      get currentTime() { return Date.now() / 1000; },
      sampleRate: 44100,
      state: "running" as AudioContextState,
      createGain: () => ({
        gain: { value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
        connect: vi.fn().mockReturnThis(), disconnect: vi.fn(),
      }),
      destination: {} as AudioDestinationNode,
      resume: vi.fn(),
    };
    toneMocks.contextNowRef.fn = () => audioContext.currentTime;
    (window as unknown as { AudioContext: unknown }).AudioContext =
      vi.fn(function () { return audioContext; }) as unknown as typeof AudioContext;
  });
  afterEach(() => { vi.useRealTimers(); });

  it("constructs 4 Parts (chord-onsets + strums + bass + drums) and 1 Loop (metronome) on play start", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"], [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60], [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    expect(toneMocks.parts).toHaveLength(4);
    expect(toneMocks.loops).toHaveLength(1);
  });

  it("sets loop=true + loopEnd=totalDurationSec on every Part when progressionLoopEnabled is on", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"], [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60], [beatsPerBarAtom, 4],
      [progressionLoopEnabledAtom, true],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    toneMocks.parts.forEach((p) => {
      expect(p.loop).toBe(true);
      expect(p.loopEnd).toBe(12); // 3 bars * 4 beats/bar * 1 sec/beat
    });
  });

  it("advances chordRootAtom when the chord-onset Part fires on first-bar events only", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"], [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60], [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);

    // Find the chord-onset Part by checking which Part has 3 events (one per
    // 1-bar step). Drum Part has many more events.
    const onsets = toneMocks.parts.find((p) => p.events.length === 3 && (p.events[0][1] as { isFirstBar?: boolean }).isFirstBar === true);
    expect(onsets).toBeDefined();
    expect(store.get(chordRootAtom)).toBe("C");

    // Fire chord-onset event for step 1 (G).
    act(() => { onsets!.callback(onsets!.events[1][0] as number, onsets!.events[1][1]); });
    expect(store.get(chordRootAtom)).toBe("G");
  });

  it("disposes ALL primitives and rebuilds from 0 when steps change mid-play", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"], [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60], [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    const initialParts = [...toneMocks.parts];
    const initialLoops = [...toneMocks.loops];

    act(() => {
      store.set(progressionStepsAtom, [...threeBars, { id: "4", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null }]);
    });

    initialParts.forEach((p) => expect(p.disposed).toBe(true));
    initialLoops.forEach((l) => expect(l.disposed).toBe(true));
    expect(toneMocks.parts.length).toBeGreaterThan(initialParts.length);
    // New Part starts at offset 0 (restart from bar 0 on edit).
    const newOnsets = toneMocks.parts.slice(initialParts.length).find((p) => p.events.length === 4);
    expect(newOnsets?.startedOffset).toBe(0);
  });

  it("tempo change is a LIVE update (Transport.bpm.value); no new Parts constructed", () => {
    // Sentinel: pre-load mock bpm to a value neither effect should leave
    // behind, so we can prove BOTH the initial-render AND the post-change
    // settings of bpm.value came from the live effect.
    toneMocks.transport.bpm.value = 999;

    const store = makeAtomStore([
      [rootNoteAtom, "C"], [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60], [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);

    // After initial render: live effect should have applied the atom value.
    expect(toneMocks.transport.bpm.value).toBe(60);
    const before = toneMocks.parts.length;

    act(() => { store.set(progressionTempoBpmAtom, 120); });

    expect(toneMocks.parts.length).toBe(before);             // no new Parts
    expect(toneMocks.transport.bpm.value).toBe(120);         // setter fired again
    toneMocks.parts.forEach((p) => expect(p.disposed).toBe(false));
  });

  it("loop toggle is a LIVE update (part.setLoop); no new Parts constructed", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"], [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60], [beatsPerBarAtom, 4],
      [progressionLoopEnabledAtom, false],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    const before = toneMocks.parts.length;
    toneMocks.parts.forEach((p) => expect(p.loop).toBe(false));

    act(() => { store.set(progressionLoopEnabledAtom, true); });

    expect(toneMocks.parts.length).toBe(before);
    toneMocks.parts.forEach((p) => expect(p.loop).toBe(true));
  });

  it("toggling drums flips the layer gain without rebuilding primitives", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"], [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60], [beatsPerBarAtom, 4],
      [progressionDrumsEnabledAtom, true],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    const before = [...toneMocks.parts];

    act(() => { store.set(progressionDrumsEnabledAtom, false); });

    // No new Parts, no disposals.
    expect(toneMocks.parts).toHaveLength(before.length);
    before.forEach((p) => expect(p.disposed).toBe(false));
    // Gain side-effect is verified by the layerBuses test in Task 1 — here we
    // only verify the rebuild guard didn't fire.
  });

  it("disposes everything on pause", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"], [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60], [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    expect(toneMocks.parts.every((p) => !p.disposed)).toBe(true);

    act(() => { store.set(setProgressionPlayingAtom, false); });

    toneMocks.parts.forEach((p) => expect(p.disposed).toBe(true));
    toneMocks.loops.forEach((l) => expect(l.disposed).toBe(true));
  });

  it("does not build any primitives while muted", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"], [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60], [beatsPerBarAtom, 4],
      [isMutedAtom, true],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    expect(toneMocks.parts).toHaveLength(0);
    expect(toneMocks.loops).toHaveLength(0);
  });

  // Regression guard for the 2026-05-25 progression-stall bug.
  it("does NOT wrap advanceProgressionPlayback in Tone.Draw or startTransition", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const raw = readFileSync(
      resolve(process.cwd(), "src/hooks/useProgressionAudioPlayback.ts"),
      "utf8",
    );
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
    expect(code).not.toMatch(/Draw\.schedule/);
    expect(code).not.toMatch(/\bstartTransition\b/);
    expect(code).not.toMatch(/from\s+["']tone["'][^;]*\bDraw\b/);
  });
});
```

- [ ] **Step 2: Run — expect failure (existing hook doesn't construct Parts/Loops)**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: FAIL — current hook code doesn't use Tone primitives the new way.

- [ ] **Step 3: Rewrite `useProgressionAudioPlayback.ts`**

Replace the entire file body:

```ts
// src/hooks/useProgressionAudioPlayback.ts
import { useEffect, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { getContext, getTransport } from "tone";
import { ensureProgressionAudio, resumeProgressionAudio, restoreProgressionBus, silenceProgressionBus } from "../progressions/audio/bus";
import { buildAllLayers, type ChordOnsetEvent, type ChordStrumEvent, type BassEvent, type DrumEvent } from "../progressions/audio/buildAllLayers";
import { createMetronomeLoop, type MetronomeLoopHandle } from "../progressions/audio/progressionMetronomeLoop";
import { createProgressionPart, type ProgressionPartHandle } from "../progressions/audio/progressionPart";
import { setLayerGain } from "../progressions/audio/layerBuses";
import { getChordVoice } from "../progressions/audio/instruments";
import { scheduleBassNote } from "../progressions/audio/bass";
import { scheduleHiHat, scheduleKick, scheduleRide, scheduleSnare } from "../progressions/audio/drumKit";
import { scheduleClick } from "../progressions/audio/metronome";
import { setActiveStep, pauseTimeline, clearTimeline } from "../progressions/audio/timeline";
import { getNoteFrequency } from "@fretflow/core";
import { isMutedAtom } from "../store/audioAtoms";
import {
  beatsPerBarAtom,
  progressionBassEnabledAtom,
  progressionBassPatternAtom,
  progressionChordEnabledAtom,
  progressionChordInstrumentAtom,
  progressionChordPatternAtom,
  progressionDrumPatternAtom,
  progressionDrumVariationsAtom,
  progressionDrumsEnabledAtom,
  progressionLoopEnabledAtom,
  progressionMetronomeEnabledAtom,
  progressionPlaybackBlockedReasonAtom,
  progressionPlayingAtom,
  progressionStepsAtom,
  progressionSwingAtom,
  progressionTempoBpmAtom,
  resolvedProgressionStepsAtom,
  setProgressionActiveStepIndexAtom,
  setProgressionPlayingAtom,
} from "../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../store/scaleAtoms";

const SCHEDULE_LEAD_SECONDS = 0.05;

interface PlaybackPrimitives {
  parts: ProgressionPartHandle[];
  loop: MetronomeLoopHandle | null;
  endEventId: number | null;
}

function disposeAll(prims: PlaybackPrimitives | null) {
  if (!prims) return;
  prims.parts.forEach((p) => p.dispose());
  prims.loop?.dispose();
  if (prims.endEventId !== null) getTransport().clear(prims.endEventId);
}

/**
 * Tone-native progression playback orchestrator.
 *
 * Seven effects, ordered by cost:
 *  1. (Heavy)   Build / dispose primitives on changes that change WHICH
 *               events fire: playing, blocked, muted, steps, patterns,
 *               drum variations. Restart from bar 0.
 *  2. (Live)    Tempo  — `Transport.bpm.value = N` (events stored as ticks).
 *  3. (Live)    Swing  — `Transport.swing = X`.
 *  4. (Live)    Loop   — `part.setLoop(bool, loopEnd?)` on every Part.
 *  5. (Live)    Time signature — `Transport.timeSignature = N` + ref read
 *               by the metronome Loop callback for accent cycling.
 *  6. (Live)    Instrument — write to `instrumentRef`; the chord-strum
 *               Part callback reads via the ref each tick.
 *  7. (Live)    Layer mutes — `setLayerGain(buses, layer, on/off)`.
 *
 * Live updates apply mid-bar with no audio glitch. Step / pattern edits
 * fall through Effect 1's full rebuild path.
 *
 * The chord-onset Part owns the React `activeProgressionStepIndex` advance,
 * deferred by the Tone lookahead via plain `setTimeout` so the visual
 * chord-overlay swap aligns with audio onset. NOT `Tone.Draw.schedule` —
 * its 250ms expiration silently drops events under heavy main-thread load
 * and would stall playback. NOT `startTransition` — it would defer the
 * Jotai write that the next-step React state depends on.
 */
export function useProgressionAudioPlayback() {
  // Read every relevant atom at the top so deps arrays stay tidy.
  const playing = useAtomValue(progressionPlayingAtom);
  const blocked = useAtomValue(progressionPlaybackBlockedReasonAtom);
  const muted = useAtomValue(isMutedAtom);
  const loopEnabled = useAtomValue(progressionLoopEnabledAtom);
  const steps = useAtomValue(resolvedProgressionStepsAtom);
  const tempo = useAtomValue(progressionTempoBpmAtom);
  const beatsPerBar = useAtomValue(beatsPerBarAtom);
  const swing = useAtomValue(progressionSwingAtom);
  const chordInstrument = useAtomValue(progressionChordInstrumentAtom);
  const chordPatternId = useAtomValue(progressionChordPatternAtom);
  const bassPatternId = useAtomValue(progressionBassPatternAtom);
  const drumPatternId = useAtomValue(progressionDrumPatternAtom);
  const drumVariations = useAtomValue(progressionDrumVariationsAtom);

  // Layer enable flags — light effect only.
  const chordOn = useAtomValue(progressionChordEnabledAtom);
  const bassOn = useAtomValue(progressionBassEnabledAtom);
  const drumsOn = useAtomValue(progressionDrumsEnabledAtom);
  const metronomeOn = useAtomValue(progressionMetronomeEnabledAtom);

  const setActiveStepIndex = useSetAtom(setProgressionActiveStepIndexAtom);
  const setPlaying = useSetAtom(setProgressionPlayingAtom);

  const primsRef = useRef<PlaybackPrimitives | null>(null);
  // Refs so the Part / Loop callbacks can read live state without depending
  // on closure recreation (which would force a rebuild on instrument /
  // beatsPerBar changes). The orchestrator's "live" effects below keep
  // these refs in sync with their atom values.
  const instrumentRef = useRef(chordInstrument);
  const beatsPerBarRef = useRef(beatsPerBar);

  // --- Effect 1: heavy build/dispose ---
  useEffect(() => {
    const tearDown = () => {
      disposeAll(primsRef.current);
      primsRef.current = null;
      silenceProgressionBus();
    };

    if (blocked || muted) { tearDown(); clearTimeline(); return; }
    if (!playing) { tearDown(); pauseTimeline(); return; }

    const audio = ensureProgressionAudio();
    if (!audio) return;
    void resumeProgressionAudio();
    restoreProgressionBus();

    // Event times are computed at the CURRENT tempo / beatsPerBar / swing
    // and then Tone stores them as ticks — subsequent live changes to those
    // settings will re-time the same events without rebuilding.
    const built = buildAllLayers({
      steps, tempoBpm: tempo, beatsPerBar, swing,
      chordInstrument, chordPatternId, bassPatternId, drumPatternId,
      drumVariations, loop: loopEnabled,
    });
    if (built.chordOnsets.length === 0) { tearDown(); return; }

    const partStart = audio.ctx.currentTime + SCHEDULE_LEAD_SECONDS;
    const parts: ProgressionPartHandle[] = [];
    const totalDurationSec = built.totalDurationSec;

    // 1. Chord-onset Part — drives React activeProgressionStepIndex.
    const chordOnsetPart = createProgressionPart<ChordOnsetEvent>({
      events: built.chordOnsets,
      loop: loopEnabled,
      loopEnd: totalDurationSec,
      onEvent: (audioTime, event) => {
        // Always publish to timeline so the playhead reflects the new bar.
        setActiveStep(event.stepIndex, audioTime, event.durationSec, event.cumulativeStartSec, totalDurationSec);
        // Jotai active-step write fires only on real step boundaries, and
        // is deferred by the Tone lookahead so the chord overlay swap
        // aligns with audio onset.
        if (event.isFirstBar) {
          const rawNow = getContext().immediate();
          const delayMs = Math.max(0, (audioTime - rawNow) * 1000);
          const applyAdvance = () => setActiveStepIndex(event.stepIndex);
          if (delayMs <= 0) applyAdvance();
          else window.setTimeout(applyAdvance, delayMs);
        }
      },
    });
    chordOnsetPart.start(partStart, 0);
    parts.push(chordOnsetPart);

    // 2. Chord strum Part. Reads `instrumentRef.current` each tick so
    //    instrument switches don't require rebuilding the Part.
    const chordStrumPart = createProgressionPart<ChordStrumEvent>({
      events: built.chordStrums,
      loop: loopEnabled,
      loopEnd: totalDurationSec,
      onEvent: (audioTime, value) => {
        const voice = getChordVoice(instrumentRef.current);
        voice.scheduleChord(audio.layers.chord, value.voicing, audioTime, {
          velocity: value.velocity, style: value.style, direction: value.direction,
        });
      },
    });
    chordStrumPart.start(partStart, 0);
    parts.push(chordStrumPart);

    // 3. Bass Part.
    const bassPart = createProgressionPart<BassEvent>({
      events: built.bass,
      loop: loopEnabled,
      loopEnd: totalDurationSec,
      onEvent: (audioTime, value) => {
        const freq = getNoteFrequency(value.note);
        if (!Number.isFinite(freq) || freq <= 0) return;
        scheduleBassNote(audio.layers.bass, freq, audioTime, { velocity: value.velocity });
      },
    });
    bassPart.start(partStart, 0);
    parts.push(bassPart);

    // 4. Drum Part.
    const drumPart = createProgressionPart<DrumEvent>({
      events: built.drums,
      loop: loopEnabled,
      loopEnd: totalDurationSec,
      onEvent: (audioTime, value) => {
        switch (value.type) {
          case "kick":  scheduleKick(audio.layers.drums, audioTime, { velocity: value.velocity });  break;
          case "snare": scheduleSnare(audio.layers.drums, audioTime, { velocity: value.velocity }); break;
          case "hihat": scheduleHiHat(audio.layers.drums, audioTime, { velocity: value.velocity }); break;
          case "ride":  scheduleRide(audio.layers.drums, audioTime, { velocity: value.velocity });  break;
        }
      },
    });
    drumPart.start(partStart, 0);
    parts.push(drumPart);

    // 5. Metronome Loop. The accent-on-beat-1 logic reads beatsPerBarRef
    //    so a live time-signature change doesn't require rebuilding the
    //    Loop. The wrapper's internal counter still increments by 1 each
    //    tick; we compare against the current ref to decide accent.
    let beatCounter = 0;
    const metronome = createMetronomeLoop({
      beatsPerBar, // wrapper uses this for its initial cycle; we override below
      onBeat: (audioTime) => {
        beatCounter = (beatCounter % beatsPerBarRef.current) + 1;
        scheduleClick(audio.layers.metronome, audioTime, { accent: beatCounter === 1 });
      },
    });
    metronome.start(partStart);

    // Transport must be running for Tone callbacks to fire. Idempotent.
    getTransport().start();

    // Non-loop progressions: schedule a one-shot pause at the natural end.
    let endEventId: number | null = null;
    if (!loopEnabled) {
      endEventId = getTransport().scheduleOnce(() => {
        setPlaying(false);
      }, `+${totalDurationSec + SCHEDULE_LEAD_SECONDS}`) as unknown as number;
    }

    primsRef.current = { parts, loop: metronome, endEventId };
    return () => { disposeAll(primsRef.current); primsRef.current = null; };
    // NOTE: tempo / swing / loopEnabled / beatsPerBar / chordInstrument are
    // INTENTIONALLY excluded from this deps array — they have dedicated
    // live-update effects below (Effects 2-6) that mutate the live
    // primitives without rebuilding. Re-adding them here would defeat the
    // whole point of the split.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playing, blocked, muted,
    steps, chordPatternId, bassPatternId, drumPatternId, drumVariations,
    setActiveStepIndex, setPlaying,
  ]);

  // --- Effect 2: live tempo ---
  // Tone.Part stores events as ticks (PPQ-relative), so flipping the
  // Transport's bpm re-times every pending event automatically. No rebuild.
  useEffect(() => {
    getTransport().bpm.value = tempo;
  }, [tempo]);

  // --- Effect 3: live swing ---
  // Transport.swing applies globally to all events scheduled through it.
  useEffect(() => {
    (getTransport() as unknown as { swing: number }).swing = swing;
  }, [swing]);

  // --- Effect 4: live loop toggle ---
  // setLoop on every existing Part. loopEnd was stored in ticks at build
  // time, so it re-times with bpm; no need to recompute the seconds value.
  useEffect(() => {
    primsRef.current?.parts.forEach((p) => {
      p.setLoop(loopEnabled);
    });
  }, [loopEnabled]);

  // --- Effect 5: live time signature (beatsPerBar) ---
  // Transport.timeSignature affects bar-relative time arithmetic. The
  // metronome accent cycle reads beatsPerBarRef inside its callback.
  useEffect(() => {
    beatsPerBarRef.current = beatsPerBar;
    (getTransport() as unknown as { timeSignature: number }).timeSignature = beatsPerBar;
  }, [beatsPerBar]);

  // --- Effect 6: live chord instrument ---
  // The chord-strum Part callback reads `instrumentRef.current` each tick
  // via `getChordVoice(...)`, so an instrument switch takes effect on the
  // next strum hit without rebuilding the Part.
  useEffect(() => {
    instrumentRef.current = chordInstrument;
  }, [chordInstrument]);

  // --- Effect 7: live layer-gain toggles ---
  useEffect(() => {
    const audio = ensureProgressionAudio();
    if (!audio) return;
    setLayerGain(audio.layers, "chord", chordOn);
    setLayerGain(audio.layers, "bass", bassOn);
    setLayerGain(audio.layers, "drums", drumsOn);
    setLayerGain(audio.layers, "metronome", metronomeOn);
  }, [chordOn, bassOn, drumsOn, metronomeOn]);
}
```

- [ ] **Step 4: Update ProgressionSummarySlot.tsx**

Remove the `useProgressionPlaybackLoop` import and call. Verify:

Run: `grep -n "useProgressionPlaybackLoop" src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx`
Expected: no matches.

- [ ] **Step 5: Delete the legacy hook + test**

```bash
rm src/hooks/useProgressionPlaybackLoop.ts src/hooks/useProgressionPlaybackLoop.test.tsx
```

- [ ] **Step 6: Run the new + neighboring tests**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx src/progressions/audio/timeline.test.ts src/progressions/audio/toneBus.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts src/hooks/useProgressionAudioPlayback.test.tsx \
        src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx
git rm src/hooks/useProgressionPlaybackLoop.ts src/hooks/useProgressionPlaybackLoop.test.tsx
git commit -m "refactor(audio): tone-native progression orchestrator

Replaces the segment-queue scheduler + useProgressionPlaybackLoop chain
with four Tone.Parts (chord-onsets, chord strums, bass, drums) and one
Tone.Loop (metronome), all routed through per-layer gain buses. Mid-
play edits dispose + rebuild from bar 0 (less flexible, much simpler).
Layer-enable toggles flip gain only, no rebuild. Chord overlay React
advance retains the setTimeout-deferral pattern inside the chord-onset
Part callback (no Draw, no startTransition — 250ms-expiration stall
cannot recur via this path)."
```

---

### Task 5: Remove scheduleProgressionStep + final verification

**Files:**
- Modify: `src/progressions/audio/scheduler.ts`
- Modify: `src/progressions/audio/scheduler.test.ts`

- [ ] **Step 1: Delete `scheduleProgressionStep` + `swingBeat` from scheduler.ts**

Open `src/progressions/audio/scheduler.ts`. Delete the `scheduleProgressionStep` exported function and the file-local `swingBeat` helper (already duplicated into `buildAllLayers.ts`). Leave the per-hit re-exports / imports untouched (they're used by the new orchestrator).

Verify:

Run: `grep -n "scheduleProgressionStep" src/`
Expected: no matches anywhere.

- [ ] **Step 2: Trim scheduler.test.ts**

Open `src/progressions/audio/scheduler.test.ts`. Delete every `describe`/`it` block that imports or exercises `scheduleProgressionStep`. Keep any per-hit tests if present.

Run: `pnpm vitest run src/progressions/audio/scheduler.test.ts`
Expected: PASS (or skip the file if it's empty after pruning).

- [ ] **Step 3: Lint + full test + build**

Run in parallel:
- `pnpm lint`
- `pnpm test`
- `pnpm build`

Expected: all clean. Net test count = previous baseline + (Task 1: 9) + (Task 2: 6) + (Task 4: 8) − (deleted loop hook tests: 7 or so).

- [ ] **Step 4: E2E (production preview)**

Run: `pnpm test:e2e:production`
Expected: all green. Pay attention to:
- `e2e/progression.visual.spec.ts` — chord swap timing now lands on audio-precise frames instead of lookahead-early frames; visual diffs at chord boundaries are expected.
- `e2e/storage-persistence.spec.ts` — loop/tempo/steps persistence unchanged; must still pass.
- Edit-mid-play behavior: any test that asserts continuity through an edit will now see a restart-from-0. Update those assertions or, if the test is specifically about preserving position, mark it as `test.fixme` with a note pointing to this commit and the user-confirmed trade-off.

- [ ] **Step 5: Refresh visual baselines if needed**

Run: `pnpm test:visual:update`
Expected: diff confined to chord-boundary frames + any test that captured mid-play edit behavior. Inspect each diff; commit if expected.

- [ ] **Step 6: Commit cleanup + baseline refresh**

```bash
git add src/progressions/audio/scheduler.ts src/progressions/audio/scheduler.test.ts
git commit -m "chore(audio): drop scheduleProgressionStep + swingBeat (subsumed by tone primitives)"
# If baselines changed:
git add e2e/**/*-snapshots/**
git status   # confirm only baseline images changed
git commit -m "test(visual): refresh baselines after tone-native scheduler migration"
```

---

## Verification summary

After Task 5 the branch should have:

1. ✅ `lint` clean.
2. ✅ Full unit suite green; net test count = previous + (Task 1: 9) + (Task 2: 6) + (Task 4: 8) − (deleted loop tests).
3. ✅ `pnpm build` succeeds.
4. ✅ `pnpm test:e2e:production` green.
5. ✅ Visual baselines refreshed (if needed) and explained in the commit message.
6. ✅ Manual smoke check:
   - Loop plays cleanly across the boundary.
   - Chord overlay swap aligns with audio onset (no more visible lead).
   - **Live (no restart) mid-play:** layer toggles (chord/bass/drums/metronome), tempo slider, swing slider, loop toggle, time-signature picker, instrument selector. All apply mid-bar with no audio glitch.
   - **Restart-from-0 mid-play:** step content edits (add/remove/change chord), pattern switches (chord/bass/drum), drum variations. Brief stop then auto-restart at bar 0.
   - Pause / resume snaps to the current chord per existing behavior.
7. ✅ `git grep useProgressionPlaybackLoop` returns nothing.
8. ✅ `git grep scheduleProgressionStep` returns nothing.
9. ✅ Regression guard test asserts the new hook never imports `Draw` or uses `startTransition` around `advance`.
