# CSS Modules Migration Audit

This document tracks the migration of global CSS to CSS Modules. It maps each module to its original source in `main` (primarily `App.css`) and audits the component templates for correct class mapping.

## Status Summary

- **Total Components Audited**: 22
- **Migrated**: 22
- **Pending Migration**: 0
- **Visual Fidelity Verified**: YES (Audited against `main` patterns)

---

## Component Audit Matrix

| Component | CSS Module | Original Source (in main) | Mapping Status | Fidelity Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `AppHeader` | `AppHeader.module.css` | `App.css` (header-*) | COMPLETE | VERIFIED | Literal brand markers kept global for E2E. |
| `BottomTabBar` | `BottomTabBar.module.css` | `BottomTabBar.module.css` | COMPLETE | VERIFIED | |
| `Card` | `Card.module.css` | `App.css` (dashboard-card) | COMPLETE | VERIFIED | E2E markers kept global. |
| `CircleOfFifths` | `CircleOfFifths.module.css` | `CircleOfFifths.module.css` | COMPLETE | VERIFIED | Restored exact RGB colors and active states. |
| `DegreeChipStrip` | `DegreeChipStrip.module.css` | `App.css` (degree-chip) | COMPLETE | VERIFIED | Restored 0.2rem padding on eye-toggle. |
| `FretboardSVG` | `FretboardSVG.module.css` | `FretboardSVG.module.css` | COMPLETE | VERIFIED | Fully mapped notes/strings; preserved snapshot markers. |
| `SettingsOverlay` | `SettingsOverlay.module.css` | `SettingsOverlay.module.css` | COMPLETE | VERIFIED | Restored padding/density; preserved E2E drawer marker. |
| `TheoryControls` | `TheoryControls.module.css` | `App.css` (theory-*) | COMPLETE | VERIFIED | Fixed padding gaps in browser and disclosure panels. |
| `LabeledSelect` | `LabeledSelect.module.css` | `App.css` (tuning-select) | COMPLETE | VERIFIED | Fully mapped from literal strings. |
| `ExpandedControlsPanel` | `ExpandedControlsPanel.module.css` | `App.css` (controls-panel) | COMPLETE | VERIFIED | |
| `ChordPracticeBar` | `ChordPracticeBar.module.css` | `App.css` (practice-bar) | COMPLETE | VERIFIED | |
| `ChordOverlayDock` | `ChordOverlayDock.module.css` | `App.css` (.chord-overlay-dock) | COMPLETE | VERIFIED | Newly created module. |
| `MobileTabPanel` | `MobileTabPanel.module.css` | `App.css` (mobile-tab-*) | COMPLETE | VERIFIED | Newly created module. |
| `FretRangeControl` | `FretRangeControl.module.css` | `App.css` (fret-range) | COMPLETE | VERIFIED | |
| `ChordRowStrip` | `ChordRowStrip.module.css` | `App.css` (chord-row) | COMPLETE | VERIFIED | |
| `ToggleBar` | `ToggleBar.module.css` | `App.css` (toggle-*) | COMPLETE | VERIFIED | |
| `NoteGrid` | `shared.module.css` | `App.css` (note-grid) | COMPLETE | VERIFIED | |
| `StepperControl` | `StepperControl.module.css` | `App.css` (stepper-*) | COMPLETE | VERIFIED | |
| `HelpModal` | `HelpModal.module.css` | `App.css` (help-modal-*) | COMPLETE | VERIFIED | Newly created module. |
| `VersionBadge` | `VersionBadge.module.css` | `App.css` (version-badge) | COMPLETE | VERIFIED | Newly created module. |
| `ErrorBoundary` | `ErrorBoundary.module.css` | `App.css` (error-fallback) | COMPLETE | VERIFIED | Newly created module. |
| `DrawerSelector` | `DrawerSelector.module.css` | `DrawerSelector.module.css` | COMPLETE | VERIFIED | |

---

## Detailed Template Mapping

### 1. TheoryControls / ChordOverlayControls / KeyExplorer
**Files**: `TheoryControls.tsx`, `ChordOverlayControls.tsx`, `KeyExplorer.tsx`, `ScaleSelector.tsx`
**CSS Module**: `TheoryControls.module.css`

