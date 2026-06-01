# Header Icon Button Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make header icon buttons (theme toggle, settings, mute, help) visually consistent with the rest of the app's `--dc-*` ghost-style controls.

**Architecture:** Single CSS change in `shared.module.css` — swap `.icon-button` from `surface--chrome` compose to `surface--control` compose, update color/hover/active tokens to match the `--dc-*` system used by ToggleBar, Stepper, NoteGrid, LabeledSelect.

**Tech Stack:** CSS Modules, CSS custom properties

---

### Task 1: Update .icon-button styling in shared.module.css

**Files:**
- Modify: `src/components/shared/shared.module.css:519-567`

- [ ] **Step 1: Apply the CSS changes**

Replace the `.icon-button` block (lines 519-567) with the updated version:

```css
/* Icon Button - shared circular button chrome for header, modal close, etc. */
.icon-button {
  composes: surface--control;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
  color: var(--dc-fg);
}

.icon-button:hover {
  color: var(--dc-fg-strong);
}

.icon-button:active {
  transform: scale(0.96);
}

.icon-button:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

:global([data-theme="modern-dark"]) .icon-button:focus-visible {
  outline: var(--control-focus-ring);
  box-shadow: var(--control-focus-inset);
}

/* stylelint-disable selector-pseudo-class-no-unknown */
.icon-button :global(.icon) {
  width: 1.18rem;
  height: 1.18rem;
  color: inherit;
}

.icon-button :global(.icon-muted) {
  color: var(--dc-fg-muted);
}

.icon-button :global(.icon-active) {
  color: var(--dc-fg-strong);
}

/* Size variants: sm / md (default) */
.icon-button--sm { width: 2rem;    height: 2rem;    }
.icon-button--md { width: 2.75rem; height: 2.75rem; }

.icon-button--sm :global(.icon) { width: 1rem;    height: 1rem;    }
/* stylelint-enable selector-pseudo-class-no-unknown */
```

- [ ] **Step 2: Verify the build still compiles**

Run: `pnpm run build`
Expected: Clean exit, no errors.

- [ ] **Step 3: Run linter**

Run: `pnpm run lint`
Expected: No stylelint or eslint errors.

- [ ] **Step 4: Run unit tests**

Run: `pnpm run test`
Expected: All tests pass.

- [ ] **Step 5: Update visual snapshots**

Run: `pnpm run test:visual:update`
Expected: Visual snapshots update to reflect new button styling.

- [ ] **Step 6: Run visual tests to confirm**

Run: `pnpm run test:visual`
Expected: All visual tests pass (snapshots match updated baselines).

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/shared.module.css
git commit -m "fix(ui): align header icon buttons with --dc-* control styling"
```
