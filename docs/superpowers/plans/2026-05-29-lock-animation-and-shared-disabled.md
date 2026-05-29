# Lock Animation Polish + Shared Composable Disabled Style — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animate the locked-card accent line and lock icon (no layout jump), and introduce one composable, self-applying disabled style so every control inside a locked card reads as disabled.

**Architecture:** Issue 1 swaps the static inset box-shadow accent for an animated `::before` wipe (leaving `box-shadow` free for elevation). Issue 2 always renders the lock icon inside a width-collapsing `.lockSlot` so its reveal is animated and never reflows siblings abruptly. Issue 3 adds a `--control-disabled-opacity` token plus a global `[inert]`-descendant cascade (`controls.css`) so locked-card controls auto-style as disabled without per-call `disabled` props.

**Tech Stack:** React 19 + TypeScript, CSS Modules + global stylesheets, lucide-react, Vitest + Testing Library (jsdom), stylelint/eslint. Package manager **pnpm**.

**Source spec:** [`docs/superpowers/specs/2026-05-29-lock-animation-and-shared-disabled-design.md`](../specs/2026-05-29-lock-animation-and-shared-disabled-design.md)

**Run all commands from the worktree root:** `/Users/isaaccocar/repos/fretboard-app/.worktrees/playback-lock-overlay`

**Note on verification:** Several changes are pure CSS animation, which jsdom cannot evaluate. Those steps are verified by `stylelint` + the structural unit tests that still must pass + a final manual preview check (Task 7). Behavioral/DOM-structure changes (always-rendered icon, inert cascade target) are unit-tested.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/components/Inspector/InspectorCard.module.css` | Card chrome + lock visuals | `::before` accent wipe (Task 1); `.cardTitle`/`.lockSlot`/`.lockIcon` (Task 2); reduced-motion (Task 2) |
| `src/components/Inspector/InspectorCard.tsx` | Card markup | Always-rendered icon in title group (Task 2) |
| `src/components/Inspector/InspectorCard.test.tsx` | Card tests | Icon presence → `data-locked`/always-present (Task 2) |
| `src/styles/semantic.css` | Semantic tokens | `--control-disabled-opacity` (Task 3) |
| `src/components/Switch/Switch.module.css` | Switch styles | `:disabled` opacity → token (Task 3) |
| `src/components/Inspector/ChordTypeGrid.module.css` | Chord grid styles | `:disabled` opacity → token (Task 3) |
| `src/components/StepperShell/StepperShell.module.css` | Stepper button styles | `:disabled` opacity → token (Task 3) |
| `src/styles/controls.css` (new) | Global inert disabled cascade | create (Task 4) |
| `src/main.tsx` | Global CSS wiring | import `controls.css` (Task 4) |
| `src/components/SongControls/SongControls.tsx` | Song-tab wiring | drop redundant `disabled` on Sequence (Task 5) |
| `src/components/SongControls/SongControls.test.tsx` | Song-tab tests | repurpose icon test → inert cascade guard (Task 5) |

---

## Task 1: Animated accent line (`::before` wipe)

Replace the static inset box-shadow accent with an animated `::before` bar. This also removes the light-mode combined-box-shadow workaround, since the accent no longer uses `box-shadow`.

**Files:**
- Modify: `src/components/Inspector/InspectorCard.module.css:119-132`

- [ ] **Step 1: Remove the static box-shadow accent rules**

In `src/components/Inspector/InspectorCard.module.css`, delete these two rules (current lines 119-132):

```css
.card[data-locked="true"] {
  box-shadow: inset 2px 0 0 0 var(--faceplate-accent);
}

/* Light mode already carries a soft elevation shadow on .card; combine both so
   the accent line and the elevation coexist while locked (equal specificity,
   later source order would otherwise drop the elevation shadow). */
/* stylelint-disable selector-pseudo-class-no-unknown */
:global([data-theme="modern-light"]) .card[data-locked="true"] {
  box-shadow:
    inset 2px 0 0 0 var(--faceplate-accent),
    0 1px 4px rgb(42 37 29 / 0.06);
}
/* stylelint-enable selector-pseudo-class-no-unknown */
```

- [ ] **Step 2: Add the animated `::before` accent bar**

In `src/components/Inspector/InspectorCard.module.css`, add these rules where the deleted rules were:

```css
/* Animated left accent line: a 2px bar that wipes in from the top, synced with
   the body dim. Transform-based so it never touches the card's box-shadow — the
   light-mode elevation shadow on .card stays intact without special-casing. */