| Template Class (JSX) | Mapped To (Module) | Original Global Class |
| :--- | :--- | :--- |
| `theory-controls` | `styles["theory-controls"]` | `.theory-controls` |
| `theory-mode-browser` | `styles["theory-mode-browser"]` | `.theory-mode-browser` |
| `theory-browser-main` | `styles["theory-browser-main"]` | `.theory-browser-main` |
| `theory-nav-btn` | `styles["theory-nav-btn"]` | `.theory-nav-btn` |
| `theory-chord-section` | `styles["theory-chord-section"]` | `.theory-chord-section` |
| `theory-disclosure-btn` | `styles["theory-disclosure-btn"]` | `.theory-disclosure-btn` |
| `theory-disclosure-title` | `styles["theory-disclosure-title"]` | `.theory-disclosure-title` |
| `theory-disclosure-summary` | `styles["theory-disclosure-summary"]` | `.theory-disclosure-summary` |
| `theory-chord-content` | `styles["theory-chord-content"]` | `.theory-chord-content` |
| `theory-inline-key` | `styles["theory-inline-key"]` | `.theory-inline-key` |
| `theory-inline-key-content` | `styles["theory-inline-key-content"]` | `.theory-inline-key-content` |

### 2. MobileTabPanel
**Files**: `MobileTabPanel.tsx`
**CSS Module**: `MobileTabPanel.module.css`

| Template Class (JSX) | Mapped To (Module) | Original Global Class |
| :--- | :--- | :--- |
| `mobile-tab-content` | `styles["mobile-tab-content"]` | `.mobile-tab-content` |
| `mobile-tab-panel` | `styles["mobile-tab-panel"]` | `.mobile-tab-panel` |
| `mobile-theory-tab` | `styles["mobile-theory-tab"]` | `.mobile-theory-tab` |
| `mobile-view-tab` | `styles["mobile-view-tab"]` | `.mobile-view-tab` |
| `cof-container` | `styles["cof-container"]` | `.cof-container` |

### 3. Fretboard / FretboardSVG
**Files**: `Fretboard.tsx`, `FretboardSVG.tsx`
**CSS Module**: `FretboardSVG.module.css`

| Template Class (JSX) | Mapped To (Module) | Original Global Class |
| :--- | :--- | :--- |
| `fretboard-note` | `styles["fretboard-note"]` | `.fretboard-note` |
| `note-played` | `styles["note-played"]` | `.note-played` |
| `hidden` | `:global(.hidden)` | `.hidden` (literal for snapshots) |
| `fretboard-string-N` | `:global(.fretboard-string-N)` | `.fretboard-string-N` (literal for snapshots) |
| `note-bubble` | `styles["note-bubble"]` | `.note-bubble` |

### 4. Shared Controls
**Files**: Multiple
**CSS Module**: `shared.module.css`

| Template Class (JSX) | Mapped To (Module) | Original Global Class |
| :--- | :--- | :--- |
| `control-section` | `shared["control-section"]` | `.control-section` |
| `section-label` | `shared["section-label"]` | `.section-label` |
| `toggle-group` | `shared["toggle-group"]` | `.toggle-group` |
| `toggle-btn` | `shared["toggle-btn"]` | `.toggle-btn` |
| `note-grid` | `shared["note-grid"]` | `.note-grid` |
| `note-btn` | `shared["note-btn"]` | `.note-btn` |
| `link-toggle` | `shared["link-toggle"]` | `.link-toggle` |
| `lens-hint` | `shared["lens-hint"]` | `.lens-hint` |

## Implementation Patterns

### 1. Scoped Classes (Standard)
Most classes are mapped using `styles["class-name"]`. The module CSS defines these normally.

### 2. E2E Markers (Intentional Literals)
Critical markers used by Playwright E2E tests are applied as literal strings in TSX (e.g., `className="dashboard-card"`). To style these while keeping the markers global:
- The TSX uses the literal string.
- The CSS Module uses `:global(.marker-class) { ... }`.
- This ensures E2E stability while allowing the module to own the styling.

### 3. Snapshot Markers
Marker classes like `fretboard-string-N` and `hidden` remain literal in HTML to match non-scoped Vitest snapshots.

- `.app-container`: Main layout wrapper.
- `.header-btn`: Action buttons in header (passed as children from `App.tsx`).
- `.panel-surface`, `.panel-surface--compact`, `.panel-surface--inset`: Foundational design system panels.
- `.main-fretboard`, `.fretboard-wrapper`, `.fretboard-outer`: Layout shells for hero unit.
- `.summary-shell`, `.chord-dock-shell`: Centering containers for ribbons.
- `.custom-scrollbar`: Global scrollbar styling utility.
- `[data-layout-tier]`, `[data-layout-variant]`, `[data-chord-active]`: Global layout state selectors.
- `.note-active`, `.key-tonic`, `.root-active`, `.note-blue`, `.note-dimmed`, `.note-inactive`: Base semantic note classes (inherited by SVG elements).
- `.note-enharmonic`, `.note-main-label`: Note label internals.
- `.note-played`: Active ping animation.
