# SongControls Top-Row Layout Polish — Design

**Date:** 2026-05-29
**Status:** Approved (design), pending implementation plan
**Builds on:** the progression-scale-coupling work (same branch). Pure layout/markup polish — no logic changes.

## Problem

After moving the preset picker into its own card first in the top row (`[Preset] [Key] [Time]`), the row is visually unbalanced (~2:3:3): the Preset card is the narrowest, so its header description truncates; the Preset picker has no micro-label (inconsistent with ROOT/SCALE/TEMPO); the Root and Tempo controls are wider than they need to be; and "TIME SIGNATURE" wraps to two lines.

## Changes

All in `src/components/SongControls/SongControls.tsx`, its CSS module, and i18n. No behavior/logic changes.

1. **Preset picker micro-label.** Wrap the `PresetMenu` in the same labeled-cell pattern as the other controls (e.g. a `Prop`/label or the card's grid), with micro-label **"PROGRESSION"** (new i18n key, e.g. `inspector.progressionLabel` / reuse an existing label key). It must not read "Preset" (avoids repeating the card title). The picker's existing `triggerLabel` (aria) stays "Preset" for the accessible name, or is updated to "Progression" for consistency — implementer's call, keep the button's accessible name stable for the existing `getByRole("button", { name: ... })` tests (update those queries if the accessible name changes).

2. **Shorten the Preset card description.** Change `inspector.groupPresetDesc` from "Pick a progression — it sets the key and chords." to **"Pick a progression."** (en) and the Spanish equivalent to **"Elige una progresión."** — short enough that it never truncates.

3. **Equal card widths.** Give all three top-row `groupColumn`s the same flex basis (drop the `groupColumn--preset` narrower modifier, or set them all to one basis). Result: even 1:1:1 row; the Preset card is no longer the smallest.

4. **Narrow the Root select.** The root only shows a note ("C"), so set the root `LabeledSelect` to intrinsic width (`width="auto"`, ~5rem min) instead of `width="fill"`. Scale keeps filling its cell.

5. **Narrow Tempo + widen Time Signature.** Set the tempo `StepperControl` to content width (`width="auto"`) instead of `width="fill"`, and rebalance the Time card's `PropGrid` cell spans so the "TIME SIGNATURE" micro-label stays on one line (no wrap). Tempo keeps its ±5 click behavior — no hold-to-accelerate.

## Notes

- Exact rem / flex-basis / `PropGrid` span values are tuned by eye during implementation and verified in the running app; this spec fixes the approach, not the pixel values.
- Update any SongControls test that asserts the old description text, the per-column flex basis, or the preset trigger's accessible name.
- Visual regression: the top-row layout changes again — darwin Playwright baselines remain a deferred-to-user `pnpm run test:visual:update` item.

## Out of Scope

- Hold-to-accelerate / coarse±fine tempo buttons (decided against — just narrower).
- Any progression/scale logic.
