# Progression Preset Picker & Smarter Suggestions — Design

**Date:** 2026-05-28
**Status:** Approved (design), pending implementation plan

## Problem

The chord-progression preset picker is a single `LabeledSelect` (a radix Select
wrapper) in `SongControls.tsx`. It crams six category groups plus a dynamic
"Suggested for <scale>" group into one long dropdown. Browsing by category is
awkward, and the per-scale suggestion engine is a small set of hardcoded major-key
cadence templates with no genre/feel awareness.

Three goals, decided during brainstorming:

1. **Better browsing UX** — category → preset navigation.
2. **Smarter suggestions** — genre-tagged and scale-aware.
3. **Evaluate `@tonaljs/progression`** — decided: **skip for now** (see section D).

## Current State (reference)

- **Preset data:** `src/progressions/progressionDomain.ts` — `PROGRESSION_PRESETS`
  (25 presets across 6 categories), compiled from a DSL via `parseSteps`.
- **Scale filtering:** `getAvailableProgressionPresets(scaleName)` in the same file.
- **Suggestions:** `src/progressions/progressionGeneration.ts` —
  `generateCommonProgressions(scaleName, rootNote)`, template-based with ordinal
  sequences (`IV-V-I`, `ii-V-I`, `I-IV-V-I`, cycle templates for ≥6-degree scales,
  an `I-IV` shuttle for ≥4). Ids are non-deterministic (`generated-${counter}`).
- **Picker UI:** `src/components/SongControls/SongControls.tsx` (~lines 146–188 and
  ~268) — builds `presetGroups` for `LabeledSelect`.
- **Current-selection logic:** `currentProgressionPresetIdAtom` in
  `src/store/progressionAtoms.ts` matches the live steps against **static** presets
  only; falls back to `CUSTOM_PRESET_ID`. Suggestions load via `loadProgressionSteps`
  (raw steps, no id), so selecting a suggestion currently shows "Custom".
- **Loading:** `loadProgressionPresetAtom` (by id, also applies a matching genre
  style) and `loadProgressionStepsAtom` (raw steps) in `progressionAtoms.ts`.
- **UI libs:** radix `dialog`, `select`, `switch`, `tabs`, `tooltip` already in use.
  No `@radix-ui/react-dropdown-menu` or `react-menubar` yet.

### Why not Menubar, and why not `@tonaljs/progression`

- **Menubar** is the wrong primitive — it models an app command bar (File/Edit/View),
  not single-value selection. It does not track a selected value or show the current
  pick on a trigger. **DropdownMenu with submenus** keeps a single value-bearing
  trigger while giving category → preset browsing.
- **`@tonaljs/progression`** exposes `fromRomanNumerals` / `toRomanNumerals` around a
  **major-key** roman-numeral frame. The existing `getDiatonicChord` is modal-aware
  (handles modes, borrowed chords, quality overrides), so routing generation through
  Tonal would be a downgrade. It is only a fit for a future "import from chord names"
  feature, which is out of scope.

## Design

### A. Picker — DropdownMenu with submenus

Add dependency `@radix-ui/react-dropdown-menu`.

New component `src/components/PresetMenu/` (`PresetMenu.tsx`, `PresetMenu.module.css`,
`PresetMenu.test.tsx`). It replaces the preset `LabeledSelect` in `SongControls.tsx`
(the root/scale/other selects stay as-is).

- **Trigger:** a button showing the current preset label (or "Custom"), styled to
  match the existing `LabeledSelect` triggers for visual consistency.
- **Menu structure** (top → bottom):
  - `Suggested for <scale>` — a `DropdownMenu.Sub` whose content is grouped by feel
    (see B). Shown only when suggestions exist.
  - One `DropdownMenu.Sub` per category with available presets: Pop/Rock, Blues, Jazz,
    Folk, Modal, Minor (same availability filter as today —
    `getAvailableProgressionPresets`).
  - The active preset shows a check indicator (radio-item semantics).
- **Selection:** item `onSelect` calls `loadProgressionPreset(id)` for static presets
  and `loadProgressionSteps(steps)` for suggestions (mirrors current
  `handlePresetChange`).
- **Locked state:** when `progressionPlayingAtom` is true, items are disabled (matches
  current `editsLocked` behavior).
