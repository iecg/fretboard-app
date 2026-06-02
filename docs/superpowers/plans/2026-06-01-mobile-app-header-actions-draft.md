# Mobile App Header Actions Draft Plan

> **For agentic workers:** Draft plan. Expand with `superpowers:writing-plans` before execution if detailed step-by-step instructions are needed.

**Goal:** Make the first mobile header row fit cleanly: brand on the left, touch-sized utility actions on the right, no clipping on `390x844` or `375x667`.

**Related detailed plan:** `docs/superpowers/plans/2026-06-01-mobile-header-transport.md`

## Scope

- Touch only header row structure and CSS.
- Preserve the existing two-row mobile header model.
- Do not redesign transport controls in this slice.

## Likely Files

- `src/components/AppHeader/AppHeader.module.css`
- `src/components/AppHeader/AppHeader.test.tsx`
- `src/App.tsx` only if action grouping needs a class or wrapper hook
- `e2e/responsive.spec.ts`

## Tasks

- [ ] Add or update a mobile geometry test asserting header brand/actions share a row and do not overflow viewport width.
- [ ] Tighten mobile `.app-header` spacing and row gaps.
- [ ] Constrain brand/wordmark width so actions keep their touch-sized hit areas.
- [ ] Keep utility actions at `var(--control-height)` where shared icon button styling allows it.
- [ ] Run `pnpm test src/components/AppHeader/AppHeader.test.tsx`.
- [ ] Run focused responsive e2e coverage for `375x667` and `390x844`.
- [ ] Commit with `fix(mobile): prevent header action overflow`.

## Acceptance

- Brand and header actions do not overlap or clip.
- Header action buttons remain tappable at mobile size.
- Desktop and tablet header layouts remain unchanged.

