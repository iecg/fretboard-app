# DAW Shell Phase 4 — TopBandSummary Reskin + View Tab Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin `TopBandSummary` into the DAW faceplate visual language and finalize the Inspector's View tab by migrating the Accidentals / Enharmonic-display / Scale-degree-colors switches out of `SettingsOverlay` and into `ViewTab`.

**Architecture:** Two independent surfaces, no shared state. (1) `TopBandSummary` loses its dead `progressionEnabled` branch (the `ProgressionSummarySlot` already gates it so that branch can never render) and its `.top-band-summary` CSS rule is restyled to the navy/cyan faceplate recipe used by `Inspector.module.css`. (2) Three notation/view `ToggleBar` controls move from `SettingsOverlay` into `ViewTab`; they bind to the same Jotai atoms (`accidentalModeAtom`, `enharmonicDisplayAtom`, `scaleDegreeColorsEnabledAtom`) — only the render location changes. `NotationSettingsSection` is deleted (both its fields migrate); `ViewSettingsSection` loses one field; `useSettingsForm` and `constants.ts` shed the now-unused bindings.

**Tech Stack:** React 19 + TypeScript, Jotai, CSS Modules with tokens from `src/styles/tokens.css` / `semantic.css`, `@radix-ui/react-tabs` (Inspector shell, untouched). Tests via Vitest + Testing Library + `vitest-axe`. Visual regression via Playwright (darwin + linux baselines).

**Spec:** `docs/superpowers/specs/2026-05-15-daw-shell-phases-4-7-design.md` §4.

---

## Context the engineer needs

- `src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx` renders
  `ProgressionTrack` when `progressionEnabledAtom` is `true`, otherwise `TopBandSummary`.
  **The two are mutually exclusive.** Therefore the `progressionEnabled && (…)` branch
  inside `TopBandSummary.tsx` is dead code — in production `TopBandSummary` only mounts
  when progression is off. The real mutual-exclusion behavior is already covered by
  `ProgressionSummarySlot.test.tsx` (do not modify that file).
- `SettingsOverlay` is **not** a staged form. `useSettingsForm` is a thin hook that
  bundles `useAtom` calls; every edit writes its atom immediately. Migrating a control to
  `ViewTab` is therefore a straight relocation — same live atom binding, no form
  semantics.
- The DAW faceplate recipe lives in `src/components/Inspector/Inspector.module.css`
  (`.root`): a navy substrate, a top-left cyan radial wash, a faint cyan border, and a
  soft drop shadow. Phase 4 replicates that recipe in `TopBandSummary.module.css`. The
  Inspector file itself is **not** modified.
- `ViewTab` already follows a "labelled control-section" pattern:
  `<div className={shared["control-section"]}><span className={shared["section-label"]}>…</span>…</div>`.
  The migrated controls reuse it. `shared` = `src/components/shared/shared.module.css`,
  which exports `control-section`, `section-label`, and `field-hint`.
- i18n keys already exist in `src/i18n/en.ts` and `src/i18n/es.ts`:
  `settings.fields.accidentals`, `settings.fields.accidentalsHint`,
  `settings.fields.enharmonicDisplay`, `settings.fields.enharmonicDisplayHint`,
  `settings.fields.scaleDegreeColors`, `settings.fields.scaleDegreeColorsHint`,
  `controls.on`, `controls.off`. Reuse them — do not add new keys.

---

## File Structure

**Modified:**
- `src/components/TopBandSummary/TopBandSummary.tsx` — remove the dead progression branch
  and its now-unused imports/hooks/computations.
- `src/components/TopBandSummary/TopBandSummary.test.tsx` — replace the two progression
  describe blocks with a content describe block.
- `src/components/TopBandSummary/TopBandSummary.module.css` — restyle `.top-band-summary`
  to the DAW faceplate; delete the dead `.progression-*` rules.
- `src/components/Inspector/ViewTab.tsx` — add the three migrated controls.
- `src/components/Inspector/ViewTab.test.tsx` — assert the migrated controls render and
  wire their atoms.
- `src/components/SettingsOverlay/SettingsOverlay.tsx` — drop the `NotationSettingsSection`
  import and render.
- `src/components/SettingsOverlay/sections/ViewSettingsSection.tsx` — drop the
  scale-degree-colors field.
- `src/components/SettingsOverlay/useSettingsForm.ts` — drop the three now-unused atom
  bindings.
