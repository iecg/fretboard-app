# Performance Hot Spots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce startup render delay and playback click latency by removing eager audio startup work, letting the fretboard paint before measurement, and reusing Tone voices instead of constructing them per scheduled hit.

**Architecture:** Keep the current progression, fretboard, and audio-clock model intact. Add one lazy guitar-audio facade for the startup path, remove the fretboard’s visibility gate so measurement becomes post-paint refinement, and introduce reusable Tone voice helpers so scheduler calls stay structurally the same while the expensive constructors leave the click path.

**Tech Stack:** React 19, TypeScript, Jotai, Vitest, Testing Library, Tone.js, Vite

---

## File map

- **Create:** `src/core/lazyGuitarAudio.ts` — lazy boundary around `src/core/audio.ts`; stores mute/error-handler state without forcing Tone into the startup graph.
- **Create:** `src/core/lazyGuitarAudio.test.ts` — verifies lazy loading, deferred mute propagation, and note-play delegation.
- **Create:** `src/progressions/audio/instruments/createReusableChordVoice.ts` — shared helper for cached `Tone.PolySynth` chord voices.
- **Create:** `src/progressions/audio/createReusableVoicePool.ts` — shared pool helper for bass, drums, and metronome one-shot voices.
- **Modify:** `src/App.tsx` — replace eager `synth` import/usage with lazy-guitar-audio calls.
- **Modify:** `src/components/Fretboard/Fretboard.tsx` — replace eager `synth` import, remove hidden-until-measured visibility gate, keep resize logic as post-paint refinement.
- **Modify:** `src/components/Fretboard/Fretboard.test.tsx` — add visibility-before-measurement and lazy note-play wiring assertions.
- **Modify:** `src/components/Fretboard/Fretboard.performance.test.tsx` — keep derived-prop reuse assertions green after measurement changes.
- **Modify:** `src/core/audio.test.ts` — keep eager synth contract covered; this remains the direct-runtime test file.
- **Modify:** `src/progressions/audio/instruments/pianoVoice.ts` — swap per-call `PolySynth` construction for reusable helper.
- **Modify:** `src/progressions/audio/instruments/organVoice.ts` — same reusable helper path as piano.
- **Modify:** `src/progressions/audio/bass.ts` — move to pooled reusable `Tone.MonoSynth` instances.
- **Modify:** `src/progressions/audio/drumKit.ts` — move kick/snare/hat/ride to pooled reusable instances keyed by destination bus.
- **Modify:** `src/progressions/audio/metronome.ts` — move clicks to pooled reusable `Tone.Synth` instances.
- **Modify:** `src/progressions/audio/instruments/pianoVoice.test.ts` — assert constructor reuse across successive chord schedules.
- **Modify:** `src/progressions/audio/instruments/organVoice.test.ts` — same constructor-reuse assertion as piano.
- **Modify:** `src/progressions/audio/bass.test.ts` — assert pooled `MonoSynth` reuse and retained scheduling contract.
- **Modify:** `src/progressions/audio/drumKit.test.ts` — assert pooled reuse per lane rather than per-hit constructor churn.
- **Modify:** `src/progressions/audio/metronome.test.ts` — assert pooled click reuse.

---

### Task 1: Add the lazy guitar-audio boundary

**Files:**

- Create: `src/core/lazyGuitarAudio.ts`
- Create: `src/core/lazyGuitarAudio.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Fretboard/Fretboard.tsx`
- Test: `src/core/lazyGuitarAudio.test.ts`

- [x] **Step 1: Write the failing lazy-audio facade test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const audioModule = vi.hoisted(() => ({
  synth: {
    resume: vi.fn(async () => {}),
    playNote: vi.fn(async () => {}),
    setMute: vi.fn(),
    onError: undefined as ((msg: string) => void) | undefined,
  },
}));

vi.mock("./audio", () => audioModule);

import {
  __resetLazyGuitarAudioForTests,
  playGuitarNote,
  resumeGuitarAudio,
  setGuitarAudioErrorHandler,
  setGuitarMutePreference,
} from "./lazyGuitarAudio";

