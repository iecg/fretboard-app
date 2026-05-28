# Progressions Drive Scale & Chord Quality — Design

**Date:** 2026-05-28
**Status:** Approved (design), pending implementation plan
**Builds on:** the unmerged PR #472 (DropdownMenu preset picker). This design **modifies** that work — it replaces the step-matching selection logic and the remap-on-load behavior. Implement on the same branch.

## Problem

Three user-reported concerns, all tracing to one root cause:

1. **Presets don't modify chord quality.** Chord quality resolves to the diatonic quality of the degree *in the currently active scale* unless a sparse `qualityOverride` is set. Loading a minor/modal progression into a major scale yields major triads.
2. **A "Dorian i-IV" preset doesn't engage Dorian — feels disconnected.** Neither loader sets `scaleNameAtom`; the preset's degrees are ordinal-remapped into the active scale, so the mode name is a label with no harmonic effect.
3. **Label bug:** loading the major "I-IV" vamp shows "Dorian i-IV" on the picker.

### Confirmed root cause

Progression steps store **scale-relative degrees**, reinterpreted in whatever scale is active. `remapDegreeByOrdinal` ([progressionDomain.ts:355](../../../src/progressions/progressionDomain.ts)) rewrites a preset's degrees into the active scale on load and on scale change. `currentProgressionPresetIdAtom` ([progressionAtoms.ts:377](../../../src/store/progressionAtoms.ts)) derives the "selected" preset by **step-matching, static presets first**. Reproduction:

```
VAMP loaded:  suggested-vamp-03 | "I-IV" | [["I",null],["IV",null]]
RESOLVED to:  dorian-i-iv  (label "Dorian i-IV")
COLLIDING_STATIC: [["dorian-i-iv","Dorian i-IV"]]
```

The static `dorian-i-iv` ("i IV"), remapped into the major scale, becomes `[I, IV]` — identical to the vamp's steps — so step-matching returns the wrong preset's label.

## Decisions (from brainstorming)

- **Every progression implies and sets its scale on load.** A progression = degrees + a home scale.
- **Keep the root (parallel key).** Loading changes only the scale/mode; the root note stays. `i-iv-v` in C major → **C minor**.
- **Track the loaded id** for the picker label (drop step-matching). Most future-proof.
- **Drop the per-scale availability filter** for static presets — all presets are always selectable (loading switches scale).
- **Update CLAUDE.md** so the "independent domains" invariant doesn't silently contradict this.
- **Layout:** the preset picker moves out of the Progression card header into its own card, **first in the top row** alongside Key and Time (R1).

## Design

### A. Core model — progression carries its home scale

A progression is a sequence of degrees **plus the scale it is written in**. Loading it:

1. Sets `scaleNameAtom` to the progression's home scale (base write — does NOT remap, since only the `setScaleNameAtom` action remaps).
2. Loads the degrees **verbatim** (no `remapDegreeByOrdinal`).
3. Leaves `rootNoteAtom` unchanged (parallel key).

Diatonic chord qualities then follow the home scale automatically — fixing concerns #1 and #2 together. The degrees in each existing preset were already authored to match their named mode (e.g. `dorian-i-iv` = `"i IV"`: minor i + major IV, correct in Dorian), so loading verbatim into the declared scale resolves correctly.

### B. Data model

Add a required `scale: string` to `ProgressionPreset` and to each entry in `PRESET_SPECS` ([progressionDomain.ts:228](../../../src/progressions/progressionDomain.ts)). Mapping:

| Preset ids | Home scale |
|---|---|
| All `pop-rock`, `folk`, `jazz` presets; `twelve-bar-blues`, `eight-bar-blues` | `major` |
| `minor-blues`, `minor-i-iv-v`, `minor-i-vi-vii`, `andalusian`, `minor-i-iv-vii-iii` | `minor` |
| `dorian-i-iv`, `dorian-i-vii-iv` | `dorian` |
| `mixolydian-i-vii-iv` | `mixolydian` |
| `phrygian-i-ii` | `phrygian` |
| `lydian-i-ii` | `lydian` |