- `src/components/SettingsOverlay/constants.ts` — drop `ACCIDENTAL_OPTIONS` /
  `ENHARMONIC_DISPLAY_OPTIONS` and their now-unused type imports.
- `src/components/SettingsOverlay/SettingsOverlay.test.tsx` — update the section-order and
  controls-present assertions; delete the scale-degree-colors-in-View test.

**Deleted:**
- `src/components/SettingsOverlay/sections/NotationSettingsSection.tsx`

**Auto-regenerated (visual baselines):**
- `e2e/app-layout.visual.spec.ts-snapshots/` — TopBandSummary appears in full-app shots.
- `e2e/app-mobile.visual.spec.ts-snapshots/` — TopBandSummary renders on mobile too.
- `e2e/app-overlays.visual.spec.ts-snapshots/` — the Settings drawer lost the Notation
  section.
- `e2e/inspector.visual.spec.ts-snapshots/` — the View tab gained three controls.
- `e2e/progression.visual.spec.ts-snapshots/` — `progression-disabled-pattern` shows
  `TopBandSummary`.
- (Refresh whatever actually diffs — Task 5 captures the real list.)

**Not touched:** `Inspector.module.css`, `Inspector.tsx`, `tabs.ts`, `ScaleTab`,
`ChordTab`, `ProgressionSummarySlot.tsx`, `ProgressionSummarySlot.test.tsx`,
`DegreeChipStrip`, `ChordPracticeBar`, every Jotai atom, every leaf control.

---

### Task 1: Remove the dead progression branch from TopBandSummary

**Files:**
- Modify: `src/components/TopBandSummary/TopBandSummary.tsx`
- Modify: `src/components/TopBandSummary/TopBandSummary.test.tsx`

`TopBandSummary` currently renders the scale `DegreeChipStrip` plus an
`<AnimatePresence>` that swaps between a progression-status block and the
`ChordPracticeBar`. The progression-status block is unreachable in production. This task
deletes it, leaving only the degree strip + chord-practice bar, and updates the unit
tests that exercised the dead branch directly.

- [ ] **Step 1: Replace the component body**

Replace the entire contents of `src/components/TopBandSummary/TopBandSummary.tsx` with:

