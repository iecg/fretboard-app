# Audio Lazy Load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Defer Tone.js loading and AudioContext construction until the user presses play in the progression backing track.

**Architecture:** Extract all Tone.js-dependent code into a single `progressionAudioEngine.ts` barrel that `useProgressionAudioPlayback` dynamically imports on play. Remove the SongControls mount effect that eagerly warms the AudioContext. The fretboard audio system (already lazy via `lazyGuitarAudio.ts`) needs no changes.

**Tech Stack:** TypeScript, Tone.js 15.1, Jotai, React 19, Vitest

---

### Task 1: Create `src/progressions/audio/progressionAudioEngine.ts`

**Files:**
- Create: `src/progressions/audio/progressionAudioEngine.ts`

- [ ] **Step 1: Create barrel with re-exports**

```typescript
import { getDraw, getTransport } from "tone";

export { ensureProgressionAudio, resumeProgressionAudio, restoreProgressionBus, silenceProgressionBus } from "./bus";
export { buildAllLayers } from "./buildAllLayers";
export type { BassEvent, ChordOnsetEvent, ChordStrumEvent, DrumEvent } from "./buildAllLayers";
export { createMetronomeLoop } from "./progressionMetronomeLoop";
export type { MetronomeLoopHandle } from "./progressionMetronomeLoop";
export { createProgressionPart } from "./progressionPart";
export type { ProgressionPartHandle } from "./progressionPart";
export { setLayerGain } from "./layerBuses";
export { getChordVoice } from "./instruments/index";
export { scheduleBassNote } from "./bass";
export { scheduleHiHat, scheduleKick, scheduleRide, scheduleSnare } from "./drumKit";
export { scheduleClick } from "./metronome";
export { clearTimeline, pauseTimeline, setActiveStep } from "./timeline";
export { getDraw, getTransport };

export interface PlaybackPrimitives {
  parts: ProgressionPartHandle[];
  loop: MetronomeLoopHandle | null;
  endEventId: number | null;
  totalDurationSec: number;
}

export function disposeAll(prims: PlaybackPrimitives | null): void {
  if (!prims) return;
  prims.parts.forEach((p) => p.dispose());
  prims.loop?.dispose();
  if (prims.endEventId !== null) {
    getTransport().clear(prims.endEventId);
  }
}

export function setPlaybackTempo(tempo: number): void {
  const transport = getTransport() as unknown as { bpm?: { value: number } } | null;
  if (transport?.bpm) transport.bpm.value = tempo;
}

export function setPlaybackSwing(swing: number): void {
  const transport = getTransport() as unknown as { swing?: number } | null;
  if (transport && transport.swing !== undefined) transport.swing = swing;
}

export function setPlaybackTimeSignature(beatsPerBar: number): void {
  const transport = getTransport() as unknown as { timeSignature?: number } | null;
  if (transport && transport.timeSignature !== undefined) transport.timeSignature = beatsPerBar;
}

export function __resetProgressionAudioEngineForTests(): void {
  /* no-op — module-level caches are reset via test helpers */
}
```

- [ ] **Step 2: Build to verify**

Run: `pnpm run build`
Expected: Build succeeds

---

### Task 2: Modify `useProgressionAudioPlayback.ts` for lazy loading

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`

- [ ] **Step 1: Replace static imports (lines 1-62)**

Remove all static imports from `tone`, `bus.ts`, `buildAllLayers`, `progressionMetronomeLoop`, `progressionPart`, `layerBuses`, `instruments`, `bass`, `drumKit`, `metronome`, `timeline`.

Keep only: React, Jotai, `@fretflow/core`, `audioAtoms`, `progressionAtoms`.

Add type-only import:
```typescript
import type {
  PlaybackPrimitives,
  BassEvent,
  ChordOnsetEvent,
  ChordStrumEvent,
  DrumEvent,
  MetronomeLoopHandle,
  ProgressionPartHandle,
} from "../progressions/audio/progressionAudioEngine";
```

- [ ] **Step 2: Add lazy loader (after imports, before function)**

```typescript
type AudioEngine = typeof import("../progressions/audio/progressionAudioEngine");

