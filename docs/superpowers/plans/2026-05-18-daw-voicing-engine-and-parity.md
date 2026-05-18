# DAW Voicing Engine + Parity Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix eight parity-drift items between the shipped DAW shell and the `FretFlow DAW.html` mockup, then build a functional chord-voicing engine (Type / Inversion / String Set) for the Chord tab.

**Architecture:** Part 1 is a series of independent, mostly-CSS parity fixes plus three small component refactors. Part 2 adds a pure, pitch-aware voicing engine in `@fretflow/core`, three new Jotai atoms, a `ToggleBar` enhancement, a new `StringSetPicker` component, and wires them into the Chord tab's VOICING group. The engine coexists with the existing CAGED full-chord finder (Approach B): type `caged` routes to `getFullChordShapeMatches`, `drop2`/`triad` route to the new algorithmic search.

**Tech Stack:** React 19, TypeScript, Jotai, Vitest + Testing Library, CSS Modules, pnpm. Source spec: `docs/superpowers/specs/2026-05-18-daw-voicing-engine-and-parity-design.md`.

---

## File Structure

**Part 1 — Parity fixes**

- Modify `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — Chord-tab group structure (Task 1).
- Modify `src/components/Inspector/ViewTab.tsx` — DISPLAY status words (Task 2).
- Modify `src/components/ProgressionControls/ProgressionControls.tsx` — selected-chord Quality grid (Task 3).
- Modify `src/components/shared/shared.module.css`, `src/components/FretRangeControl/FretRangeControl.module.css` — control density (Tasks 4, 5).
- Modify `src/components/NoteGrid/NoteGrid.tsx` — 12-column root grid (Task 5).
- Modify `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css` — status-bar unpin (Task 6).
- Modify `src/components/Switch/Switch.module.css` — toggle-switch dimensions (Task 7).
- Modify `src/styles/themes.css` — light-theme palette retune (Task 8).
- Modify `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/types.ts` — new status-word strings (Task 2).

**Part 2 — Voicing engine**

- Create `packages/core/src/shapes/voicings.ts` — the voicing engine (Tasks 9-11).
- Create `packages/core/src/shapes/voicings.test.ts` — engine TDD (Tasks 9-11).
- Modify `packages/core/src/shapes/index.ts` — export the engine (Task 11).
- Modify `src/store/chordOverlayAtoms.ts` — voicing atoms (Task 12).
- Modify `src/components/ToggleBar/ToggleBar.tsx` — `disabledOptions` is already per-option (`option.disabled`); Task 13 confirms and adds a test.
- Create `src/components/Inspector/StringSetPicker.tsx` (+ `.module.css`, `.test.tsx`) — string-set card picker (Task 14).
- Modify `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — VOICING-group controls (Task 15).
- Modify `src/components/FretboardSVG/FretboardSVG.tsx` — make voicing `shape` optional (Task 16).
- Modify `src/i18n/en.ts`, `es.ts`, `types.ts` — voicing-control strings (Task 15).

---

## PART 1 — PARITY FIXES

### Task 1: Chord tab group structure