```tsx
import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from "@fretflow/core";
import { showChordPracticeBarAtom } from "../../store/atoms";
import { useScaleState } from "../../hooks/useScaleState";
import { usePracticeBarState } from "../../hooks/usePracticeBarState";
import { DegreeChipStrip } from "../DegreeChipStrip/DegreeChipStrip";
import { ChordPracticeBar } from "../ChordPracticeBar/ChordPracticeBar";
import shared from "../shared/shared.module.css";
import styles from "./TopBandSummary.module.css";

/**
 * Scale-mode summary band. Rendered by ProgressionSummarySlot only when
 * progression mode is OFF — ProgressionTrack takes over when it is on — so this
 * component intentionally has no progression-status code path.
 */
export function TopBandSummary() {
  const {
    scaleLabel,
    hiddenNotes,
    toggleHiddenNote,
    degreeChips,
    colorNotes,
    scaleVisible,
    toggleScaleVisible,
  } = useScaleState();

  const showChordBar = useAtomValue(showChordPracticeBarAtom);
  const {
    practiceBarTitle,
    practiceBarBadge,
    practiceBarLensLabel,
    chordGroup,
    landOnGroup,
  } = usePracticeBarState();

  const colorNoteSet = colorNotes.length > 0 ? new Set<string>(colorNotes) : undefined;

  return (
    <div className={styles["top-band-summary"]} data-testid="top-band-summary">
      <DegreeChipStrip
        scaleName={scaleLabel}
        chips={degreeChips}
        hiddenNotes={scaleVisible ? hiddenNotes : undefined}
        onChipToggle={scaleVisible ? toggleHiddenNote : undefined}
        colorNotes={colorNoteSet}
        visible={scaleVisible}
        aria-label="Scale degrees"
        headerAction={
          <button
            type="button"
            className={shared["eye-toggle"]}
            aria-label={scaleVisible ? "Hide scale" : "Show scale"}
            aria-pressed={!scaleVisible}
            onClick={toggleScaleVisible}
          >
            <span className={shared["flex-center"]}>
              {scaleVisible
                ? <Eye size={18} aria-hidden="true" />
                : <EyeOff size={18} aria-hidden="true" />}
            </span>
          </button>
        }
      />
      <AnimatePresence initial={false}>
        {showChordBar && (
          <motion.div
            key="chord-section"
            className={styles["chord-section"]}
            initial={{ height: 0, overflow: "hidden", opacity: 0 }}
            animate={{ height: "auto", overflow: "visible", opacity: 1 }}
            exit={{ height: 0, overflow: "hidden", opacity: 0 }}
            transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
            data-testid="chord-practice-bar"
          >
            <ChordPracticeBar
              title={practiceBarTitle}
              badge={practiceBarBadge}
              lensLabel={practiceBarLensLabel}
              chordGroup={chordGroup}
              landOnGroup={landOnGroup}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

This drops the imports `showChordPracticeBarAtom`'s former neighbours
(`useProgressionPlaybackLoop`, `useProgressionState`, `findNextResolvableStepIndex`,
`formatProgressionDurationLabel`) and the whole progression-status JSX. `AnimatePresence`
stays so the chord bar keeps its enter/exit animation. The `!progressionEnabled` guard is
gone because the component only ever renders with progression off.

- [ ] **Step 2: Run the TopBandSummary tests to see the dead-branch tests fail**

Run: `npx vitest run src/components/TopBandSummary/TopBandSummary.test.tsx`
Expected: FAIL. The `TopBandSummary mutual exclusion` and `TopBandSummary progression
status row` describe blocks fail — they render with `progressionEnabledAtom: true` and
expect a `progression-status` element / `Bar X of N` text that no longer exists. The
`TopBandSummary motion wiring` describe still passes.

- [ ] **Step 3: Replace the two failing describe blocks with a content describe block**

In `src/components/TopBandSummary/TopBandSummary.test.tsx`, delete the entire
`describe("TopBandSummary mutual exclusion", …)` block and the entire
`describe("TopBandSummary progression status row", …)` block (lines ~48–79). Replace
them with this single block, keeping the existing `motion/react` mock and the
`describe("TopBandSummary motion wiring", …)` block untouched:

```tsx
describe("TopBandSummary content", () => {
  it("renders the scale degree summary band", () => {
    const { getByTestId } = renderWithAtoms(<TopBandSummary />);
    expect(getByTestId("top-band-summary")).toBeTruthy();
  });

  it("shows the chord practice bar when chord practice is active", () => {
    // Setting chordTypeAtom makes showChordPracticeBarAtom resolve true.
    const { queryByTestId } = renderWithAtoms(<TopBandSummary />, [
      [chordTypeAtom, "Major Triad"],
    ]);
    expect(queryByTestId("chord-practice-bar")).toBeTruthy();
  });

  it("never renders a progression-status block", () => {
    const { queryByTestId } = renderWithAtoms(<TopBandSummary />, [
      [progressionEnabledAtom, true],
      [chordTypeAtom, "Major Triad"],
    ]);
    expect(queryByTestId("progression-status")).toBeNull();
  });
});
```

The import line `import { progressionEnabledAtom, chordTypeAtom } from "../../store/atoms";`
stays as-is — both atoms are still referenced above.

- [ ] **Step 4: Run the TopBandSummary tests to verify they pass**

Run: `npx vitest run src/components/TopBandSummary/TopBandSummary.test.tsx`
Expected: PASS — `TopBandSummary content` (3 tests) and `TopBandSummary motion wiring`
(1 test).

- [ ] **Step 5: Confirm the slot-level coverage still passes**

Run: `npx vitest run src/components/ProgressionSummarySlot/ProgressionSummarySlot.test.tsx`
Expected: PASS, unchanged — this file owns the real progression/TopBandSummary
mutual-exclusion coverage and was not modified.

- [ ] **Step 6: Commit**

```bash
git add src/components/TopBandSummary/TopBandSummary.tsx src/components/TopBandSummary/TopBandSummary.test.tsx
git commit -m "refactor(top-band): remove unreachable progression branch from TopBandSummary"
```

---

### Task 2: Reskin the TopBandSummary surface to the DAW faceplate

**Files:**
- Modify: `src/components/TopBandSummary/TopBandSummary.module.css`

Restyle the `.top-band-summary` card to the navy/cyan faceplate recipe used by
`Inspector.module.css`, and delete the `.progression-*` CSS rules that the Task 1 JSX no
longer references. CSS is verified by stylelint + a visual checkpoint, not a unit test.

- [ ] **Step 1: Rewrite TopBandSummary.module.css**

Replace the entire contents of `src/components/TopBandSummary/TopBandSummary.module.css`
with:

```css
/* DAW faceplate surface — mirrors the recipe in Inspector.module.css so the
 * top band reads as the upper half of the same hardware unit as the Inspector.
 * (Values are duplicated rather than shared because Phase 4 must not modify
 * Inspector.module.css; a future phase may extract a shared `.faceplate`.) */
