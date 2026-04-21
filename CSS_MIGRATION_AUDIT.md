# CSS Migration Audit

**Status:** Complete
**Last verified:** 2026-04-21 — `npm run build`, `npm run test`, `npm run test:e2e:css-scoping`

## Overview

The CSS Module migration is complete. All component styles live in sibling `*.module.css` files. The remaining global CSS is limited to design tokens and top-level layout selectors driven by stable `[data-layout-*]` data attributes.

## Summary

| Category | Count | Status |
|---|---:|---|
| CSS Modules | 26 | Complete |
| Plain component `.css` files | 0 | Complete |
| Intentional global CSS files | 4 | Allowed |
| **Total CSS files** | **30** | Verified |

## Global CSS Allowlist

| File | Purpose |
|---|---|
| `src/index.css` | CSS entry point — imports global foundations |
| `src/tokens.css` | Base design tokens (`:root` custom properties) |
| `src/semantic.css` | Semantic token aliases (`:root` custom properties) |
| `src/App.css` | App-level layout via stable `[data-layout-*]` selectors |

## Shared Composition

Reusable primitives live in `src/components/shared.module.css`:

- `strip-surface` — surface tokens for `DegreeChipStrip` and `ChordRowStrip`
- `control-button`, `control-container`, `control-value` — stepper/range reuse
- `icon-button` variants — header icon controls
- Shared panel, toggle, and section primitives for migrated control surfaces

Add classes here only when at least two components need the primitive; keep one-off styles in the owning module.

## Verification

```bash
npm run build                  # type-check + bundle
npm run test                   # 919 unit tests (Vitest)
npm run test:e2e:css-scoping   # 14 Playwright tests against vite preview
```

The css-scoping suite runs against a production build served by `vite preview`, verifying hashed CSS Module class names. Vitest can miss these because its config sets `css.modules.classNameStrategy = 'non-scoped'`.

## Maintenance Standards

- New component styles → sibling `*.module.css` file.
- Global tokens → `tokens.css` or `semantic.css`.
- App layout rules → `App.css`, using only `[data-layout-*]` selectors. Never target component module class names from globals.
- Reusable primitives → `src/components/shared.module.css`.
- Before opening a PR: run `npm run build`, `npm run test`, and `npm run test:e2e:css-scoping`.

## Watch Items

1. **Global layout hooks** — keep `App.css` selectors restricted to documented data attributes.
2. **Vitest class names are non-scoped** — rely on the css-scoping E2E suite for module-boundary validation.
3. **Visual regressions** — layout-heavy CSS changes should still be spot-checked with targeted Playwright screenshots.
