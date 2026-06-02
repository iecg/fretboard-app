# Standardize Control Sizes Design

## Overview
Currently, the UI components have inconsistent heights (some 32px, 34px, 30px, etc.). This project will standardize the control height across the application to ensure consistency and improve touch accessibility on mobile devices.

## Requirements
- Base `control-height` token defaults to `32px` on desktop.
- On mobile viewports (max-width: 767px), `control-height` scales to `44px` to meet accessibility touch targets.
- All primary controls (Select, Slider, Buttons, Stepper, Toggle, Switch) use this token instead of hardcoded sizes.

## Implementation Details
1. **Design Tokens (`src/styles/tokens.css`)**:
   - Update `--control-height` to `32px` in the root scope.
   - Update `--control-height` to `44px` inside the `@media (max-width: 767px)` breakpoint.

2. **Component Refactoring**:
   - Locate and replace hardcoded heights (e.g., `30px`, `32px`) in component styles with `var(--control-height)`.
   - Affected components likely include:
     - `InspectorGrid`
     - `SongControls`
     - `ToggleBar`
     - `Switch`
     - `LabeledSelect`
     - `StepperControl`
     - `StepperShell`

3. **Square Elements**:
   - Ensure that square elements (like icon buttons) map both their width and height to `var(--control-height)` so they scale proportionally on mobile.

## Test Strategy
- Ensure unit tests (especially those in `ToggleBar` and `shared` checking for the control height) are updated to match the new token logic or the `32px` default.
- Visually verify controls on desktop and mobile viewports.
