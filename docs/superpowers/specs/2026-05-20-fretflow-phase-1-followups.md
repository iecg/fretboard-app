# FretFlow Phase 1 — Follow-up Observations

**Status:** Reference notes. Produced 2026-05-20 from the final code review of Phase 1 (Tonal.js foundation). Not a spec — captures non-blocking observations to be addressed in Phase 2 cleanup or a small targeted follow-up PR.

**Source:** Final-review subagent on the complete Phase 1 diff, prior to opening PR.

**Phase 1 PR:** to be linked after creation.

---

## Observations

### 1. `getChordNotes` NaN guard inconsistency (Minor — cosmetic)

**Location:** `packages/core/src/theory.ts:522` (approximately).

The Phase 1 migration established a canonical NaN guard pattern for `Note.chroma` (which returns `NaN`, not `undefined`, for invalid input):

```ts
const chroma = Note.chroma(x);
if (typeof chroma !== "number" || isNaN(chroma)) return [];
```

Every migrated function uses this hoisted form except `getChordNotes`, which writes:

```ts
if (Note.chroma(rootNote) === undefined || Number.isNaN(Note.chroma(rootNote))) return [];
```

This calls `Note.chroma` twice and mixes the canonical patterns. It works (Tonal returns `NaN`; `NaN === undefined` is false; `Number.isNaN(NaN)` is true), but it's inconsistent with the rest of the file.

**Fix:** Hoist the call once and use the canonical guard. ~3-line change.

### 2. `getDivergentNotes` was not fully migrated to Tonal (Minor — pre-existing gap)

**Location:** `packages/core/src/theory.ts:551, 562` (approximately).

`getDivergentNotes` was rewritten to delegate to `getScaleSemitones` (which is Tonal-backed) but still uses two legacy idioms:

- Line 551 (approx): `NOTES.indexOf(rootNote)` — returns `-1` for flat-spelled roots like `"Bb"`, `"Eb"`, `"Ab"`, causing the function to silently return `[]`.
- Line 562 (approx): `NOTES[semitone]` — converts absolute semitone indices back to note names via the chromatic array.

This is **not a regression** — the original code had the same `NOTES.indexOf` issue for flat roots. The Phase 1 migration didn't fix it but also didn't worsen it. The UI currently uses sharp/natural roots in most paths, so the gap is rarely reachable.

**Fix:** Replace both legacy idioms with the canonical Tonal patterns (`Note.chroma` guard for input validation; `Note.transpose(rootNote, Interval.fromSemitones(...))` + sharps normalization for output). Likely ~15 lines.

### 3. `getDivergentNotes` lacks flat-root test coverage (Minor)

The existing tests for `getDivergentNotes` exercise only sharp and natural roots (`"D"`, `"F"`, `"G"`, `"C"`, `"A"`). They do not exercise flat roots, which is why the gap in observation #2 stayed silent.

**Fix:** Add at least one test case like `getDivergentNotes("Bb", "Dorian")` and pin the expected output (either after fixing the flat-root bug, or to document current behavior).

---

## Suggested handling

These three observations are coherent — they all concern flat-root handling and pattern consistency in `theory.ts`. Smallest reasonable PR: combine the fix for observation #1 (`getChordNotes` guard) with observations #2 and #3 (`getDivergentNotes` migration + tests) into one targeted cleanup PR titled something like `refactor(core): fix theory.ts NaN guard inconsistency and complete getDivergentNotes migration`.

Alternatively, address them inline during Phase 2 (Chord unification) since that work also touches `theory.ts`.

Both are appropriate; the targeted PR is faster, the inline approach has less churn.

---

## What was *not* observed (passed final review cleanly)

For reference, these aspects of Phase 1 were reviewed and found solid:

- Adapter file `packages/core/src/lib/tonal.ts` — single responsibility, clean.
- Namespace imports applied uniformly (no deprecated defaults).
- Sharps-form normalization pattern applied at every Tonal output boundary.
- Public API of `@fretflow/core` (its `index.ts`) byte-identical to baseline.
- `KEY_SIGNATURES` and `ENHARMONICS` legitimately retained (still consumed by `src/` and by `resolveAccidentalMode`).
- Test additions (`tonal.test.ts`, `circleOfFifthsUtils.test.ts`, drift-detection tests in `degrees.test.ts`) pin real expected values.
- All 1794 tests pass; lint + build + typecheck clean.
- Bundle add ~52KB gzipped (within the spec's total ~120KB budget for Tonal + Tone combined).
