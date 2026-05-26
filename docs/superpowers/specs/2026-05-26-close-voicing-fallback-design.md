# Close-Voicing Fallback in Full Mode + Full/Close Overlap Audit

**Date:** 2026-05-26
**Status:** Draft for review

## Goal

Two related deliverables, one spec:

1. **Audit (Part A)** — produce a research report identifying every `FULL_CHORD_TEMPLATES` entry that is pitch-and-position identical to a generated close voicing. Output informs which templates are cosmetic duplicates and might be deleted.
2. **Close-voicing fallback in Full mode (Part B)** — when an active CAGED or 3NPS position has no full-chord template available (because none was ever defined, or it was deleted for being unplayable), automatically render close voicings that fit inside that position so the user always sees *some* chord at every active position.

Sequencing: Part A ships first. Its findings may motivate template deletions, and those deletions surface positions that genuinely need fallback before Part B is built.

## Non-Goals

- Re-architecting the Full/Close mode split. They remain separate user-facing modes.
- Generating close voicings for positions that already have a working full match. Full wins for any polygon where it resolves.
- New playability heuristics for full voicings (the "is this physically playable" question stays manual — handled by template authoring).
- Visual differentiation between full voicings and close fallbacks (the user should not have to think about it).

## Part A — Full/Close Overlap Audit

### Deliverable

A markdown report at `docs/superpowers/research/2026-05-26-full-close-voicing-overlap.md`. No runtime code.

### Method

For each chord quality key in `CHORD_DEFINITIONS` (currently `maj`, `min`, `dim`, `dim7`, `m7b5`, `7`, `maj7`, `m7`, plus any others present):

1. Pick a representative root (e.g. `C`) and tuning (`STANDARD_TUNING`) and `maxFret = 24`.
2. Enumerate every close voicing via `closeVoicings({ chordRoot, chordType, tuning, maxFret })`.
3. Enumerate every full match via `getFullChordShapeMatches({ chordRoot, chordType, tuning, maxFret })`.
4. For each `(full, close)` pair, normalize both to a common anchor (e.g. subtract the minimum fretted fret) and compare the resulting `Set<"stringIndex-fretIndex">`. Equal sets = identical voicing.
5. Repeat across all 12 roots to confirm shape-level identity (not just root-specific coincidence). A duplicate must hold for every root.

### Report structure

One section per quality. Per section, a table:

| CAGED shape | Template `fretsHighToLow` | Close-voicing equivalent? | String set | Notes |
|---|---|---|---|---|
| C | `[0,1,0,2,3,null]` | yes | top-5 | identical at all 12 roots |
| A | `[0,2,2,2,0,null]` | no | — | — |

Plus a summary list at the bottom: "Templates that are cosmetic duplicates of close voicings (deletion candidates): …".

### Verification

