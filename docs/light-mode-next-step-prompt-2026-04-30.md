# Next-Step Prompt

Use this prompt for the planning pass that follows the light-mode audit in [light-mode-audit-2026-04-30.md](/Users/isaaccocar/repos/fretboard-app/docs/light-mode-audit-2026-04-30.md).

```md
Read [/Users/isaaccocar/repos/fretboard-app/docs/light-mode-audit-2026-04-30.md](/Users/isaaccocar/repos/fretboard-app/docs/light-mode-audit-2026-04-30.md) first.

Based on that audit, create a concrete implementation plan for improving light mode in this repo.

Constraints:
- Adjust colors only. Do not redesign layout or component structure.
- Keep the direction warmer and more natural for light mode.
- Preserve the existing dark mode behavior unless a shared token refactor makes that impossible.
- Prefer token-driven changes over scattered one-off overrides.
- Be explicit about any tests or snapshots that will need updating.

Goals:
1. Replace the current neon cyan/orange light-mode feel with warmer light-mode accents, including the logo and brandmark.
2. Restore ring-style / hollow fretboard note bubbles in light mode instead of the current solid fills.
3. Introduce a visible but restrained warm background gradient for light mode.
4. Make fretboard inlays/insets more visible in light mode.
5. Push the light-mode fretboard further toward a believable maple look, including any needed turbulence, vignette, or texture adjustments.

What I want from you:
- Summarize the main technical constraints from the audit in 1 short section.
- Propose a phased implementation plan in execution order.
- For each phase, list the exact files most likely to change.
- Call out which changes should be token-only and which require component or SVG edits.
- Identify likely test files and visual snapshots that will need updates.
- Flag any risky couplings, especially around shared accent tokens and degree-color mode.
- End with a recommended smallest-safe first implementation slice.

Do not edit code yet. This step is planning only.
```
