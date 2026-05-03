### T1: Resolve remaining light-mode follow-up gaps

**Goal:** Implement the confirmed post-T1 misses and partial fixes on the existing light-mode workstream: non-white light-mode card-top surfaces, clearer shared hover chrome, more reliable circle-of-fifths slice borders, corrected degree-chip-strip degree-color labels, stronger degree-color contrast between chip and fretboard surfaces, warmer light-mode fret wire, and wider shared light-mode accent separation, including any required contract-test and visual-snapshot updates.

**Dependencies:** None

**Ownership:** src/styles/themes.css, src/styles/semantic.css, src/styles/tokens.css, src/styles/App.css, src/components/shared/shared.module.css, src/components/StepperShell/StepperShell.module.css, src/components/StepperControl/StepperControl.module.css, src/components/ToggleBar/ToggleBar.module.css, src/components/TheoryControls/TheoryControls.module.css, src/components/Card/Card.module.css, src/components/CircleOfFifths/CircleOfFifths.tsx, src/components/CircleOfFifths/CircleOfFifths.module.css, src/components/CircleOfFifths/CircleOfFifths.test.tsx, src/components/DegreeChipStrip/DegreeChipStrip.tsx, src/components/DegreeChipStrip/DegreeChipStrip.module.css, src/components/DegreeChipStrip/DegreeChipStrip.test.tsx, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/FretboardNoteLayer.tsx, src/components/FretboardSVG/utils/semantics.ts, src/core/degrees.ts, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts-snapshots, e2e/app-components.visual.spec.ts-snapshots, e2e/app-layout.visual.spec.ts-snapshots, e2e/app-mobile.visual.spec.ts-snapshots, e2e/app-overlays.visual.spec.ts-snapshots

**Branch/PR:** `light-mode-warm-pass/feat-light-mode-palette` -> `main`

**Copy/Paste Prompt For Agent:**

