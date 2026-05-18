# Voicing Engine Redesign — Design

**Status:** Brainstorm spec. Produced 2026-05-18 after a live diagnosis of the shipped
voicing engine (PR #413) showed the Type / Inversion / String Set controls produce
incoherent or invisible results.

**Date:** 2026-05-18

**Scope:** Make the Chord-tab voicing controls actually drive the fretboard in a
coherent, predictable way, and make the String Set options adapt to the active chord.
Core engine, voicing atoms, `StringSetPicker`, `ChordOverlayControls`.

---

## 1. Background — why the current engine fails

The voicing engine (`packages/core/src/shapes/voicings.ts`) shipped and is wired
(`voicingMatchesAtom` → `fullChordMatchesAtom` → `useFretboardState` → `Fretboard` →
`FretboardSVG`). A live diagnosis in the running app found:

| Setting | Result |
|---|---|
| `caged` + `All` | 32 shape-colored notes (CAGED A/C/E/G), 9 connectors — works |
| `caged` + any non-`All` string set | **0 voicings** — a 6-string CAGED shape cannot fit a 3-string window, so `cagedVoicings` returns `[]` |
| `triad` / `drop2` | connectors render, but **no `data-full-chord-shape`** notes — a different *kind* of rendering than `caged` |
| any type, empty engine output | the board **silently falls back** to "generated" connectors drawn over *every* scattered chord tone |

Three structural faults:

1. **`caged` is incompatible with String Set and Inversion.** A CAGED shape is a fixed,
   six-string, root-position object. Subsetting it to a string window or inverting it
   yields nothing — those two controls are dead while `caged` is selected.
2. **Each voicing type renders a different kind of thing** — `caged` colors note
   bubbles by shape; `triad`/`drop2` draw only connectors.
3. **Empty engine output silently degrades** to connectors over all chord tones, so a
   broken combination looks like a random scatter rather than "nothing".

The String Set control is also a fixed five-option list that ignores the chord — a
four-note chord cannot be voiced inside a three-string window, yet the picker still
offers the three-string sets.

---

## 2. Goals and Non-Goals

### Goals

- Every Type / Inversion / String Set combination produces a **coherent, visible**
  result on the fretboard — or visibly nothing, never a misleading scatter.
- The String Set control's options **adapt to the active chord's tone count**.
- Voicings stay **constrained to the active fingering pattern** (today's CAGED
  position filter is kept).

### Non-Goals

- No new voicing *types* — the set stays `caged` / `drop2` / `triad`.
- No 3NPS-position constraining (only the CAGED pattern constrains voicings, as today).
- No music-theory changes to chord definitions or the search algorithm itself — only
  its parameters and the surrounding UX.
- No app-shell or other-tab changes.

---

## 3. Voicing Type drives which controls are shown

The Type control keeps three options. **`caged` is a self-contained mode**; the other
two expose the sub-controls.

- **`caged`** — the canonical full CAGED shapes (`getFullChordShapeMatches`, the path
  that already works). When `caged` is selected, the **String Set and Inversion `Prop`
  cells are not rendered** at all. A CAGED shape has no meaningful string subset or
  inversion, so offering those controls is the bug.
- **`triad` / `drop2`** — the algorithmic search (`searchVoicings`). The String Set and
  Inversion cells **are rendered** and both compose with the search.

`ChordOverlayControls` gates the two `Prop` cells on `voicingType !== "caged"`. The
VOICING `GroupHeader` and the Type cell always render; the Connectors header toggle is
unchanged.

When the voicing controls are hidden and then shown again (Type switched back to
`triad`/`drop2`), they show their last persisted values.

---

## 4. Dynamic String Set

The String Set is no longer a fixed five-option union. Its options are **generated from
the active chord's tone count** `N` (the number of members in the chord definition).

### 4a. The window model

A string set is either **`all`** (all six strings) or a **contiguous window of `N`
strings**. With six strings there are `W = 6 - N + 1` windows. String indices run
`0` = high-E … `5` = low-E (matching `VoicingNote.stringIndex`); guitar string numbers
are `index + 1`.

Windows are numbered from the bass side (lowest pitch, includes string 6) to the treble
side. Naming:

| `N` (tones) | `W` | Window labels (bass → treble) |
|---|---|---|
| 2 | 5 | Bass · Lower mid · Middle · Upper mid · Treble |
| 3 | 4 | Bass · Lower mid · Upper mid · Treble |
| 4 | 3 | Bass · Middle · Treble |
| 5 | 2 | Bass · Treble |
| ≥ 6 | — | (no windows — only `All`) |

General rule: window 0 = **Bass**, window `W-1` = **Treble**; the middle windows are
**Lower mid / Middle / Upper mid** assigned symmetrically (one middle → `Middle`; two →
`Lower mid`, `Upper mid`; three → `Lower mid`, `Middle`, `Upper mid`). `N ≥ 6` is
degenerate — only `All` is offered.

The picker always shows **`All` first**, then the windows bass → treble. So a triad
shows `All · Bass · Lower mid · Upper mid · Treble` (5); a seventh chord shows
`All · Bass · Middle · Treble` (4) — exactly the brief.

### 4b. Identity, persistence, auto-pick

- A string set is identified by a **stable id string**: `"all"`, or the window's
  string numbers joined with `·` low→high, e.g. `"4·5·6"`, `"2·3·4·5"`. The id encodes
  the exact strings, so it survives chord changes when still valid.
- `voicingStringSetAtom` stores this id string (validated storage; default `"all"`).
- A pure helper `buildStringSetOptions(toneCount)` returns the ordered option list —
  each entry `{ id, label, strings: number[] }` where `strings` is the string-index
  array (`all` → `[0,1,2,3,4,5]`).
- An **effective string set** selector resolves the stored id against the current
  chord's option list: if the id is present, use its `strings`; otherwise fall back to
  `all`. This is the **auto-pick a default** behaviour — when the chord changes and the
  current selection no longer exists, the engine and picker both see `all`.
- The picker shows only the **valid** options for the current chord — invalid sets are
  **hidden, not disabled** (the list simply rebuilds).
- A normalizing `useEffect` in `ChordOverlayControls` writes `voicingStringSetAtom` back
  to `"all"` when the stored id is not in the current option list, so persisted state
  self-heals (mirrors the existing voicing-inversion normalizer).

### 4c. Core engine parameter

`generateVoicings` / `searchVoicings` take `stringSet` as a **`readonly number[]`** of
allowed string indices (no longer a union). The fixed `VoicingStringSet` union,
`STRING_SET_MASKS`, and `stringSetMask` are **removed from core** — the engine just
filters candidate strings by the index set. The id ↔ indices mapping and the dynamic
naming live entirely in the app layer (`buildStringSetOptions`).

---

## 5. Inversion

Unchanged in substance: `root` / `1st` / `2nd` / `3rd`, limited to the chord's tone
count by `availableInversionsAtom` (dyads → `root` only, triads drop `3rd`). The
Inversion cell is **hidden when `voicingType === "caged"`** (§3) and shown otherwise.
The existing normalizer that resets a stale inversion is kept.

---

## 6. Coherent rendering — no silent scatter

The engine must never silently degrade to "connectors over every chord tone":

- `triad` / `drop2` searches stay **constrained to the active CAGED position** via the
  existing `selectFullChordMatchesForCagedPosition` (it already scores any `Voicing`
  by polygon distance, shape or not). Non-CAGED patterns show the engine output as-is,
  as today.
- When the engine returns **no voicings** for the current Type / Inversion / String Set,
  the board shows the **plain chord-tone overlay with no connectors** — not the
  "generated" scatter. The connector layer only renders connectors for the engine's
  actual voicings; it does not synthesize connectors from loose chord tones when a
  voicing is the active source.
- Every voicing type highlights its voicing's note **positions** consistently
  (`fullChordPositionsAtom` already feeds the chord-role classes). `caged` additionally
  keeps its per-shape coloring (`data-full-chord-shape`); `triad`/`drop2` carry no
  shape, which is correct — they are not CAGED shapes.

---

## 7. File-level impact

- `packages/core/src/shapes/voicings.ts` — `stringSet` param → `readonly number[]`;
  drop `VoicingStringSet`, `STRING_SET_MASKS`, and `stringSetMask`.
- `packages/core/src/shapes/index.ts` — drop the removed exports.
- New `src/store/voicingStringSets.ts` (or a section of `chordOverlayAtoms.ts`) —
  `buildStringSetOptions(toneCount)`, the id ↔ indices helpers.
- `src/store/chordOverlayAtoms.ts` — `voicingStringSetAtom` stores an id string;
  add an effective-string-set selector; `voicingMatchesAtom` passes the resolved
  `number[]` to the engine.
- `src/components/Inspector/StringSetPicker.tsx` — render `buildStringSetOptions`
  output instead of the hardcoded `CARDS`.
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — hide String Set +
  Inversion cells when `voicingType === "caged"`; add the string-set normalizer.
- `src/components/FretboardSVG/` — the connector layer must not generate connectors
  from loose chord tones while a voicing is the active source (§6).

---

## 8. Cross-Cutting Notes

- New / changed UI strings (the generated window labels) go through `useTranslation`,
  en + es. The string-number `sub` text (`"4·5·6"`) is locale-neutral.
- `VoicingStringSet` removal is a breaking core API change — every consumer is in this
  spec's file list; `npx tsc -b` will surface any miss.
- Mandatory before the PR: `pnpm run lint`, `pnpm run test`, `pnpm run build`,
  `npx tsc -b`.
- Visual-regression baselines refresh for `app-components` (Chord tab),
  `chord-overlay-controls`, `fretboard-svg`, `fretboard-connectors`, darwin + linux.

## 9. Testing (TDD — failing test first per task)

- `voicings.test.ts` (core) — `generateVoicings` with an explicit `number[]` string
  set: a triad search confined to `[3,4,5]` returns only voicings whose notes sit on
  those strings; an empty result for an impossible request; `drop2` on a 4-note chord.
- `voicingStringSets.test.ts` — `buildStringSetOptions(3)` → 5 entries
  (`All · Bass · Lower mid · Upper mid · Treble`); `buildStringSetOptions(4)` → 4
  entries (`All · Bass · Middle · Treble`); each window's `strings` array is correct;
  `≥6` → `All` only.
- `chordOverlayAtoms.test.ts` — the effective-string-set selector falls back to `all`
  when the stored id is invalid for the active chord; `voicingMatchesAtom` passes the
  resolved indices and returns non-empty engine output for a valid triad + window.
- `ChordOverlayControls.test.tsx` — String Set and Inversion cells are absent when
  `voicingType` is `caged` and present for `triad`/`drop2`; the String Set picker shows
  4 options for a seventh chord and 5 for a triad; switching to an incompatible chord
  snaps the selection back to `All`.
- `StringSetPicker.test.tsx` — renders the options passed to it; unchanged a11y
  contract.
- `FretboardSVG` — when the active voicing source yields no voicings, no connector
  paths render (no generated-scatter fallback).
- Visual regression — refresh the suites in §8.

## 10. Acceptance Criteria

- Selecting `caged` hides String Set + Inversion; selecting `triad`/`drop2` shows them.
- Changing Type / Inversion / String Set visibly changes the fretboard, every time.
- The String Set picker shows tone-count-appropriate windows (triad → 5, seventh → 4),
  and an invalid persisted selection auto-snaps to `All`.
- No combination produces a misleading scatter of connectors over loose chord tones.
- `triad`/`drop2` voicings stay within the active CAGED position.
- `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b` all pass.
