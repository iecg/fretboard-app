# Mobile Progression Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep progressions longer than four chords readable and selectable on mobile without breaking ruler/playhead alignment.

**Architecture:** Add a mobile horizontal-scroll timeline width model driven by a minimum chord block width. Keep existing percent-based block and playhead math inside the widened timeline so audio/visual alignment remains unchanged.

**Tech Stack:** React, CSS Modules, Playwright visual tests, Vitest

---

## File Structure

- `src/components/ProgressionTrack/ProgressionTrack.tsx`: computes mobile-friendly timeline width CSS variables from rendered progression length.
- `src/components/ProgressionTrack/ProgressionTrack.module.css`: owns mobile timeline overflow and minimum block width.
- `src/components/ProgressionTrack/ProgressionTrack.test.tsx`: verifies long progressions expose the width variable.
- `e2e/progression.visual.spec.ts`: adds a mobile long-progression visual state.

### Task 1: Add Long-Progression Test Coverage

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionTrack.test.tsx`

- [ ] **Step 1: Add a long-progression render test**

Add a test that seeds at least eight one-bar progression steps and asserts the timeline receives the expected CSS variable. Use existing test helpers in this file; if the file already has a render helper, reuse it.

```tsx
it("sets a mobile minimum timeline width from the progression length", () => {
  renderWithAtoms(<ProgressionTrack />, {
    progressionSteps: [
      { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "two", degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "three", degree: "iii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "four", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "five", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "six", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "seven", degree: "vii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "eight", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    ],
  });

  expect(screen.getByLabelText("Progression timeline")).toHaveStyle({
    "--mobile-min-chord-count": "8",
  });
});
```

- [ ] **Step 2: Run the focused test**

Run: `pnpm test src/components/ProgressionTrack/ProgressionTrack.test.tsx -t "minimum timeline width"`

Expected before implementation: FAIL because `--mobile-min-chord-count` is missing.

- [ ] **Step 3: Commit the failing test only if your workflow allows red commits**

If red commits are not allowed, keep this test uncommitted until Task 2. If allowed:

```bash
git add src/components/ProgressionTrack/ProgressionTrack.test.tsx
git commit -m "test(mobile): cover long progression track width"
```

### Task 2: Add Mobile Timeline Width Variable

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx`

- [ ] **Step 1: Add the CSS variable to the timeline style**

In `ProgressionTrack.tsx`, extend the timeline `style` object:

```tsx
        style={{
          "--bar-count": totalBarsForDisplay,
          "--beats-per-bar": subdivisionsPerBar,
          "--mobile-min-chord-count": Math.max(stepAtoms.length, 1),
        } as CSSProperties}
```

- [ ] **Step 2: Run the focused test**

Run: `pnpm test src/components/ProgressionTrack/ProgressionTrack.test.tsx -t "minimum timeline width"`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProgressionTrack/ProgressionTrack.tsx src/components/ProgressionTrack/ProgressionTrack.test.tsx
git commit -m "fix(mobile): expose progression track chord count"
```

### Task 3: Add Mobile Horizontal Track Width

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionTrack.module.css`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts`

- [ ] **Step 1: Add mobile overflow containment**

In `ProgressionTrack.module.css`, add:

```css
:global(.app-container[data-layout-tier="mobile"]) .track {
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  padding-inline: 0.5rem;
}
```

- [ ] **Step 2: Add mobile timeline minimum width**

Add:

```css
:global(.app-container[data-layout-tier="mobile"]) .timeline {
  min-width: max(
    100%,
    calc(var(--mobile-min-chord-count, 1) * 5.25rem)
  );
}
```

- [ ] **Step 3: Add a CSS-module regression assertion**

In `src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts`, add:

```ts
it("gives mobile progression timelines a chord-count based minimum width", () => {
  expect(css).toMatch(/data-layout-tier="mobile"[\s\S]*\.timeline[\s\S]*--mobile-min-chord-count/);
});
```

Use the same raw CSS import name already used in that test file.

- [ ] **Step 4: Run CSS and component tests**

Run: `pnpm test src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts src/components/ProgressionTrack/ProgressionTrack.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgressionTrack/ProgressionTrack.module.css src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts
git commit -m "fix(mobile): allow long progression track scrolling"
```

### Task 4: Add Long Mobile Visual State

**Files:**
- Modify: `e2e/progression.visual.spec.ts`

- [ ] **Step 1: Add an eight-chord mobile visual test**

Add this test inside `test.describe("Progression Visual", () => { ... })`:

```ts
  test("progression-mobile-long-390x844", async ({ page }) => {
    await loadVisualState(
      page,
      {
        progressionSteps: [
          { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "two", degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "three", degree: "iii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "four", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "five", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "7" },
          { id: "six", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "seven", degree: "vii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "eight", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        ],
      },
      { width: 390, height: 844 },
    );

    await expect(page.getByRole("group", { name: "Progression track" })).toBeVisible();
    await expectFullPageVisual(page, "progression-mobile-long-390x844", linuxTolerance);
  });
```

- [ ] **Step 2: Run the visual test**

Run: `pnpm run test:visual -- e2e/progression.visual.spec.ts -g "progression-mobile-long-390x844"`

Expected: PASS after creating or updating the new snapshot.

- [ ] **Step 3: Commit**

```bash
git add e2e/progression.visual.spec.ts e2e/progression.visual.spec.ts-snapshots
git commit -m "test(visual): add long mobile progression track"
```

