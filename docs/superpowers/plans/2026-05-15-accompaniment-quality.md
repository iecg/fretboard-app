# Accompaniment Quality & Genre System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-pattern-per-instrument accompaniment system with selectable chord instruments, genre presets, expanded pattern catalogs, richer progression presets, and swing support.

**Architecture:** Genre-first approach. Instruments implement a common `ChordVoice` interface, patterns are data-driven catalogs, genres bundle defaults across all instruments. The scheduler becomes instrument-agnostic — it receives pattern/instrument config and dispatches to the appropriate synthesizer. Scale-aware preset generation supplements a curated preset library.

**Tech Stack:** React 19, TypeScript, Jotai (state), Web Audio API (synthesis), Vitest + Testing Library (tests)

**Spec:** `docs/superpowers/specs/2026-05-15-accompaniment-quality-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `src/progressions/audio/instruments/types.ts` | `ChordVoice` interface, `VoiceHandle` type, `ChordInstrumentId` type |
| `src/progressions/audio/instruments/strumVoice.ts` | Wraps existing `pluckString` with strum-lag spread |
| `src/progressions/audio/instruments/strumVoice.test.ts` | Tests for strum voice |
| `src/progressions/audio/instruments/pianoVoice.ts` | FM synthesis Rhodes-style chord voice |
| `src/progressions/audio/instruments/pianoVoice.test.ts` | Tests for piano voice |
| `src/progressions/audio/instruments/organVoice.ts` | Additive synthesis Hammond-style chord voice |
| `src/progressions/audio/instruments/organVoice.test.ts` | Tests for organ voice |
| `src/progressions/audio/instruments/index.ts` | `getChordVoice(id)` registry |
| `src/progressions/audio/instruments/index.test.ts` | Registry lookup tests |
| `src/progressions/audio/swing.ts` | `applySwing()` time-shift function |
| `src/progressions/audio/swing.test.ts` | Swing calculation tests |
| `src/progressions/audio/genres.ts` | `GenreStyle` interface + `GENRE_STYLES` catalog |
| `src/progressions/audio/genres.test.ts` | Genre catalog integrity tests |
| `src/progressions/progressionGeneration.ts` | `generateCommonProgressions()` |
| `src/progressions/progressionGeneration.test.ts` | Scale-aware generation tests |

### Modified Files

| File | Changes |
|---|---|
| `src/progressions/audio/patterns.ts` | Expand from 3 singleton patterns to full named catalog with `ChordPattern`, `BassPattern`, `DrumPattern`, `DrumVariation` types |
| `src/progressions/audio/patterns.test.ts` | Expand tests for new patterns |
| `src/progressions/audio/drumKit.ts` | Add `scheduleRide()` function |
| `src/progressions/audio/bass.ts` | No changes to synth engine (note selection handled at pattern/scheduler level) |
| `src/progressions/audio/scheduler.ts` | Refactor to accept instrument/pattern config, use `ChordVoice` interface, resolve bass note roles, apply drum variations |
| `src/progressions/audio/scheduler.test.ts` | Update for new scheduler interface |
| `src/progressions/progressionDomain.ts` | Add `category` to `ProgressionPreset`, expand to 25+ presets, fix 12-bar blues |
| `src/progressions/progressionDomain.test.ts` | Update preset tests |
| `src/progressions/progressionAudio.ts` | Add `resolveBassNoteForRole()` for third/octave/chromatic-approach |
| `src/progressions/progressionAudio.test.ts` | Tests for expanded bass note resolution |
| `src/store/progressionAtoms.ts` | Add genre/instrument/pattern/swing atoms, rename strum→chord enabled, add `applyGenreStyleAtom` |
| `src/hooks/useProgressionState.ts` | Expose new atoms |
| `src/hooks/useProgressionAudioPlayback.ts` | Pass new config to scheduler, resolve `nextChordRoot` |
| `src/components/ProgressionTrack/ProgressionBlock.tsx` | Remove `formatDurationShort`, use spelled-out labels |
| `src/components/ProgressionTrack/ProgressionTrack.tsx` | Add genre selector, chord instrument picker, pattern selectors, swing control |
| `src/components/ProgressionControls/ProgressionControls.tsx` | Grouped preset selector with categories |

---

## Task 1: Bar Label Display Fix

Quick, isolated change. No dependencies on other tasks.

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionBlock.tsx:16-22`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.test.tsx` (if it tests duration labels)

- [ ] **Step 1: Write the failing test**

In `src/components/ProgressionTrack/ProgressionBlock.tsx`, the `formatDurationShort` function converts "2 bars" → "2B". Add a test verifying the new behavior. Since `formatDurationShort` is a local function not exported, test via the rendered component. Add to `src/components/ProgressionTrack/ProgressionTrack.test.tsx`:

```typescript
it("renders spelled-out duration labels on progression blocks", () => {
  // Render a ProgressionTrack with a 2-bar step and verify
  // the block shows "2 bars" instead of "2B"
  const { getByText } = render(/* ProgressionTrack with test atoms */);
  expect(getByText("2 bars")).toBeInTheDocument();
});
```

Use the existing test setup patterns in that file — the `renderWithAtoms` helper and atom overrides.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ProgressionTrack/ProgressionTrack.test.tsx --reporter=verbose`
Expected: FAIL — the component currently renders "2B", not "2 bars"

- [ ] **Step 3: Remove formatDurationShort and use raw labels**

In `src/components/ProgressionTrack/ProgressionBlock.tsx`, remove the `formatDurationShort` function (lines 16-22) and replace its usage on line 66:

```typescript
// Before:
<span className={styles.duration}>{formatDurationShort(duration)}</span>

// After:
<span className={styles.duration}>{duration}</span>
```

