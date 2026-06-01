// Test-only render instrumentation for FretboardNote. Lives in its own module
// so the component file can stay export-clean (react-refresh) and so the
// increment is an external side-effecting call rather than a reassignment of a
// module-scope variable inside the render body (react-compiler purity rule).
let renderCount = 0;

/** @internal Called once per FretboardNote render. */
export const recordFretboardNoteRender = (): void => {
  renderCount += 1;
};

/** @internal test hook */
export const __getFretboardNoteRenderCount = (): number => renderCount;

/** @internal test hook */
export const __resetFretboardNoteRenderCount = (): void => {
  renderCount = 0;
};