- **Props / interface:** `PresetMenu` takes the resolved data it needs (current preset
  id, grouped available presets, suggestions, locked flag, and the two load callbacks)
  so it stays a presentational unit that is testable in isolation. `SongControls`
  remains the place that pulls atoms/state together.
- **A11y:** radix DropdownMenu provides roving focus and keyboard navigation; trigger
  is labeled. Add a `vitest-axe` assertion. Respects `data-layout-tier` /
  `data-layout-variant` like other controls.

### B. Suggestions — genre-tagged + scale-aware

In `src/progressions/progressionGeneration.ts`:

- Add a `feel` tag to the generated preset type: `"cadential" | "vamp" | "modal"`.
  Existing cadential/cycle templates → `cadential`; the `I-IV` shuttle → `vamp`.
- Add **modal-aware templates** built from the scale's own degrees (e.g. i-VII-IV for
  Dorian/Mixolydian-type scales), tagged `modal`, gated by scale degree count as the
  current templates are.
- Replace non-deterministic ids (`generated-${counter}`) with **stable, deterministic
  ids** derived from feel + ordinals (e.g. `suggested-<feel>-<ordinals joined>`), so a
  suggestion can be matched back for the current-selection indicator and reproduces
  across renders.
- The generated set continues to drop any template whose chords don't resolve in the
  current scale (existing `buildPreset` null-guard).
- Suggestions are surfaced in the menu's Suggested submenu, grouped by `feel`.

### C. Reflect suggestions in the trigger label

Extend `currentProgressionPresetIdAtom` (`src/store/progressionAtoms.ts`) to also match
the live steps against `generateCommonProgressions(scaleName, rootNote)` after the
static-preset check fails, returning the matching suggestion's stable id before falling
back to `CUSTOM_PRESET_ID`. This makes the trigger show a suggestion's label when one is
loaded. In scope (confirmed, not dropped as YAGNI).

### D. `@tonaljs/progression`

Not adopted. Add a short comment in `progressionGeneration.ts` recording the rationale
(modal-aware `getDiatonicChord` is richer than Tonal's major-key roman-numeral frame),
to be revisited only if a chord-import feature is requested. No dependency added.

## Testing

- **Unit (`progressionGeneration.test.ts`):** feel tags assigned correctly, stable id
  format, modal templates for modal scales, scale-size gating, unresolved-chord drop.
- **Unit (`progressionAtoms` / current-preset matcher):** loading a suggestion yields
  its stable id, not `CUSTOM_PRESET_ID`; static presets still match; edited progression
  still resolves to custom.
- **Component (`PresetMenu.test.tsx`):** renders category + suggestion submenus,
  selecting a static preset and a suggestion invokes the correct load callback, current
  indicator reflects the active id, locked state disables items, `vitest-axe` passes.
- **Visual regression:** regenerate snapshots for affected suites (`app-components`,
  `app-overlays`) on darwin; CI seeds linux.

## Files Touched

- `package.json` — add `@radix-ui/react-dropdown-menu`.
- new `src/components/PresetMenu/{PresetMenu.tsx, PresetMenu.module.css, PresetMenu.test.tsx}`.
- `src/progressions/progressionGeneration.ts` — feel tags, stable ids, modal templates,
  rationale comment.
- `src/store/progressionAtoms.ts` — extend `currentProgressionPresetIdAtom` to match
  suggestions.
- `src/components/SongControls/SongControls.tsx` — swap the preset `LabeledSelect` for
  `PresetMenu`; remove now-dead `presetGroups`/`handlePresetChange` plumbing as needed.

## Cleanup / Best Practices

- Remove dead code left after the picker swap (unused `LabeledSelectGroup` preset
  plumbing, unused imports in `SongControls.tsx`).
- Keep `PresetMenu` presentational and small; `SongControls` does the atom wiring.
- Reuse existing CSS tokens/semantic styles; no hardcoded values.
- Run `pnpm run lint`, `pnpm run test`, `pnpm run build` before PR (per CLAUDE.md).

## Out of Scope

- Chord-name import / `@tonaljs/progression` integration.
- Persisting custom progressions as user presets.
- Reworking the static preset catalog content.
