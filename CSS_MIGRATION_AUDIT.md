# CSS Modules Migration Audit

This document tracks the migration of global CSS to CSS Modules. It maps each module to its original source in `main` (primarily `App.css` and `index.css`) and audits the component templates for correct class mapping.

## Status Summary

- **Total Components Audited**: 24
- **Migrated**: 18
- **Pending/Partial Migration**: 6
- **Visual Fidelity Verified**: YES (In progress)

---

## Component Audit Matrix

| Component | CSS Module | Original Source (in main) | Mapping Status | Fidelity Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `AppHeader` | `AppHeader.module.css` | `App.css` (header-*) | PARTIAL | VERIFIED | `.header-btn` and `.icon` still global in `App.css`. |
| `BottomTabBar` | `BottomTabBar.module.css` | `BottomTabBar.module.css` | COMPLETE | VERIFIED | |
| `Card` | `Card.module.css` | `App.css` (dashboard-card) | PARTIAL | VERIFIED | `.dashboard-card` literal kept for shared styling. |
| `CircleOfFifths` | `CircleOfFifths.module.css` | `CircleOfFifths.module.css` | COMPLETE | VERIFIED | |
| `DegreeChipStrip` | `DegreeChipStrip.module.css` | `App.css` (degree-chip) | COMPLETE | VERIFIED | |
| `FretboardSVG` | `FretboardSVG.module.css` | `App.css` (fret-*) | PARTIAL | VERIFIED | Fret wire/bg styles still global in `App.css`. |
| `SettingsOverlay` | `SettingsOverlay.module.css` | `SettingsOverlay.module.css` | COMPLETE | VERIFIED | |
| `TheoryControls` | `TheoryControls.module.css` | `App.css` (theory-*) | COMPLETE | VERIFIED | |
| `LabeledSelect` | `LabeledSelect.module.css` | `App.css` (tuning-select) | COMPLETE | VERIFIED | |
| `ExpandedControlsPanel` | `ExpandedControlsPanel.module.css` | `App.css` (controls-panel) | COMPLETE | VERIFIED | |
| `ChordPracticeBar` | `ChordPracticeBar.module.css` | `App.css` (practice-bar) | COMPLETE | VERIFIED | |
| `ChordOverlayDock` | `ChordOverlayDock.module.css` | `App.css` (.chord-overlay-dock) | COMPLETE | VERIFIED | |
| `MobileTabPanel` | `MobileTabPanel.module.css` | `App.css` (mobile-tab-*) | COMPLETE | VERIFIED | |
| `FretRangeControl` | `FretRangeControl.module.css` | `App.css` (fret-range) | COMPLETE | VERIFIED | |
| `ChordRowStrip` | `ChordRowStrip.module.css` | `App.css` (chord-row) | COMPLETE | VERIFIED | |
| `ToggleBar` | `ToggleBar.module.css` | `App.css` (toggle-*) | COMPLETE | VERIFIED | |
| `NoteGrid` | `shared.module.css` | `App.css` (note-grid) | COMPLETE | VERIFIED | |
| `StepperControl` | `StepperControl.module.css` | `App.css` (stepper-*) | COMPLETE | VERIFIED | |
| `HelpModal` | `HelpModal.module.css` | `App.css` (help-modal-*) | COMPLETE | VERIFIED | |
| `VersionBadge` | `VersionBadge.module.css` | `App.css` (version-badge) | COMPLETE | VERIFIED | |
| `ErrorBoundary` | `ErrorBoundary.module.css` | `index.css` (error-fallback) | PARTIAL | INCONSISTENT | Styles duplicated/differ between module and `index.css`. |
| `DrawerSelector` | `DrawerSelector.module.css` | `DrawerSelector.module.css` | COMPLETE | VERIFIED | |
| `MainLayoutWrapper` | `MainLayoutWrapper.module.css` | `App.css` (app-container) | PENDING | N/A | Still uses global literals. |
| `Fretboard` | `Fretboard.module.css` | `App.css` (fretboard-*) | PENDING | N/A | Still uses global literals. |

