### T1: Light-mode follow-up refinement pass

**Goal:** Implement the 16 confirmed light-mode and shared-UI follow-up refinements on the existing light-mode workstream, including the required contract-test and visual-snapshot updates.

**Dependencies:** None

**Ownership:** src/styles/tokens.css, src/styles/semantic.css, src/styles/themes.css, src/styles/App.css, src/components/shared/shared.module.css, src/components/StepperControl/StepperControl.module.css, src/components/ToggleBar/ToggleBar.module.css, src/components/TheoryControls/TheoryControls.module.css, src/components/DegreeChipStrip/DegreeChipStrip.module.css, src/components/CircleOfFifths/CircleOfFifths.module.css, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardNoteLayer.tsx, src/components/FretboardSVG/FretboardShapeLayer.tsx, src/components/FretboardSVG/utils/semantics.ts, src/components/Card/Card.module.css, src/core/degrees.ts, src/shapes, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts-snapshots, e2e/app-components.visual.spec.ts-snapshots, e2e/app-layout.visual.spec.ts-snapshots, e2e/app-mobile.visual.spec.ts-snapshots, e2e/app-overlays.visual.spec.ts-snapshots

**Branch/PR:** `light-mode-warm-pass/feat-light-mode-palette` -> `main`

**Copy/Paste Prompt For Agent:**