Scale-name spellings are the catalog values: `major`, `minor` (aeolian), `dorian`, `phrygian`, `lydian`, `mixolydian` (verified in `theoryCatalog.ts`).

Suggestions (`generateCommonProgressions`) are generated from the current scale, so their home scale **is** the current scale — loading one never switches scale. `SuggestedPreset` gains a `scale` field set to the generating scale for symmetry.

### C. Loading behavior

- `loadProgressionPresetAtom(id)`: write `scaleNameAtom = preset.scale` → set `progressionStepsAtom` from `preset.steps` **verbatim** (drop the `createStepsFromPreset` ordinal-remap) → set `loadedPresetIdAtom = id` → `activeProgressionStepIndexAtom = 0`, stop playback → apply genre style (unchanged).
- Suggestion load: the picker calls a load path that sets steps verbatim (no scale change) **and** records `loadedPresetIdAtom = <suggestion id>`. Thread the suggestion id through (e.g. a `loadProgressionSuggestionAtom(suggestion)` or extend the existing steps-loader to accept an id).

### D. Selection label — `loadedPresetIdAtom` (#3 fix)

- New writable atom `loadedPresetIdAtom: string | null`, **persisted** via `atomWithStorage`.
- Set by both loaders (preset id / suggestion id).
- **Cleared to `null`** by: every step-mutation write (`add`, `remove`, `move`, `duplicate`, `updateDegree`, `updateDuration`, `updateQuality`, `updateRoot`) and by the `setScaleNameAtom` action (manual scale change detaches from the loaded preset).
- `currentProgressionPresetIdAtom` becomes: `get(loadedPresetIdAtom) ?? CUSTOM_PRESET_ID`. Remove the `getAvailableProgressionPresets`/`generateCommonProgressions` step-matching entirely. This eliminates the collision class — the picker shows exactly what was loaded.

### E. Picker changes

- Drop the per-scale availability filter: `SongControls` builds `categories` from **all** `PROGRESSION_PRESETS` grouped by category (not `getAvailableProgressionPresets(scaleName)`). All six category submenus always show.
- `getAvailableProgressionPresets` and `isProgressionPresetAvailableForScale` become unused for the picker; remove them if no other caller remains (verify with a usage check before deleting).
- Suggestions submenu unchanged (still generated for the current scale).
- `handlePresetChange` routes by id as today (suggestion id → suggestion load path; else `loadProgressionPreset`); the `CUSTOM_PRESET_ID` early-return stays.

### F. Layout — Preset card first in the top row (R1)

```
┌ Preset [▾] ┐ ┌ Key (root+scale) ┐ ┌ Time (sig+tempo) ┐
└────────────┘ └──────────────────┘ └──────────────────┘
┌ Progression  ── header: [Add] [edit toolbar] ─────────┐
│  progression track / step editor                      │
└─────────────────────────────────────────────────────────┘
```

- Add a third `groupColumn` to the top `groupRow` ([SongControls.tsx:196](../../../src/components/SongControls/SongControls.tsx)) as the **first** column: a new `InspectorCard` titled "Preset" containing the `PresetMenu` (with `width="fill"` styling so it fills the card).
- Move `PresetMenu` out of the Progression card's header `actions`; that header keeps only the Add/edit toolbar.
- The Preset card is `locked={editsLocked}` and the menu stays `disabled={editsLocked}` (no preset switching mid-playback), matching current behavior.
- Add i18n strings for the card heading/description (`inspector.groupPreset` / `inspector.groupPresetDesc`), following the existing `groupKey`/`groupTime` pattern.
- Responsive: the row already stacks per `data-layout-tier`; extend `.groupRow`/`.groupColumn` CSS so three cards lay out on desktop and stack on mobile/tablet as the existing two do. Confirm against both `data-layout-tier` and `data-layout-variant`.

### G. Manual scale change

