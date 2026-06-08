# Mobile Responsiveness Design Walkthrough: Mobile Dropdown Safe Zone

This walkthrough documents the implementation of **Task 1: Mobile Dropdown Safe Zone** of the [2026-06-01-mobile-responsiveness-design.md](../specs/2026-06-01-mobile-responsiveness-design.md) specification.

## Completed Tasks

All four tasks of the `2026-06-01-mobile-dropdown-safe-zone.md` plan have been successfully implemented and tested:

### 1. CSS Sizing Token
- Added `--mobile-bottom-nav-safe-zone` to `src/styles/tokens.css`.
  - Default: `0px`
  - Mobile query (`max-width: 767px`): `calc(3.5rem + env(safe-area-inset-bottom, 0px))` to safeguard the fixed bottom navigation tabs.

### 2. Dynamic Collision Padding Utility
- Created [collision.ts](../../../src/utils/collision.ts) to query the viewport-fixed bottom tab bar's actual height in real-time.
- Returns `rect.height + 8` when docked at the bottom of the viewport, ensuring that Radix UI's positioning engine detects collisions with the bottom tabs correctly and flips menus upward.

### 3. Deferring Collision Computations
- Created wrapper components (`LabeledSelectContent`, `PresetMenuContent`, `PresetMenuSubContent`) in [LabeledSelect.tsx](../../../src/components/LabeledSelect/LabeledSelect.tsx) and [PresetMenu.tsx](../../../src/components/PresetMenu/PresetMenu.tsx).
- Deferring the DOM evaluation until the menus are actually mounted avoids race conditions during initial page load, applying the correct docking height and flipping rules dynamically.

### 4. Geometry and Visual Regression Coverage
- Added a layout geometry test to [responsive.spec.ts](../../../e2e/responsive.spec.ts) validating the position of the Overlay voicing dropdown at `390x844` and `375x667` mobile viewports.
- Updated visual regression snapshots for `chord-overlay-controls-manual-1280x900`.
- All visual and E2E regression tests pass.

---

> [!NOTE]
> This completes the first of five plans for the Mobile Responsiveness sweep. The remaining plans are:
> 1. `mobile-header-transport.md` (Next)
> 2. `mobile-progression-track.md`
> 3. `mobile-song-progression-layout.md`
> 4. `fretboard-right-edge-shadow.md`
