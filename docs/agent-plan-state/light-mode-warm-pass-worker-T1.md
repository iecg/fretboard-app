### T1: Warm light mode palette pass

**Goal:** Implement the warmer light-mode pass across shared tokens, branding, fretboard note styling, degree-color mode, maple fretboard materials, and the affected tests and light-mode snapshots in one sequential branch and PR.

**Dependencies:** None

**Ownership:** src/styles/themes.css, src/styles/semantic.css, src/styles/App.css, src/components/AppHeader/AppHeader.module.css, src/components/BrandMark/BrandMark.tsx, src/components/FretFlowWordmark/FretFlowWordmark.tsx, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/hooks/useWoodGrainTexture.ts, src/core/degrees.ts, public/favicon.svg, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts-snapshots, e2e/app-components.visual.spec.ts-snapshots, e2e/app-layout.visual.spec.ts-snapshots, e2e/app-mobile.visual.spec.ts-snapshots, e2e/app-overlays.visual.spec.ts-snapshots

**Branch/PR:** `light-mode-warm-pass/feat-light-mode-palette` -> `main`

**Copy/Paste Prompt For Agent:**

```text
You are working in fretboard-app on branch light-mode-warm-pass/feat-light-mode-palette.

Task: Implement the warmer light-mode pass across shared tokens, branding, fretboard note styling, degree-color mode, maple fretboard materials, and the affected tests and light-mode snapshots in one sequential branch and PR.

Checkout discipline:
- Assigned checkout: /Users/isaaccocar/repos/fretboard-app
- Original repo: /Users/isaaccocar/repos/fretboard-app
- Expected branch: light-mode-warm-pass/feat-light-mode-palette
- Use the assigned checkout as the only repo checkout for reading and editing unless explicitly told otherwise.
- Do not open, inspect, run commands against, or edit the original repo path. Use relative paths from the assigned checkout.
- Before editing, run `pwd`, `git rev-parse --show-toplevel`, `git branch --show-current`, and `git status --short`.
- If root or branch is wrong, print `WARNING: wrong checkout or branch` with actual/expected values and stop.

Context:
- Use the R1 facts and aligned assumptions relevant to this task.
- Read context: docs/light-mode-audit-2026-04-30.md, docs/light-mode-next-step-prompt-2026-04-30.md, src/styles/themes.css, src/styles/semantic.css, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/hooks/useWoodGrainTexture.ts, src/components/BrandMark/BrandMark.tsx, src/components/FretFlowWordmark/FretFlowWordmark.tsx, src/core/degrees.ts, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts, e2e/app-components.visual.spec.ts, e2e/app-layout.visual.spec.ts, e2e/app-mobile.visual.spec.ts, e2e/app-overlays.visual.spec.ts

Ownership:
- You may edit: src/styles/themes.css, src/styles/semantic.css, src/styles/App.css, src/components/AppHeader/AppHeader.module.css, src/components/BrandMark/BrandMark.tsx, src/components/FretFlowWordmark/FretFlowWordmark.tsx, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/hooks/useWoodGrainTexture.ts, src/core/degrees.ts, public/favicon.svg, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts-snapshots, e2e/app-components.visual.spec.ts-snapshots, e2e/app-layout.visual.spec.ts-snapshots, e2e/app-mobile.visual.spec.ts-snapshots, e2e/app-overlays.visual.spec.ts-snapshots
- Do not revert unrelated changes.
- Do not edit outside the write scope unless needed; if needed, stop and explain why.

Implementation:
1. Retune the light-mode shell, surface, and accent token spine toward a warmer palette while preserving dark mode behavior.
2. Make the light-mode brandmark and wordmark theme-aware so they consume the warmer palette instead of hardcoded neon colors.
3. Restore hollow ring-style note bubbles for standard light mode and warm the degree-color mode path intentionally rather than leaving it untouched.
4. Tune the light-mode fretboard wood, grain, vignette, and inlay treatment toward a clearer maple read without changing geometry or structure.
5. Update the light-mode contract expectations and refresh only the affected light-mode visual snapshots.

Verification:
- Run: npm run lint
- Run: npm run test
- Run: npm run test:e2e -- e2e/theme-contract.spec.ts
- Run: npm run test:visual

Git/PR:
- Commit: `feat: warm light mode palette and fretboard materials`
- Run `cr review --agent` after local verification and before push/PR; address actionable findings or explain unresolved findings.
- Create a PR with base `main`.
- Suggested PR title: `feat: warm light mode palette and fretboard materials`
- PR body: Summary:\n- warm the light-mode token spine and app gradient\n- make branding light-aware and restore hollow fretboard notes\n- tune maple fretboard materials and update affected light-mode tests/snapshots\n\nVerification:\n- npm run lint\n- npm run test\n- npm run test:e2e -- e2e/theme-contract.spec.ts\n- npm run test:visual\n\nRisks:\n- shared semantic accent tokens also affect chips, controls, and the circle of fifths\n- degree-color mode is intentionally included in this pass\n- visual snapshot churn is expected in light mode only

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
  MODEL=gemini-3.1-pro-preview
  EFFORT=high
  PROMPT_FILE=$(mktemp "${TMPDIR:-/tmp}/agent-prompt.XXXXXX")
  TTY_STATE=$({ stty -g < /dev/tty; } 2>/dev/null || true)

  cleanup_terminal() {
    rm -f "$PROMPT_FILE"
    if [ -n "$TTY_STATE" ]; then
      { stty "$TTY_STATE" < /dev/tty; } 2>/dev/null || { stty sane < /dev/tty; } 2>/dev/null || true
    else
      { stty sane < /dev/tty; } 2>/dev/null || true
    fi
    command reset 2>/dev/null || true
    printf '\033[?1049l\033[?47l\033[?1047l\033[0m\033[?25h\033[?1000l\033[?1002l\033[?1003l\033[?1006l\033[?2004l'
  }

  trap cleanup_terminal EXIT INT TERM

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

Task: Implement the warmer light-mode pass across shared tokens, branding, fretboard note styling, degree-color mode, maple fretboard materials, and the affected tests and light-mode snapshots in one sequential branch and PR.

Checkout discipline:
- Assigned checkout: /Users/isaaccocar/repos/fretboard-app
- Original repo: /Users/isaaccocar/repos/fretboard-app
- Expected branch: light-mode-warm-pass/feat-light-mode-palette
- Use the assigned checkout as the only repo checkout for reading and editing unless explicitly told otherwise.
- Do not open, inspect, run commands against, or edit the original repo path. Use relative paths from the assigned checkout.
- Before editing, run `pwd`, `git rev-parse --show-toplevel`, `git branch --show-current`, and `git status --short`.
- If root or branch is wrong, print `WARNING: wrong checkout or branch` with actual/expected values and stop.

Context:
- Use the R1 facts and aligned assumptions relevant to this task.
- Read context: docs/light-mode-audit-2026-04-30.md, docs/light-mode-next-step-prompt-2026-04-30.md, src/styles/themes.css, src/styles/semantic.css, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/hooks/useWoodGrainTexture.ts, src/components/BrandMark/BrandMark.tsx, src/components/FretFlowWordmark/FretFlowWordmark.tsx, src/core/degrees.ts, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts, e2e/app-components.visual.spec.ts, e2e/app-layout.visual.spec.ts, e2e/app-mobile.visual.spec.ts, e2e/app-overlays.visual.spec.ts

Ownership:
- You may edit: src/styles/themes.css, src/styles/semantic.css, src/styles/App.css, src/components/AppHeader/AppHeader.module.css, src/components/BrandMark/BrandMark.tsx, src/components/FretFlowWordmark/FretFlowWordmark.tsx, src/components/FretboardSVG/FretboardSVG.module.css, src/components/FretboardSVG/FretboardDefs.tsx, src/components/FretboardSVG/FretboardBackground.tsx, src/components/FretboardSVG/hooks/useWoodGrainTexture.ts, src/core/degrees.ts, public/favicon.svg, e2e/theme-contract.spec.ts, e2e/fretboard-svg.visual.spec.ts-snapshots, e2e/app-components.visual.spec.ts-snapshots, e2e/app-layout.visual.spec.ts-snapshots, e2e/app-mobile.visual.spec.ts-snapshots, e2e/app-overlays.visual.spec.ts-snapshots
- Do not revert unrelated changes.
- Do not edit outside the write scope unless needed; if needed, stop and explain why.

Implementation:
1. Retune the light-mode shell, surface, and accent token spine toward a warmer palette while preserving dark mode behavior.
2. Make the light-mode brandmark and wordmark theme-aware so they consume the warmer palette instead of hardcoded neon colors.
3. Restore hollow ring-style note bubbles for standard light mode and warm the degree-color mode path intentionally rather than leaving it untouched.
4. Tune the light-mode fretboard wood, grain, vignette, and inlay treatment toward a clearer maple read without changing geometry or structure.
5. Update the light-mode contract expectations and refresh only the affected light-mode visual snapshots.

Verification:
- Run: npm run lint
- Run: npm run test
- Run: npm run test:e2e -- e2e/theme-contract.spec.ts
- Run: npm run test:visual

Git/PR:
- Commit: `feat: warm light mode palette and fretboard materials`
- Run `cr review --agent` after local verification and before push/PR; address actionable findings or explain unresolved findings.
- Create a PR with base `main`.
- Suggested PR title: `feat: warm light mode palette and fretboard materials`
- PR body: Summary:\n- warm the light-mode token spine and app gradient\n- make branding light-aware and restore hollow fretboard notes\n- tune maple fretboard materials and update affected light-mode tests/snapshots\n\nVerification:\n- npm run lint\n- npm run test\n- npm run test:e2e -- e2e/theme-contract.spec.ts\n- npm run test:visual\n\nRisks:\n- shared semantic accent tokens also affect chips, controls, and the circle of fifths\n- degree-color mode is intentionally included in this pass\n- visual snapshot churn is expected in light mode only

Return:
- Files changed
- Verification results
- PR URL or branch name
- Blockers or assumptions
PROMPT

  if [ -n "$MODEL" ]; then gemini --yolo --model "$MODEL" --prompt-interactive "$(cat "$PROMPT_FILE")"; else gemini --yolo --prompt-interactive "$(cat "$PROMPT_FILE")"; fi
)
```

**Suggested Commit:** `feat: warm light mode palette and fretboard materials`

**Suggested PR Title:** `feat: warm light mode palette and fretboard materials`