.top-band-summary {
  --topband-bg: #0a121d;
  --topband-bg-elevated: #0d1726;
  --topband-border: rgb(77 228 255 / 0.12);

  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(100%, 30rem);
  margin: 0 auto;
  overflow: visible;
  border: 1px solid var(--topband-border);
  border-radius: 12px;
  background:
    radial-gradient(120% 200% at 0% 0%, rgb(77 228 255 / 0.04), transparent 55%),
    linear-gradient(180deg, var(--topband-bg-elevated), var(--topband-bg));
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.02) inset,
    0 18px 40px -28px rgb(0 0 0 / 0.7);
  transition:
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);

  /* Suppress child strip surfaces — the faceplate owns the fill. */
  --strip-bg-override: transparent;
  --strip-border-override: none;
  --strip-shadow-override: none;

  /* Faceplate owns the rounded corners — flatten nested strip corners. */
  --strip-radius: 0;
}

/* stylelint-disable selector-pseudo-class-no-unknown */
:global(.app-container[data-layout-tier="desktop"][data-layout-variant^="desktop-"]) .top-band-summary {
  width: min(100%, 32rem);
}
/* stylelint-enable selector-pseudo-class-no-unknown */

.chord-section {
  width: 100%;
}

/* Inset hairline divider between the chip strip and the chord-practice bar.
   Rendered inside the animated motion container so it appears/disappears in
   lockstep with the content — no orphaned lines. */
.chord-section::before {
  content: "";
  display: block;
  height: 1px;
  margin: 0 0;
  background: var(--chrome-border);
  opacity: 0.6;
}
```

Everything `.progression-*` is gone (those classes had no remaining JSX consumer after
Task 1). `.chord-section` and its `::before` divider are kept.

- [ ] **Step 2: Run lint to verify the stylesheet is clean**

Run: `npm run lint`
Expected: 0 errors, 0 warnings. (`npm run lint` runs both eslint and stylelint.)

- [ ] **Step 3: Visual smoke-check in the dev server**

Start the dev server and open the app with progression mode **off** (the default):
`npm run dev`, then visit `http://localhost:5173/fretboard-app/`.
Expected: the top band renders as a navy faceplate with a faint cyan border and a soft
shadow, visually consistent with the Inspector panel below it. The degree chips and (when
chord practice is on) the chord-practice bar are legible on the dark substrate. Toggle a
chord on so the chord-practice bar appears and confirm the hairline divider shows.

If the degree chips or chord-practice text are not legible on the dark substrate, that is
a real regression — stop and fix the affected text token in `DegreeChipStrip` /
`ChordPracticeBar` styling before continuing (spec §4a permits styling-token changes to
those children). Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add src/components/TopBandSummary/TopBandSummary.module.css
git commit -m "style(top-band): reskin TopBandSummary to the DAW faceplate"
```

---

### Task 3: Migrate the notation/display controls into ViewTab

**Files:**
- Modify: `src/components/Inspector/ViewTab.tsx`
- Modify: `src/components/Inspector/ViewTab.test.tsx`

Add Accidentals, Enharmonic Display, and Scale Degree Colors controls to `ViewTab`, each
in the existing `control-section` pattern. They bind to `accidentalModeAtom`,
`enharmonicDisplayAtom`, and `scaleDegreeColorsEnabledAtom` — the same atoms the
`SettingsOverlay` controls use today. Task 4 removes the originals from `SettingsOverlay`.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/components/Inspector/ViewTab.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import {
  fretStartAtom,
  fretEndAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
  scaleDegreeColorsEnabledAtom,
} from "../../store/atoms";
import { ViewTab } from "./ViewTab";

describe("ViewTab", () => {
  it("renders the fingering pattern controls and the fret range group", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByRole("group", { name: /fret range/i })).toBeInTheDocument();
    expect(screen.getByText(/fingering pattern/i)).toBeInTheDocument();
  });

  it("reflects atom-seeded fret start/end values in the steppers", () => {
    renderWithAtoms(<ViewTab />, [
      [fretStartAtom, 3],
      [fretEndAtom, 8],
    ]);
    const startGroup = screen.getByRole("group", { name: /start fret/i });
    expect(startGroup.textContent).toContain("3");
    const endGroup = screen.getByRole("group", { name: /end fret/i });
    expect(endGroup.textContent).toContain("8");
  });

  it("renders the accidentals, enharmonic, and scale-degree-color controls", () => {
    renderWithAtoms(<ViewTab />, [
      [accidentalModeAtom, "flats"],
      [enharmonicDisplayAtom, "on"],
      [scaleDegreeColorsEnabledAtom, true],
    ]);
    expect(screen.getByRole("group", { name: /accidentals/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /enharmonic display/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /scale degree colors/i })).toBeInTheDocument();
    // Seeded accidental mode "flats" → the ♭ option button is pressed.
    expect(screen.getByRole("button", { name: "♭" })).toHaveAttribute("aria-pressed", "true");
  });

  it("updates the accidental mode atom when an option is clicked", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<ViewTab />, [[accidentalModeAtom, "auto"]]);
    await user.click(screen.getByRole("button", { name: "♯" }));
    expect(screen.getByRole("button", { name: "♯" })).toHaveAttribute("aria-pressed", "true");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ViewTab />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/components/Inspector/ViewTab.test.tsx`
