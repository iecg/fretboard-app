# Controls Overhaul — Design

**Status:** Brainstorm spec. Produced 2026-05-19. The second of three planned specs
that make the Inspector controls easier to use:

1. `2026-05-19-voicing-controls-refinement-design.md` — four behavioral voicing fixes
   (drop2/triad, string-set diagram, disable + auto-heal). Ships independently.
2. **This spec** — the controls overhaul: tab information architecture, the
   fingering↔chord decoupling, an explicit scope-to-position link, Chord Spread
   relocation, and chord-tab progressive disclosure.
3. *(Future)* Visual UI refresh — styling, spacing, hierarchy polish. Deliberately
   deferred until this spec settles the structure.

**Date:** 2026-05-19

**Scope:** Restructure the Inspector's controls so each tab is self-contained, replace
the hidden fingering↔chord couplings with one explicit opt-in link, relocate the
Chord Spread control, and reduce the Chord tab's control density. No visual restyle,
no engine changes, no new fingering patterns.

---

## 1. Background — why the controls feel complicated

The Inspector has four tabs — View, Scale, Chord, Progression. Live use surfaced
several structural problems:

- **Fingering lives in the wrong tab.** The fingering-pattern controls
  (`FingeringPatternControls`) sit in the **View** tab, away from both the Scale tab
  (which defines the scale they visualize) and the Chord tab (which they silently
  affect).
- **Hidden couplings.** Selecting the `one-string` or `two-strings` fingering pattern
  *disables the entire chord overlay* (`isChordOverlayPatternDisabled`). Selecting the
  `caged` fingering pattern *silently scopes voicing output to the active box*
  (`selectFullChordMatchesForCagedPosition`, applied whenever
  `fingeringPattern === "caged"`). Neither is requested by the user; both are
  surprising side-effects of an unrelated control.
- **Conflated axes.** The fingering control is one five-option `ToggleBar`
  (None / CAGED / 3NPS / 1-String / 2-Strings). But CAGED and 3NPS chunk the scale into
  *positions*, while 1-String and 2-Strings are for studying the scale *melodically and
  in intervals*. Two different ideas compete in one control.
- **Chord Spread is exiled.** `chordFretSpreadAtom`'s only UI control lives in the
  global Settings overlay (`ChordLayoutSettingsSection`), far from every other chord
  control.
- **Chord-tab density.** The Chord tab presents Source, Lens, and the full Voicing
  group (Type, Inversion, String Set, Connectors) at once.

---

## 2. Goals and Non-Goals

### Goals

- Each tab is self-contained — its controls do not depend on another tab's state to be
  usable.
- No control silently disables or constrains an unrelated feature. The only
  fingering↔chord link is explicit, labeled, and opt-in.
- The fingering control communicates the difference between position systems and
  string study.
- Chord Spread is reachable from the Chord tab.
- The Chord tab has a simple default reading, with advanced voicing controls behind
  progressive disclosure.

### Non-Goals

- No visual restyle — colors, spacing, typography, component look are deferred to the
  future Visual UI Refresh spec.
- No changes to the voicing engine, the scale / circle-of-fifths logic, or the
  progression engine.
- No new fingering patterns and no removal of existing ones — the five patterns stay;
  only their presentation changes.
- No change to the tab *set* — still View / Scale / Chord / Progression.
- This spec does not depend on Spec 1 (voicing-controls refinement); the two touch
  overlapping files but neither blocks the other. Where they interact (the
  scope-to-position toggle feeds Spec 1's valid-combo computation) it is noted, not
  required.

---

## 3. Tab information architecture

Controls regroup strictly by domain. The tab set is unchanged; their contents move:

| Tab | Contents after this spec |
|---|---|
| **Scale** | Key + scale type (unchanged), **+ the fingering controls** (moved from View), Circle of Fifths, Theory facts. |
| **View** | Display preferences only: note labels, accidentals, enharmonic display, fret range, degree colors. |
| **Chord** | Chord source, lens, the Voicing section, **+ Chord Spread** (moved from Settings), **+ scope-to-position**. |
| **Progression** | Unchanged. |

`FingeringPatternControls` is rendered by `ScaleTab` instead of `ViewTab`. It still
emits `GroupHeader` + `Prop` cells into the host tab's `PropGrid` (the existing
fragment-of-grid-items pattern is unchanged), so the move is a re-parenting plus any
`PropGrid` column adjustment the Scale tab needs.

---

## 4. Fingering model — split the axis

One scale-view mode is active at a time (the underlying `fingeringPatternAtom` and its
five values — `none` / `caged` / `3nps` / `one-string` / `two-strings` — are
unchanged). The **presentation** splits into two clearly-labeled clusters:

- **Position** — `None` · `CAGED` · `3NPS`. These chunk the scale into playable
  positions.
- **String study** — `1-String` · `2-Strings`. These study the scale melodically and
  in intervals.

