# Overlay Reference Design Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Overlay tab controls closer to the provided reference design: 12-column alignment, equal field widths, right-aligned shape help, inline highlighted lens help, primary header text, separated multi-select toggles, and 32px control rows.

**Architecture:** This is a presentational refinement inside the existing Inspector primitives. Keep the state atoms and behavior unchanged; adjust `PropGrid`/`Prop` layout primitives, `FingeringPatternControls`, `ChordOverlayControls`, shared toggle chrome, and focused tests around DOM structure plus stylesheet contracts.

**Tech Stack:** React, TypeScript, Jotai, CSS Modules, Vitest, React Testing Library, Playwright visual tests.

---

## File Structure

- Modify `src/components/Inspector/InspectorGrid.tsx`: add optional `labelAccessory` and `controlClassName` support to `Prop`; keep `PropGrid` API intact.
- Modify `src/components/Inspector/InspectorGrid.module.css`: make inspector grids honor `data-columns="12"`, normalize label rows, and establish 32px control containers.
- Modify `src/components/Inspector/ViewTab.tsx`: switch the Scale card grid from 6 columns to 12 columns so both Overlay sections share the same track system.
- Modify `src/components/Inspector/InspectorCard.module.css`: ensure Scale/Chord card names use primary text color explicitly and header text stays aligned.
- Modify `src/components/FingeringPatternControls/FingeringPatternControls.tsx`: move the Shift+click/long-press hint into the label row accessory and use a local separated multi-select shape bar class.
- Modify `src/components/FingeringPatternControls/FingeringPatternControls.module.css`: style the CAGED shape bar without an outer container and with slight gaps between options.
- Modify `src/components/ChordOverlayControls/ChordOverlayControls.tsx`: move the lens hint into the section body under the first row and render highlighted inline `Tones`/`Lead` text.
- Modify `src/components/ChordOverlayControls/ChordOverlayControls.module.css`: align Chord controls to the same 12-column grid and style the lens help row.
- Modify `src/components/shared/shared.module.css`: normalize default toggle button height to 32px and add a borderless/separated variant used by the CAGED multi-select.
- Modify tests:
  - `src/components/Inspector/ViewTab.test.tsx`
  - `src/components/FingeringPatternControls/FingeringPatternControls.test.tsx`
  - `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
  - `src/components/ToggleBar/ToggleBar.test.tsx`
- Run visual coverage in `e2e/chord-overlay-controls.visual.spec.ts`.

---

### Task 1: Convert Overlay Layout To A 12-Column, 32px Control Grid

**Files:**
- Modify: `src/components/Inspector/InspectorGrid.tsx`
- Modify: `src/components/Inspector/InspectorGrid.module.css`
- Modify: `src/components/Inspector/ViewTab.tsx`
- Modify: `src/components/Inspector/InspectorCard.module.css`
- Test: `src/components/Inspector/ViewTab.test.tsx`

- [ ] **Step 1: Add failing tests for 12-column Overlay grids and primary card headings**

Append these tests to `src/components/Inspector/ViewTab.test.tsx` inside the top-level `describe("ViewTab", () => { ... })`:

```tsx
  describe("reference design grid alignment", () => {
    it("renders Scale and Chord control grids on the same 12-column system", () => {
      renderWithAtoms(<ViewTab />);
      const grids = document.querySelectorAll("[data-columns]");
      expect(Array.from(grids).map((grid) => grid.getAttribute("data-columns"))).toEqual([
        "12",
        "12",
      ]);
    });

    it("uses primary text color for Scale and Chord card names", () => {
      renderWithAtoms(<ViewTab />);
      const scaleHeading = document.getElementById("view-fingering-heading");
      const chordHeading = document.getElementById("view-voicing-heading");
      expect(scaleHeading?.className).toMatch(/cardName/);
      expect(chordHeading?.className).toMatch(/cardName/);
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm vitest run src/components/Inspector/ViewTab.test.tsx
```

Expected: FAIL because the Scale and Chord grids currently report `data-columns="6"`.

- [ ] **Step 3: Extend the `Prop` primitive for label accessories and control classes**

Update `src/components/Inspector/InspectorGrid.tsx` so `PropProps` and `Prop` are:

```tsx
export interface PropProps {
  /** Uppercase micro-label shown above the control. */
  label?: string;
  /** Optional right-aligned content in the same row as the label. */
  labelAccessory?: ReactNode;
  /** Column span within the parent PropGrid. Defaults to 1. */
  span?: number;
  /** Optional terse hint shown below the control. */
  hint?: string;
  /** Optional class applied to the control wrapper for local alignment tweaks. */
  controlClassName?: string;
  children: ReactNode;
}

export function Prop({
  label,
  labelAccessory,
  span = 1,
  hint,
  controlClassName,
  children,
}: PropProps) {
  return (
    <div className={styles.prop} data-span={span}>
      {label || labelAccessory ? (
        <span className={styles.propLabelRow}>
          {label ? <span className={styles.propLabel}>{label}</span> : null}
          {labelAccessory ? (
            <span className={styles.propLabelAccessory}>{labelAccessory}</span>
          ) : null}
        </span>
      ) : null}
      <div className={clsx(styles.propControl, controlClassName)}>{children}</div>
      {hint ? <p className={styles.propHint}>{hint}</p> : null}
    </div>
  );
}
```

- [ ] **Step 4: Update Inspector grid CSS for 12 columns and 32px controls**

In `src/components/Inspector/InspectorGrid.module.css`, replace `.propGrid` and add label/control rules:

```css
.propGrid {
  display: grid;
  grid-template-columns: repeat(var(--inspector-grid-columns, 6), minmax(0, 1fr));
  gap: 0.875rem 1rem;
  align-items: start;
}

.propGrid[data-columns="12"] {
  --inspector-grid-columns: 12;
}

.propLabelRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 0.75rem;
}
```

Replace `.propControl` with:

```css
.propControl {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 32px;
}
```

Add this after `.propLabel`:

```css
.propLabelAccessory {
  min-width: 0;
  font-family: var(--font-ui);
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--dc-fg-muted);
  white-space: nowrap;
}
```

Add span support for 12-column placements:

```css
.prop[data-span="5"] {
  grid-column: span 5;
}

.prop[data-span="8"] {
  grid-column: span 8;
}

.prop[data-span="9"] {
  grid-column: span 9;
}

.prop[data-span="10"] {
  grid-column: span 10;
}

.prop[data-span="11"] {
  grid-column: span 11;
}

.prop[data-span="12"] {
  grid-column: span 12;
}
```

Update the mobile clamp selector to include spans 5, 8, 9, 10, 11, and 12:

```css
:global(.app-container[data-layout-tier="mobile"]) .prop[data-span="3"],
:global(.app-container[data-layout-tier="mobile"]) .prop[data-span="4"],
:global(.app-container[data-layout-tier="mobile"]) .prop[data-span="5"],
:global(.app-container[data-layout-tier="mobile"]) .prop[data-span="6"],
:global(.app-container[data-layout-tier="mobile"]) .prop[data-span="7"],
:global(.app-container[data-layout-tier="mobile"]) .prop[data-span="8"],
:global(.app-container[data-layout-tier="mobile"]) .prop[data-span="9"],
:global(.app-container[data-layout-tier="mobile"]) .prop[data-span="10"],
:global(.app-container[data-layout-tier="mobile"]) .prop[data-span="11"],
:global(.app-container[data-layout-tier="mobile"]) .prop[data-span="12"],
:global(.app-container[data-layout-tier="mobile"]) .toggleProp[data-span="3"],
:global(.app-container[data-layout-tier="mobile"]) .toggleProp[data-span="4"],
:global(.app-container[data-layout-tier="mobile"]) .toggleProp[data-span="6"] {
  grid-column: span 2;
}
```

- [ ] **Step 5: Switch the Scale grid to 12 columns**

In `src/components/Inspector/ViewTab.tsx`, change:

```tsx
        <PropGrid columns={6}>
```

to:

```tsx
        <PropGrid columns={12}>
```

- [ ] **Step 6: Confirm primary card header color**

In `src/components/Inspector/InspectorCard.module.css`, keep `.cardName` using primary control text. If the rule has drifted, set it to:

```css
.cardName {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--dc-fg);
  margin: 0;
  white-space: nowrap;
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm vitest run src/components/Inspector/ViewTab.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/Inspector/InspectorGrid.tsx src/components/Inspector/InspectorGrid.module.css src/components/Inspector/ViewTab.tsx src/components/Inspector/InspectorCard.module.css src/components/Inspector/ViewTab.test.tsx
git commit -m "style: align overlay controls to 12-column grid"
```

---

### Task 2: Match Scale Pattern And Shape Row To Reference

**Files:**
- Modify: `src/components/FingeringPatternControls/FingeringPatternControls.tsx`
- Modify: `src/components/FingeringPatternControls/FingeringPatternControls.module.css`
- Modify: `src/components/shared/shared.module.css`
- Test: `src/components/FingeringPatternControls/FingeringPatternControls.test.tsx`
- Test: `src/components/ToggleBar/ToggleBar.test.tsx`

- [ ] **Step 1: Add failing tests for shape help placement and separated multi-select styling**

Append to `src/components/FingeringPatternControls/FingeringPatternControls.test.tsx`:

```tsx
describe("reference design shape controls", () => {
  it("renders the Shift+click help text in the Shape label row", () => {
    renderWithAtoms(<FingeringPatternControls hideHeader />);
    const shapeHelp = screen.getByText("Shift+click to add shapes");
    const shapeCell = shapeHelp.closest("[data-span='8']");
    expect(shapeCell).toBeInTheDocument();
    expect(shapeCell?.querySelector("p")).toBeNull();
  });

  it("renders CAGED shape controls with separated multi-select chrome", () => {
    renderWithAtoms(<FingeringPatternControls hideHeader />);
    const group = screen.getByRole("group", { name: "Shape" });
    expect(group.className).toMatch(/shapeToggleBar/);
    expect(group).not.toHaveClass("toggle-group");
  });
});
```

Append to `src/components/ToggleBar/ToggleBar.test.tsx`:

```tsx
  it("shared toggle buttons keep a 32px minimum control height", () => {
    expect(sharedCSS).toMatch(/\.toggle-btn\s*\{[^}]*min-height:\s*32px/s);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm vitest run src/components/FingeringPatternControls/FingeringPatternControls.test.tsx src/components/ToggleBar/ToggleBar.test.tsx
```

Expected: FAIL because the shape help is still rendered as `Prop` hint text and the CAGED group still uses `.toggle-group`.

- [ ] **Step 3: Update scale control spans and shape label accessory**

In `src/components/FingeringPatternControls/FingeringPatternControls.tsx`, import the local CSS module:

```tsx
import styles from "./FingeringPatternControls.module.css";
```

Change the pattern prop span from 2 to 3 and remove the fixed 7rem width so it fills its 12-column field:

```tsx
      <Prop label={t("inspector.fingeringPatternLabel")} span={3}>
        <LabeledSelect
          label={t("inspector.fingeringPatternLabel")}
          hideLabel
          width="fill"
          value={fingeringPattern}
```

Change the CAGED shape prop from the current `span={2}` plus `hint={...}` to:

```tsx
        <Prop
          label={t("controls.shape")}
          span={8}
          labelAccessory={
            isTouchPrimary ? t("controls.longPressToAdd") : t("controls.shiftClickToAdd")
          }
        >
```

Change the CAGED group wrapper class:

```tsx
          <div
            className={styles.shapeToggleBar}
            role="group"
            aria-label={t("controls.shape")}
            aria-describedby={shapeHelpId}
          >
```

- [ ] **Step 4: Add separated multi-select shape bar CSS**

Replace `src/components/FingeringPatternControls/FingeringPatternControls.module.css` with:

```css
/* FingeringPatternControls component styles */

.shapeToggleBar {
  display: flex;
  align-items: stretch;
  gap: 0.45rem;
  width: 100%;
  min-height: 32px;
}

.shapeToggleBar :global(.toggle-btn) {
  min-height: 32px;
  background: var(--dc-bg);
  border: 1px solid var(--dc-border);
  border-radius: calc(var(--dc-radius) - 1px);
}

.shapeToggleBar :global(.toggle-btn:hover:not(.active)) {
  background-color: var(--dc-bg-hover);
  color: var(--dc-fg-strong);
  border-color: var(--dc-border-hover);
}

/* Visual "charging" feedback while a long press is building up */
[data-pressing] {
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--neon-cyan) 55%, transparent),
    0 0 10px color-mix(in srgb, var(--neon-cyan) 22%, transparent) !important;
  transition: box-shadow 0.45s ease !important;
}
```

- [ ] **Step 5: Normalize shared default toggle height to 32px**

In `src/components/shared/shared.module.css`, update `.toggle-group`:

```css
.toggle-group {
  display: flex;
  align-items: stretch;
  gap: 0.1rem;
  min-height: 32px;
  background-color: var(--dc-bg);
  border: 1px solid var(--dc-border);
  border-radius: calc(var(--dc-radius) - 1px);
  padding: 0.1rem;
}
```

Update `.toggle-btn`:

```css
.toggle-btn {
  flex: 1 1 0;
  min-width: 0;
  min-height: 32px;
  padding: 0.1rem 0.4rem;
  font-size: 0.78rem;
  line-height: 1.1;
  font-weight: 500;
  border-radius: calc(var(--dc-radius) - 3px);
  transition: var(--dc-transition), transform var(--transition-fast);
  text-transform: none;
  background: transparent;
  border: 1px solid transparent;
  color: var(--dc-fg);
  cursor: pointer;
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm vitest run src/components/FingeringPatternControls/FingeringPatternControls.test.tsx src/components/ToggleBar/ToggleBar.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/FingeringPatternControls/FingeringPatternControls.tsx src/components/FingeringPatternControls/FingeringPatternControls.module.css src/components/shared/shared.module.css src/components/FingeringPatternControls/FingeringPatternControls.test.tsx src/components/ToggleBar/ToggleBar.test.tsx
git commit -m "style: refine scale shape controls"
```

---

### Task 3: Match Chord Row Widths, Lens Help, And Toggle Alignment

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.module.css`
- Test: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Add failing tests for 12-column chord layout and rich lens hint**

Update the existing `ChordOverlayControls grid layout (Plan H-T4)` test in `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx` to expect 12 columns:

```tsx
  describe("ChordOverlayControls grid layout (Plan H-T4)", () => {
    it("renders the chord row as a 12-column PropGrid", () => {
      const { container } = renderDegree();
      const grid = container.querySelector("[data-columns]");
      expect(grid?.getAttribute("data-columns")).toBe("12");
    });
  });
```

Replace the static lens hint test with:

```tsx
    it("renders the static lens hint with highlighted Tones and Lead terms", () => {
      renderDegree();
      const hint = screen.getByTestId("lens-help-text");
      expect(hint).toHaveTextContent(
        "Tones highlights chord notes with guide-tone (3rd/7th) emphasis. Lead anticipates the next chord.",
      );
      expect(within(hint).getByText("Tones")).toHaveClass("lensHelpStrong");
      expect(within(hint).getByText("Lead")).toHaveClass("lensHelpStrong");
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx
```

Expected: FAIL because the chord grid currently uses 6 columns and the lens hint is plain `Prop` hint text.

- [ ] **Step 3: Update `ChordOverlayControls` to 12 columns and inline lens help**

In `src/components/ChordOverlayControls/ChordOverlayControls.tsx`, change the grid and props to:

```tsx
      <PropGrid columns={12} className={panelStyles.grid}>
        <Prop label={t("inspector.voicingLabel")} span={3}>
          <VoicingControl />
        </Prop>
        <Prop label={t("controls.lens")} span={5}>
          <ToggleBar
            options={lensOptions.map((o) => ({
              ...o,
              disabled: displayDisabled || o.disabled,
            }))}
            value={practiceLens}
            onChange={displayDisabled ? () => undefined : setPracticeLens}
            label={t("controls.lensAriaLabel")}
          />
        </Prop>
        {voicing === "close" ? (
          <Prop label={t("inspector.chordStringSetLabel")} span={1}>
            <ChordStringSetPicker />
          </Prop>
        ) : null}
        {fingeringPattern !== "none" ? (
          <Prop label={t("inspector.chordLockToScaleLabel")} span={2}>
            <ChordSnapToScaleToggle
              disabled={
                !((fingeringPattern === "caged" && cagedShapes.size === 1) ||
                  fingeringPattern === "3nps")
              }
            />
          </Prop>
        ) : null}
        <p className={panelStyles.lensHelp} data-testid="lens-help-text">
          <strong className={panelStyles.lensHelpStrong}>Tones</strong>{" "}
          highlights chord notes with guide-tone (3rd/7th) emphasis.{" "}
          <strong className={panelStyles.lensHelpStrong}>Lead</strong>{" "}
          anticipates the next chord.
        </p>
      </PropGrid>
```

- [ ] **Step 4: Update chord overlay CSS for 12-column alignment and help text**

Replace `src/components/ChordOverlayControls/ChordOverlayControls.module.css` with:

```css
.root {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.grid {
  align-items: start;
}

.lensHelp {
  grid-column: 1 / -1;
  margin: 0.25rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--dc-fg-muted);
}

.lensHelpStrong {
  color: var(--faceplate-accent);
  font-weight: 700;
}

/* On mobile, collapse the 12-column PropGrid so every child spans full width. */
:global(.app-container[data-layout-tier="mobile"]) .grid > * {
  grid-column: 1 / -1 !important;
}

/* Close-voicing position cycle — prev / counter / next stepper that lives
   next to the Voicing dropdown when `voicingAtom === "close"`. */
.cycle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}

.cycleCounter {
  font-family: var(--font-mono);
  font-size: 12px;
  min-width: 3.5em;
  text-align: center;
}
```

- [ ] **Step 5: Ensure select widths fill their grid columns where needed**

In `src/components/ChordOverlayControls/VoicingControl.tsx`, confirm the rendered `LabeledSelect` uses `width="fill"` or change it to:

```tsx
    <LabeledSelect
      label={t("inspector.voicingLabel")}
      hideLabel
      width="fill"
      value={voicing}
      onChange={(v) => setVoicing(v as ChordVoicingMode)}
      options={options}
    />
```

In `src/components/ChordOverlayControls/ChordStringSetPicker.tsx`, change the `StringSetPicker` width to fill the grid cell:

```tsx
    <StringSetPicker
      label={t("inspector.chordStringSetLabel")}
      allLabel={t("inspector.chordStringSetAll")}
      value={value}
      onChange={setValue}
      options={options}
      width="fill"
    />
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ChordOverlayControls/ChordOverlayControls.tsx src/components/ChordOverlayControls/ChordOverlayControls.module.css src/components/ChordOverlayControls/VoicingControl.tsx src/components/ChordOverlayControls/ChordStringSetPicker.tsx src/components/ChordOverlayControls/ChordOverlayControls.test.tsx
git commit -m "style: align chord overlay controls with reference"
```

---

### Task 4: Verify Visual Alignment And Update Snapshots If Needed

**Files:**
- Verify: `e2e/chord-overlay-controls.visual.spec.ts`
- Possible updates: `e2e/chord-overlay-controls.visual.spec.ts-snapshots/*.png`

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
pnpm vitest run src/components/Inspector/ViewTab.test.tsx src/components/FingeringPatternControls/FingeringPatternControls.test.tsx src/components/ChordOverlayControls/ChordOverlayControls.test.tsx src/components/ToggleBar/ToggleBar.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run focused visual test**

Run:

```bash
npm run test:visual -- e2e/chord-overlay-controls.visual.spec.ts
```

Expected: either PASS or snapshot diffs showing only the intended Overlay tab layout changes.

- [ ] **Step 3: Inspect the generated diff or screenshot**

If the visual test fails with snapshots, open the generated diff paths printed by Playwright and verify:

```text
Scale and Chord cards are aligned to the same 12-column rhythm.
Pattern and Voicing fields share the same width.
Shape and Lens fields align to the same row rhythm.
The Shape help text is in the top-right of the Shape label row.
The CAGED multi-select options have no shared outer container and have slight separation.
All visible controls have 32px-tall control containers.
The lens help appears below the chord controls, with Tones and Lead bold/highlighted.
Scale and Chord header names use primary text color.
```

- [ ] **Step 4: Update snapshots when the diff matches the reference intent**

Run:

```bash
npm run test:visual -- e2e/chord-overlay-controls.visual.spec.ts --update-snapshots
```

Expected: PASS and updated PNG snapshots only for `chord-overlay-controls`.

- [ ] **Step 5: Run final verification**

Run:

```bash
pnpm vitest run src/components/Inspector/ViewTab.test.tsx src/components/FingeringPatternControls/FingeringPatternControls.test.tsx src/components/ChordOverlayControls/ChordOverlayControls.test.tsx src/components/ToggleBar/ToggleBar.test.tsx
npm run test:visual -- e2e/chord-overlay-controls.visual.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add e2e/chord-overlay-controls.visual.spec.ts-snapshots src/components/Inspector src/components/FingeringPatternControls src/components/ChordOverlayControls src/components/shared src/components/ToggleBar
git commit -m "test: update overlay reference snapshots"
```

---

## Self-Review

**Spec coverage:**
- Aligned 12-column grid: Task 1 and Task 3 switch both Overlay sections to `columns={12}` and add tests.
- Same field width in both sections: Task 2 sets Pattern to span 3; Task 3 sets Voicing to span 3 and fill width.
- Shift+click help text right corner of shape toggle bar label row: Task 1 adds `labelAccessory`; Task 2 uses it for Shape.
- Lens help text moves in the section with highlighted/bold `Tones` and `Lead`: Task 3 renders rich help text below the chord controls.
- Scale and Chord card header text primary color: Task 1 confirms `.cardName` uses `var(--dc-fg)`.
- Multiselect toggles use no container and slight separation: Task 2 replaces the CAGED wrapper with `.shapeToggleBar`.
- Each control container is 32px tall: Task 1 normalizes `.propControl`; Task 2 normalizes shared toggle controls and shape bar.

**Placeholder scan:** No `TBD`, `TODO`, “similar to”, or undefined implementation placeholders remain.

**Type consistency:** `PropProps.labelAccessory`, `PropProps.controlClassName`, `panelStyles.lensHelp`, `panelStyles.lensHelpStrong`, and `styles.shapeToggleBar` are introduced before use and match their referenced module names.