Expected: FAIL — the two prior tests and the a11y test pass, but
`renders the accidentals, enharmonic, and scale-degree-color controls` and
`updates the accidental mode atom when an option is clicked` FAIL because those controls
do not exist in `ViewTab` yet.

- [ ] **Step 3: Implement the migrated controls in ViewTab**

Replace the entire contents of `src/components/Inspector/ViewTab.tsx` with:

```tsx
import { useAtom } from "jotai";
import {
  fretStartAtom,
  fretEndAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
  scaleDegreeColorsEnabledAtom,
} from "../../store/atoms";
import { MAX_FRET } from "@fretflow/core";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { FretRangeControl } from "../FretRangeControl/FretRangeControl";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { useTranslation } from "../../hooks/useTranslation";
import shared from "../shared/shared.module.css";
import styles from "./ViewTab.module.css";

const ACCIDENTAL_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "♯", value: "sharps" },
  { label: "♭", value: "flats" },
] as const;

const ENHARMONIC_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "On", value: "on" },
  { label: "Off", value: "off" },
] as const;

export function ViewTab() {
  const { t } = useTranslation();
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);
  const [accidentalMode, setAccidentalMode] = useAtom(accidentalModeAtom);
  const [enharmonicDisplay, setEnharmonicDisplay] = useAtom(enharmonicDisplayAtom);
  const [scaleDegreeColors, setScaleDegreeColors] = useAtom(scaleDegreeColorsEnabledAtom);

  return (
    <div className={styles.root} data-inspector-tab="view">
      <FingeringPatternControls />
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Fret Range</span>
        <FretRangeControl
          startFret={fretStart}
          endFret={fretEnd}
          onStartChange={setFretStart}
          onEndChange={setFretEnd}
          maxFret={MAX_FRET}
          layout="dashboard"
        />
      </div>
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>
          {t("settings.fields.accidentals")}
        </span>
        <ToggleBar
          label={t("settings.fields.accidentals")}
          options={ACCIDENTAL_OPTIONS}
          value={accidentalMode}
          onChange={(v) => setAccidentalMode(v as typeof accidentalMode)}
        />
        <p className={shared["field-hint"]}>{t("settings.fields.accidentalsHint")}</p>
      </div>
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>
          {t("settings.fields.enharmonicDisplay")}
        </span>
        <ToggleBar
          label={t("settings.fields.enharmonicDisplay")}
          options={ENHARMONIC_OPTIONS}
          value={enharmonicDisplay}
          onChange={(v) => setEnharmonicDisplay(v as typeof enharmonicDisplay)}
        />
        <p className={shared["field-hint"]}>
          {t("settings.fields.enharmonicDisplayHint")}
        </p>
      </div>
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>
          {t("settings.fields.scaleDegreeColors")}
        </span>
        <ToggleBar
          label={t("settings.fields.scaleDegreeColors")}
          options={[
            { value: "false", label: t("controls.off") },
            { value: "true", label: t("controls.on") },
          ]}
          value={String(scaleDegreeColors)}
          onChange={(v) => setScaleDegreeColors(v === "true")}
        />
        <p className={shared["field-hint"]}>
          {t("settings.fields.scaleDegreeColorsHint")}
        </p>
      </div>
    </div>
  );
}
```