.card::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 2px;
  background: var(--faceplate-accent);
  transform: scaleY(0);
  transform-origin: top;
  opacity: 0;
  transition: transform 300ms ease, opacity 300ms ease;
  pointer-events: none;
}

.card[data-locked="true"]::before {
  transform: scaleY(1);
  opacity: 1;
}
```

- [ ] **Step 3: Lint the stylesheet**

Run: `pnpm exec stylelint src/components/Inspector/InspectorCard.module.css`
Expected: PASS (no errors).

- [ ] **Step 4: Run the InspectorCard tests (no behavioral regression)**

Run: `pnpm exec vitest run src/components/Inspector/InspectorCard.test.tsx`
Expected: PASS — the data-locked / inert / a11y tests are unaffected by the CSS swap.

- [ ] **Step 5: Commit**

```bash
git add src/components/Inspector/InspectorCard.module.css
git commit -m "feat(inspector): animate the locked-card accent line with a pseudo-element wipe"
```

---

## Task 2: Non-shifting, animated lock icon

Always render the icon inside a width-collapsing `.lockSlot` grouped with the `<h3>`. The reveal animates; unlocked cards reserve no space.

**Files:**
- Modify: `src/components/Inspector/InspectorCard.tsx:82-87`
- Modify: `src/components/Inspector/InspectorCard.module.css:134-142` (current `.lockIcon` rules)
- Test: `src/components/Inspector/InspectorCard.test.tsx:79-87`

- [ ] **Step 1: Update the tests to the always-rendered model (failing first)**

In `src/components/Inspector/InspectorCard.test.tsx`, replace the two tests at lines 79-87:

```tsx
  it("always renders the header lock icon (visibility is CSS-driven by data-locked)", () => {
    const lockedRender = renderCard({ locked: true });
    expect(lockedRender.container.querySelector(".lucide-lock")).toBeInTheDocument();
    lockedRender.unmount();

    const unlockedRender = renderCard();
    expect(unlockedRender.container.querySelector(".lucide-lock")).toBeInTheDocument();
  });

  it("marks the lock icon decorative and leaves the card un-locked when locked=false", () => {
    const { container } = renderCard();
    expect(container.querySelector("section[data-locked='true']")).toBeNull();
    const icon = container.querySelector(".lucide-lock");
    expect(icon).toBeInTheDocument();
    expect(icon!.closest("[aria-hidden='true']")).not.toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify the new expectation fails**

Run: `pnpm exec vitest run src/components/Inspector/InspectorCard.test.tsx -t "always renders the header lock icon"`
Expected: FAIL — the unlocked render currently returns `null` for `.lucide-lock` (the icon is conditionally rendered only when `locked`).

- [ ] **Step 3: Always render the icon inside the title group**

In `src/components/Inspector/InspectorCard.tsx`, replace the `<h3>` + conditional icon (current lines 82-87):

```tsx
        <h3 id={labelledById} className={styles.cardName}>
          {name}
        </h3>
        {locked ? (
          <Lock size={11} className={styles.lockIcon} aria-hidden="true" />
        ) : null}
```

with the title group:

```tsx
        <span className={styles.cardTitle}>
          <h3 id={labelledById} className={styles.cardName}>
            {name}
          </h3>
          <span className={styles.lockSlot} aria-hidden="true">
            <Lock size={11} className={styles.lockIcon} />
          </span>
        </span>
```

- [ ] **Step 4: Replace the `.lockIcon` CSS with the slot + icon animation**

In `src/components/Inspector/InspectorCard.module.css`, replace the current `.lockIcon` rules (lines 134-142):

```css
.lockIcon {
  color: var(--faceplate-accent);
  opacity: 0;
  transition: opacity 300ms ease 50ms;
}

.card[data-locked="true"] .lockIcon {
  opacity: 1;
}
```

with:

```css
.cardTitle {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

/* Collapses to zero width when unlocked (no reserved gap on never-locked cards),
   animates open when locked so the description slides instead of jumping. */
.lockSlot {
  display: inline-flex;
  align-items: center;
  width: 0;
  overflow: hidden;
  transition: width 300ms ease;
}

.card[data-locked="true"] .lockSlot {
  width: calc(11px + 0.4rem); /* icon width + its leading gap */
}

.lockIcon {
  margin-inline-start: 0.4rem;
  color: var(--faceplate-accent);
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 240ms ease 60ms, transform 240ms ease 60ms;
}

.card[data-locked="true"] .lockIcon {
  opacity: 1;
  transform: scale(1);
}
```

- [ ] **Step 5: Add the reduced-motion guard**

In `src/components/Inspector/InspectorCard.module.css`, append at the end of the file:

```css
@media (prefers-reduced-motion: reduce) {
  .card::before,
  .lockSlot,
  .lockIcon,
  .cardBody {
    transition: none;
  }
}
```

- [ ] **Step 6: Run the InspectorCard tests to verify they pass**

Run: `pnpm exec vitest run src/components/Inspector/InspectorCard.test.tsx`
Expected: PASS — all tests, including the two rewritten icon tests.

- [ ] **Step 7: Lint the stylesheet**

Run: `pnpm exec stylelint src/components/Inspector/InspectorCard.module.css`
Expected: PASS (no errors).

- [ ] **Step 8: Commit**

```bash
git add src/components/Inspector/InspectorCard.tsx src/components/Inspector/InspectorCard.module.css src/components/Inspector/InspectorCard.test.tsx
git commit -m "feat(inspector): animate the lock icon reveal without shifting the header layout"
```

---

## Task 3: Consolidate the disabled opacity into one token

Add `--control-disabled-opacity` and migrate the three magic-number `:disabled` opacities to reference it.

**Files:**
- Modify: `src/styles/semantic.css:112`
- Modify: `src/components/Switch/Switch.module.css` (`.switch:disabled`)
- Modify: `src/components/Inspector/ChordTypeGrid.module.css` (`.cell:disabled`)
- Modify: `src/components/StepperShell/StepperShell.module.css` (`.button:disabled`)

- [ ] **Step 1: Add the semantic token**

In `src/styles/semantic.css`, replace the line:

```css
  --disabled-opacity: var(--token-disabled-opacity);
```

with:

```css
  --disabled-opacity: var(--token-disabled-opacity);
  --control-disabled-opacity: var(--disabled-opacity); /* one knob for all control-like disabled states */
```

- [ ] **Step 2: Migrate Switch**

In `src/components/Switch/Switch.module.css`, change the `.switch:disabled` rule from:

```css
.switch:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
```

to:

```css
.switch:disabled {
  opacity: var(--control-disabled-opacity);
  cursor: not-allowed;
}
```

- [ ] **Step 3: Migrate ChordTypeGrid**

In `src/components/Inspector/ChordTypeGrid.module.css`, change the `.cell:disabled` rule from:

```css
.cell:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

to:

```css
.cell:disabled {
  opacity: var(--control-disabled-opacity);
  cursor: not-allowed;
}
```

- [ ] **Step 4: Migrate StepperShell**

In `src/components/StepperShell/StepperShell.module.css`, change the `.button:disabled` rule from:

```css
.button:disabled {
  opacity: 0.3;
  cursor: default;
}
```

to:

```css
.button:disabled {
  opacity: var(--control-disabled-opacity);
  cursor: default;
}
```

- [ ] **Step 5: Lint the changed stylesheets**

Run: `pnpm exec stylelint src/styles/semantic.css src/components/Switch/Switch.module.css src/components/Inspector/ChordTypeGrid.module.css src/components/StepperShell/StepperShell.module.css`
Expected: PASS (no errors).

- [ ] **Step 6: Run the affected component tests**

Run: `pnpm exec vitest run src/components/Switch src/components/StepperControl src/components/Inspector`
Expected: PASS — opacity is a visual token swap; no behavior changes.

- [ ] **Step 7: Commit**

```bash
git add src/styles/semantic.css src/components/Switch/Switch.module.css src/components/Inspector/ChordTypeGrid.module.css src/components/StepperShell/StepperShell.module.css
git commit -m "refactor(styles): consolidate control disabled opacity into --control-disabled-opacity"
```

---

## Task 4: Global inert disabled cascade (`controls.css`)

Create the cascade so any control inside an `inert` (locked) region auto-renders disabled, and wire it into the global stylesheet imports.

**Files:**
- Create: `src/styles/controls.css`
- Modify: `src/main.tsx:6`

- [ ] **Step 1: Create the cascade stylesheet**

Create `src/styles/controls.css` with:

```css
/* Canonical disabled appearance for control-like elements inside an inert
   (e.g. locked) region. `inert` already blocks interaction; this gives the
   subtree the matching visual state so it reads as disabled, not merely
   unresponsive. Explicit element selectors (specificity 0,1,1) deliberately
   outrank component module classes (0,1,0) so they win at rest, without
   needing !important or a per-call `disabled` prop. */
[inert] button,
[inert] [role="button"],
[inert] select,
[inert] input,
[inert] textarea,
[inert] [role="combobox"],
[inert] [role="spinbutton"] {
  opacity: var(--control-disabled-opacity);
  cursor: not-allowed;
}

@media (prefers-reduced-motion: no-preference) {
  [inert] button,
  [inert] [role="button"],
  [inert] select,
  [inert] input {
    transition: opacity 300ms ease;
  }
}
```

- [ ] **Step 2: Import it after the other global stylesheets**

In `src/main.tsx`, add the import after `themes.css` (currently line 6):

```ts
import './styles/tokens.css'
import './styles/index.css'
import './styles/semantic.css'
import './styles/themes.css'
import './styles/controls.css'
```

- [ ] **Step 3: Lint the new stylesheet**

Run: `pnpm exec stylelint src/styles/controls.css`
Expected: PASS (no errors).

- [ ] **Step 4: Verify the app still builds (import resolves)**

Run: `pnpm exec tsc -b --noEmit`
Expected: PASS — the new CSS import resolves and types compile.

- [ ] **Step 5: Commit**

```bash
git add src/styles/controls.css src/main.tsx
git commit -m "feat(styles): auto-disable control-like elements inside inert (locked) regions"
```

---

## Task 5: SongControls — rely on the cascade, drop the redundant `disabled`

With the cascade in place, the Sequence `PresetMenu` no longer needs `disabled={editsLocked}`; the locked card's `inert` body blocks and styles it. Repurpose the icon test into a cascade guard.

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx:213`
- Test: `src/components/SongControls/SongControls.test.tsx:220-233`

- [ ] **Step 1: Repurpose the icon test into an inert-cascade guard**

In `src/components/SongControls/SongControls.test.tsx`, replace the test at lines 220-233:

```tsx
  it("routes Key and Progression card controls through an inert ancestor during playback (shared disabled cascade)", () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(
      <TooltipProvider><SongControls /></TooltipProvider>,
      store,
    );
    act(() => { store.set(setProgressionPlayingAtom, true); });

    const keyCard = screen.getByRole("region", { name: /key/i });
    const progressionCard = screen.getByRole("region", { name: /progression/i });

    // Every interactive control in a locked card resolves to an inert ancestor —
    // that is what drives the shared disabled appearance (controls.css), so no
    // per-control `disabled` prop is required.
    const keyControl = keyCard.querySelector("button");
    expect(keyControl).not.toBeNull();
    expect(keyControl!.closest("[inert]")).not.toBeNull();

    // Lock icons are always rendered now (visibility is CSS-driven); presence is
    // a secondary check.
    expect(keyCard.querySelector(".lucide-lock")).toBeInTheDocument();
    expect(progressionCard.querySelector(".lucide-lock")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the guard to confirm it passes (controls already sit inside inert)**

Run: `pnpm exec vitest run src/components/SongControls/SongControls.test.tsx -t "shared disabled cascade"`
Expected: PASS — the Key card body is already `inert` when locked; this guard locks in that the cascade has a target.

- [ ] **Step 3: Remove the redundant `disabled` prop on the Sequence PresetMenu**

In `src/components/SongControls/SongControls.tsx`, in the `<PresetMenu …>` for the Preset card, delete the `disabled={editsLocked}` line (current line 213). The PresetMenu props become:

```tsx
                <PresetMenu
                  triggerLabel={t("inspector.progressionLabel")}
                  customLabel="Custom"
                  scaleLabel={getScaleDisplayLabel(scaleName)}
                  currentId={currentProgressionPresetId}
                  categories={categories}
                  suggestionGroups={suggestionGroups}
                  width="fill"
                  onSelect={handlePresetChange}
                />
```

- [ ] **Step 4: Run the SongControls test suite**

Run: `pnpm exec vitest run src/components/SongControls/SongControls.test.tsx`
Expected: PASS — the menu still cannot open during playback (the trigger is inside the `inert` body), and the cascade guard passes. Non-playback menu-open tests are unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/SongControls.tsx src/components/SongControls/SongControls.test.tsx
git commit -m "refactor(song): drop redundant disabled prop now covered by the inert cascade"
```

---

## Task 6: Full automated verification

Run the mandatory pre-PR checks (per `CLAUDE.md`).

- [ ] **Step 1: Lint (eslint + stylelint)**

Run: `pnpm run lint`
Expected: PASS (no errors).

- [ ] **Step 2: Unit + component tests**

Run: `pnpm run test`
Expected: PASS (all suites green).

- [ ] **Step 3: Production build**

Run: `pnpm run build`
Expected: PASS (`tsc -b && vite build` succeeds).

- [ ] **Step 4: Commit (only if lint/test produced incidental fixes)**

```bash
git status
# If anything changed: git add -A && git commit -m "chore: lint/test fixups for lock animation + shared disabled"
```

---

## Task 7: Manual preview verification

Confirm the animations and the shared disabled styling render correctly in the browser. Use the preview tooling (preview_start → navigate to the Song tab → screenshot), not manual user testing.

- [ ] **Step 1: Start the dev server and open the Song tab**

Start the preview server (`preview_start`), then in the app click the **Song** tab.

- [ ] **Step 2: Verify the locked transitions**

Click **Play** and observe (screenshot before/after):
- The cyan left accent line **wipes in from the top** over ~300ms on the Preset, Key, and Progression cards (not an instant snap).
- The lock icon **fades + scales in** in each header, and the description text **slides** smoothly rather than jumping; the never-locked Time and Backing Track cards show **no** reserved gap and no icon.
- Every control in the Preset, Key, and Progression cards (Sequence dropdown, Root/Scale selects, DegreeGrid, Quality select, Duration stepper + Beat/Bar toggle) renders **uniformly dimmed** (disabled look) — not just the Sequence dropdown.

- [ ] **Step 3: Verify the reverse transition**

Click **Stop** and confirm the accent line wipes out, the icon fades out, the slot collapses, and controls return to full opacity — all animated.

- [ ] **Step 4: Verify light mode**

Toggle the theme to light. Confirm the accent line is visible (`#147088`), the card keeps its soft elevation shadow while locked, and the disabled controls still read as dimmed.

- [ ] **Step 5: Capture a final screenshot for the PR**

Take a screenshot of the locked Song tab (dark mode) to attach to the PR description.

---

## Self-Review

**Spec coverage** (against `2026-05-29-lock-animation-and-shared-disabled-design.md`):
- Issue 1 — animated accent line via `::before`; remove box-shadow rules + light-mode workaround → Task 1. ✓
- Issue 2 — always-rendered icon in width-collapsing `.lockSlot`, animated, no abrupt shift → Task 2. ✓
- Reduced motion → Task 2 (Step 5) for card transitions; Task 4 (Step 1) gates the cascade transition. ✓
- Issue 3a — `--control-disabled-opacity` token + migrate Switch/ChordTypeGrid/StepperShell → Task 3. ✓
- Issue 3b — global `inert` cascade in `controls.css`, imported in `main.tsx` → Task 4. ✓
- Issue 3c — drop redundant `disabled` on Sequence PresetMenu → Task 5. ✓
- Test changes (icon presence → `data-locked`/always-present; SongControls icon test → inert-cascade guard) → Tasks 2 & 5. ✓

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Every code step shows complete code; CSS-visual steps are explicitly routed to stylelint + the Task 7 preview check.

**Type/selector consistency:** `--control-disabled-opacity` defined in Task 3 Step 1 is referenced identically in Tasks 3 (Steps 2-4) and 4 (Step 1). Class names `.cardTitle` / `.lockSlot` / `.lockIcon` are used identically in the Task 2 JSX (Step 3) and CSS (Step 4). The `[inert]`-descendant selector list in `controls.css` (Task 4) matches the control elements rendered by the Song-tab components surveyed in the spec. `data-locked` is the state attribute used consistently across InspectorCard CSS and both test files.
