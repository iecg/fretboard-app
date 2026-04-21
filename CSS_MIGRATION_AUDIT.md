# CSS Migration Audit

**Status:** COMPLETE  
**Date:** 2026-04-21  
**Branch:** `feature/phase-06-css-modules-fretboard`  
**Last Verified:** `npm run build`, `npm run test`, `npm run test:e2e:css-scoping`

## Overview

The CSS Module migration is complete for component styles. The current tree has 25 CSS Module files and 4 intentional global CSS files. No plain component-level `.css` files remain.

The remaining global CSS surface is limited to design tokens, semantic tokens, root imports, and top-level layout rules that are intentionally driven by stable data attributes such as `[data-layout-tier]`, `[data-layout-variant]`, and `[data-layout-column]`.

## Migration Summary

| Category | Count | Status |
|---|---:|---|
| CSS Modules | 25 | Complete |
| Plain component `.css` files | 0 | Complete |
| Intentional global CSS files | 4 | Allowed |
| Total CSS files | 29 | Verified |

## CSS Modules

Component-scoped CSS Module files:

- `src/CircleOfFifths.module.css`
- `src/DrawerSelector.module.css`
- `src/Fretboard.module.css`
- `src/FretboardSVG.module.css`
- `src/components/AppHeader.module.css`
- `src/components/BottomTabBar.module.css`
- `src/components/Card.module.css`
- `src/components/ChordOverlayDock.module.css`
- `src/components/ChordPracticeBar.module.css`
- `src/components/ChordRowStrip.module.css`
- `src/components/DegreeChipStrip.module.css`
- `src/components/ErrorBoundary.module.css`
- `src/components/ExpandedControlsPanel.module.css`
- `src/components/FingeringPatternControls.module.css`
- `src/components/FretRangeControl.module.css`
- `src/components/HelpModal.module.css`
- `src/components/LabeledSelect.module.css`
- `src/components/MainLayoutWrapper.module.css`
- `src/components/MobileTabPanel.module.css`
- `src/components/SettingsOverlay.module.css`
- `src/components/StepperControl.module.css`
- `src/components/TheoryControls.module.css`
- `src/components/ToggleBar.module.css`
- `src/components/VersionBadge.module.css`
- `src/components/shared.module.css`

## Global CSS Allowlist

Four global files remain by design:

| File | Purpose | Scope |
|---|---|---|
| `src/index.css` | CSS entry point | Imports global foundations only |
| `src/tokens.css` | Base design tokens | CSS custom properties in `:root` |
| `src/semantic.css` | Semantic token aliases | CSS custom properties in `:root` |
| `src/App.css` | App-level layout | Stable `[data-layout-*]` selectors |

## Shared Composition

Shared utility/composition lives in `src/components/shared.module.css`.

Current shared primitives include:

- `strip-surface` for `DegreeChipStrip` and `ChordRowStrip` surface tokens.
- `control-button`, `control-container`, and `control-value` for stepper/range style reuse.
- `icon-button` variants for header icon controls.
- Shared panel, toggle, and section primitives used by migrated control surfaces.

This keeps reusable styling module-scoped while avoiding ad hoc globals.

## Recent Cleanup

The follow-up CSS audit issues were resolved:

- `ChordRowStrip` no longer references undefined strip variables; strip surface tokens are composed from `shared.module.css`.
- `MobileTabPanel` no longer targets `TheoryControls` module classes through `:global(...)`.
- Stale `.header-btn` globals were removed from `App.css`.
- The old global `.controls-panel` mobile hide rule was removed from `App.css`.
- The `key-column` class hook was replaced with the stable `data-layout-column="key"` hook.
- Dead `overlay-field--selector` rules were removed from `DrawerSelector.module.css`.
- Production CSS scoping coverage was added through `npm run test:e2e:css-scoping`.

## Verification

### Build

```bash
npm run build
```

Result: passed.

### Unit Tests

```bash
npm run test
```

Result: 43 test files passed, 919 tests passed.

### Production CSS Scoping

```bash
npm run test:e2e:css-scoping
```

Result: 14 Playwright tests passed against a production build and `vite preview`.

This test path verifies hashed/scoped CSS Module behavior that Vitest can miss because the unit test config uses `css.modules.classNameStrategy = 'non-scoped'`.

## Remaining Risks

No known CSS Module migration blockers remain.

Watch items:

1. **Intentional global layout hooks** - `App.css` still owns app-level layout selectors. Keep those selectors restricted to documented data attributes and avoid targeting module-local class names from globals.
2. **Vitest class names are non-scoped** - continue using the production CSS scoping test for module-boundary validation.
3. **Shared utilities need ownership discipline** - add reusable classes to `shared.module.css` only when at least two components need the primitive; keep one-off styles in the owning component module.
4. **Visual regressions are still possible** - build and automated tests pass, but layout-heavy CSS changes should still be checked with targeted screenshots or Playwright viewport coverage when the visual surface changes.

## Maintenance Standards

- New component styles should use sibling `.module.css` files.
- Global tokens belong in `tokens.css` or `semantic.css`.
- App layout rules belong in `App.css` and should use stable data attributes, not component module class names.
- Reusable component primitives belong in `src/components/shared.module.css`.
- Before PR, run:

```bash
npm run build
npm run test
npm run test:e2e:css-scoping
```
