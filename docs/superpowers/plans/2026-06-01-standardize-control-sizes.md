# Standardize Control Sizes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the sizes of UI controls across the application using a responsive `--control-height` token (32px desktop, 44px mobile).

**Architecture:** We will update `src/styles/tokens.css` to define the responsive `--control-height` token. Then, we will find components and styles hardcoding sizes like `30px`, `32px` or `40px` for heights and replace them with `var(--control-height)` so everything scales seamlessly. We will also update related tests that explicitly check for hardcoded height values.

**Tech Stack:** React, CSS Modules, Vitest

---

### Task 1: Update CSS Tokens

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Write the failing test**
(Skipped, we will rely on visual and standard application build checks for root CSS changes).

- [ ] **Step 2: Update default and mobile tokens**
Modify `src/styles/tokens.css` to change the default `--control-height` from 30px to 32px, and the mobile query value from 40px to 44px.

```css
/* Replace the existing --control-height around line 23 */
  --control-height: 32px;
```

```css
/* Replace the mobile breakpoint --control-height around line 200 */
@media (max-width: 767px) {
  :root {
    --size-touch-target: 2.75rem; /* 44px */
    --control-height: 44px;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.css
git commit -m "style: update control-height token to responsive 32px/44px"
```

### Task 2: Refactor Shared Controls CSS and Tests

**Files:**
- Modify: `src/components/shared/shared.module.css`
- Modify: `src/components/shared/shared.test.tsx`
- Modify: `src/components/ToggleBar/ToggleBar.test.tsx`

- [ ] **Step 1: Update shared CSS**
In `src/components/shared/shared.module.css`, replace `height: 32px;` with `height: var(--control-height);` inside the `.toggle-group` block.

```css
/* Inside .toggle-group */
  height: var(--control-height);
```
*(Also update the WCAG comment referencing 32px to mention `var(--control-height)` if desired)*.

- [ ] **Step 2: Update shared.test.tsx regex**
In `src/components/shared/shared.test.tsx`, update the regex that expects `32px` to expect `var(--control-height)`.

```tsx
  it("toggle-group base height is the control height row", () => {
    // Toggle bars align with the inspector's field height.
    expect(sharedCSS).toMatch(/\.toggle-group[^{]*\{[^}]*height:\s*var\(--control-height\)/);
  });
```

- [ ] **Step 3: Update ToggleBar.test.tsx regex**
In `src/components/ToggleBar/ToggleBar.test.tsx`, update the regex similarly.

```tsx
  it("shared toggle group keeps a consistent control height", () => {
    expect(sharedCSS).toMatch(/\.toggle-group\s*\{[^}]*height:\s*var\(--control-height\)/s);
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/shared/shared.test.tsx src/components/ToggleBar/ToggleBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/shared.module.css src/components/shared/shared.test.tsx src/components/ToggleBar/ToggleBar.test.tsx
git commit -m "refactor: use control-height token in shared controls"
```

### Task 3: Refactor Inspector and SongControls CSS

**Files:**
- Modify: `src/components/Inspector/InspectorGrid.module.css`
- Modify: `src/components/SongControls/SongControls.module.css`

- [ ] **Step 1: Update InspectorGrid.module.css**
Replace `min-height: 32px;` and `height: 32px;` with `var(--control-height)` inside the inspector elements (like `.field-row` or similar).

```css
  min-height: var(--control-height);
```
```css
  height: var(--control-height);
```

- [ ] **Step 2: Update SongControls.module.css**
Replace `width: 32px;` with `width: var(--control-height);` on the square icon button controls.

```css
  width: var(--control-height);
```

- [ ] **Step 3: Run the component tests**

Run: `pnpm test src/components/Inspector/ src/components/SongControls/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/Inspector/InspectorGrid.module.css src/components/SongControls/SongControls.module.css
git commit -m "refactor: use control-height token in Inspector and SongControls"
```

### Task 4: Clean up obsolete comments in remaining controls

**Files:**
- Modify: `src/components/StepperControl/StepperControl.module.css`
- Modify: `src/components/Switch/Switch.module.css`

- [ ] **Step 1: Update StepperControl comment**
In `src/components/StepperControl/StepperControl.module.css`, replace the comment mentioning `32px` to refer to `control-height`.

```css
/* on each axis — a true square that keeps the shell at exactly var(--control-height). */
```

- [ ] **Step 2: Update Switch comment**
In `src/components/Switch/Switch.module.css`, replace the comment mentioning `32px`.

```css
/* peer of the control row it sits beside. Replaces ToggleBar for */
```

- [ ] **Step 3: Commit**

```bash
git add src/components/StepperControl/StepperControl.module.css src/components/Switch/Switch.module.css
git commit -m "docs: update css comments to refer to control-height token instead of hardcoded sizes"
```
