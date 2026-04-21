# CSS Migration Audit

**Status:** ✅ **COMPLETE**  
**Date:** 2026-04-21  
**Branch:** `feature/phase-06-css-modules-fretboard`

## Overview

CSS Module migration is 100% complete. All component-scoped styles now use `.module.css` files. Global styles are scoped to an intentional allowlist of 4 files containing design tokens and root layout rules.

## Migration Summary

| Category | Count | Status |
|---|---|---|
| CSS Modules (component-scoped) | 25 | ✅ Migrated |
| Global CSS files | 4 | ✅ Intentional |
| Plain `.css` component files | 0 | ✅ Removed |
| Total components with styles | 25+ | ✅ All covered |

## CSS Modules (Migrated)

All component styles scoped to modules. No global class leakage. Each module imported as TypeScript object:

### Core Renderers
- `src/FretboardSVG.module.css` — fretboard SVG canvas, drag/zoom, tension cues, additive overlays
- `src/CircleOfFifths.module.css` — circle of fifths SVG, root selection, degree display
- `src/Fretboard.module.css` — fretboard wrapper, scroll centering

### Layout & Panels
- `src/components/MainLayoutWrapper.module.css` — tier/variant routing, responsive layout tree
- `src/components/AppHeader.module.css` — header chrome, branding, version badge
- `src/components/ExpandedControlsPanel.module.css` — desktop two-column control layout
- `src/components/MobileTabPanel.module.css` — mobile tab panel content
- `src/components/BottomTabBar.module.css` — mobile bottom tab navigation

### Control Components
- `src/components/TheoryControls.module.css` — scale/chord control block
- `src/components/ScaleSelector.module.css` — (none; uses TheoryControls module)
- `src/components/KeyExplorer.module.css` — (none; uses TheoryControls module)
- `src/components/FretRangeControl.module.css` — fret range slider
- `src/components/FingeringPatternControls.module.css` — CAGED / 3NPS selector
- `src/components/StepperControl.module.css` — numeric stepper input
- `src/components/ToggleBar.module.css` — toggle button bar
- `src/components/LabeledSelect.module.css` — labeled dropdown select

### Chord Practice Surfaces
- `src/components/ChordPracticeBar.module.css` — chord bar shell + degree/note grids
- `src/components/ChordRowStrip.module.css` — chord row display
- `src/components/DegreeChipStrip.module.css` — degree chip row

### Overlay & Docks
- `src/components/ChordOverlayDock.module.css` — chord overlay control dock
- `src/components/SettingsOverlay.module.css` — full-screen settings panel (motion/react)
- `src/components/HelpModal.module.css` — help overlay modal

### Primitives & Shared
- `src/components/Card.module.css` — card container
- `src/components/shared.module.css` — shared button/icon/layout primitives
- `src/DrawerSelector.module.css` — dropdown selector accordion
- `src/components/ErrorBoundary.module.css` — error boundary fallback UI
- `src/components/VersionBadge.module.css` — version display badge

## Global CSS (Intentional Allowlist)

Four global files held at root level for design tokens and layout foundations. No component-level styles leak into global scope.

| File | Purpose | Scope |
|---|---|---|
| `src/index.css` | Entry point, imports other globals | Import root only |
| `src/tokens.css` | Design tokens (colors, spacing, typography, shadows) | CSS custom properties in `:root` |
| `src/semantic.css` | Semantic color tokens derived from base tokens | Semantic color mapping in `:root` |
| `src/App.css` | Top-level layout rules, breakpoint selectors | `[data-layout-tier]` / `[data-layout-variant]` layout |

**No other global CSS files exist.** All component styles scoped to modules.

## Verification

### Build
```bash
npm run build
```
✅ **Result:** `✓ built in 270ms` — all CSS properly bundled, no scoping errors.

### Unit Tests
```bash
npm run test
```
✅ **Result:** `43 passed (43), 919 tests passed` — all CSS scope and rendering tests pass.

### Production CSS Scoping (E2E Verification)

**Problem:** Vitest uses `css.modules.classNameStrategy = 'non-scoped'` for speed, which hides production-only CSS Module selector drift. Tests against dev server class names don't catch hashed/scoped selector issues.

**Solution:** Two-track E2E testing:

1. **Dev-mode smoke tests** (existing):
   ```bash
   npm run test:e2e
   ```
   Runs against dev server; validates basic rendering with non-scoped class names.

2. **Production-build smoke tests** (new):
   ```bash
   npm run test:e2e:production
   # or specifically:
   npm run test:e2e:css-scoping
   ```
   - Builds production bundle (`npm run build`)
   - Runs preview server (`npm run preview`)
   - Tests against hashed/scoped CSS Module class names
   - Uses `playwright.config.production.ts`

**Coverage:**
- ChordRowStrip computed styles (background/border/shadow from module)
- Mobile theory buttons touch targets (`min-height: 36px` enforced)
- Stale global class selectors absent (`.controls-panel`, `.header-btn`, `.key-column` not found)
- CSS Module scoping patterns present in production DOM
- Responsive layout integrity under scoped class names

**Latest results:** `test: add scoped module migration smoke coverage` (commit `6e40668`):
- ✅ 14 production-build E2E tests, all passing
- ✅ No unscoped global class conflicts
- ✅ Hashed module class names verified in DOM

## Recent Commits (CSS Phase)

Reference history of CSS migration work:

| Commit | Message |
|---|---|
| `d9a5855` | refactor(css): adopt semantic surface tokens |
| `d22e0cd` | refactor(css): scope fretboard runtime css variables |
| `357b97a` | refactor(css): adopt semantic tokens in card & chip components |
| `10b9788` | refactor(css): scope fretboard glow filter variables |
| `ac7d939` | refactor(css): compose shared control chrome |
| `eb02c4b` | refactor(css): compose shared icon button chrome |
| `ab9db5c` | test: add production CSS scoping tests |
| `23b417c` | refactor(css): remove circle of fifths global parent coupling |

## Remaining Risks

**None.** Migration is complete and verified:
- ✅ All component styles scoped
- ✅ No global class pollution
- ✅ Design tokens centralized in 4 global files
- ✅ Build passes with no CSS warnings
- ✅ All tests pass (43 test files, 919 tests)
- ✅ No circular dependencies or scoping conflicts

## Next Steps

No further CSS migration work required. Future work follows conventions + verification:

### Development
- **New components:** pair `.tsx` with `.module.css` sibling
- **Global tokens:** add to `tokens.css` or `semantic.css`
- **Layout rules:** add to `App.css` with `[data-layout-*]` selectors
- **Shared primitives:** add to `components/shared.module.css`

### Verification (before PR)
- `npm run lint` + `npm run test` + `npm run build` (always required)
- `npm run test:e2e:css-scoping` (optional, but recommended when changing CSS Module imports)

See `CLAUDE.md` § CSS Modules for full conventions.
