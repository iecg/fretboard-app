# DAW Shell Phase 13 — Lens Floating Overlay + Chrome Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate the scale-mode lens (`TopBandSummary`) from the stacked summary band to a panel floating over the top of the fretboard, and finish the remaining DAW-shell chrome polish — brand tile, "Fretboard Studio" kicker, round utility buttons, an "Inspector" label with pill tabs, and rounded progression chord clips with a diamond playhead.

**Architecture:** Phase 13 has two independent parts. **13a (Tasks 1-3):** the `ProgressionSummarySlot` mode-swap is split — in progression mode it still renders `ProgressionTrack` in the stacked `summary-shell`; in scale mode it renders `null` and the `summary-shell` collapses (`:empty`), while a new `FretboardLensOverlay` renders `TopBandSummary` as an absolutely-positioned panel inside `.main-fretboard` (which becomes `position: relative`). On the mobile tier the overlay falls back to a static stacked placement so it never occludes the fretboard. **13b (Tasks 4-7):** pure styling/copy changes to `AppHeader`, the Inspector tab bar, and `ProgressionTrack`. The two parts are independent and may ship as two PRs (13a, then 13b), consistent with the spec's §9.

**Tech Stack:** React 19, TypeScript, Jotai, CSS Modules, Radix Tabs, `clsx`, `motion/react`, Vitest + Testing Library, Playwright (visual regression).

---

## Background for the implementer

Read these before starting:

- `docs/superpowers/specs/2026-05-16-daw-shell-phases-8-13-design.md` — the spec; this plan implements **Phase 13** (§9, "Phase 13 — Lens floating overlay + chrome polish").
- `src/components/MainLayoutWrapper/MainLayoutWrapper.tsx` + `.module.css` — the layout wrapper. It renders the `summary` slot inside a `.summary-shell` band between the header and the `<main className="main-fretboard">` element, and renders `children` (the fretboard) inside that `<main>`.
- `src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx` — currently returns `<ProgressionTrack />` when `progressionEnabledAtom` is true, else `<TopBandSummary />`. It also runs two playback hooks unconditionally; those must keep running.
- `src/components/TopBandSummary/TopBandSummary.tsx` + `.module.css` — the scale-mode lens (a `DegreeChipStrip` + an animated `ChordPracticeBar`). Its internals do not change in Phase 13 — only where it is mounted.
- `src/App.tsx` — the orchestrator; `AppContent()` wires atoms to `MainLayoutWrapper`.
- `src/components/AppHeader/AppHeader.tsx` + `.module.css`, `src/components/Inspector/Inspector.tsx` + `.module.css`, `src/components/ProgressionTrack/ProgressionBlock.tsx` + `ProgressionPlayhead.tsx` + `ProgressionTrack.module.css` — the 13b chrome surfaces.

Key facts:

- **No atom changes anywhere in Phase 13.** 13a is pure placement; 13b is pure styling/copy. `FretboardLensOverlay` reads only the existing `progressionEnabledAtom` and `useLayoutMode()`.
- The repo uses **pnpm**: `pnpm run lint`, `pnpm run test`, `pnpm run build`.
- **Commit messages must be a single `type(scope): description` line — no body, no trailer** (the repo's commit-message hook validates every line). Use the exact commit command in each task's final step.
- This branch already has Phases 8-12 merged — the status bar, the property-grid Inspector tabs, the `showStatusBar` flag, etc. are all present.
- `useLayoutMode()` (default export from `src/hooks/useLayoutMode`) returns the `ResponsiveLayout` object — `{ tier, variant, … }`. `tier` is `"mobile" | "tablet" | "desktop"`.
- Test helper: `renderWithAtoms(ui, seeds?)` from `src/test-utils/renderWithAtoms` — `seeds` is an array of `[atom, value]` pairs. Components that subscribe to atoms must be rendered with it.
- `TopBandSummary` tests mock `motion/react` (see `src/components/TopBandSummary/TopBandSummary.test.tsx`); any test that renders `TopBandSummary` transitively needs the same mock.

Task order is mandatory within each part: **1 → 2 → 3** (13a), then **4 → 5 → 6 → 7** (13b). Task 1 splits the mode-swap; Task 2 builds and mounts the overlay; Task 3 refreshes 13a baselines. Tasks 4-6 are independent chrome changes; Task 7 refreshes 13b baselines. If shipping as two PRs, Tasks 1-3 are PR 13a and Tasks 4-7 are PR 13b.

---

## File Structure

**Created:**
- `src/components/FretboardLensOverlay/FretboardLensOverlay.tsx` — renders `TopBandSummary` as a floating (desktop/tablet) or stacked (mobile) overlay in scale mode; renders `null` in progression mode.
- `src/components/FretboardLensOverlay/FretboardLensOverlay.module.css` — its positioning + floating-panel styling.
- `src/components/FretboardLensOverlay/FretboardLensOverlay.test.tsx` — its unit tests.

**Modified:**
- `src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx` — returns `null` in scale mode instead of `TopBandSummary`.
- `src/components/ProgressionSummarySlot/ProgressionSummarySlot.test.tsx` — updated for the new scale-mode behavior (if the file exists).
- `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css` — `.main-fretboard` becomes a positioning context; `.summary-shell:empty` collapses.
- `src/App.tsx` — mounts `<FretboardLensOverlay />` beside `<Fretboard />`; changes the `brandSubtitle` copy.
- `src/components/AppHeader/AppHeader.module.css` — brand tile, kicker, round utility buttons.
- `src/components/Inspector/Inspector.tsx` — adds the "Inspector" panel label.
- `src/components/Inspector/Inspector.module.css` — panel label + pill tabs (top placement).
- `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts` — one new `inspector.panelLabel` key.
- `src/components/Inspector/Inspector.test.tsx` — asserts the panel label renders.
- `src/components/ProgressionTrack/ProgressionBlock.tsx` — chord-block width gains a clip gap.
- `src/components/ProgressionTrack/ProgressionTrack.module.css` — discrete rounded chord clips + diamond playhead.
- `src/components/AppHeader/AppHeader.test.tsx` — updated subtitle assertion if needed.
- `e2e/*.visual.spec.ts-snapshots/*` — refreshed baselines (Tasks 3 and 7).

---

## Task 1: Split the lens/progression mode-swap

**Files:**
- Modify: `src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx`
- Modify: `src/components/ProgressionSummarySlot/ProgressionSummarySlot.test.tsx` (if it exists)
- Modify: `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css`

- [ ] **Step 1: Check for an existing `ProgressionSummarySlot` test and update or write it**

Run: `ls src/components/ProgressionSummarySlot/`

**If `ProgressionSummarySlot.test.tsx` exists**, READ it and update its assertions: the slot must now render `ProgressionTrack` when `progressionEnabledAtom` is `true` and render **nothing** (`null`) when it is `false`. Replace any assertion that expects `TopBandSummary` / `top-band-summary` in scale mode with an assertion that the slot renders nothing in scale mode. A scale-mode test should look like:

```tsx
  it("renders nothing when progression mode is off", () => {
    const { container } = renderWithAtoms(<ProgressionSummarySlot />, [
      [progressionEnabledAtom, false],
    ]);
    expect(container).toBeEmptyDOMElement();
  });
```

and keep/ensure a progression-mode test that asserts `ProgressionTrack` renders (query by an element `ProgressionTrack` is known to render — e.g. `data-testid="progression-playhead"` is present inside `ProgressionTrack`; or assert `container` is not empty).

**If `ProgressionSummarySlot.test.tsx` does NOT exist**, create it with:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { progressionEnabledAtom } from "../../store/atoms";
import { ProgressionSummarySlot } from "./ProgressionSummarySlot";

// ProgressionTrack and TopBandSummary pull in motion/react; stub it so the
// slot can be rendered in jsdom without animation machinery.
vi.mock("motion/react", async () => {
  const React = await import("react");
  const passthrough = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
      const { children, ...rest } = props;
      return React.createElement(tag, { ...rest, ref }, children as React.ReactNode);
    });
  const cache = new Map<string, unknown>();
  return {
    motion: new Proxy({} as Record<string, unknown>, {
      get(_t, prop: string) {
        if (!cache.has(prop)) cache.set(prop, passthrough(prop));
        return cache.get(prop);
      },
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    MotionConfig: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => null,
  };
});

describe("ProgressionSummarySlot", () => {
  it("renders nothing when progression mode is off", () => {
    const { container } = renderWithAtoms(<ProgressionSummarySlot />, [
      [progressionEnabledAtom, false],
    ]);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the progression track when progression mode is on", () => {
    const { container } = renderWithAtoms(<ProgressionSummarySlot />, [
      [progressionEnabledAtom, true],
    ]);
    expect(container).not.toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm run test -- src/components/ProgressionSummarySlot/ProgressionSummarySlot.test.tsx`
Expected: FAIL — the scale-mode test fails because the current `ProgressionSummarySlot` still renders `TopBandSummary` (non-empty) when progression is off.

- [ ] **Step 3: Update `ProgressionSummarySlot.tsx`**

Replace the entire contents of `src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx` with:

```tsx
import { useAtomValue } from "jotai";
import { useProgressionAudioPlayback } from "../../hooks/useProgressionAudioPlayback";
import { useProgressionPlaybackLoop } from "../../hooks/useProgressionPlaybackLoop";
import { progressionEnabledAtom } from "../../store/atoms";
import { ProgressionTrack } from "../ProgressionTrack/ProgressionTrack";

/**
 * The stacked top-band slot. In progression mode it renders the DAW
 * `ProgressionTrack`; in scale mode it renders nothing — the scale-mode lens
 * (`TopBandSummary`) is rendered separately as a floating overlay over the
 * fretboard by `FretboardLensOverlay` (DAW Shell Phase 13a). The two playback
 * hooks run unconditionally so progression audio/playback state stays live
 * regardless of which mode is active.
 */
export function ProgressionSummarySlot() {
  useProgressionPlaybackLoop();
  useProgressionAudioPlayback();
  const progressionEnabled = useAtomValue(progressionEnabledAtom);
  return progressionEnabled ? <ProgressionTrack /> : null;
}
```

The changes: the `TopBandSummary` import is removed; the scale-mode branch returns `null` instead of `<TopBandSummary />`. The two hook calls are unchanged.

- [ ] **Step 4: Collapse the empty `summary-shell` and make `.main-fretboard` a positioning context**

In `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css`, the file currently begins:

```css
.main-fretboard {
  width: 100%;
  flex: 0 0 auto;
  min-width: 0;
}

.summary-shell {
  display: flex;
  justify-content: center;
  width: 100%;
}
```

Replace those two rules with:

```css
.main-fretboard {
  width: 100%;
  flex: 0 0 auto;
  min-width: 0;
  /* Positioning context for the scale-mode lens overlay (Phase 13a). */
  position: relative;
}

.summary-shell {
  display: flex;
  justify-content: center;
  width: 100%;
}

/* In scale mode `ProgressionSummarySlot` renders nothing — collapse the band
   so it contributes no height or `gap` spacing. The progression-mode path
   (a non-empty `ProgressionTrack`) is unaffected. */
.summary-shell:empty {
  display: none;
}
```

Leave the rest of the file (the `.status-bar-shell` rule, the `data-layout-*` margin rules, the `:global` blocks) unchanged.

- [ ] **Step 5: Run the test and the build, verify they pass**

Run: `pnpm run test -- src/components/ProgressionSummarySlot/ProgressionSummarySlot.test.tsx`
Expected: PASS — both cases.

Run: `pnpm run build`
Expected: PASS — note `TopBandSummary` is now an unused import nowhere (it was only removed from `ProgressionSummarySlot`); it will be re-imported by `FretboardLensOverlay` in Task 2.

Run: `pnpm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx src/components/ProgressionSummarySlot/ProgressionSummarySlot.test.tsx src/components/MainLayoutWrapper/MainLayoutWrapper.module.css
git commit -m "refactor(layout): split the lens/progression mode-swap"
```

---

## Task 2: Build and mount the `FretboardLensOverlay`

**Files:**
- Create: `src/components/FretboardLensOverlay/FretboardLensOverlay.tsx`
- Create: `src/components/FretboardLensOverlay/FretboardLensOverlay.module.css`
- Test: `src/components/FretboardLensOverlay/FretboardLensOverlay.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/FretboardLensOverlay/FretboardLensOverlay.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { progressionEnabledAtom } from "../../store/atoms";
import { FretboardLensOverlay } from "./FretboardLensOverlay";

// TopBandSummary pulls in motion/react; stub it for jsdom.
vi.mock("motion/react", async () => {
  const React = await import("react");
  const passthrough = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
      const { children, ...rest } = props;
      return React.createElement(tag, { ...rest, ref }, children as React.ReactNode);
    });
  const cache = new Map<string, unknown>();
  return {
    motion: new Proxy({} as Record<string, unknown>, {
      get(_t, prop: string) {
        if (!cache.has(prop)) cache.set(prop, passthrough(prop));
        return cache.get(prop);
      },
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    MotionConfig: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => null,
  };
});

describe("FretboardLensOverlay", () => {
  it("renders the lens panel in scale mode (progression off)", () => {
    renderWithAtoms(<FretboardLensOverlay />, [[progressionEnabledAtom, false]]);
    expect(screen.getByTestId("fretboard-lens-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("top-band-summary")).toBeInTheDocument();
  });

  it("renders nothing in progression mode (progression on)", () => {
    const { container } = renderWithAtoms(<FretboardLensOverlay />, [
      [progressionEnabledAtom, true],
    ]);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("fretboard-lens-overlay")).toBeNull();
  });

  it("tags the overlay with the current layout tier", () => {
    renderWithAtoms(<FretboardLensOverlay />, [[progressionEnabledAtom, false]]);
    // jsdom's default viewport is 1024x768 -> desktop tier.
    expect(screen.getByTestId("fretboard-lens-overlay")).toHaveAttribute(
      "data-layout-tier",
    );
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm run test -- src/components/FretboardLensOverlay/FretboardLensOverlay.test.tsx`
Expected: FAIL — `./FretboardLensOverlay` does not exist yet.

- [ ] **Step 3: Create the `FretboardLensOverlay` component**

Create `src/components/FretboardLensOverlay/FretboardLensOverlay.tsx` with:

```tsx
import { useAtomValue } from "jotai";
import { progressionEnabledAtom } from "../../store/atoms";
import useLayoutMode from "../../hooks/useLayoutMode";
import { TopBandSummary } from "../TopBandSummary/TopBandSummary";
import styles from "./FretboardLensOverlay.module.css";

/**
 * The scale-mode lens, rendered as a panel that floats over the top of the
 * fretboard (DAW Shell Phase 13a). On the desktop and tablet tiers the panel
 * is absolutely positioned within `.main-fretboard`; on the mobile tier it
 * falls back to a static stacked placement so it never occludes the board.
 *
 * Renders nothing in progression mode — the progression DAW track is rendered
 * by `ProgressionSummarySlot` in the stacked summary band instead. This mirrors
 * the behavior `TopBandSummary` had before Phase 13: visible whenever the app
 * is in scale mode, regardless of the active Inspector tab.
 */
export function FretboardLensOverlay() {
  const progressionEnabled = useAtomValue(progressionEnabledAtom);
  const layout = useLayoutMode();
  if (progressionEnabled) return null;
  return (
    <div
      className={styles.overlay}
      data-layout-tier={layout.tier}
      data-testid="fretboard-lens-overlay"
    >
      <TopBandSummary />
    </div>
  );
}
```

- [ ] **Step 4: Create the stylesheet**

Create `src/components/FretboardLensOverlay/FretboardLensOverlay.module.css` with:

```css
.overlay {
  display: flex;
  justify-content: center;
  width: 100%;
  /* The container spans the full board width; only the panel itself is
     interactive, so clicks in the empty margins fall through to the board. */
  pointer-events: none;
}

.overlay > * {
  pointer-events: auto;
}

/* Desktop & tablet: float over the top of the fretboard region. */
.overlay[data-layout-tier="desktop"],
.overlay[data-layout-tier="tablet"] {
  position: absolute;
  inset-block-start: 0.5rem;
  inset-inline: 0;
  z-index: 2;
}

/* The floating panel reads through to the board behind it: a translucent
   faceplate fill plus a backdrop blur. The blur + the faceplate border are
   applied to the panel itself (the TopBandSummary root). */
.overlay[data-layout-tier="desktop"] > *,
.overlay[data-layout-tier="tablet"] > * {
  background: color-mix(in srgb, var(--faceplate-bg) 82%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow:
    var(--faceplate-shadow),
    0 10px 30px -12px rgb(0 0 0 / 0.6);
}

/* Mobile: stacked above the fretboard — no occlusion, no absolute positioning. */
.overlay[data-layout-tier="mobile"] {
  position: static;
  margin-block-end: 0.5rem;
}
```

- [ ] **Step 5: Mount `FretboardLensOverlay` in `App.tsx`**

In `src/App.tsx`, make two edits.

First, add the import. The import block contains `import { ProgressionSummarySlot } from "./components/ProgressionSummarySlot/ProgressionSummarySlot";`. Add this line immediately after it:

```tsx
import { FretboardLensOverlay } from "./components/FretboardLensOverlay/FretboardLensOverlay";
```

Second, render the overlay beside the fretboard. The `MainLayoutWrapper`'s children currently are:

```tsx
      <Fretboard
        stringRowPx={layout.stringRowPx}
      />
    </MainLayoutWrapper>
```

Replace that with — the overlay first so that on the mobile (static) tier it stacks *above* the board:

```tsx
      <FretboardLensOverlay />
      <Fretboard
        stringRowPx={layout.stringRowPx}
      />
    </MainLayoutWrapper>
```

(`MainLayoutWrapper`'s `children` is typed `ReactNode`, so two sibling elements are fine — React renders them as the `<main className="main-fretboard">` content. On desktop/tablet the overlay is `position: absolute` so DOM order does not affect its placement; `z-index: 2` keeps it above the board.)

- [ ] **Step 6: Run the tests and verify they pass**

Run: `pnpm run test -- src/components/FretboardLensOverlay/FretboardLensOverlay.test.tsx`
Expected: PASS — all three tests.

- [ ] **Step 7: Run lint, build, and the full suite**

Run: `pnpm run lint`
Expected: PASS.

Run: `pnpm run build`
Expected: PASS.

Run: `pnpm run test`
Expected: PASS — the full suite is green. `src/App.test.tsx` renders the real `App`; `TopBandSummary` still renders (now inside the overlay), so queries for `top-band-summary` still resolve. If an `App.test.tsx` or layout test fails because it asserted `TopBandSummary` lived inside the `summary-shell`, apply the minimal fix (re-scope the query to the overlay / `data-testid="fretboard-lens-overlay"`) and include it in this task's commit; report it.

- [ ] **Step 8: Verify the overlay renders over the fretboard in the browser**

Start the dev server and confirm the floating panel renders over the top of the fretboard in scale mode, and that progression mode still shows the stacked `ProgressionTrack`. Capture a screenshot of scale mode on a desktop viewport for the task report. If the panel occludes too much of the board or the blur/translucency reads poorly, the values in `FretboardLensOverlay.module.css` (`inset-block-start`, the `color-mix` percentage, `blur()` radius) are the tuning knobs — adjust and re-verify before committing.

- [ ] **Step 9: Commit**

```bash
git add src/components/FretboardLensOverlay/FretboardLensOverlay.tsx src/components/FretboardLensOverlay/FretboardLensOverlay.module.css src/components/FretboardLensOverlay/FretboardLensOverlay.test.tsx src/App.tsx
git commit -m "feat(layout): float the scale lens over the fretboard"
```

If Step 7 required an `App.test.tsx` or layout-test fix, add that file to the `git add` line before committing.

---

## Task 3: Refresh visual baselines for the lens overlay (13a)

**Files:**
- Modify (regenerated): `e2e/*.visual.spec.ts-snapshots/*` — snapshots whose images changed.

- [ ] **Step 1: Run the mandatory pre-PR checks**

Run: `pnpm run lint` → Expected: PASS.
Run: `pnpm run test` → Expected: PASS.
Run: `pnpm run build` → Expected: PASS.

- [ ] **Step 2: Refresh the darwin baselines**

Run: `pnpm run test:visual:update`
Expected: darwin snapshots rebuilt. The `app-layout`, `app-overlays`, and `fretboard-svg` desktop/tablet captures now show the lens panel floating over the top of the fretboard in scale mode; the mobile captures show it stacked above the board.

- [ ] **Step 3: Refresh the linux baselines**

Run: `pnpm run test:visual:update:linux`
Expected: linux snapshots regenerated. If this fails for an environment reason (no Docker / Linux container), record the exact command and error, finish the remaining steps, and report DONE_WITH_CONCERNS — CI regenerates the linux baselines.

- [ ] **Step 4: Confirm the visual suite passes**

Run: `pnpm run test:visual`
Expected: PASS — every visual spec matches the refreshed baselines.

- [ ] **Step 5: Manual sanity check**

Run: `git status --short e2e`
Inspect the changed snapshots: in scale mode the lens is a panel floating over the top of the fretboard (desktop/tablet) or stacked above it (mobile); in progression mode the `ProgressionTrack` still sits in the stacked band and is unchanged. If a progression-mode capture changed, or the old stacked scale-mode band is still present, a source change was missed.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "test(visual): refresh baselines for the lens overlay"
```

---

## Task 4: AppHeader chrome polish

**Files:**
- Modify: `src/components/AppHeader/AppHeader.module.css`
- Modify: `src/App.tsx`
- Modify: `src/components/AppHeader/AppHeader.test.tsx`

- [ ] **Step 1: Update the `AppHeader` subtitle test**

In `src/components/AppHeader/AppHeader.test.tsx`, READ the file. Find the test that renders `AppHeader` with a `brandSubtitle` and asserts the subtitle text. Whatever literal it currently passes/asserts, change that test so it passes `brandSubtitle="Fretboard Studio"` and asserts `screen.getByText("Fretboard Studio")` (or `getByTestId("app-header-brand-subtitle")` has text content `"Fretboard Studio"`). Do not change any other test. If no subtitle test exists, add this one inside the existing top-level `describe`:

```tsx
  it("renders the brand subtitle kicker", () => {
    render(<AppHeader brandTitle="FretFlow" brandSubtitle="Fretboard Studio" />);
    expect(screen.getByTestId("app-header-brand-subtitle")).toHaveTextContent(
      "Fretboard Studio",
    );
  });
```

(Match the existing file's import style for `render`/`screen`.)

- [ ] **Step 2: Run the test and verify it fails (or passes trivially)**

Run: `pnpm run test -- src/components/AppHeader/AppHeader.test.tsx`
Expected: the subtitle test passes once it asserts `"Fretboard Studio"` against a render that passes that exact prop — this step is a sanity check that the test file is valid. If you added a brand-new test, it should already pass (the component renders whatever `brandSubtitle` it is given). The behavioral change in this task is the *App-level copy* (Step 4) and the *styling* (Step 3); proceed.

- [ ] **Step 3: Restyle the brand tile, kicker, and utility buttons**

In `src/components/AppHeader/AppHeader.module.css`:

**3a — Brand tile.** The `.app-header-brand-icon` rule currently is:

```css
.app-header-brand-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  /* BrandMark now handles its own per-path neon glow (cyan body, orange
     neck) via internal feDropShadow filters, so we don't apply an outer
     monochrome drop-shadow here — that would muddy the two-tone palette. */
}
```

Replace it with:

```css
.app-header-brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  /* Brand glyph sits in a rounded tile with an orange-tinted hairline
     border (DAW Shell Phase 13b). BrandMark keeps its own per-path neon
     glow — the tile adds only the frame, not an outer drop-shadow. */
  padding: clamp(0.25rem, 0.6vw, 0.4rem);
  border: 1px solid rgb(255 154 77 / 0.35);
  border-radius: clamp(0.5rem, 1vw, 0.75rem);
  background: rgb(255 154 77 / 0.04);
}
```

**3b — "Fretboard Studio" kicker.** The `.app-header-brand-subtitle` rule currently is:

```css
.app-header-brand-subtitle {
  font-size: clamp(0.66rem, 1vw, 0.8rem);
  color: rgb(197 213 230 / 0.72);
  line-height: 1.2;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

Replace it with:

```css
.app-header-brand-subtitle {
  font-family: var(--font-mono);
  font-size: clamp(0.56rem, 0.85vw, 0.68rem);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: rgb(197 213 230 / 0.6);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

(Leave the `:global([data-theme="modern-light"]) .app-header-brand-subtitle` and the `@media (max-width: 879px)` rules that follow it unchanged.)

**3c — Round utility buttons.** The `.app-header-actions` rule currently is:

```css
.app-header-actions {
  display: flex;
  align-items: center;
  gap: clamp(0.35rem, 1vw, 0.6rem);
  flex-shrink: 0;
}
```

Replace it with (adds a scoped rule making the three header buttons fully round — `.app-header-actions button` outranks the shared `.icon-button` class, so no shared-component change is needed):

```css
.app-header-actions {
  display: flex;
  align-items: center;
  gap: clamp(0.35rem, 1vw, 0.6rem);
  flex-shrink: 0;
}

/* DAW Shell Phase 13b — the header utility buttons are round, not the
   rounded-square the shared `.icon-button` class gives them elsewhere. */
.app-header-actions button {
  border-radius: 50%;
}
```

- [ ] **Step 4: Change the brand subtitle copy in `App.tsx`**

In `src/App.tsx`, the `<AppHeader>` element passes `brandSubtitle="Interactive Fretboard & Music Theory"`. Change that one line to:

```tsx
          brandSubtitle="Fretboard Studio"
```

- [ ] **Step 5: Run lint, build, and the AppHeader tests**

Run: `pnpm run lint`
Expected: PASS.

Run: `pnpm run build`
Expected: PASS.

Run: `pnpm run test -- src/components/AppHeader/AppHeader.test.tsx`
Expected: PASS.

Run: `pnpm run test`
Expected: PASS — the full suite. If `src/App.test.tsx` asserted the old subtitle copy `"Interactive Fretboard & Music Theory"`, update that assertion to `"Fretboard Studio"` and include `src/App.test.tsx` in this task's commit; report it.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppHeader/AppHeader.module.css src/components/AppHeader/AppHeader.test.tsx src/App.tsx
git commit -m "feat(header): brand tile, Fretboard Studio kicker, round buttons"
```

If Step 5 required an `App.test.tsx` fix, add that file to the `git add` line before committing.

---

## Task 5: Inspector "Inspector" label + pill tabs

**Files:**
- Modify: `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts`
- Modify: `src/components/Inspector/Inspector.tsx`
- Modify: `src/components/Inspector/Inspector.module.css`
- Modify: `src/components/Inspector/Inspector.test.tsx`

- [ ] **Step 1: Add the `inspector.panelLabel` i18n key**

In `src/i18n/types.ts`, the `inspector` block ends with `    btSwing: string;`. Add `    panelLabel: string;` immediately after that line (still inside the `inspector` block):

```ts
    btSwing: string;
    panelLabel: string;
```

In `src/i18n/en.ts`, the `inspector` block ends with `    btSwing: "Swing",`. Add immediately after it:

```ts
    btSwing: "Swing",
    panelLabel: "Inspector",
```

In `src/i18n/es.ts`, the `inspector` block ends with `    btSwing: "Swing",`. Add immediately after it:

```ts
    btSwing: "Swing",
    panelLabel: "Inspector",
```

("Inspector" is the same in both locales — it is the established product term, already used as the `aria-label` on the tab list.)

- [ ] **Step 2: Add the panel-label assertion to `Inspector.test.tsx`**

In `src/components/Inspector/Inspector.test.tsx`, READ the file and note its render helper and import style. Add this test inside the existing top-level `describe`:

```tsx
  it("renders the Inspector panel label on the top placement", () => {
    renderWithAtoms(<Inspector placement="top" />);
    expect(screen.getByText("Inspector")).toBeInTheDocument();
  });

  it("does not render the panel label on the bottom placement", () => {
    renderWithAtoms(<Inspector placement="bottom" />);
    expect(screen.queryByText("Inspector")).toBeNull();
  });
```

If the test file already imports `renderWithAtoms`/`screen`, reuse them; otherwise match the file's existing render approach (the Inspector tabs subscribe to atoms, so an atom-providing render is required). Note: the tab list's `aria-label="Inspector"` is an attribute, not text content — `getByText("Inspector")` matches only the visible label span, not the `aria-label`.

- [ ] **Step 3: Run the tests and verify the new ones fail**

Run: `pnpm run test -- src/components/Inspector/Inspector.test.tsx`
Expected: FAIL — the "renders the Inspector panel label" test fails (no visible "Inspector" text yet). The build will also fail until Step 4 adds the key — that is expected mid-task.

- [ ] **Step 4: Add the panel label to `Inspector.tsx`**

In `src/components/Inspector/Inspector.tsx`, the `return` currently opens:

```tsx
  return (
    <RadixTabs.Root
      className={clsx(styles.root, placement === "bottom" && styles.placementBottom)}
      data-placement={placement}
      value={active}
      onValueChange={(value) => setActive(value as InspectorTabId)}
    >
      <RadixTabs.List className={styles.tabList} aria-label="Inspector">
```

Insert the panel label as the first child of `RadixTabs.Root`, before `<RadixTabs.List>`, rendered only on the top placement:

```tsx
  return (
    <RadixTabs.Root
      className={clsx(styles.root, placement === "bottom" && styles.placementBottom)}
      data-placement={placement}
      value={active}
      onValueChange={(value) => setActive(value as InspectorTabId)}
    >
      {placement === "top" && (
        <span className={styles.panelLabel}>{t("inspector.panelLabel")}</span>
      )}
      <RadixTabs.List className={styles.tabList} aria-label="Inspector">
```

(`t` is already in scope — `const { t } = useTranslation();` at the top of the component.)

- [ ] **Step 5: Restyle the top-placement tabs as pills in `Inspector.module.css`**

In `src/components/Inspector/Inspector.module.css`, make three edits.

**5a — Add the `.panelLabel` rule.** Insert this rule immediately after the `.root { … }` rule (after its closing `}`):

```css
/* DAW Shell Phase 13b — a mono "Inspector" kicker above the tab row, top
   placement only. */
.panelLabel {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--faceplate-accent);
  padding-inline: var(--space-1, 0.25rem);
}
```

**5b — Make the top-placement tabs rounded pills.** Insert these two rules immediately after the existing `.tab[data-state="active"] { … }` rule (after its closing `}`):

```css
/* Top-placement tabs are rounded pills with a cyan fill when active,
   replacing the bottom-underline indicator (DAW Shell Phase 13b). The
   bottom-docked (mobile) tab bar keeps the Phase 7 underline treatment —
   these rules are scoped to `[data-placement="top"]` so they never reach it. */
.root[data-placement="top"] .tab {
  border-bottom: 0;
  border-radius: 999px;
  padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
}

.root[data-placement="top"] .tab[data-state="active"] {
  color: var(--faceplate-bg);
  background: var(--faceplate-accent);
  border-bottom-color: transparent;
  text-shadow: none;
}
```

(The base `.tab` rule and `.tab[data-state="active"]` rule are left in place — they still apply to the bottom placement, where `.placementBottom .tab` overrides the borders. The `.root[data-placement="top"] …` selectors outrank both base rules by specificity, so on the top placement the pill styling wins. `color: var(--faceplate-bg)` gives dark text on the cyan fill for contrast.)

- [ ] **Step 6: Run the tests, lint, build**

Run: `pnpm run test -- src/components/Inspector/Inspector.test.tsx`
Expected: PASS — including both new panel-label tests.

Run: `pnpm run lint`
Expected: PASS.

Run: `pnpm run build`
Expected: PASS — both locales supply `inspector.panelLabel`.

Run: `pnpm run test`
Expected: PASS — the full suite. If another test asserted the old tab underline structure or failed on the new label, apply the minimal fix and include it; report it.

- [ ] **Step 7: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts src/components/Inspector/Inspector.tsx src/components/Inspector/Inspector.module.css src/components/Inspector/Inspector.test.tsx
git commit -m "feat(inspector): add panel label and pill tabs"
```

---

## Task 6: ProgressionTrack — rounded chord clips + diamond playhead

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionBlock.tsx`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.module.css`

- [ ] **Step 1: Add a clip gap to the chord-block width**

In `src/components/ProgressionTrack/ProgressionBlock.tsx`, the `style` object on the `<button>` currently is:

```tsx
      style={{
        "--duration-bars": String(durationBars),
        left: `${startPercent}%`,
        width: `${widthPercent}%`,
      } as CSSProperties}
```

Change the `width` so adjacent clips have a small visible gap between them:

```tsx
      style={{
        "--duration-bars": String(durationBars),
        left: `${startPercent}%`,
        width: `calc(${widthPercent}% - 3px)`,
      } as CSSProperties}
```

(`left` is unchanged, so each block starts at the same point but ends 3px short of the next — the gap that makes the clips read as discrete. `min-width: 0` on `.block` keeps very short clips from breaking.)

- [ ] **Step 2: Convert the chord blocks to discrete rounded clips**

In `src/components/ProgressionTrack/ProgressionTrack.module.css`, the `.block` rule currently contains this border section:

```css
  /* Borders: top/bottom always visible, left/right resolved per-position so
     adjacent blocks share a single 1px divider instead of each carrying
     their own (which would stack into a 2px line at every boundary). */
  border-block: 1px solid var(--block-border);
  border-inline-start: 1px solid transparent;
  border-inline-end: none;
  border-radius: 0;
```

Replace those four border lines (and the comment above them) with:

```css
  /* Discrete rounded clip — each block is fully bordered and rounded
     (DAW Shell Phase 13b). The 3px width gap (set inline in ProgressionBlock)
     separates adjacent clips. */
  border: 1px solid var(--block-border);
  border-radius: 7px;
```

Then DELETE these three rules entirely (the shared-divider logic, now obsolete) — the `.block:first-of-type` rule, the `.block:last-of-type` rule, and the `.block + .block` rule:

```css
.block:first-of-type {
  border-inline-start: 1px solid var(--block-border);
  border-start-start-radius: 9px;
  border-end-start-radius: 9px;
}

.block:last-of-type {
  border-inline-end: 1px solid var(--block-border);
  border-start-end-radius: 9px;
  border-end-end-radius: 9px;
}

/* Single shared divider between adjacent blocks. */
.block + .block {
  border-inline-start: 1px solid var(--track-divider);
}
```

In the `.block[data-active="true"]` rule, replace these two border lines:

```css
  border-block-color: rgb(255 154 77 / 0.55);
  border-inline-start-color: rgb(255 154 77 / 0.55);
```

with a single all-sides line:

```css
  border-color: rgb(255 154 77 / 0.55);
```

Then DELETE these two now-obsolete rules entirely (the active block is now self-contained — it no longer borrows the neighbor's divider):

```css
/* When the active block isn't the last in the lane, its right edge belongs
   to the next block's inline-start divider — paint that amber too so the
   active block reads as fully outlined. */
.block[data-active="true"] + .block {
  border-inline-start-color: rgb(255 154 77 / 0.55);
}

/* When the active block IS the last in the lane, give it its own amber
   inline-end border so it isn't open on the right. */
.block[data-active="true"]:last-of-type {
  border-inline-end-color: rgb(255 154 77 / 0.55);
}
```

Leave every other `.block*` rule (`.block:hover`, `.block:active`, `.block:focus-visible`, `.block[data-unavailable]`, `.degreeBadge`, `.blockText`, `.chordName`, `.duration`) unchanged.

- [ ] **Step 3: Convert the playhead arrowhead to a diamond**

In `src/components/ProgressionTrack/ProgressionTrack.module.css`, the `.playheadArrow` rule currently is:

```css
.playheadArrow {
  width: 0;
  height: 0;
  border-inline: 0.3rem solid transparent;
  border-block-start: 0.38rem solid var(--track-accent);
  /* Pull the arrow down by 1px so its tapering tip overlaps the 2px line
     that follows. Without this, the arrow's single-pixel tip and the line's
     squared top create a sub-pixel anti-aliasing gap. */
  margin-block-end: -1px;
  filter: drop-shadow(0 0 4px rgb(77 228 255 / 0.7));
}
```

Replace it with a solid diamond marker (a small square clipped to a rhombus):

```css
.playheadArrow {
  width: 0.5rem;
  height: 0.5rem;
  background: var(--track-accent);
  /* Diamond marker (DAW Shell Phase 13b) — replaces the triangular
     arrowhead. The clip-path rhombus points down into the playhead line. */
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  /* Overlap the line below by 1px so the diamond's bottom vertex and the
     line's squared top meet without a sub-pixel anti-aliasing gap. */
  margin-block-end: -1px;
  filter: drop-shadow(0 0 4px rgb(77 228 255 / 0.7));
}
```

Leave the `.playhead` and `.playheadLine` rules unchanged.

- [ ] **Step 4: Run the ProgressionTrack tests, lint, build**

Run: `pnpm run test -- src/components/ProgressionTrack/ProgressionTrack.test.tsx`
Expected: PASS — the playhead (`data-testid="progression-playhead"`) and the chord blocks still render; this task changes only their styling, not their markup or test-facing attributes.

Run: `pnpm run lint`
Expected: PASS — no orphaned/unused CSS selectors (stylelint is wired into lint).

Run: `pnpm run build`
Expected: PASS.

Run: `pnpm run test`
Expected: PASS — the full suite.

- [ ] **Step 5: Verify the progression track in the browser**

Start the dev server, enable progression mode, and confirm the chord blocks render as discrete rounded clips with small gaps and the playhead marker is a diamond. Capture a screenshot for the task report. If the 3px gap or the `7px` radius reads poorly, those are the tuning knobs.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgressionTrack/ProgressionBlock.tsx src/components/ProgressionTrack/ProgressionTrack.module.css
git commit -m "feat(progression): rounded chord clips and diamond playhead"
```

---

## Task 7: Refresh visual baselines for the chrome polish (13b)

**Files:**
- Modify (regenerated): `e2e/*.visual.spec.ts-snapshots/*` — snapshots whose images changed.

- [ ] **Step 1: Run the mandatory pre-PR checks**

Run: `pnpm run lint` → Expected: PASS.
Run: `pnpm run test` → Expected: PASS.
Run: `pnpm run build` → Expected: PASS.

- [ ] **Step 2: Refresh the darwin baselines**

Run: `pnpm run test:visual:update`
Expected: darwin snapshots rebuilt — `app-components` / `app-layout` show the new brand tile, kicker, and round buttons; `inspector` shows the "Inspector" label and pill tabs; `progression` shows rounded chord clips and the diamond playhead.

- [ ] **Step 3: Refresh the linux baselines**

Run: `pnpm run test:visual:update:linux`
Expected: linux snapshots regenerated. If this fails for an environment reason (no Docker / Linux container), record the exact command and error, finish the remaining steps, and report DONE_WITH_CONCERNS — CI regenerates the linux baselines.

- [ ] **Step 4: Confirm the visual suite passes**

Run: `pnpm run test:visual`
Expected: PASS — every visual spec matches the refreshed baselines.

- [ ] **Step 5: Manual sanity check**

Run: `git status --short e2e`
Inspect the changed snapshots: the header shows the brand tile, the uppercase mono "Fretboard Studio" kicker, and round utility buttons; the Inspector shows an "Inspector" label and rounded pill tabs (top placement) with the mobile bottom tab bar unchanged; the progression track shows discrete rounded chord clips and a diamond playhead. If a mobile Inspector capture changed its tab styling, the `[data-placement="top"]` scoping in Task 5 was wrong — recheck.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "test(visual): refresh baselines for the chrome polish"
```

---

## Self-Review (completed by plan author)

**Spec coverage** — against `2026-05-16-daw-shell-phases-8-13-design.md` Phase 13 (§9):

- **13a — Lens floating overlay:** `TopBandSummary` moves to a panel floating over the top of the fretboard → Tasks 1-2. `.main-fretboard` becomes the positioning context (`position: relative`) → Task 1 Step 4. The overlay is absolutely positioned within it → Task 2 `FretboardLensOverlay.module.css`. The `ProgressionSummarySlot` mode-swap is preserved — progression mode renders `ProgressionTrack` in the stacked band, scale mode renders the floating overlay → Task 1 (slot returns `null` in scale mode) + Task 2 (`FretboardLensOverlay`). `summary-shell` is repurposed for the scale-mode path — it collapses via `:empty` → Task 1 Step 4. `DegreeChipStrip` / `ChordPracticeBar` internals are unchanged — `TopBandSummary` is rendered verbatim, only its mount point changes → Task 2. The overlay is visible whenever `TopBandSummary` rendered before (scale mode, any inspector tab) — NOT tab-gated — matching the spec's flagged decision → `FretboardLensOverlay` gates only on `progressionEnabledAtom`. Mobile fallback: the overlay is `position: static` (stacked above the board) on the mobile tier → Task 2 `FretboardLensOverlay.module.css` `[data-layout-tier="mobile"]`.
- **13b — Chrome polish:** `AppHeader` brand glyph in a rounded tile with an orange-tinted border, the subtitle becomes a "Fretboard Studio" uppercase mono kicker, the three utility buttons become round, the header background stays transparent (untouched) → Task 4. Inspector `TabBar` gains an "Inspector" uppercase mono label and the top-placement tabs become rounded pills with a cyan fill when active (bottom/mobile tab bar unchanged, via `[data-placement="top"]` scoping) → Task 5. `ProgressionTrack` chord blocks become discrete rounded clips and the playhead becomes a diamond → Task 6.
- **Data flow:** no atom changes — `FretboardLensOverlay` reads the existing `progressionEnabledAtom` + `useLayoutMode()`; 13b is pure styling/copy → matches the spec's "No atom changes."
- **Testing:** `ProgressionSummarySlot` scale/progression behavior (Task 1), `FretboardLensOverlay` (Task 2), `AppHeader` subtitle (Task 4), Inspector panel label present on top / absent on bottom (Task 5), `ProgressionTrack` playhead/blocks still render (Task 6); visual-regression refresh of `app-layout` / `app-overlays` / `fretboard-svg` (Task 3) and `app-components` / `inspector` / `progression` (Task 7), darwin + linux.
- **PR split:** Tasks 1-3 (13a) and Tasks 4-7 (13b) are independent and can ship as two PRs, per spec §9.

**Placeholder scan:** No "TBD"/"TODO"/"handle edge cases". Every code step gives complete file contents or an exact insert/replace/delete instruction against quoted anchor text, and every command has an expected result. The two browser-verification steps (Task 2 Step 8, Task 6 Step 5) name the specific tuning knobs rather than leaving the styling open-ended.

**Type consistency:** `FretboardLensOverlay` is a propless component consumed as `<FretboardLensOverlay />` in `App.tsx` (Task 2). `ProgressionSummarySlot` keeps its name and propless signature; only its return value changes (Task 1). `useLayoutMode()` is the default export returning `{ tier, … }` — used for the `data-layout-tier` attribute that `FretboardLensOverlay.module.css` keys on. The new i18n key `inspector.panelLabel` (Task 5) is added to `types.ts`, `en.ts`, `es.ts` and is the exact key `t("inspector.panelLabel")` references in `Inspector.tsx`. The CSS selectors `.root[data-placement="top"] .tab` (Task 5) match the `data-placement={placement}` attribute Radix `Tabs.Root` already carries and the `styles.tab` class on each `Tabs.Trigger`. `ProgressionBlock`'s inline `width` change (Task 6 Step 1) and the `.block` border rewrite (Step 2) are consistent — the 3px gap is created inline, the rounding in CSS.

---

## Execution complete

After Task 7, the branch carries all of Phase 13 — the lens floating overlay (13a) and the chrome polish (13b) — with `pnpm run lint`, `pnpm run test`, and `pnpm run build` green and visual baselines refreshed. If shipping as two PRs, open PR 13a after Task 3 and PR 13b after Task 7. Phase 13 is the final phase of the DAW shell redesign (spec §3) — after it, the shipped app matches the `FretFlow DAW.html` design within the recorded descopes (spec §11).