`ViewTab.module.css` needs no change — `.root` already gaps its children with
`var(--space-3)`. The "Fret Range" section label stays a hardcoded string (unchanged from
the Phase 3 baseline); the three migrated labels are localized because their i18n keys
already exist.

- [ ] **Step 4: Run the ViewTab tests to verify they pass**

Run: `npx vitest run src/components/Inspector/ViewTab.test.tsx`
Expected: PASS — all 5 tests.

- [ ] **Step 5: Run the Inspector tests to confirm no regression**

Run: `npx vitest run src/components/Inspector/`
Expected: PASS — `Inspector.test.tsx` still passes (it asserts the View tab shows
"fingering pattern" text and a "fret range" group, both still true), plus
`ViewTab.test`, `ScaleTab.test`, `ChordTab.test`.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/ViewTab.tsx src/components/Inspector/ViewTab.test.tsx
git commit -m "feat(inspector): host Accidentals/Enharmonic/Scale-degree-color controls in ViewTab"
```

---

### Task 4: Remove the migrated controls from SettingsOverlay

**Files:**
- Modify: `src/components/SettingsOverlay/SettingsOverlay.test.tsx`
- Delete: `src/components/SettingsOverlay/sections/NotationSettingsSection.tsx`
- Modify: `src/components/SettingsOverlay/SettingsOverlay.tsx`
- Modify: `src/components/SettingsOverlay/sections/ViewSettingsSection.tsx`
- Modify: `src/components/SettingsOverlay/useSettingsForm.ts`
- Modify: `src/components/SettingsOverlay/constants.ts`

The Accidentals and Enharmonic Display controls were the *only* contents of the Notation
section, so that section and its component are deleted entirely. Scale Degree Colors
leaves the View section. After this task the three controls live solely in `ViewTab`.

- [ ] **Step 1: Update the SettingsOverlay tests to the new expectations**

In `src/components/SettingsOverlay/SettingsOverlay.test.tsx` make three edits:

(a) Delete the entire test
`it("renders scale degree colors as a divided View setting with hint styling", () => { … });`
(the block spanning roughly lines 114–129). Scale Degree Colors no longer appears in the
Settings drawer at all.

(b) In `it("renders sections in the expected order", …)`, change the expected array to
drop `"Notation"`:

```tsx
    expect(headings).toEqual([
      "View",
      "Instrument",
      "Language",
      "Appearance",
      "Chord Layout",
      "Reset",
    ]);
```

(c) In `it("renders all settings controls in the redesigned drawer", …)`, delete these
three assertion lines:

```tsx
    expect(screen.getByText("Scale Degree Colors")).toBeTruthy();
    expect(screen.getByText("Accidentals")).toBeTruthy();
    expect(screen.getByText("Enharmonic Display")).toBeTruthy();
```

Leave every other assertion in that test (Zoom, Fret Range, Tuning, Language, Theme,
Chord Spread, Reset) unchanged.

- [ ] **Step 2: Run the SettingsOverlay tests to verify they fail**

Run: `npx vitest run src/components/SettingsOverlay/SettingsOverlay.test.tsx`
Expected: FAIL — `renders sections in the expected order` fails because the live drawer
still renders a "Notation" section. (The controls-present test may still pass since the
removed assertions were deletions, not new expectations; the section-order test is the
guaranteed red.)

- [ ] **Step 3: Delete NotationSettingsSection**

Run: `git rm src/components/SettingsOverlay/sections/NotationSettingsSection.tsx`

- [ ] **Step 4: Remove the NotationSettingsSection usage from SettingsOverlay.tsx**

In `src/components/SettingsOverlay/SettingsOverlay.tsx`:

Delete the import line:

```tsx
import NotationSettingsSection from "./sections/NotationSettingsSection";
```

Delete the render line inside `SettingsOverlaySurface` (between `<AppearanceSettingsSection />`
and `<ChordLayoutSettingsSection />`):

```tsx
          <NotationSettingsSection />
