# Genre Mix Balance Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize chord-patch loudness so the per-genre chord bus is instrument-agnostic, retune over-hot bass on several genres, and add an optional per-genre chord-family override block (wired but unset).

**Architecture:** Pure constant retuning of patch volumes + per-genre bus levels, plus a small pure mix resolver (`resolveMixForInstrument`) and its wiring into the playback hook's graph build. `planSignalGraph(tier, mix)` is unchanged — the resolver hands it a chord block chosen by the active instrument family.

**Tech Stack:** TypeScript, Jotai, Tone.js, Vitest. Package manager **pnpm**.

**Spec:** `docs/superpowers/specs/2026-06-10-genre-mix-balance-pass-design.md`. All dB values are by-ear starting points; the mechanism is the deliverable.

---

## File Structure

- `src/progressions/audio/sound/instrumentPatches.ts` — Part 1 chord patch volumes; Part 2 `bass-pick` mid EQ.
- `src/progressions/audio/sound/genreMixPresets.ts` — Part 2 bus levels; Part 3 `chordAltMix?` type field + `resolveMixForInstrument`.
- `src/progressions/audio/progressionAudioEngine.ts` — re-export `resolveMixForInstrument`.
- `src/hooks/useProgressionAudioPlayback.ts` — Part 3 wiring at both graph-build sites + rebuild effect dep.

---

## Task 1: Chord-patch makeup gain (normalize keys patches)

**Files:**
- Modify: `src/progressions/audio/sound/instrumentPatches.ts` (epiano, jazz-organ, rock-organ `poly.volume`)
- Test: `src/progressions/audio/sound/instrumentPatches.test.ts`

- [ ] **Step 1: Add the failing test**

In `src/progressions/audio/sound/instrumentPatches.test.ts`, add this test inside `describe("instrument patches", …)`:

```ts
  it("normalizes keys chord patches to a common reference, strum +4 above it", () => {
    const REF = -6; // grand-piano anchor
    for (const id of ["chord-grand-piano", "chord-epiano", "chord-jazz-organ", "chord-rock-organ"]) {
      expect(getChordPatch(id)!.poly!.volume, id).toBe(REF);
    }
    // Steel strum is per-voice; deliberately ~4 dB hotter than the keys reference.
    expect(getChordPatch("chord-steel-strum")!.strum!.voiceVolumeDb).toBe(-14);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/sound/instrumentPatches.test.ts -t "normalizes keys chord patches"`
Expected: FAIL — epiano is −7, jazz-organ −10, rock-organ −11.

- [ ] **Step 3: Retune the keys patch volumes**

In `src/progressions/audio/sound/instrumentPatches.ts`, make these three single-value edits (grand-piano stays −6, steel-strum stays −14):

`chord-epiano`:
```ts
      volume: -7, maxPolyphonyFloor: 6,
```
→
```ts
      volume: -6, maxPolyphonyFloor: 6,
```

`chord-jazz-organ`:
```ts
      volume: -10, maxPolyphonyFloor: 6,
```
→
```ts
      volume: -6, maxPolyphonyFloor: 6,
```

`chord-rock-organ`:
```ts
      volume: -11, maxPolyphonyFloor: 6,
```
→
```ts
      volume: -6, maxPolyphonyFloor: 6,
```

- [ ] **Step 4: Run the test file to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/sound/instrumentPatches.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/sound/instrumentPatches.ts src/progressions/audio/sound/instrumentPatches.test.ts
git commit -m "feat(progression): normalize chord-patch loudness to a common reference"
```

---

## Task 2: Per-genre bus retune (bass levels + rock bass-pick EQ)

**Files:**
- Modify: `src/progressions/audio/sound/genreMixPresets.ts` (pop/rock/blues/jazz `bass.volumeDb`)
- Modify: `src/progressions/audio/sound/instrumentPatches.ts` (`bass-pick` mid EQ)
- Test: `src/progressions/audio/sound/genreMixPresets.test.ts`, `src/progressions/audio/sound/instrumentPatches.test.ts`

- [ ] **Step 1: Add the failing tests**

In `src/progressions/audio/sound/genreMixPresets.test.ts`, add inside `describe("genre mix presets", …)`:

```ts
  it("retunes bass bus levels to tame over-hot low end (mix balance pass)", () => {
    expect(getGenreMix("rock")!.perInstrument.bass.volumeDb).toBe(-5);
    expect(getGenreMix("blues")!.perInstrument.bass.volumeDb).toBe(-2);
    expect(getGenreMix("jazz")!.perInstrument.bass.volumeDb).toBe(-2);
    expect(getGenreMix("pop")!.perInstrument.bass.volumeDb).toBe(-1);
  });
