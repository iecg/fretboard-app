# Extended Chord Qualities — Design

**Date:** 2026-06-01
**Status:** Approved, pending implementation plan

## Summary

Add nine extended chord qualities (9ths, 13ths, and the 6/9) to FretFlow's chord picker. Today the app supports 15 qualities, none of which carry tensions above the 7th. This adds the common pop/jazz extension vocabulary. Altered dominants (`7♭9`, `7♯9`, `7♯11`, `7♭13`, `13♭9`, …) are explicitly deferred to a future phase; the data and voicing plumbing built here is designed so they can be added later without rework.

## Scope

### In scope — nine new qualities

| Symbol  | Display label | Tonal member set (sharps-form) |
| ------- | ------------- | ------------------------------ |
| `add9`  | `add9`        | root, 3, 5, 9                  |
| `9`     | `9`           | root, 3, 5, b7, 9              |
| `maj9`  | `M9`          | root, 3, 5, 7, 9               |
| `m9`    | `m9`          | root, b3, 5, b7, 9             |
| `6/9`   | `6/9`         | root, 3, 5, 6, 9               |
| `9sus4` | `9sus4`       | root, 4, 5, b7, 9              |
| `13`    | `13`          | root, 3, 5, b7, 9, 13          |
| `maj13` | `M13`         | root, 3, 5, 7, 9, 13           |
| `m13`   | `m13`         | root, b3, 5, b7, 9, 13         |

Member sets follow Tonal.js output. Note that Tonal's 13th chords **omit the 11th** by convention, yielding six notes (root, 3/b3, 5, b7/7, 9, 13).

The exact final symbol list (e.g. whether to include `9sus4`) is confirmed; `9sus4` is included as a cheap, common addition.

### Out of scope (deferred)

- Altered dominants and upper-structure alterations (`7♭9`, `7♯9`, `7♯11`, `7♭13`, `13♭9`, etc.).
- Adding extended chords to the CAGED `FULL_CHORD_TEMPLATES` system. Extended chords use close voicings + fretboard overlay only.
- Exposing the full Tonal chord dictionary.

## Background — current system

- **Quality definitions:** `packages/core/src/theory.ts`. `CHORD_DEFINITIONS` (a `Record<string, ChordDefinition>`) is built by `buildChordDef(symbol, category, members)`. Member tokens are typed by the `ChordMemberName` union (`packages/core/src/theory.ts:68`), currently:
  `"root" | "2" | "b3" | "3" | "4" | "b5" | "#5" | "5" | "6" | "b7" | "7" | "bb7"`.
- **Notes/intervals:** `getChordNotes` (`packages/core/src/theory.ts`) and `getChordSemitonesFromTonal` (`packages/core/src/lib/tonal.ts`) resolve `${root}${symbol}` through Tonal.js. All nine new symbols already resolve correctly in Tonal.
- **UI picker:** `src/components/Inspector/ChordTypeGrid.tsx` renders a button grid. Options come from `buildQualityToggleOptions()` (`src/components/shared/chordControlOptions.ts`). Labels and order come from `CHORD_TYPE_SHORT_LABELS` and `CHORD_TYPE_DISPLAY_ORDER` (`src/components/ChordOverlayControls/chordTypeOptions.ts`).
- **Voicings:** `packages/core/src/shapes/voicings.ts` — `closeVoicings` rejects chords outside the 3–5-note range (`voicings.ts:136`). `fullVoicings` uses CAGED templates (`templates.ts`), defined for only ~10 qualities.

### Pre-verified safety of new member tokens

A trace of every consumer of member tokens confirms `"9"`/`"11"`/`"13"` flow safely:

- `GUIDE_TONE_RAW` set (`src/store/practiceLensAtoms.ts:112`) — uses `Set.has`; new tokens correctly evaluate to non-guide-tone. Musically correct (guide tones are only 3rds/7ths).
- Member display (`src/store/chordOverlayAtoms.ts:736`, `src/store/composableSelectors.ts:109`) — uses generic `formatAccidental()`; new tokens format correctly.
- Fifth detection (`src/progressions/progressionAudio.ts:165`) — explicit `.find()` for the 5th; unaffected.
- Fretboard labels (`src/components/FretboardSVG/hooks/buildStaticFretboardTopology.ts:262`) — render note names or chromatic interval names, not member tokens; unaffected.
- **No exhaustive `switch` or `Record<ChordMemberName, X>` lookups exist** that would silently miss new tokens.

