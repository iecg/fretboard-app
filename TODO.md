# FretFlow Improvement Roadmap

**Last Updated**: 2026-04-21

## Critical Issues

### 1. State Management Fragmentation
**Severity**: CRITICAL | **Effort**: HIGH
- 19+ independent state variables in `App.tsx` cause excessive re-renders and complex sync logic.
- **Solution**: [PARTIAL] Migrated domain state to Jotai storage atoms in `src/store/`. Remaining: Split `App.tsx` into sub-components to reduce prop-drilling and reduce its ~1k line length.

### 2. Missing Error Handling
**Severity**: CRITICAL | **Effort**: MEDIUM
- Silent fallbacks in `parseNote()` and unsafe type casting in `audio.ts` risk stability.
- **Solution**: [PARTIAL] Added `console.warn` guards to Jotai storage atom catch blocks to improve visibility of persistence failures. Remaining: Add Zod validation for `parseNote()` and AudioContext guards.

### 3. Summary Rendering Duplication
**Severity**: HIGH | **Effort**: LOW
- Identical logic for scale and chord notes in `App.tsx`.
- **Solution**: Extract a `<SummaryNote>` component or `useSummaryNoteData` hook.

## High-Impact Issues

### 4. Accessibility (A11y)
**Severity**: HIGH | **Effort**: MEDIUM
- Lacks ARIA labels, semantic HTML, and keyboard navigation.
- **Solution**: Add ARIA roles/labels, implement keyboard navigation, and use `:focus-visible` styles. Prioritize Circle of Fifths and toolbar.

### 5. Shapes Polygon Logic Documentation
**Severity**: HIGH | **Effort**: MEDIUM
- Complex geometry logic in `shapes.ts` lacks documentation.
- **Solution**: [DONE] Simplified coordinate wrapping and polygon generation logic; pruned repetitive boilerplate.

## Medium-Impact Issues

### 6. Type Safety Gaps
- **Solution**: Replace `as unknown` casts with type guards, use `const` assertions for literal types, and validate persisted data.

### 7. Performance Optimization
- **Solution**: Batch and debounce localStorage updates. Use `useMemo` for expensive computations and profile with React DevTools.

### 8. Test Coverage
- **Solution**: Add integration tests for `App.tsx`, interaction tests for Circle of Fifths, and accessibility tests.

## Maintenance

### 9. Magic Numbers
- **Solution**: Move hardcoded values (string height, zoom max, fret markers) to `src/constants.ts`.

### 10. Refactoring Component Sizes
- **Solution**: [DONE] TheoryControls refactored into structured sections with dedicated layout variant styling. Remaining: split `App.tsx` (~1k lines) into `SettingsPanel` and `SummaryArea`.

---

## Positive Observations
- ✅ Strong test coverage for pure utilities (`guitar.ts`, `theory.ts`).
- ✅ Responsive UI with clear CSS organization.
- ✅ Effective use of `useMemo` and Jotai atoms.
