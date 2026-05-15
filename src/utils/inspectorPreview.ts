/**
 * Dev-flag for the DAW Shell Phase 2 preview. Returns true when the page was
 * loaded with `?inspector=tabs`, mirroring the existing `?audit=note-colors`
 * pattern in `src/App.tsx`.
 *
 * Non-reactive: read once at startup. The preview is intended for visual
 * comparison during the redesign rollout; restarts pick up URL changes.
 */
export function isInspectorPreviewEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    new URLSearchParams(window.location.search).get("inspector") === "tabs"
  );
}
