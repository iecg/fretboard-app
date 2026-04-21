# CSS Migration Audit

**Status:** Complete (verified 2026-04-21)

All component styles have been migrated to sibling `*.module.css` files. Global CSS is restricted to foundations and top-level layout.

## Global CSS Allowlist
- `src/index.css`: Global foundations
- `src/tokens.css`: Base design tokens
- `src/semantic.css`: Semantic token aliases
- `src/App.css`: Tier/variant layout via `[data-layout-*]`

## Shared Composition
Reusable primitives live in `src/components/shared.module.css` (e.g., `strip-surface`, `control-button`, `icon-button`). Use these only when at least two components share the style.

## Maintenance Standards
1. **New Styles:** Always use sibling `*.module.css` files.
2. **Global Tokens:** Add to `tokens.css` or `semantic.css`.
3. **App Layout:** Restricted to `App.css` using `[data-layout-*]` data attributes.
4. **Verification:** Run `npm run build`, `npm run test`, and `npm run test:e2e:css-scoping` before PR.