The Chord tab must show three group headers — SOURCE / CHORD TYPE / VOICING — and the Lens control must sit in SOURCE. Today the chord-type grid sits headerless inside SOURCE and Lens sits under a header keyed `groupDisplay`. The keys `inspector.groupChordType` and `inspector.groupVoicing` already exist (`src/i18n/en.ts`); `inspector.groupDisplay` stays (still used by `ViewTab`).

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Test: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `ChordOverlayControls.test.tsx` (adapt imports/`renderWithAtoms` to the file's existing helpers):

```tsx
it("renders SOURCE, CHORD TYPE and VOICING group headers in order", () => {
  renderWithAtoms(<ChordOverlayControls />, {
    initialValues: [[chordOverlayModeAtom, "manual"]],
  });
  const headers = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
  expect(headers).toEqual(["Source", "Chord Type", "Voicing"]);
});

it("places the Lens control inside the SOURCE group", () => {
  renderWithAtoms(<ChordOverlayControls />, {
    initialValues: [[chordOverlayModeAtom, "manual"]],
  });
  // Lens label appears before the CHORD TYPE header in DOM order.
  const lens = screen.getByText("Lens");
  const chordTypeHeader = screen.getByRole("heading", { name: "Chord Type" });
  expect(lens.compareDocumentPosition(chordTypeHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx -t "group headers"`
Expected: FAIL — only two headers render ("Source", "Display").

- [ ] **Step 3: Restructure the component**

In `ChordOverlayControls.tsx`, replace the `PropGrid` body (lines 149-269). The new order is: SOURCE header → Mode → Degree/Root → Lens; CHORD TYPE header → chord-type grid; VOICING header → Full Chords + Show on Board. Move the Lens `Prop` out of the `showDisplay` block into SOURCE; wrap the chord-type grid `Prop` in a `GroupHeader` keyed `groupChordType`; rename the third `GroupHeader` to `groupVoicing`.

```tsx
      <PropGrid columns={6} className={panelStyles.grid}>
        {/* ── SOURCE ───────────────────────────────────────────────────── */}
        <GroupHeader>{t("inspector.groupSource")}</GroupHeader>
        <Prop
          label={t("controls.chordMode")}
          span={3}
          hint={
            isPatternDisabled
              ? undefined
              : chordOverlayMode === "degree"
                ? t("controls.degreeModeHint")
                : chordOverlayMode === "manual"
                  ? t("controls.manualModeHint")
                  : undefined
          }
        >
          <ToggleBar
            options={[
              { value: "off", label: isPatternDisabled ? t("controls.disabled") : t("controls.off"), disabled: isPatternDisabled },
              { value: "degree", label: t("controls.degree"), disabled: isPatternDisabled },
              { value: "manual", label: t("controls.manual"), disabled: isPatternDisabled },
            ]}
            value={chordOverlayMode}
            onChange={isPatternDisabled ? () => undefined : setChordOverlayMode}
            label="Chord overlay mode"
          />
        </Prop>
        {showDegree && (
          <Prop label={t("controls.degree")} span={3}>
            <ToggleBar
              options={degreeSelectOptions}
              value={chordDegree ?? ""}
              onChange={handleDegreeChange}
              label="Chord degree"
            />
          </Prop>
        )}
        {showDisplay && (
          <Prop label={t("controls.lens")} span={3} hint={hasActiveChord ? activeLensDescription : undefined}>
            <ToggleBar
              options={lensOptions.map((o) => ({ ...o, disabled: displayDisabled || o.disabled }))}
              value={practiceLens}
              onChange={displayDisabled ? () => undefined : setPracticeLens}
              label="Practice lens"
            />
          </Prop>
        )}
        {showRoot && (
          <Prop label={t("controls.root")} span={4}>
            <NoteGrid
              notes={NOTES}
              selected={chordRootOverride}
              onSelect={(note) => { startTransition(() => { setChordRootOverride(note); }); }}
              useFlats={useFlats}
            />
          </Prop>
        )}

        {/* ── CHORD TYPE ───────────────────────────────────────────────── */}
        {showChordTypeGrid && (
          <>
            <GroupHeader>{t("inspector.groupChordType")}</GroupHeader>
            <Prop
              label={t("controls.chordType")}
              span={6}
              hint={
                chordOverlayMode === "degree"
                  ? hasQualityOverride
                    ? t("controls.customChordHint")
                    : t("controls.diatonicDefaultHint")
                  : undefined
              }
            >
              <ChordTypeGrid
                label="Chord Type"
                options={buildQualityToggleOptions({ includeSentinel: false })}
                value={chordOverlayMode === "degree" ? chordType ?? "" : chordQualityOverride ?? ""}
                onChange={handleChordTypeChange}
              />
            </Prop>
          </>
        )}

        {/* ── VOICING ──────────────────────────────────────────────────── */}
        {showDisplay && (
          <>
            <GroupHeader>{t("inspector.groupVoicing")}</GroupHeader>
            <Prop label={t("inspector.fullChords")} span={3} hint={hasActiveChord ? fullChordsHint : undefined}>
              <Switch
                label={t("inspector.fullChords")}
                checked={fullChordsEnabled}
                onChange={setFullChordsEnabled}
                disabled={displayDisabled || !fullChordsSupported}
              />
            </Prop>
            <Prop label={t("inspector.showOnBoard")} span={3}>
              <Switch
                label={t("inspector.showOnBoard")}
                checked={!chordOverlayHidden}
                onChange={(next) => setChordOverlayHidden(!next)}
                disabled={displayDisabled}
              />
            </Prop>
          </>
        )}
      </PropGrid>
```

Note: the chord-type grid `Prop` `span` changes from `4` to `6` (its own group row). The Lens `Prop` `span` changes from `4` to `3`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: PASS. Fix any sibling assertions that depended on the old "Display" header text.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChordOverlayControls/
git commit -m "fix(inspector): restore Chord tab CHORD TYPE / VOICING group headers"
```

---

### Task 2: View tab DISPLAY status words

The three DISPLAY `ToggleProp` rows must show a state word each. `ToggleProp` already supports `status` (`InspectorGrid.tsx:81`).

**Files:**
- Modify: `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/types.ts`
- Modify: `src/components/Inspector/ViewTab.tsx`
- Test: `src/components/Inspector/ViewTab.test.tsx`

- [ ] **Step 1: Add the i18n keys**

In `src/i18n/types.ts`, inside the `inspector` block, add after `tapToPlay: string;`:

```ts
    statusByDegree: string;
    statusUniform: string;
    statusVisible: string;
    statusHidden: string;
    statusAudioOn: string;
    statusMuted: string;
```

In `src/i18n/en.ts`, inside `inspector`, add after `tapToPlay: "Tap to Play",`:

```ts
    statusByDegree: "By degree",
    statusUniform: "Uniform",
    statusVisible: "Visible",
    statusHidden: "Hidden",
    statusAudioOn: "Audio on",
    statusMuted: "Muted",
```

In `src/i18n/es.ts`, inside `inspector`, add after `tapToPlay: "Tocar al pulsar",`:

```ts
    statusByDegree: "Por grado",
    statusUniform: "Uniforme",
    statusVisible: "Visible",
    statusHidden: "Oculto",
    statusAudioOn: "Audio activado",
    statusMuted: "Silenciado",
```

- [ ] **Step 2: Write the failing test**

Add to `ViewTab.test.tsx`:

```tsx
it("shows state words on the three DISPLAY toggles", () => {
  renderWithAtoms(<ViewTab />, { initialValues: [[scaleDegreeColorsEnabledAtom, false], [fullChordsEnabledAtom, true], [isMutedAtom, false]] });
  expect(screen.getByText("Uniform")).toBeInTheDocument();
  expect(screen.getByText("Visible")).toBeInTheDocument();
  expect(screen.getByText("Audio on")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/components/Inspector/ViewTab.test.tsx -t "state words"`
Expected: FAIL — no status text rendered.

- [ ] **Step 4: Pass `status` to the three ToggleProp rows**

In `ViewTab.tsx`, replace the three `ToggleProp` elements (lines 95-109):

```tsx
        <ToggleProp
          label={t("inspector.degreeColors")}
          checked={scaleDegreeColors}
          onChange={setScaleDegreeColors}
          status={scaleDegreeColors ? t("inspector.statusByDegree") : t("inspector.statusUniform")}
        />
        <ToggleProp
          label={t("inspector.fullChords")}
          checked={fullChords}
          onChange={setFullChords}
          status={fullChords ? t("inspector.statusVisible") : t("inspector.statusHidden")}
        />
        <ToggleProp
          label={t("inspector.tapToPlay")}
          checked={!muted}
          onChange={(next) => setMuted(!next)}
          status={muted ? t("inspector.statusMuted") : t("inspector.statusAudioOn")}
        />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/components/Inspector/ViewTab.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/ src/components/Inspector/ViewTab.tsx src/components/Inspector/ViewTab.test.tsx
git commit -m "fix(inspector): show state words on View-tab DISPLAY toggles"
```

---

### Task 3: Progression tab — selected-chord Quality grid

The selected-chord Quality currently renders as a scrolling `ToggleBar`. Replace it with a "Diatonic" button beside a `ChordTypeGrid` (the 15-cell grid the Chord tab uses).

**Files:**
- Modify: `src/components/ProgressionControls/ProgressionControls.tsx`
- Test: `src/components/ProgressionControls/ProgressionControls.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `ProgressionControls.test.tsx` (use the file's existing render helper; ensure a progression step is selected):

```tsx
it("renders the selected-chord Quality as a grid, not a scrolling bar", () => {
  renderProgressionControls(); // existing helper that selects a step
  const qualityGroup = screen.getByRole("group", { name: "Chord quality" });
  // ChordTypeGrid renders aria-pressed buttons; the scrolling ToggleBar set data-overflow.
  expect(qualityGroup).not.toHaveAttribute("data-overflow");
  expect(within(qualityGroup).getByRole("button", { name: "Major Triad" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/ProgressionControls/ProgressionControls.test.tsx -t "Quality as a grid"`
Expected: FAIL — the Quality control is a `ToggleBar` with `data-overflow="scroll"`.

- [ ] **Step 3: Replace the Quality control**

In `ProgressionControls.tsx`, add the import near the other component imports:

```tsx
import { ChordTypeGrid } from "../Inspector/ChordTypeGrid";
```

Replace the Quality `control-section` block (the `<ToggleBar label="Chord quality" … overflow="scroll" />` and its surrounding `<div className={shared["control-section"]}>`):

```tsx
            <div className={shared["control-section"]}>
              <span className={shared["section-label"]}>Quality</span>
              <div className={styles["quality-row"]}>
                <button
                  type="button"
                  className={clsx(shared["toggle-btn"], qualityValue === CHORD_QUALITY_DIATONIC_VALUE && shared.active)}
                  aria-pressed={qualityValue === CHORD_QUALITY_DIATONIC_VALUE}
                  onClick={() => updateProgressionStepQuality({ id: activeStep.id, qualityOverride: null })}
                >
                  Diatonic
                </button>
                <ChordTypeGrid
                  label="Chord quality"
                  options={buildQualityToggleOptions({ includeSentinel: false })}
                  value={qualityValue === CHORD_QUALITY_DIATONIC_VALUE ? "" : qualityValue}
                  onChange={(quality) =>
                    updateProgressionStepQuality({ id: activeStep.id, qualityOverride: quality })
                  }
                />
              </div>
              <p className={shared["field-hint"]}>
                {activeResolvedProgressionStep?.qualityOverrideApplied
                  ? "Custom quality on a degree-derived root."
                  : "Diatonic uses the chord quality from the active scale."}
              </p>
            </div>
```

Confirm `clsx` is imported at the top of the file; if not, add `import clsx from "clsx";`. `buildQualityToggleOptions` and `CHORD_QUALITY_DIATONIC_VALUE` are already imported (used by the old code).

- [ ] **Step 4: Add the `quality-row` style**

In `src/components/ProgressionControls/ProgressionControls.module.css`, add:

```css
.quality-row {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/components/ProgressionControls/ProgressionControls.test.tsx`
Expected: PASS. Update any sibling assertion that selected the old scrolling Quality bar.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgressionControls/
git commit -m "fix(progression): selected-chord Quality renders as a grid"
```

---

### Task 4: Control density

Shipped controls run ~4-12px taller than the mockup's DAW-inspector tier. Retune the shared control CSS. This is a CSS-values pass — no logic, no tests beyond visual regression.

**Files:**
- Modify: `src/components/shared/shared.module.css`
- Modify: `src/components/FretRangeControl/FretRangeControl.module.css`

- [ ] **Step 1: Tighten `.toggle-btn`**

In `shared.module.css`, in the `.toggle-btn` rule, change `min-height` and `padding`:

```css
  min-height: 1.6rem;
  padding: 0.12rem 0.5rem;
```

(was `min-height: 1.85rem; padding: 0.18rem 0.55rem;`)

- [ ] **Step 2: Tighten `.note-btn`**

In `shared.module.css`, in the `.note-btn` rule, change `min-height`:

```css
  min-height: 1.65rem;
```

(was `1.85rem`)

- [ ] **Step 3: Tighten `.fret-btn`**

In `FretRangeControl.module.css`, in the `.fret-btn` rule, change the sizing:

```css
  min-width: 1.55rem;
  min-height: 1.55rem;
  padding: 0.12rem 0.3rem;
```

(was `min-width/min-height: 1.85rem; padding: 0.2rem 0.35rem;`). Leave the `.fret-range-control.mobile .fret-btn` touch-target rule and the `.dashboard` variant unchanged — mobile keeps `--size-touch-target` for accessibility.

- [ ] **Step 4: Verify the build and run lint**

Run: `pnpm run lint`
Expected: PASS (stylelint clean).

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/shared.module.css src/components/FretRangeControl/FretRangeControl.module.css
git commit -m "fix(inspector): tighten control density to the DAW mockup tier"
```

---

### Task 5: Root grid → 12 columns

`NoteGrid` renders the 12 chromatic notes as a 6×2 grid; the mockup wants a single 12-column row.

**Files:**
- Modify: `src/components/NoteGrid/NoteGrid.tsx`
- Modify: `src/components/shared/shared.module.css`
- Test: `src/components/NoteGrid/NoteGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `NoteGrid.test.tsx`:

```tsx
it("renders the note grid as a single 12-column row", () => {
  render(<NoteGrid notes={NOTES} selected="C" onSelect={() => {}} useFlats={false} />);
  const grid = screen.getByRole("group", { name: "Note selector" });
  expect(getComputedStyle(grid).gridTemplateColumns.split(" ").length).toBe(12);
});
```

If CSS-module computed styles are not reliable in jsdom, instead assert the column constant directly — add an exported constant test:

```tsx
it("uses 12 grid columns", async () => {
  const mod = await import("./NoteGrid");
  expect(mod.NOTE_GRID_COLUMNS).toBe(12);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/NoteGrid/NoteGrid.test.tsx -t "12"`
Expected: FAIL — `NOTE_GRID_COLUMNS` is not exported / is 6.

- [ ] **Step 3: Change the column count**

In `NoteGrid.tsx`, replace line 14:

```tsx
export const NOTE_GRID_COLUMNS = 12;
```

and update the reference in `handleKeyDown` (line 34):

```tsx
    const cols = NOTE_GRID_COLUMNS;
```

- [ ] **Step 4: Change the grid CSS**

In `shared.module.css`, in the `.note-grid` rule, change:

```css
  grid-template-columns: repeat(12, 1fr);
```

(was `repeat(6, 1fr)`)

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/components/NoteGrid/NoteGrid.test.tsx`
Expected: PASS — including arrow-key navigation tests (they derive from `NOTE_GRID_COLUMNS`).

- [ ] **Step 6: Verify consumer layout**

`NoteGrid` is consumed by the Chord-tab root picker (`ChordOverlayControls.tsx`, `Prop span={4}`) and the Scale-tab root picker (`ScaleSelector`). Run `pnpm run build` and `pnpm run dev`; confirm a 12-wide row fits both cells. If a cell is too narrow, widen its `Prop`/grid `span` to the full row width (`span={6}` for the Chord tab; the Scale tab's column is already full-width).

- [ ] **Step 7: Commit**

```bash
git add src/components/NoteGrid/ src/components/shared/shared.module.css
git commit -m "fix(inspector): render the root grid as a single 12-column row"
```

---

### Task 6: Status bar — unpinned

The status bar is pushed to the viewport bottom by `margin-top: auto`; the mockup places it directly after the inspector panel in normal flow.

**Files:**
- Modify: `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css`

- [ ] **Step 1: Remove the bottom-pin rule**

In `MainLayoutWrapper.module.css`, in the `.status-bar-shell` rule, delete the `margin-top: auto;` line. Result:

```css
.status-bar-shell {
  width: 100%;
  flex: 0 0 auto;
}
```

- [ ] **Step 2: Verify the layout**

Run: `pnpm run dev`. On a short page the status bar now sits immediately below the inspector panel (no bottom-gap fill). The `.app-container` `min-height: 100dvh` column simply no longer force-fills; confirm no white gap or overlap.

- [ ] **Step 3: Commit**

```bash
git add src/components/MainLayoutWrapper/MainLayoutWrapper.module.css
git commit -m "fix(layout): unpin the status bar from the viewport bottom"
```

---

### Task 7: Toggle switch dimensions

The `Switch` is a 30×13 track with a 9×9 knob; the mockup `Toggle` is 30×17 with a 13×13 knob.

**Files:**
- Modify: `src/components/Switch/Switch.module.css`

- [ ] **Step 1: Resize the track**

In `Switch.module.css`, in the `.switch` rule, change `height`:

```css
  height: 17px;
```

(was `13px`)

- [ ] **Step 2: Resize the knob**

In the `.switch::before` rule, change `width` and `height`:

```css
  width: 13px;
  height: 13px;
```

(was `9px` each; `top: 1px; left: 1px;` stay)

- [ ] **Step 3: Adjust the thumb travel**

The knob travels `left:1 → 14` in the mockup = 13px. Change `transform: translateX(17px)` to `translateX(13px)` in **both** the cyan on-state rule (`.switch[data-on]:not([data-tone="warm"])::before`) and the warm on-state rule (`.switch[data-on][data-tone="warm"]::before`):

```css
  transform: translateX(13px);
```

(was `translateX(17px)` in both)

- [ ] **Step 4: Verify lint and visuals**

Run: `pnpm run lint` then `pnpm run dev`; confirm the knob sits flush at both ends (track 17, knob 13, 1px inset, 13px travel → 1 + 13 + 13 = 27 ≤ 30, with 3px right margin matching the 1px+knob+travel geometry; if the knob overshoots, the travel is `30 - 1 - 13 - 1 = 15` — use `translateX(15px)` and note the mockup's exact knob rest).

Resolve-during-implementation: the mockup knob is 13px in a 30px track resting at `left:1`, travelling to `left:14` (13px travel) which leaves a 2px right gap. Use `translateX(13px)`; if visual review wants the knob flush right, `translateX(15px)`. Default to `13px` to match the mockup numbers.

- [ ] **Step 5: Commit**

```bash
git add src/components/Switch/Switch.module.css
git commit -m "fix(controls): match the toggle switch to the DAW mockup dimensions"
```

---

### Task 8: Light-theme palette retune

Retune the `[data-theme="modern-light"]` accent and surface token *values* toward the mockup `tokens.jsx` light palette. Values-only — token *names* and the Surface-Ladder structure are preserved, so no component CSS changes.

**Files:**
- Modify: `src/styles/themes.css`

- [ ] **Step 1: Read the current `modern-light` block**

Open `src/styles/themes.css` and locate the `[data-theme="modern-light"]` rule. Apply the value map below — each entry is `token: new-value`. Tokens not listed keep their current value.

| Token | New value | Mockup source (`tokens.jsx` light) |
|---|---|---|
| `--accent-primary` | `#0e7a93` | `--daw-cyan` |
| `--interactive-focus` | `#0e7a93` | `--daw-cyan` |
| `--neon-cyan` | `#0e7a93` | `--daw-cyan` |
| `--neon-cyan-bright` | `#12a0bf` | brightened cyan |
| `--neon-cyan-dim` | `#0a5972` | `--daw-cyan-dim` |
| `--neon-orange` | `#c44a1f` | `--daw-orange` |
| `--neon-orange-bright` | `#d96a3a` | brightened orange |
| `--neon-orange-dim` | `#923613` | `--daw-orange-dim` |
| `--neon-brand-gradient` | `linear-gradient(90deg, #0e7a93 0%, #c44a1f 100%)` | brand pair |
| `--bg-color` | `#e4eaef` | `--daw-bg` |
| `--surface-base` | `#eef2f6` | `--daw-panel-soft` |
| `--surface-raised` | `#dde4eb` | `--daw-panel-hi` |
| `--surface-highlight` | `#c9d2da` | derived border |
| `--surface-shell` | `#e4eaef` | `--daw-bg` |
| `--surface-card-top` | `#ffffff` | `--daw-panel` |
| `--surface-card-nested` | `#f3f6f9` | `--daw-card`-ish |
| `--surface-well` | `#dde4eb` | `--daw-panel-hi` |
| `--surface-float` | `#ffffff` | `--daw-panel` |
| `--focus-ring-glow` | `0 0 0 3px rgb(14 122 147 / 0.18)` | cyan glow |
| `--accent-glow` | `rgb(14 122 147 / 0.06)` | `--daw-cyan-fill` |

For any `--bg-app-accent-glow*` or `--note-role-*` / `--degree-light-fill-*` token that referenced the old orange `#ea580c` family, re-tint toward `#c44a1f` proportionally (keep the same alpha / lightness relationship). Update the inline `was …` comments to reflect the new values.

- [ ] **Step 2: Verify lint and contrast**

Run: `pnpm run lint`. Then `pnpm run dev`, switch to the light theme, and open `?audit=note-colors` to check contrast — the audit harness renders both themes' swatches. Confirm no text-on-accent contrast regression (the cyan `#0e7a93` and orange `#c44a1f` are both darker than the prior values, so contrast improves or holds).

- [ ] **Step 3: Commit**

```bash
git add src/styles/themes.css
git commit -m "fix(theme): retune the light palette to the DAW mockup colors"
```

---

### Task 9 (Part 1 close-out): Refresh visual baselines and run the full gate

- [ ] **Step 1: Run the full local gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all pass.

- [ ] **Step 2: Refresh darwin visual baselines**

Run: `pnpm run test:visual:update`
Expected: snapshots for `app-components`, `app-layout`, `app-mobile` refresh (Chord/View/Progression tabs, NoteGrid, Switch, control density, status-bar placement, light theme).

- [ ] **Step 3: Commit the baselines**

```bash
git add e2e/
git commit -m "test(visual): refresh darwin baselines for DAW parity fixes"
```

Note: linux baselines refresh in CI per `CLAUDE.md` (`vitest.update='new'` seeds missing snapshots); if the repo commits linux baselines explicitly, run `pnpm run test:visual:update:linux` and commit those too.

---

## PART 2 — VOICING ENGINE

### Task 10: Voicing engine — types and helpers

Create the engine module with its public types and the pure helpers (string-set masks, inversion bass, MIDI math). TDD the helpers.

**Files:**
- Create: `packages/core/src/shapes/voicings.ts`
- Create: `packages/core/src/shapes/voicings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/shapes/voicings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { STANDARD_TUNING } from "../guitar";
import { stringSetMask, inversionBassPitchClass, openStringMidi } from "./voicings";

describe("voicing helpers", () => {
  it("maps string-set ids to high→low string indices", () => {
    expect(stringSetMask("all")).toEqual([0, 1, 2, 3, 4, 5]);
    expect(stringSetMask("low")).toEqual([3, 4, 5]);
    expect(stringSetMask("mid")).toEqual([2, 3, 4]);
    expect(stringSetMask("mid-hi")).toEqual([1, 2, 3]);
    expect(stringSetMask("top")).toEqual([0, 1, 2]);
  });

  it("computes the inversion bass pitch class", () => {
    // C Major Triad: members root/3/5 = C E G = pc 0,4,7.
    expect(inversionBassPitchClass("C", "Major Triad", "root")).toBe(0);
    expect(inversionBassPitchClass("C", "Major Triad", "1st")).toBe(4);
    expect(inversionBassPitchClass("C", "Major Triad", "2nd")).toBe(7);
    // Triad has no 3rd inversion.
    expect(inversionBassPitchClass("C", "Major Triad", "3rd")).toBeNull();
  });

  it("computes open-string MIDI from a tuning entry", () => {
    // E2 = octave 2 * 12 + index(E)=4 = 28.
    expect(openStringMidi("E2")).toBe(28);
    expect(openStringMidi(STANDARD_TUNING[5])).toBe(28);
    expect(openStringMidi("not-a-note")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/core/src/shapes/voicings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the types and helpers**

Create `packages/core/src/shapes/voicings.ts`:

```ts
import { NOTES, CHORD_DEFINITIONS } from "../theory";
import { parseNote } from "../guitar";
import type { CagedShape } from "./templates";

export type VoicingType = "caged" | "drop2" | "triad";
export type VoicingInversion = "root" | "1st" | "2nd" | "3rd";
export type VoicingStringSet = "all" | "low" | "mid" | "mid-hi" | "top";

export interface VoicingNote {
  /** 0 = highest string, 5 = lowest. */
  stringIndex: number;
  fretIndex: number;
  noteName: string;
  midi: number;
}

export interface Voicing {
  positionKeys: string[];
  notes: VoicingNote[];
  /** Present only for `caged` voicings; absent for algorithmic voicings. */
  shape?: CagedShape;
}

/** Allowed string indices (0 = high E … 5 = low E) for each string set. */
const STRING_SET_MASKS: Record<VoicingStringSet, number[]> = {
  all: [0, 1, 2, 3, 4, 5],
  low: [3, 4, 5],
  mid: [2, 3, 4],
  "mid-hi": [1, 2, 3],
  top: [0, 1, 2],
};

const INVERSION_INDEX: Record<VoicingInversion, number> = {
  root: 0,
  "1st": 1,
  "2nd": 2,
  "3rd": 3,
};

export function stringSetMask(set: VoicingStringSet): number[] {
  return [...STRING_SET_MASKS[set]];
}

/** MIDI number of an open string written like "E2" / "A#3". null if unparseable. */
export function openStringMidi(openString: string): number | null {
  const parsed = parseNote(openString);
  if (!parsed) return null;
  const idx = NOTES.indexOf(parsed.noteName);
  if (idx < 0) return null;
  return parsed.octave * 12 + idx;
}

/**
 * Pitch class (0-11) of the note that must be the lowest voice for `inversion`.
 * null when the chord has no member at that inversion index (e.g. 3rd on a triad).
 */
export function inversionBassPitchClass(
  chordRoot: string,
  chordType: string,
  inversion: VoicingInversion,
): number | null {
  const def = CHORD_DEFINITIONS[chordType];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (!def || rootIndex < 0) return null;
  const memberIndex = INVERSION_INDEX[inversion];
  const member = def.members[memberIndex];
  if (!member) return null;
  return (rootIndex + member.semitone) % 12;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/core/src/shapes/voicings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shapes/voicings.ts packages/core/src/shapes/voicings.test.ts
git commit -m "feat(core): voicing-engine types and helpers"
```

---

### Task 11: Voicing engine — algorithmic triad/drop2 search

Add the algorithmic search for `triad` and `drop2` voicings.

**Files:**
- Modify: `packages/core/src/shapes/voicings.ts`
- Modify: `packages/core/src/shapes/voicings.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `voicings.test.ts`:

```ts
import { generateVoicings } from "./voicings";

describe("generateVoicings — triad", () => {
  const base = { tuning: STANDARD_TUNING, maxFret: 12 } as const;

  it("every triad voicing contains all three chord tones", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: "all",
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const pcs = new Set(v.notes.map((n) => n.midi % 12));
      expect(pcs).toEqual(new Set([0, 4, 7])); // C E G
    }
  });

  it("root-inversion voicings have the root as the lowest note", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: "all",
    });
    for (const v of voicings) {
      const lowest = v.notes.reduce((a, b) => (a.midi <= b.midi ? a : b));
      expect(lowest.midi % 12).toBe(0); // C
    }
  });

  it("1st-inversion voicings have the 3rd as the lowest note", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "1st", stringSet: "all",
    });
    for (const v of voicings) {
      const lowest = v.notes.reduce((a, b) => (a.midi <= b.midi ? a : b));
      expect(lowest.midi % 12).toBe(4); // E
    }
  });

  it("the string set restricts which strings carry notes", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: "top",
    });
    for (const v of voicings) {
      for (const n of v.notes) expect([0, 1, 2]).toContain(n.stringIndex);
    }
  });

  it("returns no voicing for an inversion the chord lacks", () => {
    expect(generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "3rd", stringSet: "all",
    })).toEqual([]);
  });
});

describe("generateVoicings — drop2", () => {
  it("drop2 voicings span more than an octave and contain all four tones", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 14,
      chordRoot: "C", chordType: "Major 7th",
      voicingType: "drop2", inversion: "root", stringSet: "all",
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const midis = v.notes.map((n) => n.midi);
      expect(Math.max(...midis) - Math.min(...midis)).toBeGreaterThan(12);
      expect(new Set(v.notes.map((n) => n.midi % 12))).toEqual(new Set([0, 4, 7, 11]));
    }
  });

  it("drop2 on a plain triad falls back to a 3-voice voicing", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 12,
      chordRoot: "C", chordType: "Major Triad",
      voicingType: "drop2", inversion: "root", stringSet: "all",
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) expect(v.notes.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/core/src/shapes/voicings.test.ts -t generateVoicings`
Expected: FAIL — `generateVoicings` not exported.

- [ ] **Step 3: Implement the search**

Append to `voicings.ts`:

```ts
export interface GenerateVoicingsParams {
  chordRoot: string;
  chordType: string;
  tuning: string[];
  maxFret: number;
  voicingType: VoicingType;
  inversion: VoicingInversion;
  stringSet: VoicingStringSet;
}

const SPAN_LIMIT: Record<"triad" | "drop2", number> = { triad: 4, drop2: 5 };

/** Frets >0 only — open strings do not constrain the hand span. */
function fretSpan(notes: VoicingNote[]): number {
  const fretted = notes.map((n) => n.fretIndex).filter((f) => f > 0);
  if (fretted.length < 2) return 0;
  return Math.max(...fretted) - Math.min(...fretted);
}

/**
 * Algorithmic search for triad / drop2 voicings.
 * voiceCount: 3 for triad, 4 for drop2 (3 when a drop2 chord has <4 tones).
 */
function searchVoicings(
  params: GenerateVoicingsParams,
  voiceCount: number,
  requireOctaveSpread: boolean,
): Voicing[] {
  const { chordRoot, chordType, tuning, maxFret, inversion, stringSet, voicingType } = params;
  const def = CHORD_DEFINITIONS[chordType];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (!def || rootIndex < 0 || tuning.length !== 6) return [];

  const bassPC = inversionBassPitchClass(chordRoot, chordType, inversion);
  if (bassPC === null) return [];

  const chordPCs = def.members.map((m) => (rootIndex + m.semitone) % 12);
  const chordPCSet = new Set(chordPCs);
  const allowed = stringSetMask(stringSet);
  const spanLimit = SPAN_LIMIT[voicingType === "drop2" ? "drop2" : "triad"];

  const openMidis = tuning.map(openStringMidi);
  if (openMidis.some((m) => m === null)) return [];

  // Per-string frets that land on a chord tone.
  const candidateFrets: Record<number, number[]> = {};
  for (const s of allowed) {
    const open = openMidis[s] as number;
    const frets: number[] = [];
    for (let f = 0; f <= maxFret; f += 1) {
      if (chordPCSet.has((open + f) % 12)) frets.push(f);
    }
    candidateFrets[s] = frets;
  }

  const voicings: Voicing[] = [];
  const seen = new Set<string>();

  // Contiguous string runs of length voiceCount within the allowed set.
  for (let i = 0; i + voiceCount <= allowed.length; i += 1) {
    const run = allowed.slice(i, i + voiceCount);
    const contiguous = run.every((v, k) => k === 0 || v === run[k - 1] + 1);
    if (!contiguous) continue;

    const dfs = (depth: number, picked: VoicingNote[]) => {
      if (depth === run.length) {
        const pcs = new Set(picked.map((n) => n.midi % 12));
        if (pcs.size !== chordPCSet.size) return; // all chord tones present
        for (const pc of chordPCSet) if (!pcs.has(pc)) return;
        const lowest = picked.reduce((a, b) => (a.midi <= b.midi ? a : b));
        if (lowest.midi % 12 !== bassPC) return;
        if (fretSpan(picked) > spanLimit) return;
        const midis = picked.map((n) => n.midi);
        const pitchSpan = Math.max(...midis) - Math.min(...midis);
        if (requireOctaveSpread && !(pitchSpan > 12 && pitchSpan <= 24)) return;
        if (!requireOctaveSpread && pitchSpan > 12) return; // close-position triad
        const sorted = [...picked].sort((a, b) => a.stringIndex - b.stringIndex);
        const positionKeys = sorted.map((n) => `${n.stringIndex}-${n.fretIndex}`);
        const key = positionKeys.join("|");
        if (seen.has(key)) return;
        seen.add(key);
        voicings.push({ positionKeys, notes: sorted });
        return;
      }
      const stringIndex = run[depth];
      const open = openMidis[stringIndex] as number;
      for (const fret of candidateFrets[stringIndex]) {
        const midi = open + fret;
        dfs(depth + 1, [
          ...picked,
          { stringIndex, fretIndex: fret, noteName: NOTES[midi % 12], midi },
        ]);
      }
    };
    dfs(0, []);
  }
  return voicings;
}

export function generateVoicings(params: GenerateVoicingsParams): Voicing[] {
  const { voicingType } = params;
  if (voicingType === "caged") {
    return cagedVoicings(params); // implemented in the next task
  }
  const def = CHORD_DEFINITIONS[params.chordType];
  if (!def) return [];
  if (voicingType === "triad") {
    return searchVoicings(params, Math.min(3, def.members.length), false);
  }
  // drop2 — 4 voices for a 4+ note chord, else fall back to a 3-voice triad.
  if (def.members.length >= 4) return searchVoicings(params, 4, true);
  return searchVoicings(params, Math.min(3, def.members.length), false);
}
```

`cagedVoicings` does not exist yet — Task 12 adds it. To keep this task's tests green, add a temporary stub at the bottom of the file:

```ts
function cagedVoicings(_params: GenerateVoicingsParams): Voicing[] {
  return [];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/core/src/shapes/voicings.test.ts`
Expected: PASS — all triad and drop2 cases.

- [ ] **Step 5: Tune span limits if needed**

If `generateVoicings` returns zero triad voicings for a common chord (e.g. C Major), the `spanLimit` (4) or the close-position `pitchSpan > 12` cutoff is too tight. Adjust `SPAN_LIMIT.triad` upward (max 5) and re-run. Record the final values in a code comment.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/shapes/voicings.ts packages/core/src/shapes/voicings.test.ts
git commit -m "feat(core): algorithmic triad/drop2 voicing search"
```

---

### Task 12: Voicing engine — CAGED routing and export

Replace the `cagedVoicings` stub with a real adapter over `getFullChordShapeMatches`, filtered by string set and inversion. Export the engine.

**Files:**
- Modify: `packages/core/src/shapes/voicings.ts`
- Modify: `packages/core/src/shapes/voicings.test.ts`
- Modify: `packages/core/src/shapes/index.ts`

- [ ] **Step 1: Write the failing test**

Add to `voicings.test.ts`:

```ts
import { getFullChordShapeMatches } from "./fullChordShapes";

describe("generateVoicings — caged routing", () => {
  it("unconstrained caged matches getFullChordShapeMatches position keys", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 12,
      chordRoot: "E", chordType: "Major Triad",
      voicingType: "caged", inversion: "root", stringSet: "all",
    });
    const direct = getFullChordShapeMatches({
      chordRoot: "E", chordType: "Major Triad", tuning: STANDARD_TUNING, maxFret: 12,
    });
    expect(voicings.map((v) => v.positionKeys.join("|")).sort())
      .toEqual(direct.map((m) => m.positionKeys.join("|")).sort());
  });

  it("caged voicings carry their CAGED shape", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 12,
      chordRoot: "E", chordType: "Major Triad",
      voicingType: "caged", inversion: "root", stringSet: "all",
    });
    expect(voicings.every((v) => v.shape !== undefined)).toBe(true);
  });

  it("caged with a string set drops voicings that use excluded strings", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 12,
      chordRoot: "E", chordType: "Major Triad",
      voicingType: "caged", inversion: "root", stringSet: "top",
    });
    for (const v of voicings) {
      for (const n of v.notes) expect([0, 1, 2]).toContain(n.stringIndex);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/core/src/shapes/voicings.test.ts -t "caged routing"`
Expected: FAIL — the stub returns `[]`.

- [ ] **Step 3: Implement `cagedVoicings`**

In `voicings.ts`, add the import at the top:

```ts
import { getFullChordShapeMatches } from "./fullChordShapes";
```

Replace the `cagedVoicings` stub with:

```ts
function cagedVoicings(params: GenerateVoicingsParams): Voicing[] {
  const { chordRoot, chordType, tuning, maxFret, inversion, stringSet } = params;
  const allowed = new Set(stringSetMask(stringSet));
  const openMidis = tuning.map(openStringMidi);
  if (openMidis.some((m) => m === null)) return [];
  const bassPC = inversionBassPitchClass(chordRoot, chordType, inversion);

  const matches = getFullChordShapeMatches({ chordRoot, chordType, tuning, maxFret });
  const voicings: Voicing[] = [];
  for (const match of matches) {
    const notes: VoicingNote[] = match.notes.map((n) => ({
      stringIndex: n.stringIndex,
      fretIndex: n.fretIndex,
      noteName: n.noteName,
      midi: (openMidis[n.stringIndex] as number) + n.fretIndex,
    }));
    if (!notes.every((n) => allowed.has(n.stringIndex))) continue;
    if (inversion !== "root" && bassPC !== null) {
      const lowest = notes.reduce((a, b) => (a.midi <= b.midi ? a : b));
      if (lowest.midi % 12 !== bassPC) continue;
    }
    voicings.push({ positionKeys: match.positionKeys, notes, shape: match.shape });
  }
  return voicings;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/core/src/shapes/voicings.test.ts`
Expected: PASS — all caged, triad, drop2 cases.

- [ ] **Step 5: Export the engine**

In `packages/core/src/shapes/index.ts`, add:

```ts
export type {
  Voicing, VoicingNote, VoicingType, VoicingInversion, VoicingStringSet,
  GenerateVoicingsParams,
} from "./voicings";
export {
  generateVoicings, stringSetMask, inversionBassPitchClass, openStringMidi,
} from "./voicings";
```

Confirm `@fretflow/core`'s top-level `index.ts` re-exports `./shapes` (it already re-exports `getFullChordShapeMatches`, so the path is established). If not, add the re-export.

- [ ] **Step 6: Verify the package build**

Run: `pnpm run build`
Expected: PASS — `@fretflow/core` compiles with the new exports.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/shapes/
git commit -m "feat(core): CAGED voicing routing and engine export"
```

---

### Task 13: Voicing atoms

Add the three persisted voicing atoms, the derived `availableInversionsAtom`, and `voicingMatchesAtom`. Re-point `fullChordMatchesAtom` at the engine so existing consumers (`fullChordPositionsAtom`, `FretboardSVG`) keep working unchanged.

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts`
- Test: `src/store/chordOverlayAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `chordOverlayAtoms.test.ts`:

```ts
it("availableInversionsAtom excludes 3rd for a triad", () => {
  const store = createStore();
  store.set(chordRootOverrideAtom, "C");
  store.set(chordQualityOverrideAtom, "Major Triad");
  store.set(chordOverlayModeAtom, "manual");
  expect(store.get(availableInversionsAtom)).toEqual(["root", "1st", "2nd"]);
});

it("availableInversionsAtom includes 3rd for a seventh chord", () => {
  const store = createStore();
  store.set(chordRootOverrideAtom, "C");
  store.set(chordQualityOverrideAtom, "Major 7th");
  store.set(chordOverlayModeAtom, "manual");
  expect(store.get(availableInversionsAtom)).toEqual(["root", "1st", "2nd", "3rd"]);
});

it("voicingMatchesAtom is empty when Full Chords is off", () => {
  const store = createStore();
  store.set(fullChordsEnabledAtom, false);
  expect(store.get(voicingMatchesAtom)).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts -t voicing`
Expected: FAIL — the atoms do not exist.

- [ ] **Step 3: Add the atoms**

In `src/store/chordOverlayAtoms.ts`, add `generateVoicings` and `CHORD_DEFINITIONS` to the `@fretflow/core` import (verify `CHORD_DEFINITIONS` is already imported — it is, per the file head; add `generateVoicings` and the voicing types). Then add the atoms. Place the new atoms near `fullChordsEnabledAtom`; **replace** the existing `fullChordMatchesAtom` definition:

```ts
import {
  // …existing imports…
  generateVoicings,
  type VoicingType,
  type VoicingInversion,
  type VoicingStringSet,
} from "@fretflow/core";

const VOICING_INVERSIONS: VoicingInversion[] = ["root", "1st", "2nd", "3rd"];

export const voicingTypeAtom = atomWithStorage<VoicingType>(
  k("voicingType"),
  "caged",
  rawStringStorage<VoicingType>(),
  GET_ON_INIT,
);

export const voicingInversionAtom = atomWithStorage<VoicingInversion>(
  k("voicingInversion"),
  "root",
  rawStringStorage<VoicingInversion>(),
  GET_ON_INIT,
);

export const voicingStringSetAtom = atomWithStorage<VoicingStringSet>(
  k("voicingStringSet"),
  "all",
  rawStringStorage<VoicingStringSet>(),
  GET_ON_INIT,
);

/** Inversions valid for the active chord — triads drop "3rd", dyads keep "root" only. */
export const availableInversionsAtom = atom((get): VoicingInversion[] => {
  const chordType = get(chordTypeAtom);
  const def = chordType ? CHORD_DEFINITIONS[chordType] : undefined;
  const count = def ? def.members.length : 4;
  return VOICING_INVERSIONS.slice(0, Math.min(count, 4));
});

/** The renderer's voicing source — replaces the old template-only finder. */
export const voicingMatchesAtom = atom((get) => {
  if (!get(fullChordsEnabledAtom)) return [];
  if (get(chordOverlayHiddenAtom)) return [];
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  const available = get(availableInversionsAtom);
  const inversion = get(voicingInversionAtom);
  return generateVoicings({
    chordRoot: get(chordRootAtom),
    chordType,
    tuning: get(currentTuningAtom),
    maxFret: 24,
    voicingType: get(voicingTypeAtom),
    inversion: available.includes(inversion) ? inversion : "root",
    stringSet: get(voicingStringSetAtom),
  });
});

// Back-compat alias: existing consumers read fullChordMatchesAtom.
export const fullChordMatchesAtom = atom((get) => get(voicingMatchesAtom));
```

`rawStringStorage` is already imported in this file (used by `chordRootOverrideAtom`). If `rawStringStorage` is not generic, follow the pattern of `practiceLensStorage` instead — a `createJSONStorage`-style serializer; check the file's existing string-enum atoms (`practiceLensAtom`) and mirror that serializer for the three new enum atoms.

`fullChordPositionsAtom` (which flattens `fullChordMatchesAtom`) is unchanged and now reflects the engine.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts`
Expected: PASS.

- [ ] **Step 5: Export the atoms from the barrel**

In `src/store/atoms.ts`, add `voicingTypeAtom`, `voicingInversionAtom`, `voicingStringSetAtom`, `availableInversionsAtom`, `voicingMatchesAtom` to the `chordOverlayAtoms` re-export list.

- [ ] **Step 6: Commit**

```bash
git add src/store/chordOverlayAtoms.ts src/store/chordOverlayAtoms.test.ts src/store/atoms.ts
git commit -m "feat(store): voicing-engine atoms"
```

---

### Task 14: ToggleBar disabled-options confirmation

`ToggleBar` options already support a per-option `disabled` flag (`ToggleBar.tsx:43`, applied at line 87). No new capability is needed — the Inversion control passes `disabled` per option (Task 15). This task only adds a regression test.

**Files:**
- Test: `src/components/ToggleBar/ToggleBar.test.tsx`

- [ ] **Step 1: Write the test**

Add to `ToggleBar.test.tsx`:

```tsx
it("renders a disabled option as a disabled, non-clickable button", async () => {
  const onChange = vi.fn();
  render(
    <ToggleBar
      label="Inversion"
      value="root"
      onChange={onChange}
      options={[
        { value: "root", label: "Root" },
        { value: "3rd", label: "3rd", disabled: true },
      ]}
    />,
  );
  const thirdBtn = screen.getByRole("button", { name: "3rd" });
  expect(thirdBtn).toBeDisabled();
  await userEvent.click(thirdBtn);
  expect(onChange).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm vitest run src/components/ToggleBar/ToggleBar.test.tsx -t "disabled option"`
Expected: PASS immediately — the capability already exists.

- [ ] **Step 3: Commit**

```bash
git add src/components/ToggleBar/ToggleBar.test.tsx
git commit -m "test(controls): cover ToggleBar disabled options"
```

---

### Task 15: StringSetPicker component

A new control: five cards, each a 6-line string diagram + label + sub-label, bound to `voicingStringSetAtom`. Ports the mockup `StringSetPicker` (`panels.jsx:460-531`). Per the spec, follow the string-number labels, not the mockup's inconsistent mask arrays.

**Files:**
- Create: `src/components/Inspector/StringSetPicker.tsx`
- Create: `src/components/Inspector/StringSetPicker.module.css`
- Create: `src/components/Inspector/StringSetPicker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/Inspector/StringSetPicker.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StringSetPicker } from "./StringSetPicker";

describe("StringSetPicker", () => {
  it("renders all five string-set cards", () => {
    render(<StringSetPicker value="all" onChange={() => {}} />);
    for (const label of ["All", "Bass", "Lower mid", "Upper mid", "Treble"]) {
      expect(screen.getByRole("radio", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("marks the active card as checked", () => {
    render(<StringSetPicker value="low" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: /Bass/ })).toBeChecked();
  });

  it("calls onChange with the card id when a card is clicked", async () => {
    const onChange = vi.fn();
    render(<StringSetPicker value="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: /Treble/ }));
    expect(onChange).toHaveBeenCalledWith("top");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/Inspector/StringSetPicker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/components/Inspector/StringSetPicker.tsx`:

```tsx
import clsx from "clsx";
import type { VoicingStringSet } from "@fretflow/core";
import styles from "./StringSetPicker.module.css";

interface StringSetPickerProps {
  value: VoicingStringSet;
  onChange: (value: VoicingStringSet) => void;
}

interface StringSetCard {
  id: VoicingStringSet;
  label: string;
  sub: string;
  /** mask[0] = string 6 (low E, rendered top), mask[5] = string 1 (high E, bottom). */
  mask: boolean[];
}

// String numbers per the spec: 1 = high E … 6 = low E. mask top→bottom = string 6→1.
const CARDS: StringSetCard[] = [
  { id: "all", label: "All", sub: "6 strings", mask: [true, true, true, true, true, true] },
  { id: "low", label: "Bass", sub: "4·5·6", mask: [true, true, true, false, false, false] },
  { id: "mid", label: "Lower mid", sub: "3·4·5", mask: [false, true, true, true, false, false] },
  { id: "mid-hi", label: "Upper mid", sub: "2·3·4", mask: [false, false, true, true, true, false] },
  { id: "top", label: "Treble", sub: "1·2·3", mask: [false, false, false, true, true, true] },
];

export function StringSetPicker({ value, onChange }: StringSetPickerProps) {
  return (
    <div className={styles.grid} role="radiogroup" aria-label="String set">
      {CARDS.map((card) => {
        const active = value === card.id;
        return (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${card.label} — ${card.sub}`}
            className={clsx(styles.card, active && styles.cardActive)}
            onClick={() => onChange(card.id)}
          >
            <span className={styles.diagram} aria-hidden="true">
              {card.mask.map((on, i) => (
                <span
                  key={i}
                  className={clsx(styles.string, on && styles.stringOn)}
                  style={{ height: `${2.2 - (i / 5) * 1.4}px` }}
                />
              ))}
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{card.label}</span>
              <span className={styles.sub}>{card.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implement the styles**

Create `src/components/Inspector/StringSetPicker.module.css`:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.375rem;
}

.card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  min-height: 3.25rem;
  background: var(--surface-well);
  border: 1px solid var(--surface-card-border);
  border-radius: var(--dc-radius);
  cursor: pointer;
  text-align: left;
  transition: var(--dc-transition);
}

.card:hover {
  border-color: var(--surface-highlight);
}

.cardActive {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  box-shadow: 0 0 10px -4px var(--accent-primary);
}

.card:focus-visible {
  outline: 2px solid var(--neon-cyan);
  outline-offset: 2px;
}

.diagram {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 1.75rem;
  flex-shrink: 0;
}

.string {
  border-radius: 999px;
  background: var(--surface-highlight);
}

.stringOn {
  background: var(--text-muted);
}

.cardActive .stringOn {
  background: var(--accent-primary);
}

.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.1;
}

.sub {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/components/Inspector/StringSetPicker.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/StringSetPicker.tsx src/components/Inspector/StringSetPicker.module.css src/components/Inspector/StringSetPicker.test.tsx
git commit -m "feat(inspector): StringSetPicker control"
```

---

### Task 16: Wire the VOICING-group controls into the Chord tab

Add Type, Inversion, and String-Set controls to the Chord tab's VOICING group (created in Task 1).

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Modify: `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/types.ts`
- Test: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Add the i18n keys**

In `types.ts` `inspector` block, add:

```ts
    voicingType: string;
    voicingInversion: string;
    voicingStringSet: string;
    voicingTypeCaged: string;
    voicingTypeDrop2: string;
    voicingTypeTriad: string;
```

In `en.ts` `inspector`:

```ts
    voicingType: "Type",
    voicingInversion: "Inversion",
    voicingStringSet: "String Set",
    voicingTypeCaged: "Full CAGED",
    voicingTypeDrop2: "Drop 2",
    voicingTypeTriad: "Triad",
```

In `es.ts` `inspector`:

```ts
    voicingType: "Tipo",
    voicingInversion: "Inversión",
    voicingStringSet: "Juego de cuerdas",
    voicingTypeCaged: "CAGED completo",
    voicingTypeDrop2: "Drop 2",
    voicingTypeTriad: "Tríada",
```

- [ ] **Step 2: Write the failing test**

Add to `ChordOverlayControls.test.tsx`:

```tsx
it("renders Type, Inversion and String Set in the VOICING group", () => {
  renderWithAtoms(<ChordOverlayControls />, {
    initialValues: [[chordOverlayModeAtom, "manual"], [chordQualityOverrideAtom, "Major Triad"]],
  });
  expect(screen.getByRole("group", { name: "Voicing type" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Voicing inversion" })).toBeInTheDocument();
  expect(screen.getByRole("radiogroup", { name: "String set" })).toBeInTheDocument();
});

it("disables the 3rd inversion for a triad", () => {
  renderWithAtoms(<ChordOverlayControls />, {
    initialValues: [[chordOverlayModeAtom, "manual"], [chordQualityOverrideAtom, "Major Triad"]],
  });
  expect(screen.getByRole("button", { name: "3rd" })).toBeDisabled();
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx -t VOICING`
Expected: FAIL — the controls do not exist.

- [ ] **Step 4: Add the controls**

In `ChordOverlayControls.tsx`, add imports:

```tsx
import {
  voicingTypeAtom, voicingInversionAtom, voicingStringSetAtom, availableInversionsAtom,
} from "../../store/atoms";
import { StringSetPicker } from "../Inspector/StringSetPicker";
```

Add atom hooks near the other `useAtom` calls in the component body:

```tsx
  const [voicingType, setVoicingType] = useAtom(voicingTypeAtom);
  const [voicingInversion, setVoicingInversion] = useAtom(voicingInversionAtom);
  const [voicingStringSet, setVoicingStringSet] = useAtom(voicingStringSetAtom);
  const availableInversions = useAtomValue(availableInversionsAtom);
```

In the VOICING group (the `showDisplay` block created in Task 1), add the three `Prop` cells before the Full Chords `Prop`:

```tsx
            <Prop label={t("inspector.voicingType")} span={3}>
              <ToggleBar
                label="Voicing type"
                options={[
                  { value: "caged", label: t("inspector.voicingTypeCaged") },
                  { value: "drop2", label: t("inspector.voicingTypeDrop2") },
                  { value: "triad", label: t("inspector.voicingTypeTriad") },
                ]}
                value={voicingType}
                onChange={setVoicingType}
              />
            </Prop>
            <Prop label={t("inspector.voicingInversion")} span={3}>
              <ToggleBar
                label="Voicing inversion"
                options={[
                  { value: "root", label: "Root" },
                  { value: "1st", label: "1st" },
                  { value: "2nd", label: "2nd" },
                  { value: "3rd", label: "3rd" },
                ].map((o) => ({ ...o, disabled: !availableInversions.includes(o.value as typeof voicingInversion) }))}
                value={voicingInversion}
                onChange={setVoicingInversion}
              />
            </Prop>
            <Prop label={t("inspector.voicingStringSet")} span={6}>
              <StringSetPicker value={voicingStringSet} onChange={setVoicingStringSet} />
            </Prop>
```

`ToggleBar` is generic over the value type; the `setVoicingType` / `setVoicingInversion` setters are typed by the atoms, so the option `value` strings must match the atom union exactly (`caged|drop2|triad`, `root|1st|2nd|3rd`). Cast the inversion options' `value` to the atom type if TS complains.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChordOverlayControls/ src/i18n/
git commit -m "feat(inspector): wire the Chord-tab VOICING controls"
```

---

### Task 17: FretboardSVG — optional voicing shape

`FretboardSVG` types `fullChordVoicings` entries as `{ shape: CagedShape; notes: FullChordMatchNote[] }`. Algorithmic voicings have no `shape`. Make it optional and skip undefined shapes in the per-position map.

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx`
- Test: `src/components/FretboardSVG/` (existing test file) or `src/components/Fretboard/Fretboard.test.tsx`

- [ ] **Step 1: Make the prop type's `shape` optional**

In `FretboardSVG.tsx` (around line 115-118), change:

```tsx
  fullChordVoicings?: Array<{
    shape?: CagedShape;
    notes: FullChordMatchNote[];
  }>;
```

- [ ] **Step 2: Guard the shape map**

In the `fullChordShapeByPosition` `useMemo` (around line 284-296), skip voicings whose `shape` is undefined:

```tsx
  const fullChordShapeByPosition = useMemo(() => {
    const map = new Map<string, CagedShape>();
    for (const voicing of fullChordVoicings ?? []) {
      if (!voicing.shape) continue;
      for (const note of voicing.notes) {
        map.set(`${note.stringIndex}-${note.fretIndex}`, voicing.shape);
      }
    }
    return map;
  }, [fullChordVoicings]);
```

(Keep the existing map-population logic; only add the `if (!voicing.shape) continue;` guard. Adjust to the file's exact current code.)

- [ ] **Step 3: Trace the `fullChordVoicings` source**

Find where `App.tsx` (or a hook) supplies `fullChordVoicings` — it reads `fullChordMatchesAtom`. That atom now returns `Voicing[]` (Task 13), whose entries have an optional `shape` — type-compatible with the relaxed prop. Run `pnpm run build` and fix any type error at the call site (the `notes` shape is `VoicingNote` which is a superset of `FullChordMatchNote` — `VoicingNote` has the extra `midi`; the prop accepts `FullChordMatchNote`, and `VoicingNote` is assignable to it structurally since it has all of `FullChordMatchNote`'s fields). If TS rejects it, widen the prop's `notes` element type to `FullChordMatchNote` is fine; otherwise type it as `{ stringIndex: number; fretIndex: number; noteName: string }`.

- [ ] **Step 4: Run tests and build**

Run: `pnpm vitest run src/components/FretboardSVG src/components/Fretboard` then `pnpm run build`
Expected: PASS — drop2/triad voicings render as highlighted positions; caged voicings still carry their shape coloring.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.tsx
git commit -m "feat(fretboard): render algorithmic voicings without a CAGED shape"
```

---

### Task 18: Part 2 close-out — full gate and visual baselines

- [ ] **Step 1: Run the full local gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all pass, including `packages/core/src/shapes/fullChordShapes.test.ts` (unchanged — Approach B preserves the CAGED finder).

- [ ] **Step 2: Manually verify the engine in the app**

Run `pnpm run dev`. On the Chord tab: enable Full Chords, pick a Major 7th chord, switch Type to Drop 2 and Triad, change Inversion and String Set — confirm the fretboard highlights update and the `3rd` inversion is disabled for triads.

- [ ] **Step 3: Refresh visual baselines**

Run: `pnpm run test:visual:update`
Expected: `app-components` (Chord tab VOICING group) and `fretboard-svg` (drop2/triad/string-set voicings) snapshots refresh.

- [ ] **Step 4: Commit the baselines**

```bash
git add e2e/
git commit -m "test(visual): refresh baselines for the voicing engine"
```

---

## Self-Review Notes

- **Spec coverage:** Part 1 §4a-4h → Tasks 1-8; visual baselines → Task 9. Part 2 §5a (atoms) → Task 13; §5b (engine) → Tasks 10-12; §5c (UI) → Tasks 14-16; §5d (rendering) → Task 17; §5e resolve-items addressed inline (drop2-on-triad fallback in Task 11 Step 3; stale-inversion coercion in `voicingMatchesAtom` Task 13; span limits tuned in Task 11 Step 5). Testing per §4/§5 → each task's test steps + Tasks 9 and 18.
- **`groupDisplay` retained:** the `inspector.groupDisplay` key stays — `ViewTab` still uses it; only `ChordOverlayControls` stops using it (Task 1).
- **Type consistency:** `Voicing` / `VoicingNote` / `VoicingType` / `VoicingInversion` / `VoicingStringSet` / `GenerateVoicingsParams` defined in Task 10, consumed identically in Tasks 11-13, 15-17. `generateVoicings` signature is stable across Tasks 11-13.
- **Approach B preserved:** `getFullChordShapeMatches` and `fullChordShapes.test.ts` are untouched; `caged` routing delegates to them (Task 12).