```text
You are working in fretboard-app on branch light-mode-warm-pass/feat-light-mode-palette.

Task: Implement the confirmed post-T1 misses and partial fixes on the existing light-mode workstream: non-white light-mode card-top surfaces, clearer shared hover chrome, more reliable circle-of-fifths slice borders, corrected degree-chip-strip degree-color labels, stronger degree-color contrast between chip and fretboard surfaces, warmer light-mode fret wire, and wider shared light-mode accent separation, including any required contract-test and visual-snapshot updates.

Checkout discipline:
- Assigned checkout: /Users/isaaccocar/repos/fretboard-app
- Original repo: /Users/isaaccocar/repos/fretboard-app
- Expected branch: light-mode-warm-pass/feat-light-mode-palette
- This task uses the original checkout; read and edit relative paths from this checkout.
- Before editing, run `pwd`, `git rev-parse --show-toplevel`, `git branch --show-current`, and `git status --short`.
- If root or branch is wrong, print `WARNING: wrong checkout or branch` with actual/expected values and stop.

Context:
- Continue the existing light-mode workstream on branch light-mode-warm-pass/feat-light-mode-palette instead of creating a separate follow-up branch.
- Propagate the light-mode --surface-card-top correction through the shared token path rather than patching only local surfaces.
- Retune the shared light-mode accent family globally enough to improve control, circle, chip, and fretboard differentiation.
- This follow-up is limited to the confirmed post-T1 misses and partial fixes from the audit, not a reimplementation of the original 16-item pass.
- Dark mode should change only where the remaining miss explicitly applies in both themes, such as shared hover or focus chrome.
- Read context: src/styles/themes.css, src/styles/semantic.css, src/styles/tokens.css, src/styles/App.css, src/components/shared/shared.module.css, src/components/StepperShell/StepperShell.module.css, src/components/StepperControl/StepperControl.module.css, src/components/ToggleBar/ToggleBar.module.css, src/components/TheoryControls/TheoryControls.module.css, src/components/Card/Card.module.css, src/components/CircleOfFifths/CircleOfFifths.tsx, src/components/CircleOfFifths/CircleOfFifths.module.css, src/components/DegreeChipStrip/DegreeChipStrip.tsx, src/components/DegreeChipStrip/DegreeChipStrip.module.css, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/FretboardNoteLayer.tsx, src/components/FretboardSVG/utils/semantics.ts, src/core/degrees.ts, e2e/theme-contract.spec.ts, e2e/app-components.visual.spec.ts, e2e/fretboard-svg.visual.spec.ts, e2e/app-layout.visual.spec.ts, e2e/app-mobile.visual.spec.ts, e2e/app-overlays.visual.spec.ts

Ownership:
- You may edit: src/styles/themes.css, src/styles/semantic.css, src/styles/tokens.css, src/styles/App.css, src/components/shared/shared.module.css, src/components/StepperShell/StepperShell.module.css, src/components/StepperControl/StepperControl.module.css, src/components/ToggleBar/ToggleBar.module.css, src/components/TheoryControls/TheoryControls.module.css, src/components/Card/Card.module.css, src/components/CircleOfFifths/CircleOfFifths.tsx, src/components/CircleOfFifths/CircleOfFifths.module.css, src/components/CircleOfFifths/CircleOfFifths.test.tsx, src/components/DegreeChipStrip/DegreeChipStrip.tsx, src/components/DegreeChipStrip/DegreeChipStrip.module.css, src/components/DegreeChipStrip/DegreeChipStrip.test.tsx, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/FretboardNoteLayer.tsx, src/components/FretboardSVG/utils/semantics.ts, src/core/degrees.ts, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts-snapshots, e2e/app-components.visual.spec.ts-snapshots, e2e/app-layout.visual.spec.ts-snapshots, e2e/app-mobile.visual.spec.ts-snapshots, e2e/app-overlays.visual.spec.ts-snapshots
- Do not revert unrelated changes.
- Do not edit outside the write scope unless needed; if needed, stop and explain why.

Implementation:
1. Retune the shared light-mode card-top and dependent surface tokens so top-level card-like surfaces stop reading as pure white while keeping the surface ladder coherent.
2. Strengthen the remaining weak hover states across shared toggle, stepper, and nav-style controls so they are visually distinct from their background surfaces.
3. Fix circle-of-fifths slice border consistency and active/root edge visibility, including any SVG draw-order or selector adjustments needed beyond a simple stroke-width bump.
4. Correct light-mode degree-chip-strip degree-color label color and improve degree-color differentiation across both chip and fretboard surfaces.
5. Warm the light-mode fret wire hue away from the current blue-gray cast while keeping the existing fret-wire material rendering coherent with its shadow and highlight passes.
6. Retune the shared light-mode accent family enough to create clearer separation between note-ring, chord, scale, and control-accent states without redesigning the theme.
7. Update the affected contract assertions and refresh the intended light-mode visual snapshots.

Verification:
- Run: npm run lint
- Run: npm run test
- Run: npm run test:e2e -- e2e/theme-contract.spec.ts
- Run: npm run test:visual

Git/PR:
- Commit: `fix: resolve remaining light mode contrast and chrome gaps`
- Run `cr review --agent` after local verification and before push/PR; address actionable findings or explain unresolved findings.
- Create a PR with base `main`.
- Suggested PR title: `fix: resolve remaining light mode contrast and chrome gaps`
- PR body: Summary:\n- finish the remaining light-mode card, accent, and hover refinements left after the first follow-up pass\n- improve circle border consistency, degree-color readability, and fret wire warmth\n- update affected contract expectations and light-mode visual baselines\n\nVerification:\n- npm run lint\n- npm run test\n- npm run test:e2e -- e2e/theme-contract.spec.ts\n- npm run test:visual\n\nRisks:\n- shared token changes still fan out across cards, strips, controls, and note states\n- circle border visibility depends on both CSS stroke rules and SVG draw order\n- light-mode snapshot churn is expected across fretboard and circle surfaces

Return:
- Files changed
- Verification results
- PR URL or branch name
- Blockers or assumptions
```

**Interactive Command:**

