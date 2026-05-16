# DAW Shell Phase 5 Corrections — Design

**Date:** 2026-05-16

**Status:** Approved design. Follow-up to Phase 5 (PR #403), which shipped progression
integration but introduced a duplicated chord readout and left the Progression tab
unreachable when progression mode is off.

**Scope:** Three small, related corrections to the DAW shell. One spec, one
implementation plan — no independent subsystems.

---

## 1. Background

Phase 5 (`docs/superpowers/plans/2026-05-15-daw-shell-phase-5-progression-integration.md`)
made the progression workflow first-class in the Inspector. Two problems surfaced once
it shipped, plus one piece of reskin work that the DAW shell redesign always intended
but never completed:

- **A — Progression tab dead-end.** The Inspector's Progression tab is gated on
  `progressionEnabledAtom`. The only progression on/off control is the "Progression
  mode" switch *inside* `ProgressionControls`, which renders only in that tab. Turning
  progression off hides the tab, and there is then no way to turn it back on.
- **B — Duplicated chord readout.** Phase 5 added `ChordSelectionCallout` above
  `ChordOverlayControls` in the Chord tab. Its chord readout overlaps with the
  `ChordPracticeBar` that already sits above the fretboard. The chord readout belongs
  above the fretboard, not in an Inspector tab.
- **C — Incomplete DAW reskin.** `DegreeChipStrip` and `ChordPracticeBar` still use the
  generic `strip-surface` chrome and generic tokens (`--strip-fill`,
  `--chip-border-inactive`, etc.). They have not been brought into the DAW faceplate
  visual language that the Inspector uses.

### Current state (verified against the codebase)

- `App.tsx` mounts `summary={<ProgressionSummarySlot />}` above the fretboard and
  `controlsPanel={<Inspector />}`.
- `ProgressionSummarySlot` renders `ProgressionTrack` when `progressionEnabledAtom` is
  true, otherwise `TopBandSummary`.
- `TopBandSummary` renders `DegreeChipStrip` plus an optional `ChordPracticeBar` (gated
  on `showChordPracticeBarAtom`). `TopBandSummary` itself already carries the DAW
  faceplate (`composes: faceplate`) — Phase 4 reskinned the *container*. The reskin gap
  is the *contents*: `DegreeChipStrip` and `ChordPracticeBar`.
- The Inspector has four tab bodies — View, Scale, Chord, Progression. `tabs.ts` splits
  them into `ALWAYS_VISIBLE_TABS` (view/scale/chord) and `PROGRESSION_TAB`;
  `Inspector.tsx` appends `PROGRESSION_TAB` only when `progressionEnabledAtom` is true,
  and derives `effectiveActive` to fall back to "view" when the active tab is hidden.
- `ChordTab` renders `<ChordSelectionCallout />` then `<ChordOverlayControls />`, and
  emits `data-chord-accent` (`"progression"` | `"overlay"`) driven by
  `chordSourceIsProgressionAtom`. `ChordTab.module.css` switches `--chord-accent` /
  `--chord-accent-glow` between cyan and orange on that attribute.
- `ChordSelectionCallout` has two variants: a standalone-overlay readout, and a
  progression-step readout with Duplicate/Remove buttons.
- `duplicateProgressionStepAtom` and `removeProgressionStepAtom` are write atoms taking a
  step `id`. `ProgressionControls` already has Add / Move up / Move down / Remove step
  actions; it does not yet have Duplicate.
- `ScaleStripPanel` and `ChordOverlayDock` exist but are **unused dead code** — each
  wraps one of the two components being reskinned. Noted, out of scope (see §6).

---

## 2. Goals and Non-Goals

### Goals

- Make the progression on/off toggle reachable at all times.
- Remove the duplicated chord readout; keep a single chord readout above the fretboard.
- Bring `DegreeChipStrip` and `ChordPracticeBar` into the DAW faceplate visual language.

### Non-Goals

- No changes to music theory, audio, the fretboard SVG renderer, or progression domain
  logic. `duplicateProgressionStepAtom` is reused, not modified.
- No mobile-layout rework — that is Phase 7. `MobileTabPanel` continues to render
  `ChordOverlayControls` and `ProgressionControls`; the Duplicate button added in Fix B
  appears there too, which is acceptable.
- No removal of `ScaleStripPanel` / `ChordOverlayDock` dead code (see §6).

---

## 3. Fix A — Always-visible Progression tab

**Decision:** Stop hiding the Progression tab. It becomes a permanent Inspector tab
alongside View / Scale / Chord. The "Progression mode" switch inside `ProgressionControls`
is then always reachable, which fixes the dead-end. (Alternatives considered: moving the
toggle to the View tab, or to the top band — both rejected as more complex and leaving
the appear/disappear behavior that caused confusion.)

### Changes

- `src/components/Inspector/tabs.ts` — collapse `ALWAYS_VISIBLE_TABS` and
  `PROGRESSION_TAB` into a single ordered list of all four tabs (view, scale, chord,
  progression). Update or remove the now-redundant separate `PROGRESSION_TAB` export.
- `src/components/Inspector/Inspector.tsx` — remove the `useAtomValue(progressionEnabledAtom)`
  read, the conditional `visibleTabs` construction, and the `effectiveActive` fallback.
  Since no tab is ever hidden, the active tab is always valid; render the static tab
  list directly and use `active` as the Radix `value`.
- The `progressionEnabledAtom` import in `Inspector.tsx` is removed if it becomes unused.

### Data flow

No atom changes. The Progression tab body still renders `ProgressionTab` →
`ProgressionControls`, which owns the "Progression mode" switch bound to
`progressionEnabledAtom`.

---

## 4. Fix B — Remove `ChordSelectionCallout`

**Decision:** Delete `ChordSelectionCallout`. The Chord tab renders only
`ChordOverlayControls` (the chord editor). The `ChordPracticeBar` above the fretboard
remains the single chord readout. The callout's Duplicate action moves to
`ProgressionControls`; Remove already exists there.

### Changes

- **Delete:** `src/components/Inspector/ChordSelectionCallout.tsx`,
  `ChordSelectionCallout.module.css`, `ChordSelectionCallout.test.tsx`.
- `src/components/Inspector/ChordTab.tsx` — render only `<ChordOverlayControls />`.
  **Keep** the `useAtomValue(chordSourceIsProgressionAtom)` read and the
  `data-chord-accent` attribute, so the Chord tab still tints cyan→orange when a
  progression step is the active chord source.
- `src/components/Inspector/ChordTab.module.css` — unchanged (the `--chord-accent` /
  `--chord-accent-glow` cyan/orange switch stays).
- `src/components/Inspector/ChordTab.test.tsx` — remove the `data-callout-variant`
  assertions; keep the `data-chord-accent` overlay/progression assertions and the
  "renders ChordOverlayControls" and a11y tests.
- `src/store/chordOverlayAtoms.ts` / `atoms.ts` — `chordSourceIsProgressionAtom` is
  still used by `ChordTab`; **keep it**.
- **Duplicate action → `ProgressionControls`:**
  - `src/hooks/useProgressionState.ts` — expose `duplicateProgressionStep` (a setter for
    `duplicateProgressionStepAtom`, taking a step `id`), mirroring `removeProgressionStep`.
  - `src/components/ProgressionControls/ProgressionControls.tsx` — add a **Duplicate**
    button to the step-action button group (Add / Move up / Move down / Remove),
    using the lucide `CopyPlus` icon, acting on the active step's `id`.
  - `duplicateProgressionStepAtom` is reused unchanged (it already inserts a copy after
    the source step and selects it).
- **i18n:**
  - Remove the six now-unused `inspector.chordCallout*` keys
    (`chordCalloutOverlayTitle`, `chordCalloutProgressionTitle`, `chordCalloutStep`,
    `chordCalloutDuplicate`, `chordCalloutRemove`, `chordCalloutUnavailable`) from
    `src/i18n/types.ts`, `en.ts`, and `es.ts`.
  - Add one Duplicate-label key for the new `ProgressionControls` button, in the same
    i18n group the existing Add/Move/Remove step-action labels use. Match that group's
    key-naming convention.

### Data flow

```
ProgressionControls "Duplicate" button click
  -> useProgressionState().duplicateProgressionStep(activeStep.id)
  -> duplicateProgressionStepAtom: inserts a copy after the step, selects the copy
```

`ChordOverlayControls` is unchanged — it remains progression-aware via the existing
`effectiveChord*` atoms, so editing in the Chord tab still targets the active
progression step when progression is on.

---

## 5. Fix C — DAW reskin: `DegreeChipStrip` + `ChordPracticeBar`

**Decision:** Full DAW-language alignment, using `Inspector.module.css` and the
`--faceplate-*` / `--neon-cyan` / `--glow-cyan-*` token families as the canonical
reference. Semantic note roles are preserved.

### Reskin definition

`TopBandSummary` already sets `--strip-bg-override`, `--strip-border-override`,
`--strip-shadow-override`, and `--strip-radius: 0` so that `DegreeChipStrip` and
`ChordPracticeBar` render as transparent strips inside the faceplate. The strip
*surface* is therefore already handled — this reskin is **typography and chip/pill
token work**, not surface chrome.

- **Section headers and group labels** — `.degree-chip-strip-header`,
  `.chord-practice-bar-header`, and `.practice-bar-group-label` adopt the Inspector's
  micro-label treatment: `font-size: 11px`, `text-transform: uppercase`,
  `letter-spacing: 0.18em`, `font-weight: 500`, `color: var(--text-muted)`.
  (`.degree-chip-strip-header` / `.chord-practice-bar-header` currently `composes:
  card-section-header`; override or replace that compose so the DAW micro-label values
  apply.)
- **Badges and lens labels** — `.chord-practice-bar-badge` and
  `.chord-practice-bar-lens-label` align to the faceplate chip styling: faceplate-family
  surface tokens, consistent border, uppercase + letter-spacing on the badge.
- **Chips and pills** — `DegreeChipStrip` chips and `ChordPracticeBar` pills keep their
  **semantic role coding unchanged** (chord/tonic = orange via `--role-chord-border`,
  in-scale = cyan via `--role-scale-border`, color-tones unchanged). Their *neutral /
  inactive* surfaces and focus/active glow align to the faceplate token family and the
  `--glow-cyan-*` scale, so a neutral chip on the faceplate reads as DAW chrome rather
  than generic strip chrome.
- Light-theme (`modern-light`) overrides are updated in lockstep so both themes stay
  consistent.

### Changes

- `src/components/DegreeChipStrip/DegreeChipStrip.module.css` — header/label typography
  + neutral chip token alignment + glow, both themes.
- `src/components/ChordPracticeBar/ChordPracticeBar.module.css` — header/group-label
  typography + badge/lens-label + neutral pill token alignment + glow, both themes.
- No structural/DOM changes to `DegreeChipStrip.tsx` or `ChordPracticeBar.tsx` are
  expected; if a micro-label needs a wrapper element the change must stay minimal and
  not alter the accessibility tree (existing `aria-label`s and roles are preserved).

### Visual regression

Refresh darwin + linux baselines for the top-band suites (`app-components`,
`app-layout`, and any `TopBandSummary` / chord-practice-bar / degree-chip snapshots).
The `NoteColorAudit` harness also renders both components — its baseline refreshes too.

---

## 6. Cross-cutting notes

- `ScaleStripPanel` and `ChordOverlayDock` are unused dead code, each wrapping one of
  the reskinned components. Removing them is **out of scope** for this spec — a separate
  dead-code cleanup. Noted here so it is not forgotten.
- Mandatory before the PR: `npm run lint`, `npm run test`, `npm run build` (per
  `CLAUDE.md`).
- Ships as one PR with one implementation plan and one visual-regression baseline
  refresh.

---

## 7. Acceptance criteria

- With progression mode off, the Progression tab is still visible in the Inspector and
  its "Progression mode" switch turns progression back on.
- The Chord tab renders only `ChordOverlayControls`; no `ChordSelectionCallout` remains;
  the Chord tab still tints cyan→orange when a progression step is the active chord
  source.
- `ProgressionControls` has a working Duplicate step action; `duplicateProgressionStepAtom`
  is reused; the `inspector.chordCallout*` i18n keys are gone.
- `DegreeChipStrip` and `ChordPracticeBar` are visually consistent with the Inspector's
  DAW faceplate language; semantic note-role colors are unchanged.
- `npm run lint`, `npm run test`, `npm run build` pass; visual-regression baselines
  refreshed.