Keep the existing remap-on-manual-scale-change (`setScaleNameAtom` → `remapProgressionStepsForScaleAtom`) so degrees stay valid when the user changes scale directly; additionally clear `loadedPresetIdAtom` (→ Custom). Loading a preset uses the **base** `scaleNameAtom` writer (no remap), so the two paths don't conflict.

### H. CLAUDE.md update

Refine the invariant. Current text: *"Scale and chord are independent domains — do not cross-wire their visibility or color state."* New wording: progression **load** intentionally sets the active scale (a one-time user action establishing harmonic context); the **rendering/color domains** (note roles, the emphasis layer in `semantics.ts`) remain independent and must not be cross-wired. Update both the "Note Roles" section and the architecture notes.

## Testing

- **Domain (`progressionDomain.test.ts`):** every preset's `steps` resolve (not `unavailable`) in its declared `scale` via `resolveProgressionStep`; the `scale` field is present on all presets.
- **Loaders (`progressionAtoms.test.ts`):**
  - Loading `minor-i-iv-v` from C major sets `scaleNameAtom` to `minor`, keeps `rootNoteAtom` `C`, loads degrees verbatim, and resolves chords to minor qualities.
  - Loading `dorian-i-iv` sets scale `dorian`; `currentProgressionPresetIdAtom` returns `dorian-i-iv`.
  - Loading the major `I-IV` vamp sets `loadedPresetIdAtom` to `suggested-vamp-03` and `currentProgressionPresetId` returns that (no "Dorian i-IV" collision).
  - `loadedPresetIdAtom` clears to `null` after any step edit and after a manual `setScaleNameAtom`.
- **Picker/integration (`SongControls.test.tsx`):** all category submenus render regardless of active scale; selecting `dorian-i-iv` switches the scale select to Dorian and the trigger shows "Dorian i-IV"; the Preset card renders first in the top row.
- Update/replace tests that asserted the old availability filter and remap-on-load behavior. Run full `pnpm run test`, `pnpm run lint`, `pnpm run build`.
- Visual snapshots: the SongControls layout changed (new card) — note that darwin Playwright baselines need regeneration (`pnpm run test:visual:update`); deferred to the user per the prior decision.

## Files Touched

- `src/progressions/progressionDomain.ts` — add `scale` to `ProgressionPreset`/`PRESET_SPECS`; load verbatim (drop ordinal-remap on load); remove now-unused availability helpers if no callers remain.
- `src/progressions/progressionGeneration.ts` — add `scale` to `SuggestedPreset`.
- `src/store/progressionAtoms.ts` — `loadedPresetIdAtom` (persisted); rewrite `loadProgressionPresetAtom` (set scale + verbatim steps + id); suggestion load path with id; simplify `currentProgressionPresetIdAtom`; clear id on step mutations.
- `src/store/actions.ts` — `setScaleNameAtom` clears `loadedPresetIdAtom`.
- `src/components/SongControls/SongControls.tsx` — new Preset card first in the top row; remove preset menu from Progression header; build `categories` from all presets; thread suggestion-load id.
- `src/components/SongControls/SongControls.module.css` (+ layout CSS) — three-card top row, responsive.
- `src/i18n/*` — `inspector.groupPreset` / `inspector.groupPresetDesc`.
- `CLAUDE.md` — refine the independence invariant.
- Tests across the above.

## Out of Scope

- Setting the root note on load (parallel-key only).
- Jazz/extended quality overrides on suggestions beyond what presets already encode.
- Persisting suggestions as user presets.
- Reworking the static catalog's progression content (only adding the `scale` field).

## Relationship to PR #472

PR #472 introduced the `PresetMenu`, the suggestion generator with stable ids, and a step-matching `currentProgressionPresetIdAtom`. This design **supersedes** that atom's step-matching with `loadedPresetIdAtom`, repurposes the suggestion `scale`, and relocates the picker into its own card. Land on the same branch; the net result is one coherent feature.