```

- [ ] **Step 5: Remove the Scale Degree Colors field from ViewSettingsSection**

Replace the entire contents of
`src/components/SettingsOverlay/sections/ViewSettingsSection.tsx` with:

```tsx
import clsx from "clsx";
import { StepperControl } from "../../StepperControl/StepperControl";
import { FretRangeControl } from "../../FretRangeControl/FretRangeControl";
import { MAX_FRET, FRET_ZOOM_MIN, FRET_ZOOM_MAX } from "@fretflow/core";
import { ZOOM_STEP, SETTING_FIELDS } from "../constants";
import { OverlayFieldHeader } from "../shared";
import { useSettingsForm } from "../useSettingsForm";
import { useTranslation } from "../../../hooks/useTranslation";
import styles from "../SettingsOverlay.module.css";

export default function ViewSettingsSection() {
  const { t } = useTranslation();
  const { fretZoom, setFretZoom, fretStart, setFretStart, fretEnd, setFretEnd } =
    useSettingsForm();
  return (
    <>
      <div
        className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}
      >
        <OverlayFieldHeader label={t(SETTING_FIELDS.zoom.labelKey)} />
        <div className={styles["overlay-field-control"]}>
          <StepperControl
            value={fretZoom}
            onChange={setFretZoom}
            min={FRET_ZOOM_MIN}
            max={FRET_ZOOM_MAX}
            step={ZOOM_STEP}
            formatValue={(zoom) => (zoom <= 100 ? t("settings.view.auto") : `${zoom}${t("settings.view.zoomSuffix")}`)}
            buttonVariant="mobile"
          />
        </div>
      </div>
      <div className={styles["overlay-field"]}>
        <OverlayFieldHeader label={t(SETTING_FIELDS.fretRange.labelKey)} />
        <div className={styles["overlay-field-control"]}>
          <FretRangeControl
            startFret={fretStart}
            endFret={fretEnd}
            onStartChange={setFretStart}
            onEndChange={setFretEnd}
            maxFret={MAX_FRET}
            layout="mobile"
          />
        </div>
      </div>
    </>
  );
}
```

This drops the scale-degree-colors `<div>`, the unused `ToggleBar` and `shared` imports,
and the `scaleDegreeColorsEnabled` destructure. The Fret Range field loses its
`overlay-field--divided` modifier because it is now the last field in the section.

- [ ] **Step 6: Trim the now-unused atoms from useSettingsForm**

Replace the entire contents of `src/components/SettingsOverlay/useSettingsForm.ts` with:

```ts
import { useAtom } from "jotai";
import {
  fretZoomAtom,
  fretStartAtom,
  fretEndAtom,
  tuningNameAtom,
  chordFretSpreadAtom,
} from "../../store/atoms";

export function useSettingsForm() {
  const [fretZoom, setFretZoom] = useAtom(fretZoomAtom);
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);
  const [tuningName, setTuningName] = useAtom(tuningNameAtom);
  const [chordFretSpread, setChordFretSpread] = useAtom(chordFretSpreadAtom);

  return {
    fretZoom,
    setFretZoom,
    fretStart,
    setFretStart,
    fretEnd,
    setFretEnd,
    tuningName,
    setTuningName,
    chordFretSpread,
    setChordFretSpread,
  };
}
```

`accidentalModeAtom`, `enharmonicDisplayAtom`, and `scaleDegreeColorsEnabledAtom` are
removed — `NotationSettingsSection` (deleted) and the old `ViewSettingsSection` field were
their only consumers. `InstrumentSettingsSection` still uses `tuningName`; `chordFretSpread`
is left intact (pre-existing, out of scope).

- [ ] **Step 7: Remove the unused option arrays from constants.ts**

In `src/components/SettingsOverlay/constants.ts`:

Delete the `ACCIDENTAL_OPTIONS` block and the `ENHARMONIC_DISPLAY_OPTIONS` block (the two
`export const … as const satisfies …` arrays near the top of the file). They were only
consumed by the deleted `NotationSettingsSection`.

Then update the type import at the top of the file — change:

```ts
import {
  type AccidentalOptionValue,
  type EnharmonicDisplayValue,
  type ThemeOptionValue,
  type SettingFieldKey,
  type SettingFieldConfig,
  type SettingsSectionConfig,
} from "./types";
```

to:

```ts
import {
  type ThemeOptionValue,
  type SettingFieldKey,
  type SettingFieldConfig,
  type SettingsSectionConfig,
} from "./types";
```

Leave `THEME_OPTIONS`, `SETTING_FIELDS`, `SETTINGS_SECTIONS`, `ZOOM_STEP`, and
`LANGUAGE_OPTIONS` unchanged. (The `accidentals` / `enharmonicDisplay` / `scaleDegreeColors`
entries inside `SETTING_FIELDS` stay — `SETTING_FIELDS` is typed `Record<SettingFieldKey, …>`
so every key must remain present; they are harmless config data, not dead code paths.)

- [ ] **Step 8: Run the SettingsOverlay tests to verify they pass**

Run: `npx vitest run src/components/SettingsOverlay/SettingsOverlay.test.tsx`
Expected: PASS — all remaining tests, including the updated section-order and
controls-present tests.

- [ ] **Step 9: Run lint and typecheck to catch stray references**

Run: `npm run lint`
Then run: `npm run build`
Expected: 0 lint errors; the build's `tsc -b` step passes. If either flags a dangling
import of `NotationSettingsSection`, `ACCIDENTAL_OPTIONS`, `ENHARMONIC_DISPLAY_OPTIONS`,
or a removed `useSettingsForm` return, follow the trail and delete that reference too.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(settings): drop notation/display controls migrated to the View tab"
```

