// Stable DOM ids for the controls that global keyboard shortcuts focus after
// mutating their state (see src/hooks/useKeyboardShortcuts.ts). Shared so the
// hook and the components can never drift on the id string.

/** The tempo stepper group (↑/↓ shortcuts focus this). */
export const TEMPO_STEPPER_ID = "progression-tempo-stepper";

/** The chord step list scroll container (←/→ shortcuts focus this). */
export const PROGRESSION_STEP_LIST_ID = "progression-step-list";