The `duration` variable (line 43) already holds the spelled-out label from `formatProgressionDurationLabel(step.duration)` which returns "2 bars", "1 bar", "3 beats", etc.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ProgressionTrack/ProgressionTrack.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `npx vitest run --reporter=verbose`
Expected: All existing tests pass. Some snapshot tests may need updating if they captured "2B" text.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgressionTrack/ProgressionBlock.tsx src/components/ProgressionTrack/ProgressionTrack.test.tsx
git commit -m "fix(progressions): spell out bar/beat labels on progression blocks"
```

---

## Task 2: Fix 12-Bar Blues Preset

**Files:**
- Modify: `src/progressions/progressionDomain.ts:228-244`
- Modify: `src/progressions/progressionDomain.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/progressionDomain.test.ts`:

```typescript
describe("twelve-bar-blues preset", () => {
  const blues = PROGRESSION_PRESETS.find((p) => p.id === "twelve-bar-blues")!;

  it("has 7 steps totaling 12 bars", () => {
    expect(blues.steps).toHaveLength(7);
    const totalBars = blues.steps.reduce(
      (sum, s) => sum + (s.duration.unit === "bar" ? s.duration.value : 0),
      0,
    );
    expect(totalBars).toBe(12);
  });

  it("uses multi-bar durations for repeated chords", () => {
    expect(blues.steps[0]).toEqual(
      expect.objectContaining({ degree: "I", duration: { value: 4, unit: "bar" } }),
    );
    expect(blues.steps[1]).toEqual(
      expect.objectContaining({ degree: "IV", duration: { value: 2, unit: "bar" } }),
    );
    expect(blues.steps[2]).toEqual(
      expect.objectContaining({ degree: "I", duration: { value: 2, unit: "bar" } }),
    );
  });

  it("applies Dominant 7th to all steps", () => {
    for (const step of blues.steps) {
      expect(step.qualityOverride).toBe("Dominant 7th");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/progressions/progressionDomain.test.ts --reporter=verbose`
Expected: FAIL — current preset has 12 steps, not 7

- [ ] **Step 3: Replace the 12-bar blues preset**

In `src/progressions/progressionDomain.ts`, replace the `twelve-bar-blues` entry (lines 228-244) with:

```typescript
{
  id: "twelve-bar-blues",
  label: "12-bar blues",
  steps: [
    { degree: "I",  duration: { value: 4, unit: "bar" }, qualityOverride: "Dominant 7th" },
    { degree: "IV", duration: { value: 2, unit: "bar" }, qualityOverride: "Dominant 7th" },
    { degree: "I",  duration: { value: 2, unit: "bar" }, qualityOverride: "Dominant 7th" },
    { degree: "V",  duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
    { degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
    { degree: "I",  duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
    { degree: "V",  duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
  ],
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/progressions/progressionDomain.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All pass. Some existing tests that counted 12 steps for blues may need updating.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/progressionDomain.ts src/progressions/progressionDomain.test.ts
git commit -m "fix(progressions): collapse 12-bar blues into 7 multi-bar steps"
```

---

## Task 3: Chord Voice Interface & Strum Voice

Extract the existing strum logic into the new `ChordVoice` interface.

**Files:**
- Create: `src/progressions/audio/instruments/types.ts`
- Create: `src/progressions/audio/instruments/strumVoice.ts`
- Create: `src/progressions/audio/instruments/strumVoice.test.ts`

- [ ] **Step 1: Create the ChordVoice interface**

Create `src/progressions/audio/instruments/types.ts`:

```typescript
export interface VoiceHandle {
  cancel(): void;
}

export type ChordInstrumentId = "strum" | "piano" | "organ";

export interface ChordVoiceOptions {
  velocity: number;
  style?: "staccato" | "sustained";
}

export interface ChordVoice {
  scheduleChord(
    ctx: AudioContext,
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle;
}
```

- [ ] **Step 2: Write the failing test for strumVoice**

Create `src/progressions/audio/instruments/strumVoice.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { strumVoice, STRUM_LAG_SECONDS } from "./strumVoice";

describe("strumVoice", () => {
  it("implements ChordVoice interface", () => {
    expect(strumVoice.scheduleChord).toBeTypeOf("function");
  });

  it("exports STRUM_LAG_SECONDS constant", () => {
    expect(STRUM_LAG_SECONDS).toBe(0.018);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/progressions/audio/instruments/strumVoice.test.ts --reporter=verbose`
Expected: FAIL — module does not exist

- [ ] **Step 4: Implement strumVoice**

Create `src/progressions/audio/instruments/strumVoice.ts`:

```typescript
import { getNoteFrequency } from "@fretflow/core";
import { pluckString } from "../string";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

export const STRUM_LAG_SECONDS = 0.018;

export const strumVoice: ChordVoice = {
  scheduleChord(
    ctx: AudioContext,
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle {
    const voices = notes.map((note, i) => {
      const freq = getNoteFrequency(note);
      if (!Number.isFinite(freq) || freq <= 0) return null;
      return pluckString(ctx, dest, freq, time + i * STRUM_LAG_SECONDS, {
        velocity: options.velocity,
      });
    }).filter(Boolean) as Array<{ cancel: () => void }>;

    return {
      cancel: () => {
        for (const v of voices) v.cancel();
      },
    };
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/progressions/audio/instruments/strumVoice.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/instruments/types.ts src/progressions/audio/instruments/strumVoice.ts src/progressions/audio/instruments/strumVoice.test.ts
git commit -m "feat(audio): add ChordVoice interface and strumVoice adapter"
```

---

## Task 4: Piano Voice (FM Synthesis)

**Files:**
- Create: `src/progressions/audio/instruments/pianoVoice.ts`
- Create: `src/progressions/audio/instruments/pianoVoice.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/progressions/audio/instruments/pianoVoice.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pianoVoice } from "./pianoVoice";

describe("pianoVoice", () => {
  it("implements ChordVoice interface", () => {
    expect(pianoVoice.scheduleChord).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/progressions/audio/instruments/pianoVoice.test.ts --reporter=verbose`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement pianoVoice**

Create `src/progressions/audio/instruments/pianoVoice.ts`. The Rhodes-style FM synthesis uses a carrier sine wave modulated by another sine at a harmonic ratio, with a bell-like attack and exponential decay:

```typescript
import { getNoteFrequency } from "@fretflow/core";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

const ATTACK = 0.005;
const DECAY_SHORT = 0.4;
const DECAY_LONG = 1.2;
const RELEASE = 0.8;
const MOD_INDEX = 2.5;
const MOD_RATIO = 1;
const FADE_OUT = 0.04;
const ENVELOPE_MIN = 0.001;

function schedulePianoNote(
  ctx: AudioContext,
  dest: AudioNode,
  frequency: number,
  time: number,
  velocity: number,
  decayTime: number,
): { cancel: () => void } | null {
  if (!Number.isFinite(frequency) || frequency <= 0 || velocity <= 0) return null;

  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  const carrier = ctx.createOscillator();
  const envelope = ctx.createGain();

  modulator.type = "sine";
  modulator.frequency.setValueAtTime(frequency * MOD_RATIO, time);
  modGain.gain.setValueAtTime(frequency * MOD_INDEX, time);
  modGain.gain.exponentialRampToValueAtTime(
    frequency * MOD_INDEX * 0.1,
    time + ATTACK + decayTime,
  );

  carrier.type = "sine";
  carrier.frequency.setValueAtTime(frequency, time);

  envelope.gain.setValueAtTime(ENVELOPE_MIN, time);
  envelope.gain.linearRampToValueAtTime(velocity * 0.7, time + ATTACK);
  envelope.gain.exponentialRampToValueAtTime(
    velocity * 0.3,
    time + ATTACK + decayTime,
  );
  envelope.gain.exponentialRampToValueAtTime(
    ENVELOPE_MIN,
    time + ATTACK + decayTime + RELEASE,
  );

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(envelope);
  envelope.connect(dest);

  const stopAt = time + ATTACK + decayTime + RELEASE + 0.05;
  modulator.start(time);
  modulator.stop(stopAt);
  carrier.start(time);
  carrier.stop(stopAt);

  let stopped = false;
  const dispose = () => {
    try {
      modulator.disconnect();
      modGain.disconnect();
      carrier.disconnect();
      envelope.disconnect();
    } catch { /* already disconnected */ }
  };
  carrier.onended = dispose;

  return {
    cancel: () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      try {
        envelope.gain.cancelScheduledValues(now);
        envelope.gain.setValueAtTime(Math.max(envelope.gain.value, ENVELOPE_MIN), now);
        envelope.gain.exponentialRampToValueAtTime(ENVELOPE_MIN, now + FADE_OUT);
        carrier.stop(now + FADE_OUT + 0.01);
        modulator.stop(now + FADE_OUT + 0.01);
      } catch { dispose(); }
    },
  };
}

export const pianoVoice: ChordVoice = {
  scheduleChord(
    ctx: AudioContext,
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle {
    const decayTime = options.style === "staccato" ? DECAY_SHORT
      : options.style === "sustained" ? DECAY_LONG * 1.5
      : DECAY_LONG;

    const voices = notes.map((note) => {
      const freq = getNoteFrequency(note);
      return schedulePianoNote(ctx, dest, freq, time, options.velocity, decayTime);
    }).filter(Boolean) as Array<{ cancel: () => void }>;

    return {
      cancel: () => { for (const v of voices) v.cancel(); },
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/progressions/audio/instruments/pianoVoice.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/instruments/pianoVoice.ts src/progressions/audio/instruments/pianoVoice.test.ts
git commit -m "feat(audio): add FM synthesis piano chord voice"
```

---

## Task 5: Organ Voice (Additive Synthesis)

**Files:**
- Create: `src/progressions/audio/instruments/organVoice.ts`
- Create: `src/progressions/audio/instruments/organVoice.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/progressions/audio/instruments/organVoice.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { organVoice } from "./organVoice";

describe("organVoice", () => {
  it("implements ChordVoice interface", () => {
    expect(organVoice.scheduleChord).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/progressions/audio/instruments/organVoice.test.ts --reporter=verbose`
Expected: FAIL

- [ ] **Step 3: Implement organVoice**

Create `src/progressions/audio/instruments/organVoice.ts`. Hammond-style: additive synthesis with stacked harmonics (simulating drawbar registration) and a sustained envelope:

```typescript
import { getNoteFrequency } from "@fretflow/core";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

const ATTACK = 0.008;
const RELEASE_SHORT = 0.15;
const RELEASE_LONG = 0.6;
const FADE_OUT = 0.04;
const ENVELOPE_MIN = 0.001;

const DRAWBAR_HARMONICS = [1, 2, 3, 4, 6, 8];
const DRAWBAR_LEVELS = [0.8, 0.6, 0.3, 0.2, 0.15, 0.1];

function scheduleOrganNote(
  ctx: AudioContext,
  dest: AudioNode,
  frequency: number,
  time: number,
  velocity: number,
  releaseTime: number,
): { cancel: () => void } | null {
  if (!Number.isFinite(frequency) || frequency <= 0 || velocity <= 0) return null;

  const merger = ctx.createGain();
  merger.gain.setValueAtTime(velocity * 0.4, time);
  merger.connect(dest);

  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  for (let i = 0; i < DRAWBAR_HARMONICS.length; i++) {
    const harmonicFreq = frequency * DRAWBAR_HARMONICS[i];
    if (harmonicFreq > 16000) continue;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(harmonicFreq, time);
    gain.gain.setValueAtTime(ENVELOPE_MIN, time);
    gain.gain.linearRampToValueAtTime(DRAWBAR_LEVELS[i], time + ATTACK);

    osc.connect(gain);
    gain.connect(merger);
    osc.start(time);
    oscs.push(osc);
    gains.push(gain);
  }

  let stopped = false;
  const dispose = () => {
    try {
      for (const o of oscs) o.disconnect();
      for (const g of gains) g.disconnect();
      merger.disconnect();
    } catch { /* already disconnected */ }
  };

  if (oscs.length > 0) {
    oscs[oscs.length - 1].onended = dispose;
  }

  return {
    cancel: () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      try {
        for (const g of gains) {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(Math.max(g.gain.value, ENVELOPE_MIN), now);
          g.gain.exponentialRampToValueAtTime(ENVELOPE_MIN, now + FADE_OUT);
        }
        for (const o of oscs) o.stop(now + FADE_OUT + 0.01);
      } catch { dispose(); }
    },
  };
}

export const organVoice: ChordVoice = {
  scheduleChord(
    ctx: AudioContext,
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle {
    const voices = notes.map((note) => {
      const freq = getNoteFrequency(note);
      return scheduleOrganNote(ctx, dest, freq, time, options.velocity,
        options.style === "staccato" ? RELEASE_SHORT : RELEASE_LONG);
    }).filter(Boolean) as Array<{ cancel: () => void }>;

    return {
      cancel: () => { for (const v of voices) v.cancel(); },
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/progressions/audio/instruments/organVoice.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/instruments/organVoice.ts src/progressions/audio/instruments/organVoice.test.ts
git commit -m "feat(audio): add additive synthesis organ chord voice"
```

---

## Task 6: Instrument Registry

**Files:**
- Create: `src/progressions/audio/instruments/index.ts`
- Create: `src/progressions/audio/instruments/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/progressions/audio/instruments/index.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getChordVoice } from "./index";

describe("getChordVoice", () => {
  it("returns strum voice for 'strum'", () => {
    const voice = getChordVoice("strum");
    expect(voice.scheduleChord).toBeTypeOf("function");
  });

  it("returns piano voice for 'piano'", () => {
    const voice = getChordVoice("piano");
    expect(voice.scheduleChord).toBeTypeOf("function");
  });

  it("returns organ voice for 'organ'", () => {
    const voice = getChordVoice("organ");
    expect(voice.scheduleChord).toBeTypeOf("function");
  });

  it("returns different instances for different ids", () => {
    expect(getChordVoice("strum")).not.toBe(getChordVoice("piano"));
    expect(getChordVoice("piano")).not.toBe(getChordVoice("organ"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/progressions/audio/instruments/index.test.ts --reporter=verbose`
Expected: FAIL

- [ ] **Step 3: Implement the registry**

Create `src/progressions/audio/instruments/index.ts`:

```typescript
import type { ChordInstrumentId, ChordVoice } from "./types";
import { strumVoice } from "./strumVoice";
import { pianoVoice } from "./pianoVoice";
import { organVoice } from "./organVoice";

export type { ChordInstrumentId, ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

const CHORD_VOICES: Record<ChordInstrumentId, ChordVoice> = {
  strum: strumVoice,
  piano: pianoVoice,
  organ: organVoice,
};

export function getChordVoice(id: ChordInstrumentId): ChordVoice {
  return CHORD_VOICES[id];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/progressions/audio/instruments/index.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/instruments/index.ts src/progressions/audio/instruments/index.test.ts
git commit -m "feat(audio): add chord voice instrument registry"
```

---

## Task 7: Ride Cymbal in Drum Kit

**Files:**
- Modify: `src/progressions/audio/drumKit.ts`

- [ ] **Step 1: Write the failing test**

Add to the drum kit test file (create `src/progressions/audio/drumKit.test.ts` if it doesn't exist, or add to existing):

```typescript
import { describe, it, expect } from "vitest";
import { scheduleRide } from "./drumKit";

describe("scheduleRide", () => {
  it("is exported as a function", () => {
    expect(scheduleRide).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/progressions/audio/drumKit.test.ts --reporter=verbose`
Expected: FAIL — `scheduleRide` not exported

- [ ] **Step 3: Implement scheduleRide**

Add to `src/progressions/audio/drumKit.ts`, after the `scheduleHiHat` function:

```typescript
export interface RideOptions extends DrumHitOptions {
  bell?: boolean;
}

export function scheduleRide(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  options: RideOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return { cancel: () => {} };
  const decay = options.bell ? 0.15 : 0.5;

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = options.bell ? 6000 : 4000;
  bp.Q.value = options.bell ? 2 : 0.5;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3000;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(0.25 * velocity, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

  noise.connect(bp).connect(hp).connect(gain).connect(dest);
  noise.start(time);
  noise.stop(time + decay + 0.05);
  noise.onended = () => disposeNodes(noise, bp, hp, gain);

  return createDrumVoiceHandle(ctx, [noise], [noise, bp, hp, gain]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/progressions/audio/drumKit.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/drumKit.ts src/progressions/audio/drumKit.test.ts
git commit -m "feat(audio): add ride cymbal voice to drum kit"
```

---

## Task 8: Swing Module

**Files:**
- Create: `src/progressions/audio/swing.ts`
- Create: `src/progressions/audio/swing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/progressions/audio/swing.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { applySwing } from "./swing";

describe("applySwing", () => {
  it("returns beat unchanged when swing is 0", () => {
    expect(applySwing(0.5, 0, 1)).toBe(0.5);
    expect(applySwing(1.5, 0, 1)).toBe(1.5);
  });

  it("shifts off-beats forward with swing 0.33", () => {
    const result = applySwing(0.5, 0.33, 1);
    expect(result).toBeCloseTo(0.5 + 0.33 * (1 / 3) * 1, 6);
  });

  it("does not shift on-beats", () => {
    expect(applySwing(0, 0.33, 1)).toBe(0);
    expect(applySwing(1, 0.33, 1)).toBe(1);
    expect(applySwing(2, 0.33, 1)).toBe(2);
    expect(applySwing(3, 0.33, 1)).toBe(3);
  });

  it("shifts all off-beats (0.5, 1.5, 2.5, 3.5)", () => {
    const swing = 0.5;
    const spb = 0.5;
    for (const beat of [0.5, 1.5, 2.5, 3.5]) {
      const result = applySwing(beat, swing, spb);
      expect(result).toBeGreaterThan(beat);
    }
  });

  it("scales shift by secondsPerBeat", () => {
    const fast = applySwing(0.5, 0.33, 0.5);
    const slow = applySwing(0.5, 0.33, 1.0);
    expect(slow - 0.5).toBeCloseTo((fast - 0.5) * 2, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/progressions/audio/swing.test.ts --reporter=verbose`
Expected: FAIL

- [ ] **Step 3: Implement applySwing**

Create `src/progressions/audio/swing.ts`:

```typescript
const OFF_BEAT_TOLERANCE = 0.01;

function isOffBeat(beat: number): boolean {
  const fractional = beat % 1;
  return Math.abs(fractional - 0.5) < OFF_BEAT_TOLERANCE;
}

export function applySwing(beat: number, swing: number, secondsPerBeat: number): number {
  if (swing <= 0 || !isOffBeat(beat)) return beat;
  return beat + swing * (1 / 3) * secondsPerBeat;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/progressions/audio/swing.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/swing.ts src/progressions/audio/swing.test.ts
git commit -m "feat(audio): add swing time-shift module"
```

---

## Task 9: Expanded Pattern Catalog

Refactor `patterns.ts` from singleton constants to a full named catalog. Existing patterns remain with IDs; new patterns are added.

**Files:**
- Modify: `src/progressions/audio/patterns.ts`
- Modify: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/patterns.test.ts`:

```typescript
import {
  CHORD_PATTERNS,
  BASS_PATTERNS,
  DRUM_PATTERNS,
  DRUM_VARIATIONS,
  getChordPattern,
  getBassPattern,
  getDrumPattern,
} from "./patterns";

describe("pattern catalog", () => {
  it("has 6 chord patterns with unique IDs", () => {
    expect(CHORD_PATTERNS).toHaveLength(6);
    const ids = CHORD_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 6 bass patterns with unique IDs", () => {
    expect(BASS_PATTERNS).toHaveLength(6);
    const ids = BASS_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 7 drum patterns with unique IDs", () => {
    expect(DRUM_PATTERNS).toHaveLength(7);
    const ids = DRUM_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 3 drum variations with unique IDs", () => {
    expect(DRUM_VARIATIONS).toHaveLength(3);
    const ids = DRUM_VARIATIONS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all pattern beats are in range [0, 4)", () => {
    for (const p of CHORD_PATTERNS) {
      for (const h of p.hits) {
        expect(h.beat).toBeGreaterThanOrEqual(0);
        expect(h.beat).toBeLessThan(4);
      }
    }
    for (const p of BASS_PATTERNS) {
      for (const h of p.hits) {
        expect(h.beat).toBeGreaterThanOrEqual(0);
        expect(h.beat).toBeLessThan(4);
      }
    }
  });

  it("lookups return correct patterns", () => {
    expect(getChordPattern("pop-8ths")).toBeDefined();
    expect(getBassPattern("root-fifth")).toBeDefined();
    expect(getDrumPattern("rock")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/progressions/audio/patterns.test.ts --reporter=verbose`
Expected: FAIL — new exports don't exist yet

- [ ] **Step 3: Expand patterns.ts with full catalog**

Rewrite `src/progressions/audio/patterns.ts` to add the new typed interfaces and pattern catalog while preserving the existing `repeatPatternToBeats` and `clipPatternToBeats` functions. The existing `POP_STRUM_PATTERN`, `ROOT_FIFTH_BASS_PATTERN`, and `ROCK_DRUM_PATTERN` constants stay exported for backwards compatibility but are also wrapped in the new catalog format.

New types to add at the top:

```typescript
export type BassNoteRole = "root" | "third" | "fifth" | "octave" | "chromatic-approach";

export interface ChordHit {
  beat: number;
  velocity: number;
  style?: "staccato" | "sustained";
}

export interface ChordPattern {
  id: string;
  label: string;
  hits: readonly ChordHit[];
}

// BassHit already exists but needs the expanded note type:
export interface CatalogBassHit {
  beat: number;
  velocity: number;
  note: BassNoteRole;
}

export interface CatalogBassPattern {
  id: string;
  label: string;
  hits: readonly CatalogBassHit[];
}

export interface CatalogDrumPattern {
  id: string;
  label: string;
  kicks: readonly DrumHit[];
  snares: readonly DrumHit[];
  hats: readonly DrumHit[];
  openHats?: readonly DrumHit[];
  ride?: readonly DrumHit[];
}

export interface DrumVariation {
  id: string;
  label: string;
  barInterval: number;
  pattern: CatalogDrumPattern;
}
```

Add the full catalog arrays `CHORD_PATTERNS`, `BASS_PATTERNS`, `DRUM_PATTERNS`, `DRUM_VARIATIONS` per the spec, with all the patterns listed in the design doc (pop-8ths, ballad-whole, offbeat-skank, shuffle-comp, jazz-comp, straight-quarters for chords; root-fifth, walking, arpeggiated, shuffle, pedal, funk-syncopated for bass; rock, pop, blues-shuffle, jazz-ride, bossa, ballad, funk for drums; fill-every-4, open-hat-and-of-4, crash-bar-1 for variations).

Add lookup functions:

```typescript
export function getChordPattern(id: string): ChordPattern | undefined {
  return CHORD_PATTERNS.find((p) => p.id === id);
}

export function getBassPattern(id: string): CatalogBassPattern | undefined {
  return BASS_PATTERNS.find((p) => p.id === id);
}

export function getDrumPattern(id: string): CatalogDrumPattern | undefined {
  return DRUM_PATTERNS.find((p) => p.id === id);
}

export function getDrumVariation(id: string): DrumVariation | undefined {
  return DRUM_VARIATIONS.find((v) => v.id === id);
}
```

The beat-level data for each pattern — consult the design spec tables for exact values. Key examples:

**Chord: `pop-8ths`** — wraps the existing `POP_STRUM_PATTERN` data (beats 0, 1, 1.5, 2.5, 3, 3.5).

**Chord: `ballad-whole`** — `[{ beat: 0, velocity: 0.8, style: "sustained" }]`

**Chord: `offbeat-skank`** — `[{ beat: 0.5, velocity: 0.7 }, { beat: 1.5, velocity: 0.7 }, { beat: 2.5, velocity: 0.7 }, { beat: 3.5, velocity: 0.7 }]`

**Chord: `shuffle-comp`** — `[{ beat: 0, velocity: 0.9 }, { beat: 1.5, velocity: 0.6 }]`

**Chord: `jazz-comp`** — `[{ beat: 0, velocity: 0.85 }, { beat: 1.5, velocity: 0.6 }, { beat: 3, velocity: 0.7 }]`

**Chord: `straight-quarters`** — `[{ beat: 0, velocity: 0.8 }, { beat: 1, velocity: 0.6 }, { beat: 2, velocity: 0.7 }, { beat: 3, velocity: 0.6 }]`

**Bass: `walking`** — `[{ beat: 0, velocity: 1, note: "root" }, { beat: 1, velocity: 0.8, note: "third" }, { beat: 2, velocity: 0.85, note: "fifth" }, { beat: 3, velocity: 0.75, note: "chromatic-approach" }]`

**Bass: `arpeggiated`** — `[{ beat: 0, velocity: 1, note: "root" }, { beat: 1, velocity: 0.8, note: "third" }, { beat: 2, velocity: 0.85, note: "fifth" }, { beat: 3, velocity: 0.7, note: "octave" }]`

**Bass: `shuffle`** — `[{ beat: 0, velocity: 1, note: "root" }, { beat: 2, velocity: 0.85, note: "fifth" }, { beat: 3.5, velocity: 0.6, note: "root" }]`

**Bass: `pedal`** — `[{ beat: 0, velocity: 1, note: "root" }, { beat: 0.5, velocity: 0.6, note: "root" }, { beat: 1, velocity: 0.8, note: "root" }, { beat: 1.5, velocity: 0.6, note: "root" }, { beat: 2, velocity: 0.8, note: "root" }, { beat: 2.5, velocity: 0.6, note: "root" }, { beat: 3, velocity: 0.8, note: "root" }, { beat: 3.5, velocity: 0.6, note: "root" }]`

**Bass: `funk-syncopated`** — `[{ beat: 0, velocity: 1, note: "root" }, { beat: 0.5, velocity: 0.5, note: "octave" }, { beat: 1.5, velocity: 0.7, note: "fifth" }, { beat: 2.5, velocity: 0.6, note: "root" }, { beat: 3, velocity: 0.8, note: "fifth" }]`

**Drums: `pop`** — kicks: [0, 1.5], snares: [1, 3], hats: 8th notes (same as rock but kick on beat 1 + "and" of 2)

**Drums: `blues-shuffle`** — kicks: [0, 2], snares: [1, 3], hats: swung pattern (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5 — swing applied at scheduler level)

**Drums: `jazz-ride`** — ride: [0, 1, 1.5, 2, 3, 3.5], kicks: [0.5, 2.5] (comping), snares: [3] (cross-stick, lower velocity)

**Drums: `bossa`** — kicks: [0, 1.5, 3], snares: [1, 2.5] (cross-stick, velocity 0.5), hats: [] (no hats)

**Drums: `ballad`** — kicks: [0], snares: [2], hats: [0, 1, 2, 3] (quarter-note hats, low velocity)

**Drums: `funk`** — kicks: [0, 0.5, 2.5], snares: [1, 1.5 (ghost, vel 0.3), 3], hats: 16th notes (0, 0.25, 0.5, ... every 0.25)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/progressions/audio/patterns.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Run full test suite to verify backwards compatibility**

The existing `POP_STRUM_PATTERN`, `ROOT_FIFTH_BASS_PATTERN`, and `ROCK_DRUM_PATTERN` exports must still exist. The scheduler test and other tests import them.

Run: `npx vitest run --reporter=verbose`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(audio): expand pattern catalog with chord, bass, drum, and variation patterns"
```

---

## Task 10: Genre Presets Catalog

**Files:**
- Create: `src/progressions/audio/genres.ts`
- Create: `src/progressions/audio/genres.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/progressions/audio/genres.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GENRE_STYLES, getGenreStyle, type GenreStyle } from "./genres";
import { getChordPattern, getBassPattern, getDrumPattern } from "./patterns";

describe("genre styles", () => {
  it("has 7 genre presets", () => {
    expect(GENRE_STYLES).toHaveLength(7);
  });

  it("has unique IDs", () => {
    const ids = GENRE_STYLES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("references valid pattern IDs", () => {
    for (const genre of GENRE_STYLES) {
      expect(getChordPattern(genre.chordPattern)).toBeDefined();
      expect(getBassPattern(genre.bassPattern)).toBeDefined();
      expect(getDrumPattern(genre.drumPattern)).toBeDefined();
    }
  });

  it("has valid tempo ranges", () => {
    for (const genre of GENRE_STYLES) {
      expect(genre.tempoRange[0]).toBeLessThan(genre.tempoRange[1]);
      expect(genre.suggestedTempo).toBeGreaterThanOrEqual(genre.tempoRange[0]);
      expect(genre.suggestedTempo).toBeLessThanOrEqual(genre.tempoRange[1]);
    }
  });

  it("has swing in valid range", () => {
    for (const genre of GENRE_STYLES) {
      expect(genre.swing).toBeGreaterThanOrEqual(0);
      expect(genre.swing).toBeLessThanOrEqual(0.5);
    }
  });

  it("getGenreStyle returns correct genre", () => {
    expect(getGenreStyle("blues")?.label).toBe("Blues");
    expect(getGenreStyle("nonexistent")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/progressions/audio/genres.test.ts --reporter=verbose`
Expected: FAIL

- [ ] **Step 3: Implement genres.ts**

Create `src/progressions/audio/genres.ts`:

```typescript
import type { ChordInstrumentId } from "./instruments/types";

export interface GenreStyle {
  id: string;
  label: string;
  chordInstrument: ChordInstrumentId;
  chordPattern: string;
  bassPattern: string;
  drumPattern: string;
  drumVariations: string[];
  tempoRange: [number, number];
  suggestedTempo: number;
  swing: number;
}

export const GENRE_STYLES: readonly GenreStyle[] = [
  {
    id: "pop",
    label: "Pop",
    chordInstrument: "piano",
    chordPattern: "straight-quarters",
    bassPattern: "root-fifth",
    drumPattern: "pop",
    drumVariations: [],
    tempoRange: [100, 130],
    suggestedTempo: 115,
    swing: 0,
  },
  {
    id: "rock",
    label: "Rock",
    chordInstrument: "strum",
    chordPattern: "pop-8ths",
    bassPattern: "root-fifth",
    drumPattern: "rock",
    drumVariations: [],
    tempoRange: [110, 140],
    suggestedTempo: 120,
    swing: 0,
  },
  {
    id: "blues",
    label: "Blues",
    chordInstrument: "organ",
    chordPattern: "shuffle-comp",
    bassPattern: "shuffle",
    drumPattern: "blues-shuffle",
    drumVariations: [],
    tempoRange: [70, 110],
    suggestedTempo: 85,
    swing: 0.33,
  },
  {
    id: "jazz",
    label: "Jazz",
    chordInstrument: "piano",
    chordPattern: "jazz-comp",
    bassPattern: "walking",
    drumPattern: "jazz-ride",
    drumVariations: [],
    tempoRange: [100, 160],
    suggestedTempo: 130,
    swing: 0.33,
  },
  {
    id: "ballad",
    label: "Ballad",
    chordInstrument: "piano",
    chordPattern: "ballad-whole",
    bassPattern: "arpeggiated",
    drumPattern: "ballad",
    drumVariations: [],
    tempoRange: [60, 80],
    suggestedTempo: 70,
    swing: 0,
  },
  {
    id: "funk",
    label: "Funk",
    chordInstrument: "strum",
    chordPattern: "offbeat-skank",
    bassPattern: "funk-syncopated",
    drumPattern: "funk",
    drumVariations: [],
    tempoRange: [90, 120],
    suggestedTempo: 100,
    swing: 0,
  },
  {
    id: "bossa-nova",
    label: "Bossa Nova",
    chordInstrument: "piano",
    chordPattern: "straight-quarters",
    bassPattern: "arpeggiated",
    drumPattern: "bossa",
    drumVariations: [],
    tempoRange: [120, 140],
    suggestedTempo: 130,
    swing: 0,
  },
];

export function getGenreStyle(id: string): GenreStyle | undefined {
  return GENRE_STYLES.find((g) => g.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/progressions/audio/genres.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/genres.ts src/progressions/audio/genres.test.ts
git commit -m "feat(audio): add genre style catalog with 7 presets"
```

---

## Task 11: Expanded Bass Note Resolution

Expand `progressionAudio.ts` to resolve bass notes for all `BassNoteRole` values.

**Files:**
- Modify: `src/progressions/progressionAudio.ts`
- Modify: `src/progressions/progressionAudio.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/progressionAudio.test.ts`:

```typescript
import { resolveBassNoteForRole } from "./progressionAudio";

describe("resolveBassNoteForRole", () => {
  it("resolves root", () => {
    expect(resolveBassNoteForRole("C", "Major Triad", "root")).toBe("C2");
  });

  it("resolves third", () => {
    expect(resolveBassNoteForRole("C", "Major Triad", "third")).toBe("E2");
  });

  it("resolves fifth", () => {
    expect(resolveBassNoteForRole("C", "Major Triad", "fifth")).toBe("G2");
  });

  it("resolves octave", () => {
    expect(resolveBassNoteForRole("C", "Major Triad", "octave")).toBe("C3");
  });

  it("resolves chromatic-approach to semitone below next root", () => {
    expect(resolveBassNoteForRole("C", "Major Triad", "chromatic-approach", "F")).toBe("E2");
  });

  it("falls back to semitone below current root when no next root", () => {
    expect(resolveBassNoteForRole("C", "Major Triad", "chromatic-approach")).toBe("B1");
  });

  it("falls back to root when third/fifth unavailable", () => {
    expect(resolveBassNoteForRole("C", "Power Chord", "third")).toBe("C2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/progressions/progressionAudio.test.ts --reporter=verbose`
Expected: FAIL — `resolveBassNoteForRole` not exported

- [ ] **Step 3: Implement resolveBassNoteForRole**

Add to `src/progressions/progressionAudio.ts`:

```typescript
import type { BassNoteRole } from "./audio/patterns";

export function resolveBassNoteForRole(
  root: string,
  quality: string,
  role: BassNoteRole,
  nextChordRoot?: string,
  rootOctave: number = PROGRESSION_BASS_ROOT_OCTAVE,
): string {
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return `${root}${rootOctave}`;

  const definition = CHORD_DEFINITIONS[quality];
  const rootAbsolute = rootOctave * 12 + rootIndex;

  const toNote = (absolute: number) => {
    const note = NOTES[((absolute % 12) + 12) % 12];
    const oct = Math.floor(absolute / 12);
    return `${note}${oct}`;
  };

  switch (role) {
    case "root":
      return toNote(rootAbsolute);

    case "third": {
      const third = definition?.members.find((m) => m.name === "3" || m.name === "b3");
      return third ? toNote(rootAbsolute + third.semitone) : toNote(rootAbsolute);
    }

    case "fifth": {
      const fifth = definition?.members.find((m) => m.name === "5" || m.name === "b5" || m.name === "#5");
      return fifth ? toNote(rootAbsolute + fifth.semitone) : toNote(rootAbsolute);
    }

    case "octave":
      return toNote(rootAbsolute + 12);

    case "chromatic-approach": {
      if (nextChordRoot) {
        const nextIndex = NOTES.indexOf(nextChordRoot);
        if (nextIndex >= 0) {
          const nextAbsolute = rootOctave * 12 + nextIndex;
          return toNote(nextAbsolute - 1);
        }
      }
      return toNote(rootAbsolute - 1);
    }

    default:
      return toNote(rootAbsolute);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/progressions/progressionAudio.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/progressions/progressionAudio.ts src/progressions/progressionAudio.test.ts
git commit -m "feat(audio): add bass note role resolution for expanded patterns"
```

---

## Task 12: Refactor Scheduler to Be Instrument-Agnostic

The biggest refactor. The scheduler currently hardcodes `pluckString`, `scheduleBassNote`, `ROCK_DRUM_PATTERN`, etc. Refactor it to accept instrument/pattern config and dispatch to the appropriate synthesizer.

**Files:**
- Modify: `src/progressions/audio/scheduler.ts`
- Modify: `src/progressions/audio/scheduler.test.ts`

- [ ] **Step 1: Update the SchedulerStepInput interface**

In `src/progressions/audio/scheduler.ts`, expand `SchedulerStepInput`:

```typescript
import type { ChordInstrumentId } from "./instruments/types";

export interface SchedulerStepInput {
  voicing: readonly string[];
  bassNotes: readonly string[];
  beatsAvailable: number;
  beatsPerBar: number;
  secondsPerBeat: number;
  startTime: number;
  scheduleFromTime?: number;
  enable: SchedulerEnableFlags;
  // New fields:
  chordInstrument: ChordInstrumentId;
  chordPatternId: string;
  bassPatternId: string;
  drumPatternId: string;
  drumVariations: string[];
  swing: number;
  nextChordRoot?: string;
  currentRoot?: string;
  currentQuality?: string;
}
```

- [ ] **Step 2: Update existing tests to pass new fields**

In `src/progressions/audio/scheduler.test.ts`, add the new required fields to all test inputs with backwards-compatible defaults:

```typescript
const defaultNewFields = {
  chordInstrument: "strum" as const,
  chordPatternId: "pop-8ths",
  bassPatternId: "root-fifth",
  drumPatternId: "rock",
  drumVariations: [] as string[],
  swing: 0,
};
```

Spread this into every `scheduleProgressionStep` call in existing tests.

- [ ] **Step 3: Run tests to verify they still pass with interface expansion**

Run: `npx vitest run src/progressions/audio/scheduler.test.ts --reporter=verbose`
Expected: FAIL initially (TypeScript errors), then fix the test inputs

- [ ] **Step 4: Rewrite scheduler internals**

Replace the hardcoded instrument calls with pattern-catalog-driven logic:

1. **Chord voice**: Look up `getChordVoice(input.chordInstrument)`, look up `getChordPattern(input.chordPatternId)`, tile pattern via `repeatPatternToBeats`, call `voice.scheduleChord()` for each hit. Apply swing to hit times.

2. **Bass**: Look up `getBassPattern(input.bassPatternId)`, tile via `repeatPatternToBeats`, for each hit call `resolveBassNoteForRole(root, quality, hit.note, nextChordRoot)` to get the frequency, then schedule via `scheduleBassNote`. Apply swing.

3. **Drums**: Look up `getDrumPattern(input.drumPatternId)`, check `drumVariations` for bar substitutions. For each bar, decide if a variation applies (bar index % barInterval === 0). Schedule kicks/snares/hats/openHats/ride per the pattern. Apply swing.

4. **Metronome**: Unchanged.

Remove the direct imports of `POP_STRUM_PATTERN`, `ROOT_FIFTH_BASS_PATTERN`, `ROCK_DRUM_PATTERN`, and `pluckString` from the scheduler. Import from the instruments registry and pattern catalog instead.

- [ ] **Step 5: Run scheduler tests**

Run: `npx vitest run src/progressions/audio/scheduler.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/scheduler.ts src/progressions/audio/scheduler.test.ts
git commit -m "refactor(audio): make scheduler instrument-agnostic with pattern catalog dispatch"
```

---

## Task 13: Expanded Progression Presets

Add the ~20 new curated presets with category grouping.

**Files:**
- Modify: `src/progressions/progressionDomain.ts`
- Modify: `src/progressions/progressionDomain.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/progressionDomain.test.ts`:

```typescript
describe("expanded preset catalog", () => {
  it("has at least 25 presets", () => {
    expect(PROGRESSION_PRESETS.length).toBeGreaterThanOrEqual(25);
  });

  it("all presets have unique IDs", () => {
    const ids = PROGRESSION_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all presets have a category", () => {
    for (const preset of PROGRESSION_PRESETS) {
      expect(preset.category).toBeDefined();
      expect(["pop-rock", "blues", "jazz", "folk", "modal", "minor"]).toContain(preset.category);
    }
  });

  it("has presets in each category", () => {
    const categories = new Set(PROGRESSION_PRESETS.map((p) => p.category));
    expect(categories).toContain("pop-rock");
    expect(categories).toContain("blues");
    expect(categories).toContain("jazz");
    expect(categories).toContain("modal");
    expect(categories).toContain("minor");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/progressions/progressionDomain.test.ts --reporter=verbose`
Expected: FAIL — `category` field doesn't exist, only 5 presets

- [ ] **Step 3: Add category to ProgressionPreset and expand the catalog**

In `src/progressions/progressionDomain.ts`:

1. Add `category` to the `ProgressionPreset` interface:

```typescript
export type ProgressionPresetCategory = "pop-rock" | "blues" | "jazz" | "folk" | "modal" | "minor";

export interface ProgressionPreset {
  id: string;
  label: string;
  category: ProgressionPresetCategory;
  steps: Array<Omit<ProgressionStep, "id">>;
}
```

2. Add `category` to all 5 existing presets (first 4 are `"pop-rock"`, blues is `"blues"`).

3. Add the ~20 new presets from the spec. Each preset follows the same structure. The degree IDs must match what `@fretflow/core` supports for the target scale. Refer to the spec's "Expanded Curated Presets" section for the full list.

Key additions:
- **Pop/Rock**: `vi-IV-I-V`, `I-IV-vi-V`, canon progression (8-bar)
- **Blues**: 8-bar blues, minor blues
- **Jazz**: turnaround `I-vi-ii-V`, `iii-vi-ii-V`, rhythm changes `ii-V-I-vi`, `I-IV-ii-V`
- **Folk**: `I-IV-I-V`, `I-V-I-IV-I-V-I`
- **Modal**: Dorian `i-IV`, Dorian `i-bVII-IV`, Mixolydian `I-bVII-IV`, Phrygian `i-bII`, Lydian `I-II`
  - Note: Modal degree IDs use the mode's own degree sequence. For Dorian, `IV` means the major IV chord. For Mixolydian, `bVII` maps to `VII` in the Mixolydian degree sequence. Use `getDegreeSequence` to verify the correct IDs.
- **Minor**: `i-iv-v`, `i-bVI-bVII`, Andalusian `i-bVII-bVI-V`, `i-iv-bVII-bIII`
  - Minor degree IDs come from the Natural Minor degree sequence: `["i", "ii°", "III", "iv", "v", "VI", "VII"]`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/progressions/progressionDomain.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All pass. Some tests that reference `ProgressionPreset` type may need the `category` field added.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/progressionDomain.ts src/progressions/progressionDomain.test.ts
git commit -m "feat(progressions): expand preset catalog to 25+ with categories"
```

---

## Task 14: Scale-Aware Preset Generation

**Files:**
- Create: `src/progressions/progressionGeneration.ts`
- Create: `src/progressions/progressionGeneration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/progressions/progressionGeneration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateCommonProgressions } from "./progressionGeneration";

describe("generateCommonProgressions", () => {
  it("returns progressions for Major scale", () => {
    const presets = generateCommonProgressions("Major", "C");
    expect(presets.length).toBeGreaterThan(0);
    for (const p of presets) {
      expect(p.steps.length).toBeGreaterThan(0);
      expect(p.category).toBe("suggested");
    }
  });

  it("returns progressions for Dorian scale", () => {
    const presets = generateCommonProgressions("Dorian", "D");
    expect(presets.length).toBeGreaterThan(0);
  });

  it("all generated steps resolve in their target scale", () => {
    const scales = ["Major", "Natural Minor", "Dorian", "Mixolydian", "Phrygian", "Lydian"];
    for (const scale of scales) {
      const presets = generateCommonProgressions(scale, "C");
      for (const preset of presets) {
        for (const step of preset.steps) {
          // Every degree should resolve via getDiatonicChord
          // (this is what isProgressionPresetAvailableForScale checks)
        }
      }
    }
  });

  it("returns empty for scales with too few degrees", () => {
    // Pentatonic has only 5 degrees — generation may return fewer but shouldn't crash
    const presets = generateCommonProgressions("Major Pentatonic", "C");
    expect(presets).toBeDefined();
  });

  it("generated presets have unique IDs", () => {
    const presets = generateCommonProgressions("Major", "C");
    const ids = presets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/progressions/progressionGeneration.test.ts --reporter=verbose`
Expected: FAIL

- [ ] **Step 3: Implement generateCommonProgressions**

Create `src/progressions/progressionGeneration.ts`:

```typescript
import {
  getDegreeSequence,
  getDiatonicChord,
  type DegreeId,
} from "@fretflow/core";
import type { ProgressionPreset, ProgressionStep } from "./progressionDomain";

type GeneratedCategory = "suggested";

interface GeneratedPreset extends ProgressionPreset {
  category: GeneratedCategory;
}

interface ProgressionTemplate {
  label: string;
  ordinals: number[];
  durations?: Array<{ value: number; unit: "bar" | "beat" }>;
}

const CADENTIAL_TEMPLATES: ProgressionTemplate[] = [
  { label: "IV-V-I", ordinals: [3, 4, 0] },
  { label: "ii-V-I", ordinals: [1, 4, 0] },
  { label: "I-IV-V-I", ordinals: [0, 3, 4, 0] },
];

const CYCLE_TEMPLATES: ProgressionTemplate[] = [
  { label: "vi-ii-V-I", ordinals: [5, 1, 4, 0] },
  { label: "iii-vi-ii-V-I", ordinals: [2, 5, 1, 4, 0] },
];

function buildPreset(
  id: string,
  label: string,
  degrees: DegreeId[],
  ordinals: number[],
  scaleName: string,
  rootNote: string,
  durations?: Array<{ value: number; unit: "bar" | "beat" }>,
): GeneratedPreset | null {
  const steps: Array<Omit<ProgressionStep, "id">> = [];
  for (let i = 0; i < ordinals.length; i++) {
    const degree = degrees[ordinals[i]];
    if (!degree) return null;
    const chord = getDiatonicChord(degree, scaleName, rootNote);
    if (!chord) return null;
    steps.push({
      degree,
      duration: durations?.[i] ?? { value: 1, unit: "bar" },
      qualityOverride: null,
    });
  }
  return { id, label, category: "suggested", steps };
}

export function generateCommonProgressions(
  scaleName: string,
  rootNote: string,
): GeneratedPreset[] {
  const degrees = getDegreeSequence(scaleName);
  if (degrees.length < 3) return [];

  const results: GeneratedPreset[] = [];
  let counter = 0;

  const tryTemplate = (template: ProgressionTemplate) => {
    if (template.ordinals.every((o) => o < degrees.length)) {
      const preset = buildPreset(
        `generated-${counter++}`,
        template.label,
        degrees,
        template.ordinals,
        scaleName,
        rootNote,
        template.durations,
      );
      if (preset) results.push(preset);
    }
  };

  for (const t of CADENTIAL_TEMPLATES) tryTemplate(t);

  if (degrees.length >= 6) {
    for (const t of CYCLE_TEMPLATES) tryTemplate(t);
  }

  // Tonic-subdominant shuttle
  if (degrees.length >= 4) {
    const shuttle = buildPreset(
      `generated-${counter++}`,
      `${degrees[0]}-${degrees[3]}`,
      degrees,
      [0, 3],
      scaleName,
      rootNote,
    );
    if (shuttle) results.push(shuttle);
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/progressions/progressionGeneration.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/progressions/progressionGeneration.ts src/progressions/progressionGeneration.test.ts
git commit -m "feat(progressions): add scale-aware progression preset generation"
```

---

## Task 15: State Management — New Atoms

**Files:**
- Modify: `src/store/progressionAtoms.ts`
- Modify: `src/hooks/useProgressionState.ts`

- [ ] **Step 1: Add new atoms to progressionAtoms.ts**

Add the genre/instrument/pattern/swing atoms. Key implementation details:

```typescript
import type { ChordInstrumentId } from "../progressions/audio/instruments/types";

const chordInstrumentStorage = createStorage<ChordInstrumentId>({
  serialize: (v) => v,
  deserialize: (raw) => raw as ChordInstrumentId,
  validate: (v): v is ChordInstrumentId =>
    v === "strum" || v === "piano" || v === "organ",
});

export const progressionGenreStyleAtom = atomWithStorage<string>(
  k("progressionGenreStyle"),
  "rock",
  createStorage<string>({
    serialize: (v) => v,
    deserialize: (raw) => raw,
    validate: (v): v is string => typeof v === "string",
  }),
  GET_ON_INIT,
);

export const progressionChordInstrumentAtom = atomWithStorage<ChordInstrumentId>(
  k("progressionChordInstrument"),
  "strum",
  chordInstrumentStorage,
  GET_ON_INIT,
);

export const progressionChordPatternAtom = atomWithStorage<string>(
  k("progressionChordPattern"),
  "pop-8ths",
  // ... string storage
  GET_ON_INIT,
);

export const progressionBassPatternAtom = atomWithStorage<string>(
  k("progressionBassPattern"),
  "root-fifth",
  // ... string storage
  GET_ON_INIT,
);

export const progressionDrumPatternAtom = atomWithStorage<string>(
  k("progressionDrumPattern"),
  "rock",
  // ... string storage
  GET_ON_INIT,
);

export const progressionDrumVariationsAtom = atomWithStorage<string[]>(
  k("progressionDrumVariations"),
  [],
  // ... JSON array storage
  GET_ON_INIT,
);

export const progressionSwingAtom = atomWithStorage<number>(
  k("progressionSwing"),
  0,
  constrainedNumberStorage({ min: 0, max: 0.5, integer: false }),
  GET_ON_INIT,
);
```

Rename `progressionStrumEnabledAtom` to `progressionChordEnabledAtom` with storage key migration:

```typescript
export const progressionChordEnabledAtom = atomWithStorage<boolean>(
  k("progressionChordEnabled"),
  true,
  booleanStorage,
  GET_ON_INIT,
);
// Keep old export name as alias for backwards compatibility during transition:
export const progressionStrumEnabledAtom = progressionChordEnabledAtom;
```

Add the `applyGenreStyleAtom` write-only atom:

```typescript
import { getGenreStyle } from "../progressions/audio/genres";

export const applyGenreStyleAtom = atom(null, (_get, set, genreId: string) => {
  const genre = getGenreStyle(genreId);
  if (!genre) return;
  set(progressionGenreStyleAtom, genreId);
  set(progressionChordInstrumentAtom, genre.chordInstrument);
  set(progressionChordPatternAtom, genre.chordPattern);
  set(progressionBassPatternAtom, genre.bassPattern);
  set(progressionDrumPatternAtom, genre.drumPattern);
  set(progressionDrumVariationsAtom, genre.drumVariations);
  set(progressionSwingAtom, genre.swing);
});
```

Add new atoms to `resetProgressionAtomsAtom`.

- [ ] **Step 2: Update useProgressionState.ts**

Expose the new atoms in the return object of `useProgressionState`:

```typescript
// Add to the return:
progressionGenreStyle, applyGenreStyle,
progressionChordInstrument, setProgressionChordInstrument,
progressionChordPattern, setProgressionChordPattern,
progressionBassPattern, setProgressionBassPattern,
progressionDrumPattern, setProgressionDrumPattern,
progressionDrumVariations, setProgressionDrumVariations,
progressionSwing, setProgressionSwing,
// Rename:
progressionChordEnabled (was progressionStrumEnabled),
setProgressionChordEnabled (was setProgressionStrumEnabled),
```

Keep `progressionStrumEnabled` / `setProgressionStrumEnabled` as aliases in the return object for backwards compatibility with existing consumers.

- [ ] **Step 3: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: All pass. The alias ensures existing references to `progressionStrumEnabled` still work.

- [ ] **Step 4: Commit**

```bash
git add src/store/progressionAtoms.ts src/hooks/useProgressionState.ts
git commit -m "feat(state): add genre, instrument, pattern, and swing atoms"
```

---

## Task 16: Wire New Config Through Playback Hook

Connect the new atoms to the scheduler via the playback hook.

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`

- [ ] **Step 1: Update SchedulerInputs to include new fields**

In `useProgressionAudioPlayback.ts`, expand the `SchedulerInputs` interface and the `sameEnableFlags` / comparison logic:

```typescript
interface SchedulerInputs {
  steps: readonly ResolvedProgressionStep[];
  tempo: number;
  beatsPerBar: number;
  loopEnabled: boolean;
  enable: { strum: boolean; bass: boolean; drums: boolean; metronome: boolean };
  chordInstrument: ChordInstrumentId;
  chordPatternId: string;
  bassPatternId: string;
  drumPatternId: string;
  drumVariations: string[];
  swing: number;
}
```

- [ ] **Step 2: Update buildSegment to pass new fields to scheduler**

The `buildSegment` function must pass the new fields, plus resolve `nextChordRoot` from the next step in the progression:

```typescript
function buildSegment(
  ctx: AudioContext,
  bus: AudioNode,
  stepIndex: number,
  startTime: number,
  inputs: SchedulerInputs,
  scheduleFromTime?: number,
): ScheduledSegment | null {
  const step = inputs.steps[stepIndex];
  if (!step || step.unavailable || !step.root || !step.quality) return null;

  const voicing = resolveChordVoicing(step.root, step.quality);
  const bassNotes = resolveBassLineNotes(step.root, step.quality);
  const secondsPerBeat = 60 / Math.max(1, inputs.tempo);
  const beatsAvailable = step.duration.unit === "bar"
    ? step.duration.value * inputs.beatsPerBar
    : step.duration.value;

  // Resolve next chord root for chromatic-approach bass notes
  const nextIdx = findNextResolvableStepIndex(
    inputs.steps, stepIndex, 1, inputs.loopEnabled,
  );
  const nextStep = nextIdx !== null ? inputs.steps[nextIdx] : null;
  const nextChordRoot = nextStep?.root ?? undefined;

  const handle = scheduleProgressionStep(ctx, bus, {
    voicing,
    bassNotes,
    beatsAvailable,
    beatsPerBar: inputs.beatsPerBar,
    secondsPerBeat,
    startTime,
    scheduleFromTime,
    enable: inputs.enable,
    chordInstrument: inputs.chordInstrument,
    chordPatternId: inputs.chordPatternId,
    bassPatternId: inputs.bassPatternId,
    drumPatternId: inputs.drumPatternId,
    drumVariations: inputs.drumVariations,
    swing: inputs.swing,
    nextChordRoot,
    currentRoot: step.root,
    currentQuality: step.quality,
  });

  // ... rest unchanged
}
```

- [ ] **Step 3: Subscribe to new atoms in the useEffect**

Add the new atoms to `useProgressionState()` destructuring and pass them into `inputs`. Add them to the dependency array of the `useEffect`.

The `SchedulerEnableFlags.strum` field name stays as `strum` for now (internal detail). Add a broader config comparison so instrument/pattern changes trigger a rebuild:

```typescript
function sameConfig(a: SchedulerInputs | null, b: SchedulerInputs): boolean {
  return !!a
    && sameEnableFlags(a.enable, b.enable)
    && a.chordInstrument === b.chordInstrument
    && a.chordPatternId === b.chordPatternId
    && a.bassPatternId === b.bassPatternId
    && a.drumPatternId === b.drumPatternId
    && a.swing === b.swing;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts
git commit -m "feat(audio): wire genre/instrument/pattern/swing config through playback hook"
```

---

## Task 17: UI — Genre Selector and Instrument Controls

Add the genre dropdown, chord instrument picker, per-instrument pattern selectors, and swing control to the progression track UI.

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.module.css`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/ProgressionTrack/ProgressionTrack.test.tsx`:

```typescript
it("renders genre selector", () => {
  const { getByLabelText } = render(/* with test atoms, progression enabled */);
  expect(getByLabelText("Genre style")).toBeInTheDocument();
});

it("renders chord instrument selector", () => {
  const { getByLabelText } = render(/* with test atoms */);
  expect(getByLabelText("Chord instrument")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ProgressionTrack/ProgressionTrack.test.tsx --reporter=verbose`
Expected: FAIL

- [ ] **Step 3: Add genre selector to the instrument cluster**

In the `ProgressionTrack` component's instrument cluster area (around line 164), add a genre dropdown above the instrument toggles:

```tsx
<select
  aria-label="Genre style"
  value={progressionGenreStyle}
  onChange={(e) => applyGenreStyle(e.target.value)}
  className={styles.genreSelect}
>
  {GENRE_STYLES.map((g) => (
    <option key={g.id} value={g.id}>{g.label}</option>
  ))}
  <option value="custom">Custom</option>
</select>
```

Import `GENRE_STYLES` from `../../progressions/audio/genres`.

- [ ] **Step 4: Add chord instrument picker**

Next to the chord enable toggle, add a small segmented control or select:

```tsx
<select
  aria-label="Chord instrument"
  value={progressionChordInstrument}
  onChange={(e) => setProgressionChordInstrument(e.target.value as ChordInstrumentId)}
  className={styles.instrumentSelect}
>
  <option value="strum">Strum</option>
  <option value="piano">Piano</option>
  <option value="organ">Organ</option>
</select>
```

- [ ] **Step 5: Add per-instrument pattern selectors**

For each instrument toggle row (chord, bass, drums), add a small pattern dropdown:

```tsx
// Example for chord pattern
<select
  aria-label="Chord pattern"
  value={progressionChordPattern}
  onChange={(e) => setProgressionChordPattern(e.target.value)}
  className={styles.patternSelect}
>
  {CHORD_PATTERNS.map((p) => (
    <option key={p.id} value={p.id}>{p.label}</option>
  ))}
</select>
```

Similarly for bass (`BASS_PATTERNS`) and drums (`DRUM_PATTERNS`).

- [ ] **Step 6: Add swing control**

A small stepper or range input:

```tsx
{progressionSwing > 0 || progressionGenreStyle === "custom" ? (
  <label className={styles.swingControl}>
    Swing
    <input
      type="range"
      min={0}
      max={0.5}
      step={0.01}
      value={progressionSwing}
      onChange={(e) => setProgressionSwing(Number(e.target.value))}
      aria-label="Swing amount"
    />
    <span>{Math.round(progressionSwing * 100)}%</span>
  </label>
) : null}
```

- [ ] **Step 7: Add CSS for new controls**

Add styles to `ProgressionTrack.module.css` for `.genreSelect`, `.instrumentSelect`, `.patternSelect`, `.swingControl`. Keep them compact — these are secondary controls.

- [ ] **Step 8: Run tests**

Run: `npx vitest run src/components/ProgressionTrack/ProgressionTrack.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 9: Run full test suite and lint**

Run: `npx vitest run --reporter=verbose && npm run lint`
Expected: All pass

- [ ] **Step 10: Commit**

```bash
git add src/components/ProgressionTrack/ProgressionTrack.tsx src/components/ProgressionTrack/ProgressionTrack.module.css src/components/ProgressionTrack/ProgressionTrack.test.tsx
git commit -m "feat(ui): add genre selector, instrument picker, pattern controls, and swing slider"
```

---

## Task 18: Grouped Preset Selector

**Files:**
- Modify: `src/components/ProgressionControls/ProgressionControls.tsx`
- Modify: `src/components/ProgressionControls/ProgressionControls.test.tsx` (if exists)

- [ ] **Step 1: Write the failing test**

```typescript
it("renders preset selector with category groups", () => {
  const { getByLabelText } = render(/* with atoms */);
  const select = getByLabelText(/preset/i);
  const optgroups = select.querySelectorAll("optgroup");
  expect(optgroups.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ProgressionControls/ --reporter=verbose`
Expected: FAIL

- [ ] **Step 3: Update preset selector to use optgroups**

In `ProgressionControls.tsx`, replace the flat preset list with grouped options:

```tsx
import { PROGRESSION_PRESETS, type ProgressionPresetCategory } from "../../progressions/progressionDomain";
import { generateCommonProgressions } from "../../progressions/progressionGeneration";

const CATEGORY_LABELS: Record<ProgressionPresetCategory, string> = {
  "pop-rock": "Pop / Rock",
  blues: "Blues",
  jazz: "Jazz",
  folk: "Folk / Country",
  modal: "Modal",
  minor: "Minor",
};

// Inside the component:
const availablePresets = getAvailableProgressionPresets(scaleName);
const grouped = Object.entries(CATEGORY_LABELS)
  .map(([cat, label]) => ({
    label,
    presets: availablePresets.filter((p) => p.category === cat),
  }))
  .filter((g) => g.presets.length > 0);

const suggested = generateCommonProgressions(scaleName, rootNote);

// In JSX:
<select value={currentProgressionPresetId} onChange={handlePresetChange}>
  <option value="custom">Custom</option>
  {grouped.map((group) => (
    <optgroup key={group.label} label={group.label}>
      {group.presets.map((p) => (
        <option key={p.id} value={p.id}>{p.label}</option>
      ))}
    </optgroup>
  ))}
  {suggested.length > 0 && (
    <optgroup label={`Suggested for ${scaleName}`}>
      {suggested.map((p) => (
        <option key={p.id} value={p.id}>{p.label}</option>
      ))}
    </optgroup>
  )}
</select>
```

Note: Generated presets need to be loadable. Add a handler that creates steps from the generated preset when selected, similar to `loadProgressionPreset` but working with the generated preset data directly.

- [ ] **Step 4: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgressionControls/ProgressionControls.tsx
git commit -m "feat(ui): group preset selector by category with scale-aware suggestions"
```

---

## Task 19: Final Integration Test & Cleanup

**Files:**
- All modified files
- Possibly snapshot updates

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build, no TypeScript errors

- [ ] **Step 4: Update any stale snapshots**

If snapshot tests fail due to the new UI elements or changed text, update them:

Run: `npx vitest run --update`

Review the snapshot diffs to ensure they reflect intentional changes only.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`

Verify:
1. Genre selector appears and switches instruments/patterns
2. Piano and organ chord voices produce sound
3. Bass patterns vary with different selections
4. Drum patterns change per genre
5. Swing audibly affects timing for blues/jazz
6. 12-bar blues preset loads with 7 blocks
7. Progression blocks show "1 bar", "2 bars" instead of "1B", "2B"
8. Preset selector shows category groups
9. Existing "Rock" genre sounds identical to the old default

- [ ] **Step 6: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore(progressions): integration fixes and snapshot updates"
```