- The audit script lives at `scripts/audit-full-close-overlap.ts` (or inline in the report's appendix as a runnable snippet) and is reproducible. The report itself records the commit SHA used to generate it.
- Human review chooses which duplicates to delete in a follow-up PR. No automated deletion.

## Part B — Close-Voicing Fallback in Full Mode

### Trigger

For each active CAGED polygon, after `selectFullChordMatchesForCagedPosition` runs:

- If a full match was selected for that polygon → unchanged. Render the full match.
- If **no** full match was selected (no template exists for shape+quality, or the best candidate exceeded the `outsideCount ≤ 2` tolerance) → run the close-fallback picker.

3NPS positions follow the same trigger using `selectFullChordMatchesForThreeNpsPosition`.

### Close-fallback picker

Input: the polygon (CAGED) or `boxBounds` (3NPS), the active chord, the active scale window (for snap-to-scale), the user's string-set selection.

Algorithm:

1. Start from `closeCandidatesAllStringSetsAtom` — close voicings for the active chord, with snap-to-scale already applied per the existing `chordSnapToScaleAtom` toggle.
2. Filter to voicings whose every fretted note lies **inside** the polygon's per-string fret range (or 3NPS `boxBounds`). Reuse `distanceOutsidePolygon` with a stricter `outsideCount === 0` requirement — the polygon is the only anchor, so no outside-tolerance is appropriate.
3. Filter by the user's current `voicingStringSetAtom` selection.
4. Return all surviving voicings for that polygon. Multiple results is acceptable — string-set is the primary disambiguator. If several still fit, render them all (matches Close-mode behavior).
5. If none survive → no fallback for this position. Polygon renders with no voicing connectors, same as today.

### Atom additions

- `fallbackVoicingMatchesAtom: Voicing[]` — only the fallback fills, per polygon/3NPS position. Computed by iterating active positions, calling the picker, flattening.
- `hasFallbackPositionsAtom: boolean` — `fallbackVoicingMatchesAtom.length > 0`. Drives UI gating for the string-set dropdown.

### Atom refactor

- `visibleVoicingMatchesAtom` (currently full-only) returns `[...fullMatches, ...fallbackMatches]` in Full mode. Both are `Voicing` shape; downstream consumers (connector renderer, `chordHighlightPositionsAtom`, in-polygon supplementation) are unchanged. Fallback voicings carry their polygon's `shape` field so connector grouping by shape continues to work.

### UX

- **String-set dropdown:** currently visible only in Close mode. In Full mode it appears **only when `hasFallbackPositionsAtom` is true** (i.e. ≥ 1 active position uses fallback). Changing the dropdown re-filters fallback voicings; full-template positions are unaffected.
- **Visual rendering:** fallback connectors render **identically** to full voicings — same stroke, same colors, same fingering chips, same in-polygon chord-tone supplementation. The goal is "every active position shows a chord," without making the user reason about which mechanism produced it.
- **Lock-to-scale:** fallback voicings inherit the snap-to-scale filter that already runs in `closeCandidatesAllStringSetsAtom`, so behavior is consistent across modes.

### Edge cases

- Polygon has both a full match and candidate close voicings → full wins. No fallback for that polygon.
- Polygon has a full match but it's outside the `outsideCount ≤ 2` tolerance → no full match selected, fallback runs. (This is the existing tolerance — not relaxed.)
- No close voicing fits any active polygon → no fallback voicings, no string-set dropdown, no chord highlights from voicings. Same as today's empty state for those positions.
- 5-tone chord qualities (9, 11, 13 chords if added later) → `closeVoicings` already supports up to 5 voices, no changes needed.

### Component shape

- `voicingSelection.ts` (existing) gains `selectCloseFallbacksForCagedPosition` and `selectCloseFallbacksForThreeNpsPosition` — pure functions, parallel to the existing full selectors.
- `chordOverlayAtoms.ts` gains the two new atoms above and the refactor of `visibleVoicingMatchesAtom`.
- The string-set picker component reads `hasFallbackPositionsAtom` via the existing visibility gate (currently a simple `voicing === "close"` check — replaced with `voicing === "close" || hasFallbackPositionsAtom`).

## Testing

**Audit (Part A):**
- The audit script itself is the test. Re-running it on the committed SHA must reproduce the report.

**Fallback (Part B):**
- Unit tests for `selectCloseFallbacksForCagedPosition` and `…ForThreeNpsPosition`: in-polygon filtering, string-set filtering, no-survivors → empty, multi-survivor → all returned.
- Atom test for `fallbackVoicingMatchesAtom`: a position with no full template + at least one fitting close voicing produces a fallback; a position with a full match produces none.
- Atom test for `hasFallbackPositionsAtom`: true/false matches `fallbackVoicingMatchesAtom.length > 0`.
- Atom test for `visibleVoicingMatchesAtom` in Full mode: returns full + fallback union.
- Component test for the string-set picker visibility gate in Full mode.
- Visual regression refresh for any position that previously rendered empty in Full mode and now renders a fallback voicing.

## Sequencing

1. Part A: audit script + report. Commit. Human review.
2. (Optional, separate plan) Delete any templates identified as cosmetic duplicates.
3. Part B: fallback runtime feature. Single plan.

Each ships independently — Part B does not block on Part A's review outcome.
