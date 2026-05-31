# Funk Guitar Voice Rebuild (MonoSynth + Amp Strip) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the funk chord voice's bare `Tone.PluckSynth` with a `Tone.MonoSynth` single-coil source through a clean `EQ3` amp channel strip, so it reads as an electric funk guitar instead of a synthetic pluck.

**Architecture:** Two halves — a per-note `Tone.MonoSynth` source (sawtooth → lowpass + snappy filter envelope for the pick "spank", percussive amp envelope) and a per-bus amp/cab coloration (the chord channel's existing `EQ3` insert: cut lows, mid presence, keep sparkle, no overdrive). The comp/part, voice pool, and articulation/duration threading are untouched — only the instrument changes. Sequenced so the build stays green at every commit: add MonoSynth support, switch the funk patch over, then delete the dead pluck path.

**Tech Stack:** TypeScript, Tone.js (`MonoSynth`, `EQ3`), Vitest. Files: `patchTypes.ts`, `string.ts`, `instrumentPatches.ts` + co-located tests.

---

### Task 1: Add a MonoSynth source voice (additive, pluck path still present)

**Files:**
- Modify: `src/progressions/audio/sound/patchTypes.ts`
- Modify: `src/progressions/audio/string.ts`
- Create: `src/progressions/audio/string.mono.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/progressions/audio/string.mono.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const spies = vi.hoisted(() => ({
  monoCtor: vi.fn(),
  monoTAR: vi.fn(),
  synthCtor: vi.fn(),
  pluckCtor: vi.fn(),
  gainCtor: vi.fn(),
}));

vi.mock("tone", () => {
  class MonoSynth {
    constructor(opts: unknown) { spies.monoCtor(opts); }
    connect() { return this; }
    dispose() {}
    triggerAttackRelease(...args: unknown[]) { spies.monoTAR(...args); return this; }
  }
  class Synth {
    constructor(opts: unknown) { spies.synthCtor(opts); }
    connect() { return this; }
    dispose() {}
    triggerAttackRelease() { return this; }
  }
  class PluckSynth {
    constructor(opts: unknown) { spies.pluckCtor(opts); }
    connect() { return this; }
    dispose() {}
    triggerAttackRelease() { return this; }
  }
  class Gain {
    gain = { setValueAtTime: () => {} };
    constructor(v: unknown) { spies.gainCtor(v); }
    connect() { return this; }
    dispose() {}
  }
  return { MonoSynth, Synth, PluckSynth, Gain, gainToDb: (v: number) => v, now: () => 0 };
});

import { pluckString } from "./string";
import type { StrumSpec } from "./sound/patchTypes";

const monoSpec: StrumSpec = {
  mono: {
    oscillator: { type: "sawtooth" },
    filter: { type: "lowpass", Q: 1 },
    filterEnvelope: { attack: 0.005, decay: 0.08, sustain: 0.2, release: 0.1, baseFrequency: 800, octaves: 2.8 },
    envelope: { attack: 0.004, decay: 0.2, sustain: 0.15, release: 0.1 },
  },
  noteDurationSec: 0.18,
  releaseTailSec: 0.4,
};

describe("pluckString — Tone.MonoSynth backend", () => {
  beforeEach(() => {
    spies.monoCtor.mockClear(); spies.monoTAR.mockClear();
    spies.synthCtor.mockClear(); spies.pluckCtor.mockClear(); spies.gainCtor.mockClear();
  });

  it("constructs a MonoSynth (not Synth/PluckSynth) from a mono spec", () => {
    pluckString({} as AudioNode, 220, 0, { velocity: 0.7, spec: monoSpec });
    expect(spies.monoCtor).toHaveBeenCalledTimes(1);
    expect(spies.monoCtor.mock.calls[0]![0]).toMatchObject({
      oscillator: { type: "sawtooth" },
      filter: { type: "lowpass", Q: 1 },
    });
    expect(spies.synthCtor).not.toHaveBeenCalled();
    expect(spies.pluckCtor).not.toHaveBeenCalled();
  });

  it("passes velocity natively to triggerAttackRelease (no gain stage)", () => {
    pluckString({} as AudioNode, 220, 0, { velocity: 0.7, spec: monoSpec });
    expect(spies.monoTAR).toHaveBeenCalledTimes(1);
    const [freq, duration, time, velocity] = spies.monoTAR.mock.calls[0]!;
    expect(Number(freq)).toBeCloseTo(220, 1);
    expect(duration).toBeCloseTo(0.18, 3);
    expect(time).toBeCloseTo(0, 3);
    expect(velocity).toBeCloseTo(0.7, 3);
    expect(spies.gainCtor).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/string.mono.test.ts`
Expected: FAIL — `monoSpec.mono` is a type error (no `mono` field on `StrumSpec` yet) and/or no MonoSynth is constructed.

- [ ] **Step 3: Add the `MonoSynthVoiceSpec` type + `mono?` field in `patchTypes.ts`**

In `src/progressions/audio/sound/patchTypes.ts`, add this interface immediately after the existing `PluckSpec` interface (keep `PluckSpec` for now — it is removed in Task 3):

```ts
/** Subtractive single-coil-guitar params (Tone.MonoSynth): an oscillator through
 *  a lowpass with a snappy filter envelope (the pick "spank") + an amp envelope.
 *  Present instead of `pluck`/`oscillator` for the funk guitar strum patch. */
export interface MonoSynthVoiceSpec {
  oscillator: { type: OscillatorType };
  filter: { type: "lowpass"; Q: number };
  filterEnvelope: FilterEnvelopeSpec;
  envelope: EnvelopeSpec;
}
```

Then add a `mono?` field to `StrumSpec` (the interface currently lists `oscillator?`, `envelope?`, `pluck?`, `noteDurationSec`, `releaseTailSec`, `strumLagSec?`). Insert the `mono?` line after `pluck?`:

```ts
  mono?: MonoSynthVoiceSpec;
```

- [ ] **Step 4: Add `createMonoSynthVoice` + routing in `string.ts`**

In `src/progressions/audio/string.ts`:

(a) Extend the type import to include `MonoSynthVoiceSpec`:

```ts
import type { StrumSpec, PluckSpec, MonoSynthVoiceSpec } from "./sound/patchTypes";
```

(b) Add this function immediately before `function createSynthVoice`:

```ts
/** Subtractive single-coil guitar voice (Tone.MonoSynth). Velocity is honored
 *  natively by triggerAttackRelease, so no gain stage is needed. */
function createMonoSynthVoice(mono: MonoSynthVoiceSpec): StrumPlayableVoice {
  return new Tone.MonoSynth({
    oscillator: { type: mono.oscillator.type },
    filter: { type: mono.filter.type, Q: mono.filter.Q },
    filterEnvelope: mono.filterEnvelope,
    envelope: mono.envelope,
  });
}
```

(c) Update `makePool`'s `createVoice` routing to prefer `mono`:

```ts
function makePool(spec?: StrumSpec): PluckPool {
  return createReusableVoicePool<StrumPlayableVoice>({
    createVoice: () =>
      spec?.mono
        ? createMonoSynthVoice(spec.mono)
        : spec?.pluck
          ? createPluckVoice(spec.pluck)
          : createSynthVoice(spec),
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/string.mono.test.ts`
Expected: PASS (both tests).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm exec tsc -b`
Expected: exit 0 (trust the shell exit code, not IDE diagnostics).

```bash
git add src/progressions/audio/sound/patchTypes.ts src/progressions/audio/string.ts src/progressions/audio/string.mono.test.ts
git commit -m "feat(progressions): add monosynth strum source voice

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
(commitlint requires a lowercase subject; the lint-staged "could not find any staged files" line is harmless.)

---

### Task 2: Switch the funk patch to the MonoSynth source + clean amp strip

**Files:**
- Modify: `src/progressions/audio/sound/instrumentPatches.ts` (the `chord-funk-scratch` patch)
- Modify: `src/progressions/audio/sound/instrumentPatches.test.ts` (rework the funk guard)

- [ ] **Step 1: Rework the funk guard test (write the new expectation first)**

In `src/progressions/audio/sound/instrumentPatches.test.ts`, REPLACE the entire existing test `it("provides a Karplus-Strong funk scratch guitar patch with a tight strum", ...)` with:

```ts
  it("provides a clean single-coil funk scratch guitar patch (MonoSynth + amp strip)", () => {
    const patch = getChordPatch("chord-funk-scratch")!;
    expect(patch).toBeDefined();
    expect(patch.family).toBe("strum");
    // Root-cause guard: the funk guitar is a MonoSynth "channel strip", not a bare
    // plucked string (which never read as a guitar across three tuning rounds). A
    // mono source spec must be present.
    expect(patch.strum!.mono).toBeDefined();
    // Live filter envelope = the pick "spank". Without it the note has no attack
    // transient and reads as a static synth pad (mirrors the bass live-filter guard).
    expect(patch.strum!.mono!.filterEnvelope.octaves).toBeGreaterThan(0);
    // Harmonic oscillator: a guitar needs overtones; a sine-family oscillator has
    // none and cannot read as a plucked string (mirrors the bass harmonics guard).
    const SINE_FAMILY = new Set(["sine", "fatsine", "fmsine"]);
    expect(SINE_FAMILY.has(patch.strum!.mono!.oscillator.type)).toBe(false);
    // Amp formant: the channel strip must cut lows (tightness) and keep mid
    // presence (single-coil honk) so it cannot be flattened to a full-range tone.
    expect(patch.insert!.eq3!.low).toBeLessThan(0);
    expect(patch.insert!.eq3!.mid).toBeGreaterThanOrEqual(0);
    // Tight strum so the chord reads as a single stab.
    expect(patch.strum!.strumLagSec).toBeLessThanOrEqual(0.01);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/sound/instrumentPatches.test.ts`
Expected: FAIL — the current patch still has `pluck` (not `mono`), so `patch.strum!.mono` is `undefined`.

- [ ] **Step 3: Rewrite the `chord-funk-scratch` patch**

In `src/progressions/audio/sound/instrumentPatches.ts`, REPLACE the entire `chord-funk-scratch` patch object (currently the `pluck`-based block) with:

```ts
  {
    id: "chord-funk-scratch", label: "Funk Scratch", family: "strum",
    strum: {
      // Clean single-coil funk guitar (Nile Rodgers chicken scratch), built as a
      // MonoSynth "channel strip" rather than a bare plucked string (which never
      // read as a guitar):
      //  - sawtooth oscillator: the harmonically dense raw material a bright
      //    single-coil needs.
      //  - lowpass + snappy filter envelope: the filter sweeps open on attack
      //    (~800Hz -> ~5-6kHz) then settles, which IS the pick "spank" of a
      //    plucked string; the lowpass also doubles as the cab/tone rolloff that
      //    caps synthetic fizz per-voice.
      //  - percussive amp envelope: low sustain + short decay so the note is tight.
      //    durationSec (per articulation hit) governs choke-vs-ring NATIVELY here
      //    — a 0.06s ghost chokes, a 0.4s stab rings — unlike the old PluckSynth
      //    where decay was set by comb resonance.
      // The amp/pickup voicing (cut lows for tightness, mid presence for the
      // single-coil honk, keep highs for sparkle) lives in the eq3 insert below.
      // Tight strumLagSec so the chord lands as a single stab. Velocity is honored
      // natively by MonoSynth (no gain stage needed).
      mono: {
        oscillator: { type: "sawtooth" },
        filter: { type: "lowpass", Q: 1 },
        filterEnvelope: { attack: 0.005, decay: 0.08, sustain: 0.2, release: 0.1, baseFrequency: 800, octaves: 2.8 },
        envelope: { attack: 0.004, decay: 0.2, sustain: 0.15, release: 0.1 },
      },
      noteDurationSec: 0.18,
      releaseTailSec: 0.4,
      strumLagSec: 0.007,
    },
    insert: { eq3: { low: -6, mid: 2, high: 2 } },
  },
```

- [ ] **Step 4: Run the funk-patch test + the mono voice test**

Run: `pnpm vitest run src/progressions/audio/sound/instrumentPatches.test.ts src/progressions/audio/string.mono.test.ts`
Expected: PASS (the new funk guard is green; the mono voice test still green).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm exec tsc -b`
Expected: exit 0.

```bash
git add src/progressions/audio/sound/instrumentPatches.ts src/progressions/audio/sound/instrumentPatches.test.ts
git commit -m "feat(progressions): funk guitar = monosynth single-coil + clean amp strip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Remove the now-dead PluckSynth path

**Files:**
- Modify: `src/progressions/audio/string.ts` (remove `createPluckVoice` + `PluckSpec` import, simplify routing)
- Modify: `src/progressions/audio/sound/patchTypes.ts` (remove `PluckSpec` + `pluck?` field)
- Delete: `src/progressions/audio/string.pluck.test.ts`

- [ ] **Step 1: Delete the obsolete pluck test file**

```bash
git rm src/progressions/audio/string.pluck.test.ts
```

- [ ] **Step 2: Remove `createPluckVoice` + simplify routing in `string.ts`**

In `src/progressions/audio/string.ts`:

(a) Delete the entire `createPluckVoice` function (the `function createPluckVoice(pluck: PluckSpec): StrumPlayableVoice { ... }` block, including its leading doc comment "Karplus-Strong pluck voice...").

(b) Change the import to drop `PluckSpec`:

```ts
import type { StrumSpec, MonoSynthVoiceSpec } from "./sound/patchTypes";
```

(c) Simplify `makePool`'s routing (no more pluck branch):

```ts
function makePool(spec?: StrumSpec): PluckPool {
  return createReusableVoicePool<StrumPlayableVoice>({
    createVoice: () =>
      spec?.mono ? createMonoSynthVoice(spec.mono) : createSynthVoice(spec),
  });
}
```

- [ ] **Step 3: Remove `PluckSpec` + `pluck?` from `patchTypes.ts`**

In `src/progressions/audio/sound/patchTypes.ts`:

(a) Delete the entire `PluckSpec` interface (the `export interface PluckSpec { ... }` block and its doc comment).

(b) Remove the `pluck?: PluckSpec;` line from `StrumSpec`.

- [ ] **Step 4: Confirm no stray references remain**

Run: `grep -rn "PluckSpec\|createPluckVoice\|\.pluck\b\|PluckSynth" src/progressions/audio`
Expected: NO matches in `string.ts`, `patchTypes.ts`, or any patch/test (the public `pluckString` function name and `PluckStringOptions`/`PluckedVoiceHandle` are generic strum-API names and are EXPECTED to remain — they are not PluckSynth-specific). If `grep` finds `pluck`-spec references anywhere else, stop and report.

- [ ] **Step 5: Typecheck + run the affected tests**

Run: `pnpm exec tsc -b && pnpm vitest run src/progressions/audio/string.mono.test.ts src/progressions/audio/sound/instrumentPatches.test.ts`
Expected: tsc exit 0; both test files PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src/progressions/audio
git commit -m "refactor(progressions): remove dead karplus-strong pluck voice

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the complete gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: lint clean, all tests pass (no orphaned pluck references; new mono + funk guards green), `tsc -b` + `vite build` exit 0. Trust the shell exit code, not IDE diagnostics.

- [ ] **Step 2: If anything fails, fix at root cause and re-run**

Do not patch around a failure. If a test or typecheck fails, trace it to the change that caused it (most likely a stray `pluck` reference or a mock gap) and fix that. Re-run the full gate until green.

---

### Verification (by ear — user)

Audio timbre cannot be unit-tested. After the gate is green and pushed to PR #489, the user auditions the **Funk** genre and confirms it now reads as a clean, sparkly electric funk guitar (percussive single-coil chicken scratch) — with the one / stab / color up-strums ringing as distinct events and the ghosts choking tight. Nudge levers if needed:
- **Too dull / muffled** → raise `filterEnvelope.octaves` (more attack brightness) or `insert.eq3.high`.
- **Too thin / buzzy** → raise `filter.Q` slightly or lower `insert.eq3.high`; raise `eq3.mid` for more body.
- **Not percussive enough** → shorten `envelope.decay` / lower `envelope.sustain`.
- **Sterile / wants warmth** → add a light `insert.saturation: { kind: "chebyshev", amount: 2 }`.