```text
You are working in fretboard-app on branch light-mode-warm-pass/feat-light-mode-palette.

Task: Implement the 16 confirmed light-mode and shared-UI follow-up refinements on the existing light-mode workstream, including the required contract-test and visual-snapshot updates.

Checkout discipline:
- Assigned checkout: /Users/isaaccocar/repos/fretboard-app
- Original repo: /Users/isaaccocar/repos/fretboard-app
- Expected branch: light-mode-warm-pass/feat-light-mode-palette
- This task uses the original checkout; read and edit relative paths from this checkout.
- Before editing, run `pwd`, `git rev-parse --show-toplevel`, `git branch --show-current`, and `git status --short`.
- If root or branch is wrong, print `WARNING: wrong checkout or branch` with actual/expected values and stop.

Context:
- Extend the existing light-mode workstream instead of creating a separate branch/PR chain.
- Apply white labels only to degree-color mode, not to all standard light-mode fretboard note labels.
- Cover all light-mode note roles and practice-lens states when improving note-ring differentiation and ring thickness.
- Read context: src/styles/tokens.css, src/styles/semantic.css, src/styles/themes.css, src/components/shared/shared.module.css, src/components/TheoryControls/TheoryControls.module.css, src/components/DegreeChipStrip/DegreeChipStrip.module.css, src/components/CircleOfFifths/CircleOfFifths.module.css, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/FretboardDefs.tsx, src/core/degrees.ts, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts, e2e/app-components.visual.spec.ts, e2e/app-layout.visual.spec.ts, e2e/app-mobile.visual.spec.ts, e2e/app-overlays.visual.spec.ts

Ownership:
- You may edit: src/styles/tokens.css, src/styles/semantic.css, src/styles/themes.css, src/styles/App.css, src/components/shared/shared.module.css, src/components/StepperControl/StepperControl.module.css, src/components/ToggleBar/ToggleBar.module.css, src/components/TheoryControls/TheoryControls.module.css, src/components/DegreeChipStrip/DegreeChipStrip.module.css, src/components/CircleOfFifths/CircleOfFifths.module.css, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardNoteLayer.tsx, src/components/FretboardSVG/FretboardShapeLayer.tsx, src/components/FretboardSVG/utils/semantics.ts, src/components/Card/Card.module.css, src/core/degrees.ts, src/shapes, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts-snapshots, e2e/app-components.visual.spec.ts-snapshots, e2e/app-layout.visual.spec.ts-snapshots, e2e/app-mobile.visual.spec.ts-snapshots, e2e/app-overlays.visual.spec.ts-snapshots
- Do not revert unrelated changes.
- Do not edit outside the write scope unless needed; if needed, stop and explain why.

Implementation:
1. Retune shared control hover and focus styling for the stepper, toggle groups, theory disclosure button, and fretboard hover affordance where requested.
2. Adjust light-mode shared surface tokens such as --surface-card-top and any directly dependent chrome needed to satisfy the confirmed visibility issues.
3. Refine the light-mode fretboard materials and overlays, including maple wood tone, strings, fret wire/shadow balance, nut, headstock, inlays, and CAGED shape visibility.
4. Fix the light-mode circle-of-fifths active/root border visibility and remove light-mode degree-chip glow mismatches.
5. Improve light-mode fretboard note-ring differentiation and stroke weight across all light-mode note roles and lens states, while limiting white note labels to degree-color mode only.
6. Update the relevant theme-contract assertions and refresh the affected visual snapshots.

Verification:
- Run: npm run lint
- Run: npm run test
- Run: npm run test:e2e -- e2e/theme-contract.spec.ts
- Run: npm run test:visual

Git/PR:
- Commit: `feat: refine light mode follow-up surfaces and fretboard contrast`
- Run `cr review --agent` after local verification and before push/PR; address actionable findings or explain unresolved findings.
- Create a PR with base `main`.
- Suggested PR title: `feat: refine light mode follow-up surfaces and fretboard contrast`
- PR body: Summary:\n- refine shared hover/focus chrome and light-mode card surfaces\n- improve light-mode fretboard materials, note rings, caged shapes, and degree-color readability\n- fix light-mode circle/degrees styling inconsistencies and update affected tests/snapshots\n\nVerification:\n- npm run lint\n- npm run test\n- npm run test:e2e -- e2e/theme-contract.spec.ts\n- npm run test:visual\n\nRisks:\n- shared token changes fan out into cards, strips, and control surfaces\n- fretboard rendering is split across tokens, CSS, and hardcoded SVG defs\n- visual snapshot churn is expected for light-mode fretboard and circle surfaces

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

Task: Implement the 16 confirmed light-mode and shared-UI follow-up refinements on the existing light-mode workstream, including the required contract-test and visual-snapshot updates.

Checkout discipline:
- Assigned checkout: /Users/isaaccocar/repos/fretboard-app
- Original repo: /Users/isaaccocar/repos/fretboard-app
- Expected branch: light-mode-warm-pass/feat-light-mode-palette
- This task uses the original checkout; read and edit relative paths from this checkout.
- Before editing, run `pwd`, `git rev-parse --show-toplevel`, `git branch --show-current`, and `git status --short`.
- If root or branch is wrong, print `WARNING: wrong checkout or branch` with actual/expected values and stop.

Context:
- Extend the existing light-mode workstream instead of creating a separate branch/PR chain.
- Apply white labels only to degree-color mode, not to all standard light-mode fretboard note labels.
- Cover all light-mode note roles and practice-lens states when improving note-ring differentiation and ring thickness.
- Read context: src/styles/tokens.css, src/styles/semantic.css, src/styles/themes.css, src/components/shared/shared.module.css, src/components/TheoryControls/TheoryControls.module.css, src/components/DegreeChipStrip/DegreeChipStrip.module.css, src/components/CircleOfFifths/CircleOfFifths.module.css, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/FretboardDefs.tsx, src/core/degrees.ts, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts, e2e/app-components.visual.spec.ts, e2e/app-layout.visual.spec.ts, e2e/app-mobile.visual.spec.ts, e2e/app-overlays.visual.spec.ts

Ownership:
- You may edit: src/styles/tokens.css, src/styles/semantic.css, src/styles/themes.css, src/styles/App.css, src/components/shared/shared.module.css, src/components/StepperControl/StepperControl.module.css, src/components/ToggleBar/ToggleBar.module.css, src/components/TheoryControls/TheoryControls.module.css, src/components/DegreeChipStrip/DegreeChipStrip.module.css, src/components/CircleOfFifths/CircleOfFifths.module.css, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardNoteLayer.tsx, src/components/FretboardSVG/FretboardShapeLayer.tsx, src/components/FretboardSVG/utils/semantics.ts, src/components/Card/Card.module.css, src/core/degrees.ts, src/shapes, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts-snapshots, e2e/app-components.visual.spec.ts-snapshots, e2e/app-layout.visual.spec.ts-snapshots, e2e/app-mobile.visual.spec.ts-snapshots, e2e/app-overlays.visual.spec.ts-snapshots
- Do not revert unrelated changes.
- Do not edit outside the write scope unless needed; if needed, stop and explain why.

Implementation:
1. Retune shared control hover and focus styling for the stepper, toggle groups, theory disclosure button, and fretboard hover affordance where requested.
2. Adjust light-mode shared surface tokens such as --surface-card-top and any directly dependent chrome needed to satisfy the confirmed visibility issues.
3. Refine the light-mode fretboard materials and overlays, including maple wood tone, strings, fret wire/shadow balance, nut, headstock, inlays, and CAGED shape visibility.
4. Fix the light-mode circle-of-fifths active/root border visibility and remove light-mode degree-chip glow mismatches.
5. Improve light-mode fretboard note-ring differentiation and stroke weight across all light-mode note roles and lens states, while limiting white note labels to degree-color mode only.
6. Update the relevant theme-contract assertions and refresh the affected visual snapshots.

Verification:
- Run: npm run lint
- Run: npm run test
- Run: npm run test:e2e -- e2e/theme-contract.spec.ts
- Run: npm run test:visual

Git/PR:
- Commit: `feat: refine light mode follow-up surfaces and fretboard contrast`
- Run `cr review --agent` after local verification and before push/PR; address actionable findings or explain unresolved findings.
- Create a PR with base `main`.
- Suggested PR title: `feat: refine light mode follow-up surfaces and fretboard contrast`
- PR body: Summary:\n- refine shared hover/focus chrome and light-mode card surfaces\n- improve light-mode fretboard materials, note rings, caged shapes, and degree-color readability\n- fix light-mode circle/degrees styling inconsistencies and update affected tests/snapshots\n\nVerification:\n- npm run lint\n- npm run test\n- npm run test:e2e -- e2e/theme-contract.spec.ts\n- npm run test:visual\n\nRisks:\n- shared token changes fan out into cards, strips, and control surfaces\n- fretboard rendering is split across tokens, CSS, and hardcoded SVG defs\n- visual snapshot churn is expected for light-mode fretboard and circle surfaces

Return:
- Files changed
- Verification results
- PR URL or branch name
- Blockers or assumptions
PROMPT

  if [ -n "$MODEL" ]; then gemini --yolo --model "$MODEL" --prompt-interactive "$(cat "$PROMPT_FILE")"; else gemini --yolo --prompt-interactive "$(cat "$PROMPT_FILE")"; fi
)
```

**Suggested Commit:** `feat: refine light mode follow-up surfaces and fretboard contrast`

**Suggested PR Title:** `feat: refine light mode follow-up surfaces and fretboard contrast`