```bash
(
  WORKDIR=/Users/isaaccocar/repos/fretboard-app
  EXPECTED_ROOT=/Users/isaaccocar/repos/fretboard-app
  EXPECTED_BRANCH=light-mode-warm-pass/feat-light-mode-palette
  ORIGINAL_REPO=/Users/isaaccocar/repos/fretboard-app
  USE_WORKTREES=false
  TOOL=gemini
  MODEL=gemini-3.1-pro-preview
  EFFORT=high
  PROMPT_FILE=$(mktemp "${TMPDIR:-/tmp}/agent-prompt.XXXXXX") || { printf '[agent-work-planner] failed to create prompt file\n' >&2; exit 1; }
  TTY_STATE=$({ stty -g < /dev/tty; } 2>/dev/null || true)

  cleanup_terminal() {
    status="${1:-0}"
    if [ "$status" -eq 0 ]; then
      rm -f "$PROMPT_FILE"
    fi
    if [ -n "$TTY_STATE" ]; then
      { stty "$TTY_STATE" < /dev/tty; } 2>/dev/null || { stty sane < /dev/tty; } 2>/dev/null || true
    else
      { stty sane < /dev/tty; } 2>/dev/null || true
    fi
    command reset 2>/dev/null || true
    printf '\033[?1049l\033[?47l\033[?1047l\033[0m\033[?25h\033[?1000l\033[?1002l\033[?1003l\033[?1006l\033[?2004l'
    if [ "$status" -ne 0 ]; then
      printf '\n[agent-work-planner] worker command failed with exit status %s\n' "$status" >&2
      printf '[agent-work-planner] tool: %s\n' "$TOOL" >&2
      printf '[agent-work-planner] workdir: %s\n' "$EXPECTED_ROOT" >&2
      printf '[agent-work-planner] expected branch: %s\n' "$EXPECTED_BRANCH" >&2
      if [ -n "$MODEL" ]; then
        printf '[agent-work-planner] model: %s\n' "$MODEL" >&2
      fi
      if [ -n "$PROMPT_FILE" ] && [ -f "$PROMPT_FILE" ]; then
        printf '[agent-work-planner] prompt file retained for debugging: %s\n' "$PROMPT_FILE" >&2
      fi
    fi
  }

  finish() {
    status=$?
    trap - EXIT INT TERM
    cleanup_terminal "$status"
    exit "$status"
  }

  trap finish EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  ACTUAL_ROOT=$(git -C "$WORKDIR" rev-parse --show-toplevel 2>/dev/null || true)
  ACTUAL_BRANCH=$(git -C "$WORKDIR" branch --show-current 2>/dev/null || true)
  if [ "$ACTUAL_ROOT" != "$EXPECTED_ROOT" ] || [ "$ACTUAL_BRANCH" != "$EXPECTED_BRANCH" ]; then
    printf 'WARNING: wrong checkout or branch\nExpected root: %s\nActual root: %s\nExpected branch: %s\nActual branch: %s\n' "$EXPECTED_ROOT" "$ACTUAL_ROOT" "$EXPECTED_BRANCH" "$ACTUAL_BRANCH"
    exit 1
  fi
  if [ "$USE_WORKTREES" = "true" ] && [ "$EXPECTED_ROOT" = "$ORIGINAL_REPO" ]; then
    printf 'WARNING: worktree task points at original repo: %s\n' "$ORIGINAL_REPO"
    exit 1
  fi
  cd "$EXPECTED_ROOT" || exit 1

  cat > "$PROMPT_FILE" <<'PROMPT'
You are working in fretboard-app on branch light-mode-warm-pass/feat-light-mode-palette.

Task: Implement the confirmed post-T1 misses and partial fixes on the existing light-mode workstream: non-white light-mode card-top surfaces, clearer shared hover chrome, more reliable circle-of-fifths slice borders, corrected degree-chip-strip degree-color labels, stronger degree-color contrast between chip and fretboard surfaces, warmer light-mode fret wire, and wider shared light-mode accent separation, including any required contract-test and visual-snapshot updates.

Checkout discipline:
- Assigned checkout: /Users/isaaccocar/repos/fretboard-app
- Original repo: /Users/isaaccocar/repos/fretboard-app
- Expected branch: light-mode-warm-pass/feat-light-mode-palette
- This task uses the original checkout; read and edit relative paths from this checkout.
- Before editing, run `pwd`, `git rev-parse --show-toplevel`, `git branch --show-current`, and `git status --short`.
- If root or branch is wrong, print `WARNING: wrong checkout or branch` with actual/expected values and stop.

Context:
- Continue the existing light-mode workstream on branch light-mode-warm-pass/feat-light-mode-palette instead of creating a separate follow-up branch.
- Propagate the light-mode --surface-card-top correction through the shared token path rather than patching only local surfaces.
- Retune the shared light-mode accent family globally enough to improve control, circle, chip, and fretboard differentiation.
- This follow-up is limited to the confirmed post-T1 misses and partial fixes from the audit, not a reimplementation of the original 16-item pass.
- Dark mode should change only where the remaining miss explicitly applies in both themes, such as shared hover or focus chrome.
- Read context: src/styles/themes.css, src/styles/semantic.css, src/styles/tokens.css, src/styles/App.css, src/components/shared/shared.module.css, src/components/StepperShell/StepperShell.module.css, src/components/StepperControl/StepperControl.module.css, src/components/ToggleBar/ToggleBar.module.css, src/components/TheoryControls/TheoryControls.module.css, src/components/Card/Card.module.css, src/components/CircleOfFifths/CircleOfFifths.tsx, src/components/CircleOfFifths/CircleOfFifths.module.css, src/components/DegreeChipStrip/DegreeChipStrip.tsx, src/components/DegreeChipStrip/DegreeChipStrip.module.css, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/FretboardNoteLayer.tsx, src/components/FretboardSVG/utils/semantics.ts, src/core/degrees.ts, e2e/theme-contract.spec.ts, e2e/app-components.visual.spec.ts, e2e/fretboard-svg.visual.spec.ts, e2e/app-layout.visual.spec.ts, e2e/app-mobile.visual.spec.ts, e2e/app-overlays.visual.spec.ts

Ownership:
- You may edit: src/styles/themes.css, src/styles/semantic.css, src/styles/tokens.css, src/styles/App.css, src/components/shared/shared.module.css, src/components/StepperShell/StepperShell.module.css, src/components/StepperControl/StepperControl.module.css, src/components/ToggleBar/ToggleBar.module.css, src/components/TheoryControls/TheoryControls.module.css, src/components/Card/Card.module.css, src/components/CircleOfFifths/CircleOfFifths.tsx, src/components/CircleOfFifths/CircleOfFifths.module.css, src/components/CircleOfFifths/CircleOfFifths.test.tsx, src/components/DegreeChipStrip/DegreeChipStrip.tsx, src/components/DegreeChipStrip/DegreeChipStrip.module.css, src/components/DegreeChipStrip/DegreeChipStrip.test.tsx, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/FretboardNoteLayer.tsx, src/components/FretboardSVG/utils/semantics.ts, src/core/degrees.ts, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts-snapshots, e2e/app-components.visual.spec.ts-snapshots, e2e/app-layout.visual.spec.ts-snapshots, e2e/app-mobile.visual.spec.ts-snapshots, e2e/app-overlays.visual.spec.ts-snapshots
- Do not revert unrelated changes.
- Do not edit outside the write scope unless needed; if needed, stop and explain why.

Implementation:
1. Retune the shared light-mode card-top and dependent surface tokens so top-level card-like surfaces stop reading as pure white while keeping the surface ladder coherent.
2. Strengthen the remaining weak hover states across shared toggle, stepper, and nav-style controls so they are visually distinct from their background surfaces.
3. Fix circle-of-fifths slice border consistency and active/root edge visibility, including any SVG draw-order or selector adjustments needed beyond a simple stroke-width bump.
4. Correct light-mode degree-chip-strip degree-color label color and improve degree-color differentiation across both chip and fretboard surfaces.
5. Warm the light-mode fret wire hue away from the current blue-gray cast while keeping the existing fret-wire material rendering coherent with its shadow and highlight passes.
6. Retune the shared light-mode accent family enough to create clearer separation between note-ring, chord, scale, and control-accent states without redesigning the theme.
7. Update the affected contract assertions and refresh the intended light-mode visual snapshots.

Verification:
- Run: npm run lint
- Run: npm run test
- Run: npm run test:e2e -- e2e/theme-contract.spec.ts
- Run: npm run test:visual

Git/PR:
- Commit: `fix: resolve remaining light mode contrast and chrome gaps`
- Run `cr review --agent` after local verification and before push/PR; address actionable findings or explain unresolved findings.
- Create a PR with base `main`.
- Suggested PR title: `fix: resolve remaining light mode contrast and chrome gaps`
- PR body: Summary:\n- finish the remaining light-mode card, accent, and hover refinements left after the first follow-up pass\n- improve circle border consistency, degree-color readability, and fret wire warmth\n- update affected contract expectations and light-mode visual baselines\n\nVerification:\n- npm run lint\n- npm run test\n- npm run test:e2e -- e2e/theme-contract.spec.ts\n- npm run test:visual\n\nRisks:\n- shared token changes still fan out across cards, strips, controls, and note states\n- circle border visibility depends on both CSS stroke rules and SVG draw order\n- light-mode snapshot churn is expected across fretboard and circle surfaces

Return:
- Files changed
- Verification results
- PR URL or branch name
- Blockers or assumptions
PROMPT

  if [ -n "$MODEL" ]; then gemini --yolo --model "$MODEL" --prompt-interactive "$(cat "$PROMPT_FILE")"; else gemini --yolo --prompt-interactive "$(cat "$PROMPT_FILE")"; fi
)
```

**Suggested Commit:** `fix: resolve remaining light mode contrast and chrome gaps`

**Suggested PR Title:** `fix: resolve remaining light mode contrast and chrome gaps`