The only required type change is extending the `ChordMemberName` union.

## Design

### 1. Data layer — `packages/core`

**`theory.ts`**

- Extend the `ChordMemberName` union to add `"9"`, `"11"`, `"13"`. (`"6"` is already present. `"11"` is included for forward-compatibility with deferred altered/extended chords even though no in-scope chord uses it.)
- Add the nine entries to `CHORD_DEFINITIONS` via `buildChordDef`, with the member arrays in the scope table above. Categories: `add9`/`6/9` map to existing categories where sensible, or a new `"extended"` category value is added to the `ChordQuality` category union (`theory.ts:69`). Decision: **add an `"extended"` category** for `9`, `maj9`, `m9`, `6/9`, `add9`, `9sus4`, `13`, `maj13`, `m13`, so grouping logic and any category-driven behavior can distinguish them.

**Shapes layer — new omission table**

- Add a per-quality tone-omission table, e.g. in `packages/core/src/shapes/` (co-located with voicing logic):

  ```ts
  // Tones dropped before voicing generation, to reduce 6-note extended
  // chords to a playable grip. Tonal already omits the 11th on 13th chords;
  // dropping the 5th brings them to the standard 5-note jazz voicing.
  export const VOICING_OMISSIONS: Record<string, ChordMemberName[]> = {
    "13": ["5"],
    maj13: ["5"],
    m13: ["5"],
  };
  ```

- This is the extension hook altered-dominant voicings will reuse.

### 2. Shapes / voicings layer

- `closeVoicings` (and/or the voicing entry point) consults `VOICING_OMISSIONS` and removes the listed members before the 3–5-note range check. After dropping the 5th, the three 13th chords become 5-note grips (root, 3/b3, b7/7, 9, 13) that pass the existing range gate.
- **No change to the 3–5 cap.** No new shape algorithm.
- The ≤5-note extensions (`add9`=4, `9`/`maj9`/`m9`/`6/9`/`9sus4`=5) need no omission and generate close voicings unchanged.
- CAGED `FULL_CHORD_TEMPLATES`, `FullChordQuality`, and `FULL_CHORD_QUALITIES` are **not** extended. Extended chords rely on close voicings + the fretboard overlay. This is an accepted, documented boundary.

### 3. UI layer — `src/components`

- Add the nine symbols to `CHORD_TYPE_SHORT_LABELS` with the labels in the scope table.
- Restructure `CHORD_TYPE_DISPLAY_ORDER` from a flat array into **labelled groups**, and update `ChordTypeGrid.tsx` to render section headers. Groups:
  - **Triads:** M, m, dim, aug
  - **Suspended:** sus2, sus4, 9sus4
  - **Power:** 5
  - **Sixths:** 6, m6, 6/9
  - **Sevenths:** maj7, m7, 7, dim7, m7b5, mMaj7
  - **Extensions:** add9, 9, maj9, m9, 13, maj13, m13
- Section headers must be accessible (e.g. grouped via `role="group"` + `aria-label`, or visually-labelled subgroups). Keep the existing single-grid visual language; add headers rather than a new interaction model.
- `buildQualityToggleOptions()` updated to emit grouped option data the grid can render.

### 4. Testing

- **Unit (`packages/core`):**
  - Each new quality resolves the expected notes via `getChordNotes` for at least one root (and a flat-key root to confirm sharps-form normalization).
  - Member arrays in `CHORD_DEFINITIONS` match Tonal's resolved intervals for each new symbol.
  - `VOICING_OMISSIONS` applied to `13`/`maj13`/`m13` yields a 5-note close voicing; the dropped tone is the 5th.
- **Component (`src/components`):**
  - Picker renders all groups including the new Extensions group with correct labels.
  - Selecting an extension updates the chord overlay (correct chord-tone count highlighted).
- **Visual regression (`e2e/`):** Refresh the picker snapshot(s) to capture the regrouped layout.

## Risks & boundaries

- **6-note chords have no full/CAGED shape** — accepted. Overlay always works; close voicings work after omission.
- **Picker length grows** (15 → 24 qualities) — mitigated by labelled grouping.
- **`"11"` token is added but unused in-scope** — intentional forward-compat; carries no runtime cost.

## Future phase (not this spec)

Altered dominants and upper-structure alterations, reusing `VOICING_OMISSIONS` and the `"extended"` category. Would expand the `ChordMemberName` union (`b9`, `#9`, `#11`, `b13`) and the Extensions group.
