# Keyboard-Shortcut Focus Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move DOM focus to the tempo stepper (↑/↓) and the chord step list (←/→) after the global arrow-key shortcuts fire, so the existing `:focus-visible` ring highlights the control that changed instead of the whole tab body or a stale chord row.

**Architecture:** The global `useKeyboardShortcuts` hook already mutates atoms but never moves focus. We give the two target controls stable DOM ids and make them programmatically focusable (`tabIndex={-1}`), add `:focus-visible` rings using existing tokens, and have the hook call `getElementById(id)?.focus({ preventScroll: true })` after each relevant mutation — the same pattern already used in `MobilePanel.tsx`. If a target is on the hidden tab, `getElementById` returns `null` and focusing is a silent no-op (state still updates).

**Tech Stack:** React 19 + TypeScript, Jotai, CSS Modules, Vitest + Testing Library (jsdom).

---

## Spec

See [`docs/superpowers/specs/2026-06-15-keyboard-shortcut-focus-design.md`](../specs/2026-06-15-keyboard-shortcut-focus-design.md).

## File structure

| File | Responsibility |
| --- | --- |
| `src/components/SongControls/progressionFocusIds.ts` | **New.** Two exported id-string constants shared by the hook and the components, so the ids never drift. |
| `src/components/StepperControl/StepperControl.tsx` | Accept an optional `groupId`; forward it as `id` + `tabIndex={-1}` to the `StepperShell` group element. |
| `src/components/StepperShell/StepperShell.module.css` | Add a `:focus-visible` ring on `.shell`. |
| `src/components/SongControls/ProgressionStepList.tsx` | Give the `.scroll` container the shared id + `tabIndex={-1}`. |
| `src/components/SongControls/ProgressionStepList.module.css` | Add a `:focus-visible` ring on `.scroll`. |
| `src/components/SongControls/SongControls.tsx` | Pass `groupId` to the tempo `StepperControl`. |
| `src/hooks/useKeyboardShortcuts.ts` | Focus the tempo group / chord list after the four arrow shortcuts. |
| `src/hooks/useKeyboardShortcuts.test.tsx` | New tests for the focus moves + off-tab no-op. |
| `src/components/StepperControl/StepperControl.test.tsx` | New/extended test: `groupId` renders id + `tabIndex`. |
| `src/components/SongControls/ProgressionStepList.test.tsx` | New/extended test: scroll container has id + `tabIndex`. |

Notes verified during planning:
- `StepperShell` extends `HTMLAttributes<HTMLDivElement>` and spreads `{...props}` onto its `div`, so forwarding `id` and `tabIndex` requires no change to `StepperShell.tsx`.
- `MobilePanels.module.css` `.panel` already sets `outline: none`; **no mobile-panel CSS change is needed.**
- `.shell` composes `surface--control`, which already rings on `:focus-within`; the new `.shell:focus-visible` rule adds the glow and makes keyboard focus on the group element explicit.

---

## Task 1: Shared focus-target id constants

**Files:**
- Create: `src/components/SongControls/progressionFocusIds.ts`

- [ ] **Step 1: Create the constants module**

```typescript
// Stable DOM ids for the controls that global keyboard shortcuts focus after
// mutating their state (see src/hooks/useKeyboardShortcuts.ts). Shared so the
// hook and the components can never drift on the id string.

/** The tempo stepper group (↑/↓ shortcuts focus this). */
export const TEMPO_STEPPER_ID = "progression-tempo-stepper";

/** The chord step list scroll container (←/→ shortcuts focus this). */
export const PROGRESSION_STEP_LIST_ID = "progression-step-list";
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm exec tsc -b --noEmit`
Expected: no errors (the file is plain constants).

- [ ] **Step 3: Commit**

```bash
git add src/components/SongControls/progressionFocusIds.ts
git commit -m "feat(shortcuts): add shared focus-target id constants"
```

---

## Task 2: StepperControl forwards a focusable group id

**Files:**
- Modify: `src/components/StepperControl/StepperControl.tsx`
- Modify: `src/components/StepperShell/StepperShell.module.css`
- Test: `src/components/StepperControl/StepperControl.test.tsx`

- [ ] **Step 1: Write the failing test**

If `StepperControl.test.tsx` already exists, append this `describe` block; otherwise create the file with this content.

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StepperControl } from "./StepperControl";