let enginePromise: Promise<AudioEngine> | null = null;
let engine: AudioEngine | null = null;

async function getEngine(): Promise<AudioEngine> {
  if (!enginePromise) {
    enginePromise = import("../progressions/audio/progressionAudioEngine").then((mod) => {
      engine = mod;
      return mod;
    });
  }
  return enginePromise;
}
```

- [ ] **Step 3: Remove `PlaybackPrimitives` interface and `disposeAll` function** (lines 68-84)

- [ ] **Step 4: Add `genRef` to track async generation**

```typescript
const genRef = useRef(0);
```

Add to the first (no-deps) `useEffect` that mirrors `buildInputsRef`:
```typescript
useEffect(() => {
  genRef.current++;
  buildInputsRef.current = { steps, chordPatternId, bassPatternId, drumPatternId, drumVariations, tempo, beatsPerBar, swing, loopEnabled };
});
```

- [ ] **Step 5: Rewrite Effect 1 (heavy build/dispose) to use async lazy loading**

```typescript
useEffect(() => {
  const tearDown = () => {
    disposeAll(primsRef.current);
    primsRef.current = null;
    if (engine) engine.silenceProgressionBus();
    clearTimeline();
    setLoading(false);
  };

  if (blocked || muted) { tearDown(); return; }
  if (!playing) { tearDown(); pauseTimeline(); return; }

  const gen = ++genRef.current;
  setLoading(true);

  getEngine().then((eng) => {
    if (gen !== genRef.current) return;
    const audio = eng.ensureProgressionAudio();
    if (!audio) { tearDown(); return; }
    eng.resumeProgressionAudio();
    eng.restoreProgressionBus();

    const inputs = buildInputsRef.current;
    const built = eng.buildAllLayers({ steps: inputs.steps, tempoBpm: inputs.tempo, beatsPerBar: inputs.beatsPerBar, swing: inputs.swing, chordPatternId: inputs.chordPatternId, bassPatternId: inputs.bassPatternId, drumPatternId: inputs.drumPatternId, drumVariations: inputs.drumVariations, loop: inputs.loopEnabled });
    if (built.chordOnsets.length === 0) { tearDown(); return; }

    const partStart = audio.ctx.currentTime + SCHEDULE_LEAD_SECONDS;
    const parts: ProgressionPartHandle[] = [];
    const totalDurationSec = built.totalDurationSec;

    let hasFiredOnce = false;
    const chordOnsetPart = eng.createProgressionPart<ChordOnsetEvent>({
      events: built.chordOnsets, loop: inputs.loopEnabled, loopEnd: totalDurationSec,
      onEvent: (audioTime, event) => {
        if (!hasFiredOnce) { hasFiredOnce = true; setLoading(false); }
        eng.setActiveStep(event.stepIndex, audioTime, event.durationSec, event.cumulativeStartSec, totalDurationSec);
        if (event.isFirstBar) {
          eng.getDraw().schedule(() => setActiveStepIndex(event.stepIndex), audioTime);
        }
      },
    });
    chordOnsetPart.start(partStart, 0);
    parts.push(chordOnsetPart);

    const chordStrumPart = eng.createProgressionPart<ChordStrumEvent>({
      events: built.chordStrums, loop: inputs.loopEnabled, loopEnd: totalDurationSec,
      onEvent: (audioTime, value) => {
        const voice = eng.getChordVoice(instrumentRef.current);
        voice.scheduleChord(audio.layers.chord, value.voicing, audioTime, {
          velocity: value.velocity, style: value.style, direction: value.direction,
        });
      },
    });
    chordStrumPart.start(partStart, 0);
    parts.push(chordStrumPart);

    const bassPart = eng.createProgressionPart<BassEvent>({
      events: built.bass, loop: inputs.loopEnabled, loopEnd: totalDurationSec,
      onEvent: (audioTime, value) => {
        const freq = getNoteFrequency(value.note);
        if (!Number.isFinite(freq) || freq <= 0) return;
        eng.scheduleBassNote(audio.layers.bass, freq, audioTime, { velocity: value.velocity });
      },
    });
    bassPart.start(partStart, 0);
    parts.push(bassPart);

    const drumPart = eng.createProgressionPart<DrumEvent>({
      events: built.drums, loop: inputs.loopEnabled, loopEnd: totalDurationSec,
      onEvent: (audioTime, value) => {
        switch (value.type) {
          case "kick": eng.scheduleKick(audio.layers.drums, audioTime, { velocity: value.velocity }); break;
          case "snare": eng.scheduleSnare(audio.layers.drums, audioTime, { velocity: value.velocity }); break;
          case "hihat": eng.scheduleHiHat(audio.layers.drums, audioTime, { velocity: value.velocity }); break;
          case "openHat": eng.scheduleHiHat(audio.layers.drums, audioTime, { velocity: value.velocity, open: true }); break;
          case "ride": eng.scheduleRide(audio.layers.drums, audioTime, { velocity: value.velocity }); break;
        }
      },
    });
    drumPart.start(partStart, 0);
    parts.push(drumPart);

    let beatCounter = 0;
    const metronome = eng.createMetronomeLoop({
      beatsPerBar: beatsPerBarRef.current,
      onBeat: (beatTime) => {
        beatCounter = (beatCounter % beatsPerBarRef.current) + 1;
        eng.scheduleClick(audio.layers.metronome, beatTime, { accent: beatCounter === 1 });
      },
    });
    metronome.start(partStart);

    eng.getTransport().start();

    let endEventId: number | null = null;
    if (!inputs.loopEnabled) {
      endEventId = eng.getTransport().scheduleOnce(
        () => setPlaying(false),
        `+${totalDurationSec + SCHEDULE_LEAD_SECONDS}`,
      );
    }

    primsRef.current = { parts, loop: metronome, endEventId, totalDurationSec };
  });

  return () => {
    genRef.current++;
    if (engine) engine.getDraw().cancel();
    disposeAll(primsRef.current);
    primsRef.current = null;
    setLoading(false);
  };
}, [playing, blocked, muted, buildKey, setActiveStepIndex, setPlaying, setLoading]);
```

- [ ] **Step 6: Guard Effects 2-7 behind `engine`**

Effect 2 (tempo):
```typescript
useEffect(() => {
  if (!engine) return;
  engine.setPlaybackTempo(tempo);
}, [tempo]);
```

Effect 3 (swing):
```typescript
useEffect(() => {
  if (!engine) return;
  engine.setPlaybackSwing(swing);
}, [swing]);
```

Effect 4 (time signature):
```typescript
useEffect(() => {
  beatsPerBarRef.current = beatsPerBar;
  if (!engine) return;
  engine.setPlaybackTimeSignature(beatsPerBar);
}, [beatsPerBar]);
```

Effect 5 (instrument) — no change (just ref write).

Effect 6 (layer mutes):
```typescript
useEffect(() => {
  if (!engine) return;
  const audio = engine.ensureProgressionAudio();
  if (!audio) return;
  engine.setLayerGain(audio.layers, "chord", chordOn);
  engine.setLayerGain(audio.layers, "bass", bassOn);
  engine.setLayerGain(audio.layers, "drums", drumsOn);
  engine.setLayerGain(audio.layers, "metronome", metronomeOn);
}, [chordOn, bassOn, drumsOn, metronomeOn]);
```

Effect 7 (loop toggle):
```typescript
useEffect(() => {
  if (!engine) return;
  const prims = primsRef.current;
  if (!prims) return;
  const { totalDurationSec } = prims;
  prims.parts.forEach((p) => p.setLoop(loopEnabled, totalDurationSec));
  if (loopEnabled) {
    if (prims.endEventId !== null) {
      engine.getTransport().clear(prims.endEventId);
      prims.endEventId = null;
    }
  } else {
    if (prims.endEventId === null && totalDurationSec > 0) {
      const transport = engine.getTransport() as unknown as { seconds: number };
      const elapsedInLoop = transport.seconds % totalDurationSec;
      const remaining = totalDurationSec - elapsedInLoop;
      prims.endEventId = engine.getTransport().scheduleOnce(
        () => setPlaying(false),
        `+${remaining + SCHEDULE_LEAD_SECONDS}`,
      );
    }
  }
}, [loopEnabled, setPlaying]);
```

- [ ] **Step 7: Build to verify**

Run: `pnpm run build`
Expected: Build succeeds

---

### Task 3: Modify `SongControls.tsx`

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`