---

## Detailed Template Mapping

### 1. Main Layout & Shell
**Files**: `MainLayoutWrapper.tsx`, `App.tsx`
**Target CSS Module**: `MainLayoutWrapper.module.css` (to be created)

| Template Class (JSX) | Mapped To (Module) | Original Global Class |
| :--- | :--- | :--- |
| `app-container` | `styles["app-container"]` | `.app-container` |
| `summary-shell` | `styles["summary-shell"]` | `.summary-shell` |
| `chord-dock-shell` | `styles["chord-dock-shell"]` | `.chord-dock-shell` |
| `main-fretboard` | `styles["main-fretboard"]` | `.main-fretboard` |

### 2. Fretboard Component
**Files**: `Fretboard.tsx`
**Target CSS Module**: `Fretboard.module.css` (to be created)

| Template Class (JSX) | Mapped To (Module) | Original Global Class |
| :--- | :--- | :--- |
| `fretboard-outer` | `styles["fretboard-outer"]` | `.fretboard-outer` |
| `fretboard-wrapper` | `styles["fretboard-wrapper"]` | `.fretboard-wrapper` |
| `hide-scrollbar` | `styles["hide-scrollbar"]` | `.hide-scrollbar` |

### 3. Fretboard SVG Internals
**Files**: `FretboardSVG.tsx`
**CSS Module**: `FretboardSVG.module.css`

| Template Class (JSX) | Mapped To (Module) | Original Global Class |
| :--- | :--- | :--- |
| `fret-backgrounds` | `styles["fret-backgrounds"]` | `.fret-backgrounds` |
| `fret-column` | `styles["fret-column"]` | `.fret-column` |
| `fret-zero` | `styles["fret-zero"]` | `.fret-zero` |
| `fret-standard` | `styles["fret-standard"]` | `.fret-standard` |
| `fret-numbers-row` | `styles["fret-numbers-row"]` | `.fret-numbers-row` |
| `fret-number` | `styles["fret-number"]` | `.fret-number` |
| `fret-marker-container` | `styles["fret-marker-container"]` | `.fret-marker-container` |
| `marker-double` | `styles["marker-double"]` | `.marker-double` |
| `marker-dot` | `styles["marker-dot"]` | `.marker-dot` |
| `strings-container` | `styles["strings-container"]` | `.strings-container` |
| `string-row` | `styles["string-row"]` | `.string-row` |
| `string-line` | `styles["string-line"]` | `.string-line` |
| `string-notes` | `styles["string-notes"]` | `.string-notes` |
| `note-cell` | `styles["note-cell"]` | `.note-cell` |

### 4. Global Design System (Shared Literals)
These classes are intentionally kept as literals in TSX to allow the design system to apply shared styling across different modules.

| Global Class | Usage | Notes |
| :--- | :--- | :--- |
| `.panel-surface` | Shared panel styling | Defined in `semantic.css` |
| `.panel-surface--compact` | Variant | Defined in `semantic.css` |
| `.panel-surface--inset` | Variant | Defined in `semantic.css` |
| `.dashboard-card` | Shared card styling | Defined in `App.css` (Target: `semantic.css`?) |
| `.custom-scrollbar` | Scrollbar utility | Defined in `App.css` |
| `.icon` | Global icon sizing | Defined in `App.css` |

---

## Global Selectors (:global) Registry

The following selectors are used within CSS Modules via `:global()` to reference global state or layout tiers:

- `:global(.app-container[data-layout-tier="mobile"])`
- `:global(.app-container[data-layout-tier="desktop"])`
- `:global(.app-container[data-layout-tier="tablet"])`
- `:global(.app-container[data-layout-variant="landscape-mobile"])`
- `:global(.dashboard-card)`
- `:global(.brand-mark)`
- `:global(.icon)`
- `:global(.mobile-tab-panel)`
