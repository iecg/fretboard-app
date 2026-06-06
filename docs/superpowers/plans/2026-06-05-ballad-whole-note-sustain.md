# Ballad Whole-Note Sustain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Ballad Whole Notes" chord pattern ring for the full bar at any tempo instead of a fixed ~half-note duration.

**Architecture:** Compute a tempo/bar-aware `durationSec` for `style: "sustained"` chord hits in the scheduler (`buildAllLayers`), and make the pooled chord voice (`createReusableChordVoice`, used by piano/organ) honor an explicit `options.durationSec` instead of always using the patch's fixed `sustainedDurationSec`.

**Tech Stack:** TypeScript, Vitest, Tone.js (mocked in tests via `src/test-utils/toneMocks.ts`).

---

## Background (read before starting)

Root cause: `ballad-whole` (`src/progressions/audio/patterns.ts:134`) emits one hit at beat 0 with `style: "sustained"`. The ballad genre uses `chordInstrument: "piano"` → `createReusableChordVoice`, which rings for the patch's fixed `sustainedDurationSec` (Grand Piano = `1.4s`). That is not tempo-aware: at ~70 BPM it is ~1.6 beats (a half note), not a whole note. Separately, `createReusableChordVoice` currently ignores `ChordVoiceOptions.durationSec` entirely.

`ballad-whole` is the **only** pattern using `style: "sustained"`, so this change does not affect strum-based genres (rock/funk).

Execute the tasks in order. Task 1 makes the voice honor an explicit duration; Task 2 makes the scheduler emit one. Task 3 fixes a stale comment.

---

## Task 1: Honor `options.durationSec` in the pooled chord voice

**Files:**
- Modify: `src/progressions/audio/instruments/createReusableChordVoice.ts:15-16`
- Test: `src/progressions/audio/instruments/createReusableChordVoice.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/progressions/audio/instruments/createReusableChordVoice.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PolyChordSpec } from "../sound/patchTypes";

const tone = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../../test-utils/toneMocks");
  return createToneSynthSpies();
});

vi.mock("tone", async () => {
  const t = await tone;
  return {
    // createReusableChordVoice calls `new Tone.PolySynth(Tone.Synth, opts)`.
    // Reuse the shared synth-instance spy as the PolySynth constructor so
    // instance.triggerAttackRelease forwards to spies.triggerAttackRelease.
    PolySynth: t.spies.ctorSpy,
    Synth: function Synth() {},
    now: () => t.now(),
  };
});

import { createReusableChordVoice } from "./createReusableChordVoice";

const spec: PolyChordSpec = {
  volume: -6,
  maxPolyphonyFloor: 6,
  oscillator: { type: "custom", partials: [1, 0.5] },
  envelope: { attack: 0.004, decay: 0.5, sustain: 0.08, release: 1.4 },
  releaseTailSec: 1.4,
  sustainedDurationSec: 1.4,
  shortDurationSec: 0.4,
};

describe("createReusableChordVoice — durationSec handling", () => {
  beforeEach(async () => {
    (await tone).reset();
  });

  it("uses an explicit options.durationSec over the patch default", async () => {
    const t = await tone;
    const voice = createReusableChordVoice(spec);
    voice.scheduleChord({} as AudioNode, ["C4", "E4", "G4"], 0, {
      velocity: 0.8,
      style: "sustained",
      durationSec: 3.5,
    });
    // triggerAttackRelease(notes, duration, time, velocity) — duration is arg[1].
    const [, duration] = t.spies.triggerAttackRelease.mock.calls[0]!;
    expect(duration).toBe(3.5);
  });

  it("falls back to spec.sustainedDurationSec when no override is given", async () => {
    const t = await tone;
    const voice = createReusableChordVoice(spec);
    voice.scheduleChord({} as AudioNode, ["C4", "E4", "G4"], 0, {
      velocity: 0.8,
      style: "sustained",
    });
    const [, duration] = t.spies.triggerAttackRelease.mock.calls[0]!;
    expect(duration).toBe(spec.sustainedDurationSec);
  });

  it("falls back to spec.shortDurationSec for non-sustained with no override", async () => {
    const t = await tone;
    const voice = createReusableChordVoice(spec);
    voice.scheduleChord({} as AudioNode, ["C4", "E4", "G4"], 0, {
      velocity: 0.8,
      style: "staccato",
    });
    const [, duration] = t.spies.triggerAttackRelease.mock.calls[0]!;
    expect(duration).toBe(spec.shortDurationSec);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/instruments/createReusableChordVoice.test.ts`