- [ ] **Step 1: Remove the `ensureProgressionAudio` import (line 27)**

Delete:
```typescript
import { ensureProgressionAudio } from "../../progressions/audio/bus";
```

- [ ] **Step 2: Remove the mount effect that pre-warms AudioContext (lines 146-151)**

Delete:
```typescript
useEffect(() => {
  ensureProgressionAudio();
}, []);
```

- [ ] **Step 3: Build to verify**

Run: `pnpm run build`
Expected: Build succeeds

---

### Task 4: Update `SongControls.test.tsx`

**Files:**
- Modify: `src/components/SongControls/SongControls.test.tsx`

- [ ] **Step 1: Remove the `ensureProgressionAudio` import (line 9)**

Delete:
```typescript
import { ensureProgressionAudio } from "../../progressions/audio/bus";
```

- [ ] **Step 2: Remove the `vi.mock` block (lines 12-18)**

Delete:
```typescript
vi.mock("../../progressions/audio/bus", async () => {
  const actual = await vi.importActual<typeof import("../../progressions/audio/bus")>("../../progressions/audio/bus");
  return { ...actual, ensureProgressionAudio: vi.fn() };
});
```

- [ ] **Step 3: Remove the "AudioContext pre-warm" test (lines 622-631)**

Delete:
```typescript
describe("SongControls AudioContext pre-warm (P3-T4)", () => {
  beforeEach(() => {
    vi.mocked(ensureProgressionAudio).mockClear();
  });
  it("calls ensureProgressionAudio on mount to pre-warm the AudioContext", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(ensureProgressionAudio).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Run SongControls tests**

Run: `pnpm run test -- SongControls`
Expected: All tests pass

---

### Task 5: Update `useProgressionAudioPlayback.test.tsx`

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.test.tsx`

