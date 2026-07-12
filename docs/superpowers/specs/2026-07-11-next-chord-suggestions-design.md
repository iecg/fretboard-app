# Function-Aware Next-Chord Suggestions — Design

**Date:** 2026-07-11
**Status:** Implemented.
**Topic:** Replace the fixed "+1 next diatonic degree" add-chord default with chord-function theory, and surface 2–3 ranked candidates the user can insert directly.

Picked up from the parked entry in [`docs/ROADMAP.md`](../../ROADMAP.md) ("Smart /
function-aware add chord"), which the chord-audition work
([spec](./2026-06-16-progression-chord-audition-design.md)) scoped out. Theory
grounding: [`music-theory-pedagogy.md`](../../design/music-theory-pedagogy.md)
§6 "Chord-function transitions".

## Problem

- **The Add default ignores intent.** `addProgressionStepAtom` picked the new
  chord's degree as `(previousIdx + 1) % sequence.length` — a fixed walk up the
  scale. After a V you got vi° walking, never the I the ear expects.
- **No "what goes here?" help.** Deciding the next chord requires theory
  knowledge the app otherwise teaches; the editor gave no hints.

## Design

### 1. Pure suggestion engine

`packages/fretboard/src/progressions/nextChordSuggestions.ts` —
`suggestNextChords(previousDegree, scaleName, tonicNote, limit = 3)`.

- A ranked **transition table keyed by the previous chord root's semitone
  offset** from the tonic (the same key `getDegreesForScale` uses). Candidates
  are filtered to offsets the active scale has a diatonic degree on, so one
  table serves every mode and the pentatonics (a missing degree just lets the
  next-ranked function surface).
- Each suggestion carries the resolved diatonic `root` + `quality` (via
  `getDiatonicChord`) and a `reason` key (`authenticCadence`, `twoFive`,
  `modalCadence`, …) rendered as a localized tooltip / aria-label.
- Null or unknown previous degree (empty list, borrowed/chromatic numerals)
  falls back to opening candidates (tonic first). Diatonic-only in v1;
  borrowed-chord suggestions are deferred.
- Like `progressionGeneration.ts`, deliberately does NOT use
  @tonaljs/progression (major-key-only roman-numeral frame).

### 2. Function-aware Add default

`addProgressionStepAtom` now inserts the **top suggestion** for the selected
chord (tonic when the list is empty). Insert-at-cursor mechanics are unchanged
and shared via a private `insertProgressionStepAtom`.

### 3. "Suggested next" chips

- `nextChordSuggestionsAtom` (derived) exposes the candidates for the selected
  slot; empty progression → no chips (the editor panel is hidden there anyway).
- `ChordSuggestions` (in `src/components/SongControls/`) renders at the bottom
  of the chord editor panel: degree numeral + resolved note per chip, reason as
  `title` and in the aria-label, disabled while playback locks the editor.
- Clicking a chip = `addSuggestedProgressionStepAtom(degree)` — same
  insert-after-cursor + select behavior as Add, so the new chord can be
  previewed (`A`) or refined immediately. Pairs with the audition control as
  the roadmap intended.

## Affected code

- `packages/fretboard/src/progressions/nextChordSuggestions.ts` — engine (new).
- `packages/fretboard/src/store/progressionAtoms.ts` — `nextChordSuggestionsAtom`,
  `addSuggestedProgressionStepAtom`, function-aware `addProgressionStepAtom`.
- `src/components/SongControls/ChordSuggestions.tsx` — chips (new);
  `SongControls.tsx` mounts it under the editor grid.
- `src/i18n/` — `suggestedNext` + eight `suggestionReason*` strings (en/es).

## Testing

- Unit: transition ranking per mode (major, minor, pentatonic skip-over),
  cadence reason tagging, opening/unknown-degree fallbacks, limit; atom tests
  for the new default (I → IV, V → I), chip insert semantics, preset-marker
  clearing.
- Component: chips render with resolved notes, click inserts + selects,
  reason in accessible name, disabled while playing, hidden when empty.