The two clusters are mutually exclusive in effect (only one `fingeringPatternAtom`
value is active); the split is a visual/structural grouping, not two independently
active states. Rendering: the single `ToggleBar` becomes two labeled groups — a
`Position` group of three and a `String study` group of two — within the FINGERING
property-grid section, with enough separation (a divider or sub-labels) that the user
reads them as distinct axes. Selecting any option in either group sets
`fingeringPatternAtom`; the other group's options visibly deselect.

Per-mode sub-controls are unchanged in function and appear only under the active mode:
CAGED shape selector (with long-press multi-select); 3NPS position + octave; 1-String
string + connectors; 2-Strings pair + interval. They are simply owned by the cluster
of their mode rather than trailing a generic "pattern" control.

---

## 5. Kill the hidden couplings

Both implicit fingering→chord side-effects are removed:

- **`one-string` / `two-strings` no longer disable the chord overlay.**
  `isChordOverlayPatternDisabled` (in `fingeringAtoms.ts`) and every consumer of it are
  removed. `ChordOverlayControls` drops its `isPatternDisabled` branch — the
  `panel-disabled` styling, the `data-disabled` attribute, the
  `controls.chordOverlayDisabled` hint, and the `isPatternDisabled` gating of the
  Source/Display/Voicing sections. The chord overlay is available in every fingering
  mode.
- **The `caged` fingering pattern no longer silently scopes voicings.** The
  application of `selectFullChordMatchesForCagedPosition` in `useFretboardState` stops
  being keyed on `fingeringPattern === "caged"`. It is keyed on the explicit
  scope-to-position state (§6).

After this, choosing a fingering pattern changes only how the *scale* is drawn. It has
no effect on whether or how the chord overlay renders, unless the user opts in via §6.

---

## 6. Scope-to-position — the one explicit link

A single labeled control in the Chord tab — **"Scope to position"**, a `Switch` —
governs whether the chord overlay is constrained to the active fingering position.

- **State:** a new persisted boolean atom (working name `chordScopeToPositionAtom`),
  default off.
- **An "active position" exists** when the fingering mode resolves to a single
  position: exactly one CAGED shape selected, or a 3NPS position `> 0`. Fingering
  `None`, multi-shape CAGED, and the String-study modes have no single position.
- **When the toggle is on *and* an active position exists:** the chord overlay — both
  the loose chord-tone highlighting and the voicing-engine output — is constrained to
  that position's fret window. This reuses the existing position-scoping mechanism
  (`selectFullChordMatchesForCagedPosition` for voicings; the box-bounds filter in
  `useNoteData` for chord tones) — now gated on the toggle rather than on the fingering
  pattern.
- **When the toggle is off, or no active position exists:** the chord overlay renders
  unconstrained across the whole fretboard. When no active position exists the toggle
  renders disabled with a hint explaining it needs a single CAGED shape or 3NPS
  position.

This is the only surviving fingering↔chord coupling, and it is visible, named, and
off by default.

---

## 7. The "CAGED" naming

"CAGED" legitimately names both a scale-position system and a chord-voicing system —
they are the same five-shape idea applied to scales versus chords. No code-level type
or value is renamed. Disambiguation is contextual: the fingering option always appears
under the **Position** group label (§4) and the voicing option under the **Voicing**
group label (§8), so the user always sees "Position: CAGED" or "Voicing: CAGED" in
context. The HelpModal text gains one sentence noting the two uses.

---

## 8. Chord Spread relocation + Chord-tab progressive disclosure

### 8a. Chord Spread moves to the Chord tab

`chordFretSpreadAtom` is unchanged; only its UI home moves. Its control is rendered in
the Chord tab inside the Voicing section (§8b). The Settings-overlay piece is removed:
`ChordLayoutSettingsSection`, the `chordSpread` entry in `SETTING_FIELDS`, the
`"chordSpread"` member of the SettingsOverlay field-type union, and the
`chordFretSpread` wiring in `useSettingsForm`. The `settings.fields.chordSpread*` i18n
keys are repurposed for the Chord-tab control's label and hint (or replaced with
`inspector.*` keys — implementer's choice, but the user-facing strings stay).

### 8b. Voicing section becomes collapsible

The Chord tab reads top-to-bottom as: **Source** (mode, degree/root) → **Lens** →
**Voicing ▸**. The Voicing group becomes a collapsible section:

- Collapsed by default — the common "just show me the chord" case is uncluttered.
- When expanded it holds Type, Inversion, String Set, Connectors (the existing VOICING
  group), plus Chord Spread and the §6 scope-to-position toggle.
- Expanded/collapsed state is a persisted boolean atom (working name
  `voicingSectionExpandedAtom`).
- The collapsible header shows the section name and the disclosure affordance; it
  reuses the existing `GroupHeader` where practical (the Connectors toggle currently in
  the VOICING `GroupHeader` stays with the section).

Trade-off accepted: collapsing Voicing by default hides the controls Spec 1 refines.
That is deliberate — the simpler default serves the common case, and the section is one
click away with its state remembered.

---

## 9. File-level impact

