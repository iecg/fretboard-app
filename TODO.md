# FretFlow Improvement Roadmap

**Last Updated**: 2026-04-12

## Critical Issues

### 1. State Management Fragmentation
**Severity**: CRITICAL | **Effort**: HIGH
- 19+ independent state variables in `App.tsx` cause excessive re-renders and complex sync logic.
- **Solution**: Consolidate into a single state object with a custom `useAppState` hook. Batch updates and consider Zustand for future growth.

### 2. Missing Error Handling
**Severity**: CRITICAL | **Effort**: MEDIUM
- Silent fallbacks in `parseNote()` and unsafe type casting in `audio.ts` risk stability.
- **Solution**: Add explicit validation, guard AudioContext creation, and use try-catch for localStorage/JSON operations. Use Zod for schema validation.

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
- **Solution**: Add inline comments for geometry algorithms and extract named helper functions for clarity.

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
- **Solution**: Split `App.tsx` (~1k lines) into smaller components (`SettingsPanel`, `SummaryArea`, `TheoryControls`).

---

## Positive Observations
- ✅ Strong test coverage for pure utilities (`guitar.ts`, `theory.ts`).
- ✅ Responsive UI with clear CSS organization.
- ✅ Effective use of `useMemo` and Jotai atoms.