describe("lazyGuitarAudio", () => {
  beforeEach(() => {
    __resetLazyGuitarAudioForTests();
    vi.clearAllMocks();
  });

  it("does not call synth.setMute until the lazy runtime has been loaded", () => {
    setGuitarMutePreference(true);
    expect(audioModule.synth.setMute).not.toHaveBeenCalled();
  });

  it("replays the stored mute preference and error handler on first lazy load", async () => {
    const onError = vi.fn();
    setGuitarMutePreference(true);
    setGuitarAudioErrorHandler(onError);

    await resumeGuitarAudio();

    expect(audioModule.synth.setMute).toHaveBeenCalledWith(true);
    expect(audioModule.synth.onError).toBe(onError);
    expect(audioModule.synth.resume).toHaveBeenCalledTimes(1);
  });

  it("delegates note playback through the lazy runtime", async () => {
    await playGuitarNote(440);
    expect(audioModule.synth.playNote).toHaveBeenCalledWith(440);
  });
});
```

- [x] **Step 2: Run the new test to confirm the facade does not exist yet**

Run:

```bash
pnpm vitest run src/core/lazyGuitarAudio.test.ts
```

Expected: FAIL with a module-not-found error for `src/core/lazyGuitarAudio.ts`.

- [x] **Step 3: Implement the lazy audio facade**

```ts
// src/core/lazyGuitarAudio.ts
type GuitarSynthModule = typeof import("./audio");

let modulePromise: Promise<GuitarSynthModule> | null = null;
let desiredMute = false;
let errorHandler: ((message: string) => void) | undefined;

async function loadAudioModule(): Promise<GuitarSynthModule> {
  if (!modulePromise) {
    modulePromise = import("./audio").then((mod) => {
      mod.synth.onError = errorHandler;
      mod.synth.setMute(desiredMute);
      return mod;
    });
  }
  return modulePromise;
}

export function setGuitarMutePreference(mute: boolean): void {
  desiredMute = mute;
  void modulePromise?.then((mod) => {
    mod.synth.setMute(mute);
  });
}

export function setGuitarAudioErrorHandler(
  nextHandler: ((message: string) => void) | undefined,
): void {
  errorHandler = nextHandler;
  void modulePromise?.then((mod) => {
    mod.synth.onError = nextHandler;
  });
}

export async function resumeGuitarAudio(): Promise<void> {
  const mod = await loadAudioModule();
  await mod.synth.resume();
}

export async function playGuitarNote(frequency: number): Promise<void> {
  const mod = await loadAudioModule();
  await mod.synth.playNote(frequency);
}

export function __resetLazyGuitarAudioForTests(): void {
  modulePromise = null;
  desiredMute = false;
  errorHandler = undefined;
}
```

- [x] **Step 4: Wire `App.tsx` and `Fretboard.tsx` through the lazy facade**

```ts
// src/App.tsx
import {
  resumeGuitarAudio,
  setGuitarAudioErrorHandler,
  setGuitarMutePreference,
} from "./core/lazyGuitarAudio";

useEffect(() => {
  setGuitarMutePreference(isMuted);
}, [isMuted]);

useEffect(() => {
  setGuitarAudioErrorHandler((msg) => setAudioError(msg));
  return () => setGuitarAudioErrorHandler(undefined);
}, [setAudioError]);

useEffect(() => {
  const handleGesture = () => {
    void resumeGuitarAudio();
    window.removeEventListener("click", handleGesture);
    window.removeEventListener("touchstart", handleGesture);
  };
  window.addEventListener("click", handleGesture);
  window.addEventListener("touchstart", handleGesture);
  return () => {
    window.removeEventListener("click", handleGesture);
    window.removeEventListener("touchstart", handleGesture);
  };
}, []);
```

```ts
// src/components/Fretboard/Fretboard.tsx
import { playGuitarNote } from "../../core/lazyGuitarAudio";

