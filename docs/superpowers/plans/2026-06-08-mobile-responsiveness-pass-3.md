# Mobile Responsiveness Pass 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish mobile layouts across 10 reported issues using pure CSS overrides scoped to `[data-layout-tier="mobile"]` and one minor JSX wrapper div.

**Architecture:** Add specific CSS overrides nested under `:global(.app-container[data-layout-tier="mobile"])` or standard `@media` mobile queries, keeping existing layout code clean and non-mobile tiers completely unaffected. Use CSS-module string assertions in Vitest to drive the TDD implementation loop.

**Tech Stack:** React, CSS Modules, TypeScript, Vitest

---

### Task 1: Remove TransportBar / ProgressionTrack Divider

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionTrack.module.css`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside `src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts`:

```typescript
  it("removes top border on mobile track", () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "ProgressionTrack.module.css"),
      "utf8",
    );
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.track\s*\{[^}]*border-top:\s*none/s,
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts`
Expected: FAIL with no match found

- [ ] **Step 3: Write minimal implementation**

In `src/components/ProgressionTrack/ProgressionTrack.module.css`, add `border-top: none;` to the `.track` selector under the mobile tier override (around line 495):

```css
:global(.app-container[data-layout-tier="mobile"]) .track {
  border-top: none;
  padding: 0.5rem 0.55rem 0.45rem;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgressionTrack/ProgressionTrack.module.css src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts
git commit -m "style: remove top border on mobile track to eliminate double divider"
```

---

### Task 2: AppHeader Action Buttons: Tap Targets & Header Actions Gap

**Files:**
- Modify: `src/components/shared/shared.module.css`
- Modify: `src/components/shared/shared.test.tsx`
- Modify: `src/components/AppHeader/AppHeader.module.css`
- Create: `src/components/AppHeader/AppHeader.module.css.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test in `src/components/shared/shared.test.tsx` (inside `describe("shared.module.css responsive selectors")`):

```typescript
  it("defines 44px mobile override for .icon-button--sm", () => {
    expect(sharedCSS).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.icon-button--sm\s*\{[^}]*width:\s*var\(--size-touch-target\)/s,
    );
  });
```

And create `src/components/AppHeader/AppHeader.module.css.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("AppHeader.module.css", () => {
  it("tightens mobile actions gap to 0.15rem", () => {
    const css = readFileSync(join(__dirname, "AppHeader.module.css"), "utf8");
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.app-header-actions\s*\{[^}]*gap:\s*0\.15rem/s,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/shared/shared.test.tsx src/components/AppHeader/AppHeader.module.css.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

In `src/components/shared/shared.module.css`, add the mobile override for `.icon-button--sm` (around line 573):

```css
:global(.app-container[data-layout-tier="mobile"]) .icon-button--sm {
  width: var(--size-touch-target);   /* 2.75rem = 44px */
  height: var(--size-touch-target);
}
```

In `src/components/AppHeader/AppHeader.module.css`, change `gap: 0.3rem;` to `gap: 0.15rem;` in the `.app-header-actions` mobile block:

```css
:global(.app-container[data-layout-tier="mobile"]) .app-header-actions {
  order: 1;
  flex: 0 0 auto;
  gap: 0.15rem;
  max-width: 44vw;
  padding-inline-start: 0;
  border-inline-start: none;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/shared/shared.test.tsx src/components/AppHeader/AppHeader.module.css.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/shared.module.css src/components/shared/shared.test.tsx src/components/AppHeader/AppHeader.module.css src/components/AppHeader/AppHeader.module.css.test.ts
git commit -m "style: increase mobile AppHeader sm icon button touch targets and tighten actions gap"
```

---

### Task 3: Fretboard to Inspector Gap

**Files:**
- Modify: `src/styles/App.css`
- Create: `src/styles/__tests__/appCss.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/styles/__tests__/appCss.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("App.css layout", () => {
  it("uses 0.35rem gap for app-container on mobile viewports", () => {
    const css = readFileSync(join(__dirname, "../App.css"), "utf8");
    expect(css).toMatch(/@media\s*\(\s*max-width:\s*767px\s*\)\s*\{[^}]*\.app-container\s*\{[^}]*gap:\s*0\.35rem/s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/styles/__tests__/appCss.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

In `src/styles/App.css`, change `gap: 0.5rem;` to `gap: 0.35rem;` (around line 72):

```css
/* Breakpoint aligned with data-layout-tier="mobile" (< 768px) */
@media (max-width: 767px) {
  .app-container {
    padding: 0.65rem;
    padding-bottom: 3.5rem;
    gap: 0.35rem;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/styles/__tests__/appCss.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/styles/App.css src/styles/__tests__/appCss.test.ts
git commit -m "style: reduce gap between fretboard and inspector on mobile to 0.35rem"
```

---

### Task 4: Progression Card Header Toolbar Button Sizes

**Files:**
- Modify: `src/components/SongControls/SongControls.module.css`
- Modify: `src/components/SongControls/SongControls.module.css.test.ts`

- [ ] **Step 1: Write the failing test**

Add these tests inside `src/components/SongControls/SongControls.module.css.test.ts`:

```typescript
  it("defines mobile progression toolbar button size overrides", () => {
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.toolbar-button\s*\{[^}]*width:\s*var\(--control-height\)/s,
    );
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.delete-button\s*\{[^}]*width:\s*var\(--control-height\)/s,
    );
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.grouped-button\s*\{[^}]*height:\s*var\(--control-height\)/s,
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/SongControls/SongControls.module.css.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

In `src/components/SongControls/SongControls.module.css`, add these mobile overrides at the end of the mobile block (around line 534):

```css
:global(.app-container[data-layout-tier="mobile"]) .toolbar-button {
  width: var(--control-height);
  padding: 0;
}

:global(.app-container[data-layout-tier="mobile"]) .delete-button {
  width: var(--control-height);
  padding: 0;
  margin-left: 0;
}

:global(.app-container[data-layout-tier="mobile"]) .grouped-button {
  height: var(--control-height);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/SongControls/SongControls.module.css.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/SongControls.module.css src/components/SongControls/SongControls.module.css.test.ts
git commit -m "style: enforce square toolbar and delete buttons, and proper grouped-button height on mobile"
```

---

### Task 5: Quality Row: Collapse to One Row + Icon-Only Lock

**Files:**
- Modify: `src/components/SongControls/SongControls.module.css`
- Modify: `src/components/SongControls/SongControls.tsx`
- Modify: `src/components/SongControls/SongControls.module.css.test.ts`

- [ ] **Step 1: Write the failing test**

Add these tests inside `src/components/SongControls/SongControls.module.css.test.ts`:

```typescript
  it("defines mobile root-quality flex row, lock-label sr-only, and lock-toggle size overrides", () => {
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.root-quality-row\s*\{[^}]*display:\s*flex/s,
    );
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.lock-label\s*\{[^}]*clip-path:\s*inset\(50%\)/s,
    );
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.lock-toggle\s*\{[^}]*width:\s*var\(--control-height\)/s,
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/SongControls/SongControls.module.css.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

In `src/components/SongControls/SongControls.module.css`, add the following overrides at the end of the mobile block:

```css
:global(.app-container[data-layout-tier="mobile"]) .root-quality-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

:global(.app-container[data-layout-tier="mobile"]) .lock-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border-width: 0;
}

:global(.app-container[data-layout-tier="mobile"]) .lock-toggle {
  width: var(--control-height);
  padding: 0;
  flex-shrink: 0;
}
```

In `src/components/SongControls/SongControls.tsx`, wrap the Root and Quality sections inside the `<div className={styles["root-quality-row"]}>` (around line 445):

```tsx
                  <div className={styles["editor-grid"]}>
                    <div className={styles["root-quality-row"]}>
                      <div className={shared["control-section"]}>
                        <div className={styles["field-label-row"]}>
                          <span className={styles["field-label"]}>{t("controls.chordRootLabel")}</span>
                        </div>
                        <LabeledSelect
                          label={t("controls.chordRootLabel")}
                          hideLabel
                          width="fixed"
                          widthValue="9rem"
                          value={activeResolvedProgressionStep?.root ?? rootNote}
                          groups={chordRootGroups}
                          onChange={(note) => {
                            const { inScale, numeral } = classifyRoot(scaleName, rootNote, note, preferFlats);
                            selectProgressionStepRoot({ id: activeStep.id, root: note, numeral, inScale });
                          }}
                          data-testid="chord-root-select"
                        />
                      </div>
                      <div className={shared["control-section"]}>
                        <div className={styles["field-label-row"]}>
                          <span className={styles["field-label"]}>{t("controls.quality")}</span>
                        </div>
                        <div className={styles["quality-row"]}>
                          <LabeledSelect
                            label={t("controls.quality")}
                            hideLabel
                            width="fixed"
                            widthValue="7rem"
                            accentValue={qualityLock}
                            data-testid="quality-select"
                            value={
                              activeStep?.qualityOverride
                              ?? activeResolvedProgressionStep?.quality
                              ?? activeResolvedProgressionStep?.diatonicQuality
                              ?? ""
                            }
                            onChange={(quality) =>
                              updateProgressionStepQuality({
                                id: activeStep.id,
                                qualityOverride: quality,
                              })
                            }
                            groups={qualityGroups}
                          />
                          <button
                            type="button"
                            className={clsx(
                              shared["surface--control"],
                              styles["lock-toggle"],
                              { [styles["lock-toggle--on"]]: qualityLock },
                            )}
                            aria-pressed={qualityLock}
                            aria-label={t("controls.lockQuality")}
                            title={t("controls.lockQualityHint")}
                            onClick={() => setQualityLock(!qualityLock)}
                            data-testid="quality-lock-toggle"
                          >
                            {qualityLock
                              ? <Lock size={13} aria-hidden="true" />
                              : <LockOpen size={13} aria-hidden="true" />}
                            <span className={styles["lock-label"]}>
                              {qualityLock ? t("controls.lockLocked") : t("controls.lockAdapts")}
                            </span>
                          </button>
                        </div>
                        <p className={styles["lock-hint"]}>{lockHint}</p>
                      </div>
                    </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/SongControls/SongControls.module.css.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/SongControls.module.css src/components/SongControls/SongControls.tsx src/components/SongControls/SongControls.module.css.test.ts
git commit -m "feat: collapse Root and Quality controls to a single row on mobile with icon-only lock toggle"
```

---

### Task 6: Editor Pager Navigation: Tap Target Size

**Files:**
- Modify: `src/components/SongControls/SongControls.module.css`
- Modify: `src/components/SongControls/SongControls.module.css.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside `src/components/SongControls/SongControls.module.css.test.ts`:

```typescript
  it("defines mobile editor pager button size", () => {
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.pager-button\s*\{[^}]*width:\s*var\(--control-height\)/s,
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/SongControls/SongControls.module.css.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

In `src/components/SongControls/SongControls.module.css`, add the mobile override for `.pager-button` inside the mobile tier block:

```css
:global(.app-container[data-layout-tier="mobile"]) .pager-button {
  width: var(--control-height);
  height: var(--control-height);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/SongControls/SongControls.module.css.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/SongControls.module.css src/components/SongControls/SongControls.module.css.test.ts
git commit -m "style: enforce 44px tap targets for pager buttons on mobile"
```

---

### Task 7: Duration Row: Stepper vs. ToggleBar Height Mismatch

**Files:**
- Modify: `src/components/StepperControl/StepperControl.module.css`
- Modify: `src/components/ToggleBar/ToggleBar.module.css`
- Create: `src/components/StepperControl/StepperControl.module.css.test.ts`
- Create: `src/components/ToggleBar/ToggleBar.module.css.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/StepperControl/StepperControl.module.css.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("StepperControl.module.css", () => {
  it("uses --control-height token in mobile stepper-btn", () => {
    const css = readFileSync(join(__dirname, "StepperControl.module.css"), "utf8");
    expect(css).toMatch(
      /\.stepper-control\.mobile\s+\.stepper-btn\s*\{[^}]*min-height:\s*var\(--control-height\)/s,
    );
  });
});
```

Create `src/components/ToggleBar/ToggleBar.module.css.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("ToggleBar.module.css", () => {
  it("uses --control-height token in mobile-tab min-height", () => {
    const css = readFileSync(join(__dirname, "ToggleBar.module.css"), "utf8");
    expect(css).toMatch(
      /\.mobile-tab-bar\s+\.mobile-tab\s*\{[^}]*min-height:\s*var\(--control-height\)/s,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/StepperControl/StepperControl.module.css.test.ts src/components/ToggleBar/ToggleBar.module.css.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

In `src/components/StepperControl/StepperControl.module.css`, update `.stepper-control.mobile .stepper-btn` override (around line 59) to use `var(--control-height)`:

```css
.stepper-control.mobile .stepper-btn {
  min-height: var(--control-height);
  min-width: var(--control-height);
}
```

In `src/components/ToggleBar/ToggleBar.module.css`, replace the hardcoded `2.85rem` with `var(--control-height)` in `.mobile-tab-bar .mobile-tab` (around line 16):

```css
.mobile-tab-bar .mobile-tab {
  flex: 1;
  min-height: var(--control-height);
  padding: 0.45rem 0.6rem;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/StepperControl/StepperControl.module.css.test.ts src/components/ToggleBar/ToggleBar.module.css.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/StepperControl/StepperControl.module.css src/components/StepperControl/StepperControl.module.css.test.ts src/components/ToggleBar/ToggleBar.module.css src/components/ToggleBar/ToggleBar.module.css.test.ts
git commit -m "style: link Stepper and ToggleBar mobile heights to the --control-height token"
```

---

### Task 8: LabeledSelect Dropdown Items: Tap Target

**Files:**
- Modify: `src/components/LabeledSelect/LabeledSelect.module.css`
- Modify: `src/components/LabeledSelect/LabeledSelect.module.css.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside `src/components/LabeledSelect/LabeledSelect.module.css.test.ts`:

```typescript
  it("defines mobile item height override", () => {
    const css = readFileSync(join(__dirname, "LabeledSelect.module.css"), "utf8");
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.labeled-select-item\s*\{[^}]*min-height:\s*var\(--control-height\)/s,
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/LabeledSelect/LabeledSelect.module.css.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

In `src/components/LabeledSelect/LabeledSelect.module.css`, add the mobile override for `.labeled-select-item` at the end of the file:

```css
:global(.app-container[data-layout-tier="mobile"]) .labeled-select-item {
  min-height: var(--control-height);
  padding-block: 0.6rem;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/LabeledSelect/LabeledSelect.module.css.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/LabeledSelect/LabeledSelect.module.css src/components/LabeledSelect/LabeledSelect.module.css.test.ts
git commit -m "style: increase mobile dropdown item height to --control-height"
```

---

### Task 9: InspectorCard Head: Empty Placeholder Span + Toolbar Ordering

**Files:**
- Modify: `src/components/Inspector/InspectorCard.module.css`
- Modify: `src/components/Inspector/Inspector.module.css.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside `src/components/Inspector/Inspector.module.css.test.ts`:

```typescript
  it("defines mobile cardHeadActions order and flex behavior", () => {
    const css = readFileSync(
      join(__dirname, "Inspector.module.css"),
      "utf8",
    );
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.cardHeadActions\s*\{[^}]*order:\s*3/s,
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/Inspector/Inspector.module.css.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

In `src/components/Inspector/InspectorCard.module.css`, modify the mobile block for `.cardHeadActions` (around line 96):

```css
:global(.app-container[data-layout-tier="mobile"]) .cardHeadActions {
  order: 3;
  flex: 1 1 100%;
  justify-content: flex-end;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/Inspector/Inspector.module.css.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Inspector/InspectorCard.module.css src/components/Inspector/Inspector.module.css.test.ts
git commit -m "style: refine mobile inspector head layout to handle empty description placeholder and wrap actions toolbar"
```

---

### Task 10: Editor Panel Header: Overflow on Narrow Screens

**Files:**
- Modify: `src/components/SongControls/SongControls.module.css`
- Modify: `src/components/SongControls/SongControls.module.css.test.ts`

- [ ] **Step 1: Write the failing test**

Add these tests inside `src/components/SongControls/SongControls.module.css.test.ts`:

```typescript
  it("defines mobile editor panel header wrapping and pager order", () => {
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.editor-panel-header\s*\{[^}]*flex-wrap:\s*wrap/s,
    );
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.editor-pager\s*\{[^}]*order:\s*3/s,
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/SongControls/SongControls.module.css.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

In `src/components/SongControls/SongControls.module.css`, add the mobile overrides for `.editor-panel-header` and `.editor-pager` inside the mobile tier block:

```css
:global(.app-container[data-layout-tier="mobile"]) .editor-panel-header {
  flex-wrap: wrap;
  row-gap: 0.35rem;
  align-items: flex-start;
}

:global(.app-container[data-layout-tier="mobile"]) .editor-pager {
  order: 3;
  flex: 1 1 100%;
  justify-content: center;
  margin-left: 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/SongControls/SongControls.module.css.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/SongControls.module.css src/components/SongControls/SongControls.module.css.test.ts
git commit -m "style: wrap editor panel header and center pager on a new row on mobile"
```