```

In `src/progressions/audio/sound/instrumentPatches.test.ts`, add inside `describe("instrument patches", …)`:

```ts
  it("eases the rock bass-pick mid presence so it sits back in the mix", () => {
    expect(getBassPatch("bass-pick")!.insert!.eq3!.mid).toBe(1);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/audio/sound/genreMixPresets.test.ts -t "retunes bass bus" && pnpm exec vitest run src/progressions/audio/sound/instrumentPatches.test.ts -t "eases the rock bass-pick"`
Expected: FAIL — current values are rock −2, blues 0, jazz 0, pop 0; bass-pick mid +2.

- [ ] **Step 3: Retune the bass bus levels**

In `src/progressions/audio/sound/genreMixPresets.ts`:

Pop:
```ts
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.04 },
```
→
```ts
      bass: { volumeDb: -1, pan: 0, reverbSend: 0.04 },
```

Rock (replace the two comment lines + the value):
```ts
      // -2 (was 0): the sawtooth bass-pick is the buzziest/most harmonic-rich
      // bass patch; at unity it sat too present in the rock mix.
      bass: { volumeDb: -2, pan: 0, reverbSend: 0.02 },
```
→
```ts
      // -5: the sawtooth bass-pick (buzzy, mid-forward) over a dense staccato
      // pedal-bass pattern read too prominent even at -2; pulled to -5 in the
      // mix-balance pass (paired with easing its mid EQ to +1).
      bass: { volumeDb: -5, pan: 0, reverbSend: 0.02 },
```

Blues:
```ts
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.05 },
```
→
```ts
      bass: { volumeDb: -2, pan: 0, reverbSend: 0.05 },
```

Jazz:
```ts
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.06 },
```
→
```ts
      bass: { volumeDb: -2, pan: 0, reverbSend: 0.06 },
```

- [ ] **Step 4: Ease the rock bass-pick mid EQ**

In `src/progressions/audio/sound/instrumentPatches.ts`, the `chord-... ` — no, the `bass-pick` patch:
```ts
    insert: { eq3: { low: 0, mid: 2, high: 0 } },
```
→
```ts
    insert: { eq3: { low: 0, mid: 1, high: 0 } },
```

(This line is unique to `bass-pick`.)

- [ ] **Step 5: Run both test files to verify they pass**

Run: `pnpm exec vitest run src/progressions/audio/sound/genreMixPresets.test.ts src/progressions/audio/sound/instrumentPatches.test.ts`
Expected: PASS, including the existing loudness-ceiling invariant.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/sound/genreMixPresets.ts src/progressions/audio/sound/instrumentPatches.ts src/progressions/audio/sound/genreMixPresets.test.ts src/progressions/audio/sound/instrumentPatches.test.ts
git commit -m "feat(progression): retune bass bus levels and ease rock bass-pick mids"
```

---

## Task 3: `chordAltMix` schema + `resolveMixForInstrument` helper

**Files:**
- Modify: `src/progressions/audio/sound/genreMixPresets.ts` (type + helper)
- Test: `src/progressions/audio/sound/genreMixPresets.test.ts`

- [ ] **Step 1: Add the failing tests**

In `src/progressions/audio/sound/genreMixPresets.test.ts`, first ensure `resolveMixForInstrument` is imported from `./genreMixPresets` (add it to the existing import from that module). Then add:

```ts
  describe("resolveMixForInstrument", () => {
    it("returns the same mix object when the genre has no chordAltMix (all current genres)", () => {
      for (const m of GENRE_MIX_PRESETS) {
        expect(resolveMixForInstrument(m, "strum")).toBe(m);
        expect(resolveMixForInstrument(m, "organ")).toBe(m);
      }
    });

    it("swaps in chordAltMix only when the selected family differs from the default", () => {
      const base = getGenreMix("blues")!; // strum default (chord-steel-strum)
      const altBlock = { volumeDb: 2, pan: 0.3, reverbSend: 0.4 };
      const withAlt = { ...base, chordAltMix: altBlock };
      // Strum is the default family → unchanged chord block.
      expect(resolveMixForInstrument(withAlt, "strum").perInstrument.chord).toBe(base.perInstrument.chord);
      // Poly (organ/piano) differs from the strum default → use the alt block.
      expect(resolveMixForInstrument(withAlt, "organ").perInstrument.chord).toBe(altBlock);
      expect(resolveMixForInstrument(withAlt, "piano").perInstrument.chord).toBe(altBlock);
      // patches are preserved (only the chord bus block changes).
      expect(resolveMixForInstrument(withAlt, "organ").patches).toBe(base.patches);
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/audio/sound/genreMixPresets.test.ts -t "resolveMixForInstrument"`
Expected: FAIL — `resolveMixForInstrument` is not exported (import error / undefined).

- [ ] **Step 3: Add the `chordAltMix?` field to `GenreMix`**

In `src/progressions/audio/sound/genreMixPresets.ts`, add the field to the interface (after `master`):

```ts
export interface GenreMix {
  genre: string;
  /** `chord` is the default-family patch (its family must match the genre's
   *  `chordInstrument`). `chordAlt`, when set, is the patch for the *other*
   *  family — used when the user switches the instrument away from the default
   *  (e.g. Blues defaults to a strum guitar but offers the organ via `chordAlt`). */
  patches: { bass: string; chord: string; chordAlt?: string; drumKit: string };
  perInstrument: Record<MixInstrument, InstrumentMix>;
  master: MasterMix;
  /** Optional chord-bus block used when the user selects the NON-default chord
   *  family (resolved by `resolveMixForInstrument`). Lets a genre stage the
   *  swapped instrument independently of its default. Unset = no override. */
  chordAltMix?: InstrumentMix;
}
```

- [ ] **Step 4: Add the imports and the `resolveMixForInstrument` helper**

In `src/progressions/audio/sound/genreMixPresets.ts`, add these imports at the top of the file (alongside existing imports):

```ts
import { getChordPatch } from "./instrumentPatches";
import type { ChordInstrumentId } from "../instruments/types";
```

Then add this exported function (e.g. just below `getGenreMix`):

```ts
/**
 * Resolve a genre mix for the user's selected chord instrument. When the genre
 * defines a `chordAltMix` AND the selected instrument's family differs from the
 * default chord patch's family, the chord bus block is replaced by `chordAltMix`;
 * otherwise the mix is returned unchanged (same object reference). Pure.
 */
export function resolveMixForInstrument(mix: GenreMix, instrument: ChordInstrumentId): GenreMix {
  if (!mix.chordAltMix) return mix;
  const defaultFamily = getChordPatch(mix.patches.chord)?.family;
  const selectedFamily = instrument === "strum" ? "strum" : "poly";
  if (selectedFamily === defaultFamily) return mix;
  return { ...mix, perInstrument: { ...mix.perInstrument, chord: mix.chordAltMix } };
}
```

- [ ] **Step 5: Run the test file to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/sound/genreMixPresets.test.ts`
Expected: PASS (new resolveMixForInstrument suite + all existing tests).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/sound/genreMixPresets.ts src/progressions/audio/sound/genreMixPresets.test.ts
git commit -m "feat(progression): add chordAltMix + resolveMixForInstrument resolver"
```

---

## Task 4: Wire `resolveMixForInstrument` into the playback graph build

Integration glue; verified by `tsc -b` + the Task 5 smoke test (no dedicated unit test for the hook).

**Files:**
- Modify: `src/progressions/audio/progressionAudioEngine.ts` (re-export)
- Modify: `src/hooks/useProgressionAudioPlayback.ts` (two build sites + rebuild dep)

- [ ] **Step 1: Re-export the resolver from the engine**

In `src/progressions/audio/progressionAudioEngine.ts`, change:

```ts
export { getGenreMix, DEFAULT_GENRE_MIX } from "./sound/genreMixPresets";
```
to:
```ts
export { getGenreMix, DEFAULT_GENRE_MIX, resolveMixForInstrument } from "./sound/genreMixPresets";
```

- [ ] **Step 2: Resolve the mix at the initial graph build**

In `src/hooks/useProgressionAudioPlayback.ts`, find:

```ts
      const mix = eng.getGenreMix(store.get(progressionGenreStyleAtom)) ?? eng.DEFAULT_GENRE_MIX;
```

and replace with:

```ts
      const mix = eng.resolveMixForInstrument(
        eng.getGenreMix(store.get(progressionGenreStyleAtom)) ?? eng.DEFAULT_GENRE_MIX,
        store.get(progressionChordInstrumentAtom),
      );
```

(`progressionChordInstrumentAtom` is already imported in this file.)

- [ ] **Step 3: Resolve the mix at the genre/quality rebuild effect, and add the instrument dep**

In `src/hooks/useProgressionAudioPlayback.ts`, find the rebuild effect:

```ts
    const timer = setTimeout(() => {
      const mix = eng.getGenreMix(genreId) ?? eng.DEFAULT_GENRE_MIX;
      const tier = resolveActiveTier(eng, quality);
      eng.configureProgressionGraph(eng.planSignalGraph(eng.TIER_PROFILES[tier], mix));
    }, 0);
    return () => clearTimeout(timer);
  }, [genreId, quality, playing]);
```

and replace with:

```ts
    const timer = setTimeout(() => {
      const mix = eng.resolveMixForInstrument(
        eng.getGenreMix(genreId) ?? eng.DEFAULT_GENRE_MIX,
        chordInstrument,
      );
      const tier = resolveActiveTier(eng, quality);
      eng.configureProgressionGraph(eng.planSignalGraph(eng.TIER_PROFILES[tier], mix));
    }, 0);
    return () => clearTimeout(timer);
  }, [genreId, quality, playing, chordInstrument]);
```

(`chordInstrument` is already in scope at `useProgressionAudioPlayback.ts:134`.)

- [ ] **Step 4: Type-check**

Run: `pnpm exec tsc -b`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/progressionAudioEngine.ts src/hooks/useProgressionAudioPlayback.ts
git commit -m "feat(progression): re-stage chord bus per selected instrument family"
```

---

## Task 5: Full verification + playback smoke test

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: 0 errors (pre-existing `useFretboardTopologyModel.ts` warning is unrelated).

- [ ] **Step 2: Full test suite**

Run: `pnpm run test`
Expected: all pass; count rises by the new cases (Task 1: +1, Task 2: +2, Task 3: +2).

- [ ] **Step 3: Production build**

Run: `pnpm run build`
Expected: `tsc -b` + `vite build` succeed.

- [ ] **Step 4: Live no-error smoke test (controller does this, not a subagent)**

Note for the controller: start the preview, then for each genre select it and toggle the chord instrument between Strum and Organ, watching `preview_console_logs` (level error) for thrown exceptions from the graph re-stage. Confirm the graph rebuilds without errors. (Audio loudness itself is a by-ear judgment for the user.)

- [ ] **Step 5: Report for the user's by-ear tuning pass**

Summarize the shipped levels (the seed values) so the user can audition and request nudges:
- Chord patches normalized to −6 (keys), steel-strum −14/voice (≈ +4).
- Bass: Rock −5 (+ mid EQ +1), Blues −2, Jazz −2, Pop −1.
- `chordAltMix` available but unset on every genre.

---

## Self-Review Notes

- **Spec coverage:** Part 1 → Task 1; Part 2 → Task 2; Part 3 (schema + resolver) → Task 3; Part 3 (wiring) → Task 4; testing/verification → Task 5.
- **Type consistency:** `resolveMixForInstrument(mix: GenreMix, instrument: ChordInstrumentId): GenreMix`; the hook passes `store.get(progressionChordInstrumentAtom)` / `chordInstrument` (both `ChordInstrumentId`). `chordAltMix?: InstrumentMix` matches the `perInstrument.chord` block type it replaces.
- **No-cycle check:** `genreMixPresets.ts` imports `getChordPatch` (instrumentPatches) and the `ChordInstrumentId` *type* (instruments/types). `instruments/index.ts` imports instrumentPatches, not genreMixPresets — no cycle.
- **Backward compatibility:** `chordAltMix` ships unset on all genres, so `resolveMixForInstrument` returns the input mix unchanged for every current genre — the only behavioral change is the bus/patch retuning (Tasks 1–2) and the graph now re-staging on instrument switch (a no-op for level since `chordAltMix` is unset, but it does rebuild the graph — confirm no audible glitch in the smoke test).