const handleFretClick = useCallback(
  async (stringIndex: number, fretIndex: number, noteName: string) => {
    if (dragDistance.current > 5) return;
    const fretNoteWithOctave = getFretNoteWithOctave(
      tuning[stringIndex],
      fretIndex,
    );
    const frequency = getNoteFrequency(fretNoteWithOctave);
    await playGuitarNote(frequency);
    if (onFretClickProp) onFretClickProp(stringIndex, fretIndex, noteName);
  },
  [tuning, onFretClickProp],
);
```

- [x] **Step 5: Run the lazy-audio test to verify it passes**

Run:

```bash
pnpm vitest run src/core/lazyGuitarAudio.test.ts src/core/audio.test.ts
```

Expected: PASS for the new lazy facade tests and existing direct-runtime audio tests.

- [x] **Step 6: Commit Task 1**

```bash
git add src/core/lazyGuitarAudio.ts src/core/lazyGuitarAudio.test.ts src/App.tsx src/components/Fretboard/Fretboard.tsx
git commit -m "perf(audio): lazy-load guitar audio"
```

---

### Task 2: Let the fretboard paint before measurement settles

**Files:**

- Modify: `src/components/Fretboard/Fretboard.tsx`
- Modify: `src/components/Fretboard/Fretboard.test.tsx`
- Modify: `src/components/Fretboard/Fretboard.performance.test.tsx`
- Test: `src/components/Fretboard/Fretboard.test.tsx`

- [x] **Step 1: Write the failing visibility-before-measurement test**

```ts
it("keeps the fretboard visible before ResizeObserver publishes width", () => {
  const { container } = render(<Fretboard {...defaultProps} />);
  const wrapper = container.querySelector('[class*="fretboard-wrapper"]');
  expect(wrapper).not.toHaveStyle({ visibility: "hidden" });
});
```

- [x] **Step 2: Run the fretboard test to capture the current regression**

Run:

```bash
pnpm vitest run src/components/Fretboard/Fretboard.test.tsx -t "keeps the fretboard visible before ResizeObserver publishes width"
```

Expected: FAIL because the wrapper currently renders with `visibility: hidden` until `containerWidth` is set.

- [x] **Step 3: Remove the visibility gate and seed width with a paint-safe fallback**

```ts
// src/components/Fretboard/Fretboard.tsx
const [containerWidth, setContainerWidth] = useState<number>(() => {
  if (typeof window === "undefined") return 0;
  return Math.max(window.innerWidth, 320);
});

useLayoutEffect(() => {
  const el = scrollRef.current;
  if (!el) return;
  if (el.clientWidth > 0) setContainerWidth(el.clientWidth);

  const ro = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 0;
    if (width > 0) setContainerWidth(width);
  });
  ro.observe(el);
  return () => ro.disconnect();
}, []);

// Drop the inline visibility gate entirely.
<div
  className={clsx(styles["fretboard-wrapper"], styles["hide-scrollbar"])}
  ref={scrollRef}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onPointerLeave={handlePointerUp}