The existing `vi.mock("tone", ...)` mock still works — it intercepts Tone module resolution. `progressionAudioEngine.ts` statically imports from `tone`, so the mock applies.

Key concern: The hook's Effect 1 now uses `getEngine()` → `import(...)`, which resolves asynchronously. Tests that assert on `toneMocks.parts.length` after `store.set(playing=true)` need the microtask queue flushed first.

- [ ] **Step 1: Add `await vi.waitFor(...)` wrapping for post-play assertions**

In every test that does `store.set(setProgressionPlayingAtom, true)` and then checks `toneMocks.parts` or `toneMocks.loops`, wrap the assertions in `await vi.waitFor(...)`:

```typescript
await vi.waitFor(() => {
  expect(toneMocks.parts).toHaveLength(4);
  expect(toneMocks.loops).toHaveLength(1);
});
```

Tests affected (by approximate line number):
- Line 214: `expect(toneMocks.parts).toHaveLength(4)` + `expect(toneMocks.loops).toHaveLength(1)`
- Line 229-232: `toneMocks.parts.forEach(...)` with `p.loop` and `p.loopEnd`
- Line 248-252: `toneMocks.parts.find(...)` and assertions
- Line 297-298: Destructure `toneMocks.parts` and `toneMocks.loops` into local vars

- [ ] **Step 2: Adjust source-code assertion test**

The test at line 271 (`"source defers chord-overlay advance via Tone.Draw, not setTimeout"`) checks the raw source for `getDraw()\.schedule`. The source now uses `eng.getDraw().schedule`. Update the regex on line 284:
```typescript
expect(code).toMatch(/(?:getDraw\(\)\.schedule|eng\.getDraw\(\)\.schedule)/);
```

- [ ] **Step 3: Run the test**

Run: `pnpm run test -- useProgressionAudioPlayback`
Expected: All tests pass

---

### Task 6: Verify end-to-end

**Files:** None

- [ ] **Step 1: Run lint**

Run: `pnpm run lint`
Expected: No lint errors

- [ ] **Step 2: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass

- [ ] **Step 3: Run build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "perf(audio): defer Tone.js loading until play button press"
```