Expected: the first test FAILS — `duration` is `1.4` (patch default) instead of `3.5`. The other two should pass.

- [ ] **Step 3: Make the voice honor the override**

In `src/progressions/audio/instruments/createReusableChordVoice.ts`, change `durationFor` (lines 15-16) from:

```ts
  const durationFor = (o: ChordVoiceOptions) =>
    o.style === "sustained" ? spec.sustainedDurationSec : spec.shortDurationSec;
```

to:

```ts
  const durationFor = (o: ChordVoiceOptions) =>
    o.durationSec ?? (o.style === "sustained" ? spec.sustainedDurationSec : spec.shortDurationSec);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/instruments/createReusableChordVoice.test.ts`
Expected: all three tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/instruments/createReusableChordVoice.ts src/progressions/audio/instruments/createReusableChordVoice.test.ts
git commit -m "fix(progressions): honor explicit durationSec in pooled chord voice"
```

---

## Task 2: Emit a bar-aware sustain duration in the scheduler

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts:294-331` (the chord-hit loop)
- Test: `src/progressions/audio/buildAllLayers.test.ts` (add to the existing `chord strum durationSec emission` describe block, ends at line ~303)

- [ ] **Step 1: Write the failing tests**

In `src/progressions/audio/buildAllLayers.test.ts`, inside the `describe("chord strum durationSec emission", ...)` block (after the existing `it("rings the stab well above the muted choke ...")` test at ~line 302, before the block's closing `});`), add:

```ts
    it("rings the ballad whole-note chord for the full bar (tempo-aware)", async () => {
      // 60 bpm → 1 beat = 1s; 4/4 bar = 4s. ballad-whole = one sustained hit on beat 0.
      const layers = await buildAllLayersAsync({
        ...baseInput,
        tempoBpm: 60,
        beatsPerBar: 4,
        chordPatternId: "ballad-whole",
        steps: [step({ duration: { value: 1, unit: "bar" } })],
      });
      expect(layers.chordStrums).toHaveLength(1);
      expect(layers.chordStrums[0]!.value.durationSec).toBeCloseTo(4, 6);
    });

    it("scales the ballad whole-note duration with tempo and meter", async () => {
      // 120 bpm → 1 beat = 0.5s; 3/4 bar = 1.5s.
      const layers = await buildAllLayersAsync({
        ...baseInput,
        tempoBpm: 120,
        beatsPerBar: 3,
        chordPatternId: "ballad-whole",
        steps: [step({ duration: { value: 1, unit: "bar" } })],
      });
      expect(layers.chordStrums).toHaveLength(1);
      expect(layers.chordStrums[0]!.value.durationSec).toBeCloseTo(1.5, 6);
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "ballad whole-note"`
Expected: both FAIL — `durationSec` is currently `undefined` for the sustained hit.

- [ ] **Step 3: Compute the sustain duration in the chord-hit loop**

In `src/progressions/audio/buildAllLayers.ts`, the chord-hit loop currently reads (around lines 294-331):

```ts
        for (const hit of hits) {
          const isLhBass =
            hit.voiceRole === "bass-root" || hit.voiceRole === "bass-fifth";
          const baseTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          const { time: hitTime, velocity } = applyJitter({
            time: baseTime,
            velocity: hit.velocity,
            seed: stepIndex * 10000 + bar * 100 + hit.beat,
            // LH bass doubles the upright an octave up — lock it to the grid.
            ...(isLhBass ? { timeAmountSec: 0 } : {}),
          });
          chordStrums.push({
            time: hitTime,
            value: {
              voicing:
                hit.voiceRole === "bass-root"
                  ? bassRootVoicing
                  : hit.voiceRole === "bass-fifth"
                    ? bassFifthVoicing
                    : hit.articulation === "color-stab"
                      ? colorVoicing
                      : hit.articulation === "root"
                        ? rootNoteVoicing
                        : compVoicing,
              velocity,
              style: hit.style,
              direction: hit.direction,
              durationSec:
                hit.articulation === "muted"
                  ? MUTED_STRUM_DURATION_SEC
                  : hit.articulation === "root"
                    ? ROOT_STRUM_DURATION_SEC
                    : hit.articulation === "stab" || hit.articulation === "color-stab"
                      ? STAB_STRUM_DURATION_SEC
                      : undefined,
            },
          });
        }
```

Replace the `for (const hit of hits)` header with an indexed loop and add a sustained-duration branch. The full replacement block:

```ts
        for (let hitIndex = 0; hitIndex < hits.length; hitIndex++) {
          const hit = hits[hitIndex];
          const isLhBass =
            hit.voiceRole === "bass-root" || hit.voiceRole === "bass-fifth";
          const baseTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          const { time: hitTime, velocity } = applyJitter({
            time: baseTime,
            velocity: hit.velocity,
            seed: stepIndex * 10000 + bar * 100 + hit.beat,
            // LH bass doubles the upright an octave up — lock it to the grid.
            ...(isLhBass ? { timeAmountSec: 0 } : {}),
          });
          // A sustained chord rings until the next hit in the bar, or to the bar
          // end when it is the last hit — a true whole note for ballad-whole,
          // tempo- and meter-aware at any setting.
          const nextHitBeat = hits[hitIndex + 1]?.beat ?? eventBeats;
          const sustainedDurationSec =
            Math.max(0, nextHitBeat - hit.beat) * secondsPerBeat;
          chordStrums.push({
            time: hitTime,
            value: {
              voicing:
                hit.voiceRole === "bass-root"
                  ? bassRootVoicing
                  : hit.voiceRole === "bass-fifth"
                    ? bassFifthVoicing
                    : hit.articulation === "color-stab"
                      ? colorVoicing
                      : hit.articulation === "root"
                        ? rootNoteVoicing
                        : compVoicing,
              velocity,
              style: hit.style,
              direction: hit.direction,
              durationSec:
                hit.articulation === "muted"
                  ? MUTED_STRUM_DURATION_SEC
                  : hit.articulation === "root"
                    ? ROOT_STRUM_DURATION_SEC
                    : hit.articulation === "stab" || hit.articulation === "color-stab"
                      ? STAB_STRUM_DURATION_SEC
                      : hit.style === "sustained"
                        ? sustainedDurationSec
                        : undefined,
            },
          });
        }
```

Note: `eventBeats` and `secondsPerBeat` are already in scope in this loop (defined at lines ~269 and earlier in the function).

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "ballad whole-note"`
Expected: both PASS.

- [ ] **Step 5: Run the full buildAllLayers suite (regression guard)**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts`
Expected: all PASS — including the existing `leaves durationSec undefined for a pattern with no muted hits` test (pop-8ths has no sustained hits, so it stays `undefined`).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "fix(progressions): ring ballad whole-note chords for the full bar"
```

---

## Task 3: Update the stale `durationSec` doc comment

**Files:**
- Modify: `src/progressions/audio/instruments/types.ts:12-14`

- [ ] **Step 1: Update the comment**

In `src/progressions/audio/instruments/types.ts`, the `durationSec` field on `ChordVoiceOptions` (lines 12-14) currently reads:

```ts
  /** Per-stroke note length override (seconds). Used by the strum voice for
   *  muted chicken-scratch strokes; ignored by piano/organ voices. */
  durationSec?: number;
```

Replace with:

```ts
  /** Per-stroke note length override (seconds). Honored by all chord voices
   *  (strum, piano, organ); when omitted each voice uses its own default
   *  (the strum's `noteDurationSec`, or the poly patch's
   *  sustained/short duration). */
  durationSec?: number;
```

- [ ] **Step 2: Type-check / build the comment change**

Run: `pnpm exec tsc -b`
Expected: no errors (comment-only change).

- [ ] **Step 3: Commit**

```bash
git add src/progressions/audio/instruments/types.ts
git commit -m "docs(progressions): correct durationSec comment — all voices honor it"
```

---

## Task 4: Full verification

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: no errors.

- [ ] **Step 2: Test**

Run: `pnpm run test`
Expected: all tests pass.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: build succeeds (`tsc -b && vite build`).

- [ ] **Step 4: Manual audio check (optional but recommended)**

Run: `pnpm run dev`, load a progression, select the **Ballad** genre, and play. Confirm each chord now rings across the whole bar instead of decaying around the half-bar mark, at both a slow and a faster tempo.

---

## Notes on edge cases (already covered by the design)

- **Release tail:** `releaseTailSec` still applies on top of the computed `durationSec`, giving a natural decay past the bar boundary — desirable for a ballad. No change needed.
- **Multi-hit sustained patterns:** none exist today. If one is added, each sustained hit will correctly ring hit-to-hit, with the last hit ringing to the bar end — because `nextHitBeat` falls back to `eventBeats`.
- **Cell-sliced patterns (`bars > 1`):** `hits` is already resolved per-bar before this loop, so the duration is computed against the correct per-bar hit list automatically.