>
```

- [x] **Step 4: Keep the existing prop-reuse performance coverage green**

```ts
// src/components/Fretboard/Fretboard.performance.test.tsx
it("still reuses expensive derived props when zoom changes after width fallback", () => {
  const store = createStore();

  render(
    <Provider store={store}>
      <Fretboard stringRowPx={40} />
    </Provider>,
  );

  const first = received.at(-1)!;

  act(() => {
    store.set(fretZoomAtom, 150);
  });

  const second = received.at(-1)!;
  expect(second.fretboardLayout).toBe(first.fretboardLayout);
  expect(second.fullChordVoicings).toBe(first.fullChordVoicings);
});
```

- [x] **Step 5: Run the fretboard tests to verify the new startup behavior**

Run:

```bash
pnpm vitest run src/components/Fretboard/Fretboard.test.tsx src/components/Fretboard/Fretboard.performance.test.tsx
```

Expected: PASS, including the new “visible before measurement” assertion and the existing reuse assertions.

- [x] **Step 6: Commit Task 2**

```bash
git add src/components/Fretboard/Fretboard.tsx src/components/Fretboard/Fretboard.test.tsx src/components/Fretboard/Fretboard.performance.test.tsx
git commit -m "perf(fretboard): paint before measurement"
```

---

### Task 3: Reuse chord voices instead of constructing `PolySynth` per hit

**Files:**

- Create: `src/progressions/audio/instruments/createReusableChordVoice.ts`
- Modify: `src/progressions/audio/instruments/pianoVoice.ts`
- Modify: `src/progressions/audio/instruments/organVoice.ts`
- Modify: `src/progressions/audio/instruments/pianoVoice.test.ts`
- Modify: `src/progressions/audio/instruments/organVoice.test.ts`
- Test: `src/progressions/audio/instruments/pianoVoice.test.ts`
- Test: `src/progressions/audio/instruments/organVoice.test.ts`

- [x] **Step 1: Add the failing constructor-reuse tests**

```ts
it("reuses one PolySynth across successive piano schedules", () => {
  pianoVoice.scheduleChord({} as AudioNode, ["C3", "E3", "G3"], 0, {
    velocity: 0.7,
  });
  pianoVoice.scheduleChord({} as AudioNode, ["F3", "A3", "C4"], 1, {
    velocity: 0.7,
  });

  expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
  expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(2);
});
```

```ts
it("reuses one PolySynth across successive organ schedules", () => {
  organVoice.scheduleChord({} as AudioNode, ["C3", "E3", "G3"], 0, {
    velocity: 0.7,
  });
  organVoice.scheduleChord({} as AudioNode, ["D3", "F3", "A3"], 1, {
    velocity: 0.7,
  });

  expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
  expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(2);
});
```

- [x] **Step 2: Run the instrument tests to confirm they fail under the current per-call constructor pattern**

Run:

```bash
pnpm vitest run src/progressions/audio/instruments/pianoVoice.test.ts src/progressions/audio/instruments/organVoice.test.ts
```

Expected: FAIL because each `scheduleChord()` call currently constructs a fresh `Tone.PolySynth`.

- [x] **Step 3: Implement the shared reusable chord-voice helper**

```ts
// src/progressions/audio/instruments/createReusableChordVoice.ts
import * as Tone from "tone";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

interface ReusableChordVoiceConfig {
  volume: number;
  maxPolyphonyFloor: number;
  oscillator: { type: "custom"; partials: number[] };
  envelope: { attack: number; decay: number; sustain: number; release: number };
  durationFor: (options: ChordVoiceOptions) => number;
}

export function createReusableChordVoice(
  config: ReusableChordVoiceConfig,
): ChordVoice {
  let synth: Tone.PolySynth<Tone.Synth> | null = null;
  let currentDest: AudioNode | null = null;

  const getSynth = (dest: AudioNode, notes: readonly string[]) => {
    if (!synth) {
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: config.oscillator,
        envelope: config.envelope,
        volume: config.volume,
      });
    }
    if (currentDest !== dest) {
      synth.connect(dest);
      currentDest = dest;
    }
    synth.maxPolyphony = Math.max(notes.length, config.maxPolyphonyFloor);
    return synth;
  };

  return {
    scheduleChord(dest, notes, time, options): VoiceHandle {
      const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.7));
      if (velocity <= 0 || notes.length === 0) return { cancel: () => {} };

      const activeSynth = getSynth(dest, notes);
      activeSynth.triggerAttackRelease(
        notes as string[],
        config.durationFor(options),
        time,
        velocity,
      );

      let cancelled = false;
      return {
        cancel: () => {
          if (cancelled) return;
          cancelled = true;
          activeSynth.releaseAll(Tone.now());
        },
      };
    },
  };
}
```

- [x] **Step 4: Replace piano/organ implementations with the helper**

```ts
// src/progressions/audio/instruments/pianoVoice.ts
import { createReusableChordVoice } from "./createReusableChordVoice";