---

### Task 5: Refresh the visual regression baselines

**Files:**
- Modify (auto-generated): darwin + linux PNGs under the snapshot directories listed
  below — only those that actually diff.

The TopBandSummary reskin, the populated View tab, and the shortened Settings drawer all
change rendered pixels. Refresh both platforms.

- [ ] **Step 1: Run the visual suite and capture the failures**

Run: `npm run test:visual`
Expected: a controlled set of failures. Likely suites: `app-layout` (TopBandSummary in
full-app shots), `app-mobile` (TopBandSummary renders on mobile), `app-overlays` (Settings
drawer lost the Notation section), `inspector` (View tab gained three controls),
`progression` (`progression-disabled-pattern` shows TopBandSummary). Note exactly which
snapshot names diffed. If anything diffs that is not plausibly explained by these three
changes, stop and investigate before refreshing.

- [ ] **Step 2: Refresh the darwin baselines**

Run: `npm run test:visual:update`
Then re-run: `npm run test:visual`
Expected: the diffed darwin PNGs are regenerated; the suite now passes on darwin.

- [ ] **Step 3: Refresh the linux baselines**

Run: `npm run test:visual:update:linux`
Expected: the docker run completes; the linux PNGs are regenerated alongside the darwin
ones.

- [ ] **Step 4: Eyeball the regenerated PNGs**

Open each changed PNG (use `git status` to list them) and confirm: the top band shows the
navy faceplate; the View tab shows Accidentals / Enharmonic Display / Scale Degree Colors
below Fret Range; the Settings drawer no longer has a Notation section. If any snapshot
shows clipped content, an unstyled control, or missing controls, that is a real
regression — stop and fix the source, then re-run from Step 1.

- [ ] **Step 5: Commit**

```bash
git add e2e/
git commit -m "test(visual): refresh baselines for DAW shell Phase 4"
```

---

### Final Verification

Run the full quality gate locally before opening the PR (per `CLAUDE.md`).

- [ ] **Lint**

Run: `npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Unit + integration tests**

Run: `npm run test`
Expected: all tests pass, including the rewritten `TopBandSummary.test`, the expanded
`ViewTab.test`, and the updated `SettingsOverlay.test`.

- [ ] **Production build**

Run: `npm run build`
Expected: clean build (`tsc -b && vite build`).

- [ ] **E2E (production)**

Run: `npm run test:e2e:production`
Expected: all e2e tests pass.

- [ ] **Visual regression (darwin)**

Run: `npm run test:visual`
Expected: all tests pass on darwin.

- [ ] **Visual regression (linux)**

Run: `npm run test:visual:ci`
Expected: all tests pass on linux.

If any step fails: stop, return to the task that produced the regression, fix it,
recommit, then resume verification.

---

## Notes for the next phase

- Phase 6 (extract `TransportBar` from `ProgressionTrack`) is next in the build order
  (4 → 6 → 5 → 7). It does not depend on any Phase 4 file.
- The faceplate recipe is now duplicated in `Inspector.module.css` and
  `TopBandSummary.module.css`. If a third surface needs it (Phase 6's `TransportBar` is a
  candidate), extract a shared `.faceplate` class or token set at that point rather than
  copying a third time.
- The deferred "chord-type-for-scale chip row" (spec §4c, dropped) still needs its own
  brainstorm if that feature is wanted.