describe("StepperControl groupId", () => {
  it("renders the group element with the given id and tabIndex=-1", () => {
    const { container } = render(
      <StepperControl
        value={100}
        onChange={() => {}}
        min={40}
        max={240}
        groupId="test-stepper"
        label="Tempo"
      />,
    );

    const group = container.querySelector("#test-stepper");
    expect(group).not.toBeNull();
    expect(group?.getAttribute("role")).toBe("group");
    expect(group?.getAttribute("tabindex")).toBe("-1");
  });

  it("does not set a tabIndex when no groupId is given", () => {
    const { container } = render(
      <StepperControl value={100} onChange={() => {}} min={40} max={240} label="Tempo" />,
    );

    const group = container.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    expect(group?.getAttribute("tabindex")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/StepperControl/StepperControl.test.tsx`
Expected: FAIL — the first test cannot find `#test-stepper` (prop not wired yet).

- [ ] **Step 3: Add the `groupId` prop and forward it**

In `src/components/StepperControl/StepperControl.tsx`, add the prop to the interface (after the `disabled` prop):

```typescript
  /** When true, both stepper buttons are disabled regardless of value bounds. */
  disabled?: boolean;
  /** When set, the stepper group element gets this DOM id and becomes
   * programmatically focusable (tabIndex=-1) so global keyboard shortcuts can
   * focus it. Does not add a Tab stop — the +/- buttons remain the tab stops. */
  groupId?: string;
```

Add `groupId` to the destructured params:

```typescript
  testId,
  width,
  disabled = false,
  groupId,
}: StepperControlProps) {
```

Forward it to the `StepperShell` group element (the element that already has `role="group"`):

```tsx
      <StepperShell
        className={styles["stepper-group"]}
        role="group"
        aria-label={label ?? "Stepper control"}
        data-testid={testId}
        id={groupId}
        tabIndex={groupId ? -1 : undefined}
      >
```

- [ ] **Step 4: Add the `:focus-visible` ring to the shell**

In `src/components/StepperShell/StepperShell.module.css`, add this rule immediately after the existing `.shell { ... }` block:

```css
.shell:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
  box-shadow: var(--focus-ring-glow);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/StepperControl/StepperControl.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/StepperControl/StepperControl.tsx src/components/StepperShell/StepperShell.module.css src/components/StepperControl/StepperControl.test.tsx
git commit -m "feat(stepper): optional focusable groupId with focus-visible ring"
```

---

## Task 3: ProgressionStepList scroll container becomes focusable

**Files:**
- Modify: `src/components/SongControls/ProgressionStepList.tsx`
- Modify: `src/components/SongControls/ProgressionStepList.module.css`
- Test: `src/components/SongControls/ProgressionStepList.test.tsx`

- [ ] **Step 1: Write the failing test**

If `ProgressionStepList.test.tsx` already exists, append this `describe` block; otherwise create the file with this content.

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProgressionStepList } from "./ProgressionStepList";
import { PROGRESSION_STEP_LIST_ID } from "./progressionFocusIds";
import type { ResolvedProgressionStep } from "../../progressions/progressionDomain";

const steps = [
  {
    id: "s0",
    degree: "I",
    duration: 4,
    resolvedChordLabel: "C",
    unavailable: false,
  },
  {
    id: "s1",
    degree: "V",
    duration: 4,
    resolvedChordLabel: "G",
    unavailable: false,
  },
] as unknown as ResolvedProgressionStep[];

describe("ProgressionStepList focus target", () => {
  it("exposes a focusable scroll container with the shared id", () => {
    const { container } = render(
      <ProgressionStepList
        steps={steps}
        activeIndex={0}
        onSelect={() => {}}
        label="Progression"
        caption="Steps"
      />,
    );

    const scroll = container.querySelector(`#${PROGRESSION_STEP_LIST_ID}`);
    expect(scroll).not.toBeNull();
    expect(scroll?.getAttribute("tabindex")).toBe("-1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/SongControls/ProgressionStepList.test.tsx`
Expected: FAIL — no element with id `progression-step-list`.

- [ ] **Step 3: Add the id + tabIndex to the scroll container**

In `src/components/SongControls/ProgressionStepList.tsx`, add the import near the top (with the other relative imports):

```typescript
import { PROGRESSION_STEP_LIST_ID } from "./progressionFocusIds";
```

Change the `.scroll` wrapper `div` so it carries the id and is focusable:

```tsx
      <div className={styles.scroll} id={PROGRESSION_STEP_LIST_ID} tabIndex={-1}>
```

- [ ] **Step 4: Add the `:focus-visible` ring**

In `src/components/SongControls/ProgressionStepList.module.css`, add this rule immediately after the existing `.scroll { ... }` block (around line 46):

```css
.scroll:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
  border-radius: var(--radius-md);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/SongControls/ProgressionStepList.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/SongControls/ProgressionStepList.tsx src/components/SongControls/ProgressionStepList.module.css src/components/SongControls/ProgressionStepList.test.tsx
git commit -m "feat(progression): focusable chord-list scroll container with ring"
```

---

## Task 4: Wire the tempo stepper id in SongControls

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`

This is a pure wire-up of the prop from Task 2; it is covered end-to-end by the hook test in Task 5 (which renders nothing of SongControls but relies on the id contract) and by manual verification. No separate unit test.

- [ ] **Step 1: Import the constant**

In `src/components/SongControls/SongControls.tsx`, add to the relative imports:

```typescript
import { TEMPO_STEPPER_ID } from "./progressionFocusIds";
```

- [ ] **Step 2: Pass `groupId` to the tempo StepperControl**

Find the tempo `StepperControl` (inside the `inspector.meterTempo` `Prop`, around line 304) and add the `groupId` prop:

```tsx
                <StepperControl
                  label={t("inspector.meterTempo")}
                  hideLabel
                  value={progressionTempoBpm}
                  min={MIN_PROGRESSION_TEMPO_BPM}
                  max={MAX_PROGRESSION_TEMPO_BPM}
                  step={5}
                  formatValue={(bpm) => `${bpm} BPM`}
                  onChange={setProgressionTempoBpm}
                  width="auto"
                  groupId={TEMPO_STEPPER_ID}
                />
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SongControls/SongControls.tsx
git commit -m "feat(song): give the tempo stepper its shortcut focus id"
```

---

## Task 5: Hook moves focus after the arrow shortcuts

**Files:**
- Modify: `src/hooks/useKeyboardShortcuts.ts`
- Test: `src/hooks/useKeyboardShortcuts.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/hooks/useKeyboardShortcuts.test.tsx`, add these imports to the existing import block:

```tsx
import { activeProgressionStepIndexAtom, progressionTempoBpmAtom } from "../store/progressionAtoms";
import { TEMPO_STEPPER_ID, PROGRESSION_STEP_LIST_ID } from "../components/SongControls/progressionFocusIds";
```

(`activeProgressionStepIndexAtom` may already be imported — if so, only add `progressionTempoBpmAtom`.)

Append these tests inside the top-level `describe("useKeyboardShortcuts", ...)` block, before its closing `});`:

```tsx
  it("ArrowUp moves focus to the tempo stepper when it is present", () => {
    store.set(progressionTempoBpmAtom, 100);
    const el = document.createElement("div");
    el.id = TEMPO_STEPPER_ID;
    el.tabIndex = -1;
    document.body.appendChild(el);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowUp" }); });

    expect(store.get(progressionTempoBpmAtom)).toBe(105);
    expect(document.activeElement).toBe(el);
    document.body.removeChild(el);
  });

  it("ArrowDown moves focus to the tempo stepper when it is present", () => {
    store.set(progressionTempoBpmAtom, 100);
    const el = document.createElement("div");
    el.id = TEMPO_STEPPER_ID;
    el.tabIndex = -1;
    document.body.appendChild(el);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowDown" }); });

    expect(store.get(progressionTempoBpmAtom)).toBe(95);
    expect(document.activeElement).toBe(el);
    document.body.removeChild(el);
  });

  it("ArrowUp still changes tempo and does not throw when the stepper is absent", () => {
    store.set(progressionTempoBpmAtom, 100);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowUp" }); });

    expect(store.get(progressionTempoBpmAtom)).toBe(105);
  });

  it("ArrowRight moves focus to the chord list when not playing", () => {
    store.set(setProgressionPlayingAtom, false);
    store.set(activeProgressionStepIndexAtom, 0);
    const el = document.createElement("div");
    el.id = PROGRESSION_STEP_LIST_ID;
    el.tabIndex = -1;
    document.body.appendChild(el);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowRight" }); });

    expect(document.activeElement).toBe(el);
    document.body.removeChild(el);
  });

  it("ArrowLeft moves focus to the chord list when not playing", () => {
    store.set(setProgressionPlayingAtom, false);
    store.set(activeProgressionStepIndexAtom, 2);
    const el = document.createElement("div");
    el.id = PROGRESSION_STEP_LIST_ID;
    el.tabIndex = -1;
    document.body.appendChild(el);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowLeft" }); });

    expect(document.activeElement).toBe(el);
    document.body.removeChild(el);
  });

  it("ArrowRight does not move focus to the chord list while playing", () => {
    store.set(setProgressionPlayingAtom, true);
    store.set(activeProgressionStepIndexAtom, 0);
    const el = document.createElement("div");
    el.id = PROGRESSION_STEP_LIST_ID;
    el.tabIndex = -1;
    document.body.appendChild(el);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowRight" }); });

    expect(document.activeElement).not.toBe(el);
    document.body.removeChild(el);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/hooks/useKeyboardShortcuts.test.tsx`
Expected: FAIL — the new focus assertions fail (`document.activeElement` is `body`, not the target) because the hook does not move focus yet. The "absent" tempo test may already pass.

- [ ] **Step 3: Add focus movement to the hook**

In `src/hooks/useKeyboardShortcuts.ts`, add this import after the existing imports:

```typescript
import {
  TEMPO_STEPPER_ID,
  PROGRESSION_STEP_LIST_ID,
} from "../components/SongControls/progressionFocusIds";
```

Add this helper just above `export function useKeyboardShortcuts() {`:

```typescript
/** Focus a shortcut target by id if it is currently rendered. A no-op when the
 * element is absent (e.g. its inspector tab is not showing) — the state mutation
 * has already happened, so we just skip moving focus. `preventScroll` keeps the
 * page and the list scrollport from jumping. */
function focusShortcutTarget(id: string) {
  document.getElementById(id)?.focus({ preventScroll: true });
}
```

In the `switch (e.key)`, update the four arrow cases so each focuses its target after the mutation:

```typescript
        case "ArrowLeft":
          if (store.get(progressionPlayingAtom)) return;
          e.preventDefault();
          store.set(previousProgressionStepAtom);
          focusShortcutTarget(PROGRESSION_STEP_LIST_ID);
          break;
        case "ArrowRight":
          if (store.get(progressionPlayingAtom)) return;
          e.preventDefault();
          store.set(advanceProgressionPlaybackAtom);
          focusShortcutTarget(PROGRESSION_STEP_LIST_ID);
          break;
        case "ArrowUp":
          e.preventDefault();
          store.set(
            progressionTempoBpmAtom,
            Math.min(
              MAX_PROGRESSION_TEMPO_BPM,
              store.get(progressionTempoBpmAtom) + 5,
            ),
          );
          focusShortcutTarget(TEMPO_STEPPER_ID);
          break;
        case "ArrowDown":
          e.preventDefault();
          store.set(
            progressionTempoBpmAtom,
            Math.max(
              MIN_PROGRESSION_TEMPO_BPM,
              store.get(progressionTempoBpmAtom) - 5,
            ),
          );
          focusShortcutTarget(TEMPO_STEPPER_ID);
          break;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/hooks/useKeyboardShortcuts.test.tsx`
Expected: PASS (all existing tests plus the six new ones).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/hooks/useKeyboardShortcuts.test.tsx
git commit -m "feat(shortcuts): focus the changed control after arrow shortcuts"
```

---

## Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: passes (no new errors; the fretboard-boundary and react-compiler rules stay green).

- [ ] **Step 2: Token check**

Run: `pnpm run ui:tokens`
Expected: no undefined `var(--x)` references — the new rules use `--focus-ring`, `--focus-ring-offset`, `--focus-ring-glow`, `--radius-md`, all already defined.

- [ ] **Step 3: Unit tests**

Run: `pnpm run test`
Expected: all pass.

- [ ] **Step 4: Build**

Run: `pnpm run build`
Expected: `tsc -b` + `vite build` succeed.

- [ ] **Step 5: Manual smoke (dev server)**

Run: `pnpm run dev`, open the app, go to the **Song** tab, then:
- Press ↑/↓ — the **tempo stepper** shows the cyan ring (not the whole tab body), and the value changes by 5 BPM.
- Press ←/→ (while stopped) — the **chord list** shows the ring as a unit and the active chord advances/retreats.
- Confirm clicking with the mouse does **not** trigger the ring (keyboard-only `:focus-visible`).
- On a narrow viewport (mobile dock → Song panel), repeat and confirm the whole-panel highlight is gone.

- [ ] **Step 6: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "test(shortcuts): verification fixups for focus management"
```

(Skip if steps 1–5 needed no changes.)

---

## Self-review notes

- **Spec coverage:** tempo focus (Tasks 2, 4, 5), chord-list focus (Tasks 3, 5), shared ids to avoid drift (Task 1), off-tab silent no-op (Task 5 "absent" test), no ring-token changes (only consuming existing tokens), mobile panel needs no change (documented). All covered.
- **Type/name consistency:** `groupId` prop name is identical in Tasks 2 and 4; `TEMPO_STEPPER_ID` / `PROGRESSION_STEP_LIST_ID` defined once in Task 1 and imported everywhere else; `focusShortcutTarget` defined and used only in Task 5.
- **Known browser caveat:** `:focus-visible` after a programmatic `.focus()` relies on the browser's keyboard-recency heuristic; it resolves to "visible" here because the trigger is a keydown. This is exercised in the manual smoke step (jsdom does not evaluate `:focus-visible`, so unit tests assert `document.activeElement` instead).