export const pianoVoice = createReusableChordVoice({
  volume: -6,
  maxPolyphonyFloor: 6,
  oscillator: { type: "custom", partials: [1, 0.5, 0.25, 0.12] },
  envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 1.2 },
  durationFor: (options) => (options.style === "sustained" ? 1.2 : 0.4),
});
```

```ts
// src/progressions/audio/instruments/organVoice.ts
import { createReusableChordVoice } from "./createReusableChordVoice";

export const organVoice = createReusableChordVoice({
  volume: -10,
  maxPolyphonyFloor: 6,
  oscillator: { type: "custom", partials: [1, 0.6, 0.4, 0.3, 0.2] },
  envelope: { attack: 0.02, decay: 0.05, sustain: 0.9, release: 0.6 },
  durationFor: (options) => (options.style === "staccato" ? 0.2 : 1.5),
});
```

- [x] **Step 5: Run the chord-voice tests to verify constructor reuse**

Run:

```bash
pnpm vitest run src/progressions/audio/instruments/pianoVoice.test.ts src/progressions/audio/instruments/organVoice.test.ts
```

Expected: PASS, including the new “ctor called once across two schedules” assertions.

- [x] **Step 6: Commit Task 3**

```bash
git add src/progressions/audio/instruments/createReusableChordVoice.ts src/progressions/audio/instruments/pianoVoice.ts src/progressions/audio/instruments/organVoice.ts src/progressions/audio/instruments/pianoVoice.test.ts src/progressions/audio/instruments/organVoice.test.ts
git commit -m "perf(audio): reuse chord voices"
```

---

### Task 4: Pool bass, drums, and metronome voices

**Files:**

- Create: `src/progressions/audio/createReusableVoicePool.ts`
- Modify: `src/progressions/audio/bass.ts`
- Modify: `src/progressions/audio/drumKit.ts`
- Modify: `src/progressions/audio/metronome.ts`
- Modify: `src/progressions/audio/bass.test.ts`
- Modify: `src/progressions/audio/drumKit.test.ts`
- Modify: `src/progressions/audio/metronome.test.ts`
- Test: `src/progressions/audio/bass.test.ts`
- Test: `src/progressions/audio/drumKit.test.ts`
- Test: `src/progressions/audio/metronome.test.ts`

- [x] **Step 1: Add the failing pooled-reuse tests**

```ts
it("reuses MonoSynth instances across successive bass notes", () => {
  scheduleBassNote({} as AudioNode, 110, 0, { velocity: 0.9 });
  scheduleBassNote({} as AudioNode, 146.83, 1, { velocity: 0.9 });

  expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
  expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(2);
});
```

```ts
it("reuses the metronome synth across successive clicks", () => {
  scheduleClick({} as AudioNode, 0, { accent: true });
  scheduleClick({} as AudioNode, 1, { accent: false });

  expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
  expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(2);
});
```

```ts
it("reuses metal synth instances for successive hi-hat hits on the same bus", () => {
  scheduleHiHat({} as AudioNode, 0, {});
  scheduleHiHat({} as AudioNode, 0.5, {});

  expect(metalSpies.ctorSpy).toHaveBeenCalledTimes(1);
  expect(metalSpies.triggerAttackRelease).toHaveBeenCalledTimes(2);
});
```

- [x] **Step 2: Run the rhythm-voice tests to confirm the current constructor churn**

Run:

```bash
pnpm vitest run src/progressions/audio/bass.test.ts src/progressions/audio/drumKit.test.ts src/progressions/audio/metronome.test.ts
```

Expected: FAIL because each schedule helper currently constructs a fresh Tone synth.

- [x] **Step 3: Implement the reusable one-shot pool helper**

```ts
// src/progressions/audio/createReusableVoicePool.ts
interface ReusableVoice {
  connect: (dest: AudioNode) => unknown;
}

