# Tonal Phase A Migration — Design

**Date:** 2026-05-24
**Status:** Approved
**Branch target:** `claude/elated-nobel-dd4e76` (or new feature branch)

## Context

FretFlow already depends on five Tonal modules (`@tonaljs/note`, `interval`, `scale`, `key`, `chord`) via `packages/core/`. The user surveyed Tonal's full module list and asked to "migrate" toward broader adoption. A scope check found this is **four independent subsystems with very different ROI**, not one migration. This document covers **Phase A** only — the mechanical, low-risk swaps. Phase B (roman-numeral / progression / mode) and Phase C (voicing / rhythm) are deferred to their own designs.

The phase also includes one **cleanup** task (A2) that is not a Tonal adoption but is the natural pairing — it deletes a code block duplicated five times across `theory.ts` and `lib/tonal.ts`.

## Goals

- Replace hand-rolled frequency math with `@tonaljs/midi`/`@tonaljs/note` (`Note.freq`).
- Replace hand-rolled chroma-set construction in `getDivergentNotes` with `@tonaljs/pcset`.
- Extract the duplicated "Tonal output → FretFlow sharps form" normalization into a single helper.
- Ship with zero behavioral change (Tonal's formulas match the existing implementations).

## Non-goals

- Touching `degrees.ts` (Phase B — needs feasibility spike on `@tonaljs/roman-numeral`).
- Touching `theoryCatalog.ts` or replacing `SCALES`/`CHORDS` source-of-truth dictionaries (Phase A.5 — catalog surgery).
- Touching `src/core/audio.ts` or `Tone.js` integration (audio architecture, separate concern).
- Adding Tonal modules that have no current consumer (`voicing`, `voice-leading`, `voicing-dictionary`, `rhythm-pattern`, `chord-detect`, `abc-notation`).
- Changing the verbose-name ↔ Tonal-symbol adapter tables in `lib/tonal.ts`. They stay as the FretFlow vocabulary bridge.

## Tasks

### A1 — `Note.freq` adoption

**File:** `packages/core/src/guitar.ts`

Replace `getNoteFrequency` (currently 8 lines of `A4_FREQUENCY * Math.pow(2, halfStepsFromA4 / 12)`) with a one-line wrapper over `Note.freq()` from `@tonaljs/note`. Tonal computes the same A4=440 equal-temperament formula.

```ts
// Before: builds noteIndex / absoluteDistance / halfStepsFromA4 by hand.
// After:
export function getNoteFrequency(noteStringWithOctave: string): number {
  return Note.freq(noteStringWithOctave) ?? A4_FREQUENCY;
}
```

The fallback `A4_FREQUENCY` preserves the existing behavior on unparseable input (current code falls back to `A4`).

**Why not `@tonaljs/midi` directly?** `Note.freq` is the higher-level API and already wraps midi math. Adding `@tonaljs/midi` as a dep gains nothing here.

**Constants:** `A4_FREQUENCY` and `A4_ABS_DISTANCE` may be dropped if no other consumer exists. Verify with grep before removing.

### A2 — `normalizeToSharps` extraction

**Files:** `packages/core/src/lib/tonal.ts`, `packages/core/src/theory.ts`

The following block appears 5 times across the codebase:

```ts
const simplified = Note.simplify(t);
return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
```

Sites:
1. `theory.ts::getIntervalNotes` (per mapped note)
2. `theory.ts::getScaleNotes` (per mapped note)
3. `theory.ts::getChordNotes` (per mapped note)
4. `theory.ts::getDivergentNotes` (per mapped note)
5. `lib/tonal.ts::transposeNoteToSharps` (single note)

Extract into `lib/tonal.ts`:

```ts
/**
 * Normalize a Tonal note name to FretFlow's sharps-form contract.
 * Tonal may return flats (e.g. "Eb"); the rest of the app keys on
 * the sharps array (NOTES). Pass any Tonal-output note name through
 * this before exposing it.
 *
 * Returns the input unchanged if Tonal can't simplify it (defensive
 * against malformed input).
 */
export function normalizeToSharps(note: string): string {
  if (!note) return note;
  const simplified = Note.simplify(note);
  if (!simplified) return note;
  return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
}
```

Update all 5 sites to call `normalizeToSharps(t)` instead of inlining the block.

### A3 — `@tonaljs/pcset` adoption

**File:** `packages/core/src/theory.ts`

Rewrite `getDivergentNotes` (currently 33 lines, builds a chroma `Set` by hand) to use `Pcset` for the reference-scale comparison.

Current logic:
1. Skip blues/pentatonic/major/natural-minor (return `[]`).
2. Compute scale chroma indices via `getScaleSemitones`.
3. Compute relative intervals from root.
4. Pick reference scale (`Major` if has major 3rd, else `Natural Minor`).
5. Build a `Set` of reference scale chromas.
6. Filter scale chromas to those NOT in reference.
7. Transpose each survivor back to a note name, normalize to sharps.

New logic:
1. Same early-return guards (1).
2. Compute current and reference scale notes once.
3. Use `Pcset.get(scaleNotes).chroma` and `Pcset.get(refNotes).chroma` to get 12-bit chroma strings.
4. For each note in the current scale, include it iff its chroma bit is NOT set in the reference chroma.
5. Apply `normalizeToSharps` from A2.

The major-vs-minor reference selection stays as-is. Output is unchanged.

**Add `@tonaljs/pcset` to `packages/core/package.json` dependencies.**

## Testing

### Pre-refactor: lock current behavior

Before touching `getDivergentNotes`, **add a parameterized snapshot test** to `theory.test.ts` covering every scale in `SCALE_TO_TONAL` (28 scales) crossed with at least 3 roots (`C`, `F#`, `Bb`). Record the current output and pin it. The refactor must produce identical output.

### A1 coverage

`guitar.test.ts` already covers `getNoteFrequency` with concrete A4/E2/etc. expectations. Re-run; if it passes, A1 is verified.

### A2 coverage

Add `normalizeToSharps` unit tests to `lib/tonal.test.ts`:
- `Bb` → `A#`
- `Eb` → `D#`
- `C#` → `C#` (no-op)
- `C` → `C` (no-op)
- `""` → `""` (defensive)
- `"garbage"` → `"garbage"` (defensive)

### A3 coverage

The pre-refactor snapshot test above is the verification. Existing `getDivergentNotes` tests remain.

### Property tests

`theory.property.test.ts` exists with fast-check. No new properties required, but the existing properties must still hold after the refactor.

## Risk

| Task | Risk | Mitigation |
|------|------|------------|
| A1 | Frequency drift from a different formula | Identical formula; existing tests pin output |
| A2 | A site had a subtle difference I missed | Snapshot tests + property tests catch it |
| A3 | Pcset returns a different note ordering | Snapshot the current output BEFORE refactoring |

## Verification

`pnpm lint && pnpm test && pnpm build && pnpm test:e2e:production` — all green.

`pnpm test:visual` — paranoid check. No visual changes expected. **Do not refresh baselines.** Any diff = regression.

## Deferred (explicit follow-up designs)

- **Phase A.5** — adopt `@tonaljs/scale-type` and `@tonaljs/chord-type` as the source of truth, retiring FretFlow's parallel `SCALES`/`CHORDS` dictionaries. Touches `theory.ts`, `theoryCatalog.ts`, and `degrees.ts` indirectly. Needs its own design.
- **Phase B** — `@tonaljs/roman-numeral` + `@tonaljs/progression`. Requires a spike to verify Tonal's parser handles FretFlow's "+" augmented notation and pentatonic degree set.
- **Phase B.2** — `@tonaljs/mode` as a partial replacement for the mode dictionary in `theoryCatalog.ts` (FretFlow-specific browse/UI metadata stays).
- **Phase C** — `@tonaljs/voicing`, `voice-leading`, `voicing-dictionary` — deferred until a concrete feature needs voice-leading suggestions. These produce pitch voicings, not fretboard positions, so they do **not** replace `src/shapes/`.
- **Phase C.2** — `@tonaljs/time-signature`, `duration-value`, `rhythm-pattern` — cosmetic at best given existing bpm math; defer.