- `src/components/Inspector/ScaleTab.tsx` — render `FingeringPatternControls`; adjust
  `PropGrid` columns as needed.
- `src/components/Inspector/ViewTab.tsx` — remove `FingeringPatternControls`; View now
  holds only display-preference groups.
- `src/components/FingeringPatternControls/FingeringPatternControls.tsx` — render the
  pattern selector as two labeled clusters (Position / String study) instead of one
  five-option `ToggleBar`; sub-controls unchanged.
- `src/store/fingeringAtoms.ts` — remove `isChordOverlayPatternDisabled`.
- `src/hooks/useFretboardState.ts` — gate `selectFullChordMatchesForCagedPosition` (and
  the chord-tone box-bounds scoping path) on `chordScopeToPositionAtom` + an
  active-position check, not on `fingeringPattern === "caged"`.
- `src/store/chordOverlayAtoms.ts` — add `chordScopeToPositionAtom` (persisted,
  default off) and `voicingSectionExpandedAtom` (persisted); an `activePositionAtom`
  (or equivalent selector) reporting whether a single CAGED shape / 3NPS position is
  active.
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — remove the
  `isPatternDisabled` branch and all disabled-panel UI; make the Voicing group a
  collapsible section; render the Chord Spread control and the scope-to-position
  toggle inside it.
- `src/components/SettingsOverlay/sections/ChordLayoutSettingsSection.tsx` — removed.
- `src/components/SettingsOverlay/{constants,types}.ts`, `useSettingsForm.ts` — remove
  the `chordSpread` field.
- `src/store/atoms.ts` — re-export the new atoms.
- `src/components/HelpModal/HelpModal.tsx` — update the Chord Spread reference (no
  longer in Settings); add the one-sentence CAGED-naming note.
- i18n (`en.ts`, `es.ts`, `types.ts`) — strings for the two fingering cluster labels,
  the scope-to-position label + hint, the Voicing collapsible; remove or repurpose the
  obsolete `controls.chordOverlayDisabled` and Settings `chordSpread` keys.

---

## 10. Cross-Cutting Notes

- New user-facing strings (cluster labels, scope-to-position label/hint, Voicing
  section) go through `useTranslation`, en + es.
- The persisted atoms (`chordScopeToPositionAtom`, `voicingSectionExpandedAtom`) use
  the standard `atomWithStorage` + `k()` key prefix; default off / collapsed.
- Removing `isChordOverlayPatternDisabled` is a behavior change covered by existing
  `ChordOverlayControls` and `FingeringPatternControls` tests — those tests update.
- Mandatory before the PR: `pnpm run lint`, `pnpm run test`, `pnpm run build`,
  `npx tsc -b`.
- Visual-regression baselines refresh for `app-components` and `app-layout` (the View,
  Scale, and Chord tabs all change layout), darwin + linux.

---

## 11. Testing (TDD — failing test first per task)

- `ScaleTab.test.tsx` / `ViewTab.test.tsx` — fingering controls render in the Scale tab
  and no longer in the View tab.
- `FingeringPatternControls.test.tsx` — the selector renders a Position cluster
  (None/CAGED/3NPS) and a String-study cluster (1-String/2-Strings); selecting an
  option in one clears the other; each mode's sub-controls still appear.
- `fingeringAtoms` / `ChordOverlayControls.test.tsx` — with `one-string` or
  `two-strings` active, the chord overlay controls are fully enabled (no disabled
  panel).
- `chordOverlayAtoms.test.ts` — `chordScopeToPositionAtom` and
  `voicingSectionExpandedAtom` default off/collapsed and persist; `activePositionAtom`
  reports true only for a single CAGED shape or a 3NPS position > 0.
- `useFretboardState` — voicings are scoped to the active position only when
  `chordScopeToPositionAtom` is on and an active position exists; with the toggle off,
  voicings are unconstrained regardless of fingering pattern.
- `ChordOverlayControls.test.tsx` — the Voicing section is collapsed by default and
  toggles; Chord Spread and scope-to-position render inside it; the scope toggle is
  disabled with a hint when no active position exists.
- `SettingsOverlay` tests — the Chord Spread section is gone; remaining settings
  unaffected.
- Visual regression — refresh `app-components` and `app-layout` (darwin + linux).

---

## 12. Acceptance Criteria

- Fingering controls appear in the Scale tab; the View tab holds only display
  preferences.
- The fingering selector reads as two labeled groups — Position and String study.
- Selecting any fingering pattern, including 1-String / 2-Strings, leaves the chord
  overlay fully usable.
- Voicings are constrained to a fingering position only when the user turns on
  "Scope to position" and a single CAGED shape or 3NPS position is active.
- Chord Spread is adjustable from the Chord tab; it is no longer in the Settings
  overlay.
- The Chord tab shows Source and Lens by default with the Voicing section collapsed;
  expanding it reveals Type, Inversion, String Set, Connectors, Chord Spread, and
  scope-to-position.
- `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b` all pass.