export function createReusableVoicePool<T extends ReusableVoice>(
  size: number,
  build: () => T,
): (dest: AudioNode) => T {
  const pools = new WeakMap<AudioNode, { voices: T[]; cursor: number }>();

  return (dest: AudioNode) => {
    let pool = pools.get(dest);
    if (!pool) {
      pool = { voices: [], cursor: 0 };
      pools.set(dest, pool);
    }

    if (pool.voices.length < size) {
      const voice = build();
      voice.connect(dest);
      pool.voices.push(voice);
    }

    const next = pool.voices[pool.cursor]!;
    pool.cursor = (pool.cursor + 1) % pool.voices.length;
    return next;
  };
}
```

- [x] **Step 4: Refactor bass, metronome, and drums to use the reusable pool**

```ts
// src/progressions/audio/metronome.ts
const getClickSynth = createReusableVoicePool(
  1,
  () =>
    new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: DECAY, sustain: 0, release: RELEASE },
    }),
);

export function scheduleClick(
  dest: AudioNode,
  time: number,
  options: ClickOptions = {},
): ClickHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.6));
  if (velocity <= 0) return { cancel: () => {} };

  const synth = getClickSynth(dest);
  synth.triggerAttackRelease(
    options.accent ? ACCENT_FREQ : NORMAL_FREQ,
    DECAY,
    time,
    velocity,
  );

  return {
    cancel: () => {
      synth.triggerRelease?.(Tone.now());
    },
  };
}
```

- [x] **Step 5: Run the rhythm-voice tests to verify pooled reuse**

Run:

```bash
pnpm vitest run src/progressions/audio/bass.test.ts src/progressions/audio/drumKit.test.ts src/progressions/audio/metronome.test.ts
```

Expected: PASS, with the new reuse assertions confirming that the hot path now schedules onto pooled instances.

- [x] **Step 6: Commit Task 4**

```bash
git add src/progressions/audio/createReusableVoicePool.ts src/progressions/audio/bass.ts src/progressions/audio/drumKit.ts src/progressions/audio/metronome.ts src/progressions/audio/bass.test.ts src/progressions/audio/drumKit.test.ts src/progressions/audio/metronome.test.ts
git commit -m "perf(audio): pool rhythm voices"
```

---

### Task 5: Run end-to-end validation for the hot-spot plan

**Files:**

- Test: `src/core/lazyGuitarAudio.test.ts`
- Test: `src/components/Fretboard/Fretboard.test.tsx`
- Test: `src/components/Fretboard/Fretboard.performance.test.tsx`
- Test: `src/progressions/audio/instruments/pianoVoice.test.ts`
- Test: `src/progressions/audio/instruments/organVoice.test.ts`
- Test: `src/progressions/audio/bass.test.ts`
- Test: `src/progressions/audio/drumKit.test.ts`
- Test: `src/progressions/audio/metronome.test.ts`

- [x] **Step 1: Run the focused performance-related test slice**

Run:

```bash
pnpm vitest run \
  src/core/lazyGuitarAudio.test.ts \
  src/components/Fretboard/Fretboard.test.tsx \
  src/components/Fretboard/Fretboard.performance.test.tsx \
  src/progressions/audio/instruments/pianoVoice.test.ts \
  src/progressions/audio/instruments/organVoice.test.ts \
  src/progressions/audio/bass.test.ts \
  src/progressions/audio/drumKit.test.ts \
  src/progressions/audio/metronome.test.ts
```

Expected: PASS for the startup-path and voice-reuse coverage added in Tasks 1-4.

- [x] **Step 2: Run the required repo validation commands**

Run:

```bash
pnpm run lint
pnpm run test
pnpm run build
```

Expected: all three commands PASS.

- [x] **Step 3: Capture the post-change production trace checklist**

```md
1. Build production assets with `pnpm run build`.
2. Serve the built app with the existing production Playwright/Vite path.
3. Record a fresh trace of initial load and the same playback click.
4. Confirm:
   - initial paint no longer waits on the fretboard visibility gate,
   - Tone-backed guitar audio is not in the critical startup graph before audio use,
   - click-path constructor churn is gone or materially reduced.
```
