# Mobile Progression & Preset Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four mobile defects on the progression surfaces — chord-list/editor overlap, timeline not following the active chord, short timeline blocks squishing, and the preset menu overflowing off-screen.

**Architecture:** Surface-by-surface, mobile-tier gated. (1) Drop the chord list's nested inner-scroll on mobile so the card flows in a single column. (2) Drive the timeline's mobile min-width off the shortest block duration so no block squishes. (3) Add a small auto-scroll hook that keeps the active block in view, firing only on active-index changes (which inherently yields to manual scrolling between changes). (4) On mobile, render preset categories as flat Radix groups instead of sideways fly-out submenus.

**Tech Stack:** React 19, TypeScript, CSS Modules, Jotai, Radix `DropdownMenu`, Vitest + Testing Library, Playwright. Package manager: **pnpm**. Mobile tier gated by `:global(.app-container[data-layout-tier="mobile"])`.

**Design spec:** `docs/superpowers/specs/2026-06-07-mobile-progression-preset-refinements-design.md`

---

## File Structure

- `src/components/SongControls/ProgressionStepList.module.css` — mobile rules removing the inner `.list` scroll cap and hiding the `.scroll` edge fades.
- `src/components/SongControls/ProgressionStepList.module.css.test.ts` (new) — raw-CSS assertions for the mobile rules.
- `src/components/ProgressionTrack/hooks/buildTimelineViewModel.ts` — expose shortest block duration.
- `src/components/ProgressionTrack/ProgressionTrack.tsx` — compute and set the `--mobile-timeline-min-width` variable; add a ref to the scroll container and wire the auto-scroll hook.
- `src/components/ProgressionTrack/ProgressionTrack.module.css` — replace the `--mobile-min-chord-count` rule with the duration-driven width variable.
- `src/components/ProgressionTrack/hooks/timelineAutoScroll.ts` (new) — pure `computeAutoScrollDelta` helper.
- `src/components/ProgressionTrack/hooks/useTimelineAutoScroll.ts` (new) — effect hook composing the helper.
- `src/components/ProgressionTrack/hooks/timelineAutoScroll.test.ts` (new) — helper unit tests.
- `src/components/ProgressionTrack/ProgressionTrack.test.tsx`, `ProgressionTrack.module.css.test.ts` — update width-variable coverage.
- `src/components/PresetMenu/PresetMenu.tsx` — `compact` prop; conditional flat-vs-sub category rendering.
- `src/components/PresetMenu/PresetMenu.test.tsx` — compact-mode coverage.
- `src/components/SongControls/SongControls.tsx` — read layout tier, pass `compact` to `PresetMenu`.
- `e2e/responsive.spec.ts` — mobile geometry guards: list non-scroll, active-block in-view, preset-menu horizontal bounds.

---

## Task 1: Progression card — single-column flow (drop inner list scroll on mobile)

**Files:**
- Modify: `src/components/SongControls/ProgressionStepList.module.css`
- Create: `src/components/SongControls/ProgressionStepList.module.css.test.ts`

Context: `.col > .caption + .scroll > ul.list`. On all tiers `.list` has `max-height: 17rem; overflow-y: auto`, and `.scroll::before`/`.scroll::after` render top/bottom edge-fade overlays. On mobile this nested scroll-in-scroll plus fades reads as the editor overlapping the list. We remove the cap and fades at the mobile tier only; desktop/tablet keep the bounded scroll.

- [ ] **Step 1: Write the failing raw-CSS test**

Create `src/components/SongControls/ProgressionStepList.module.css.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("./ProgressionStepList.module.css", import.meta.url)),
  "utf8",
);

describe("ProgressionStepList.module.css mobile rules", () => {
  it("removes the inner list scroll cap on mobile", () => {
    expect(css).toMatch(
      /data-layout-tier="mobile"[\s\S]*\.list[\s\S]*max-height:\s*none/,
    );
  });

  it("hides the scroll edge fades on mobile", () => {
    expect(css).toMatch(
      /data-layout-tier="mobile"[\s\S]*\.scroll::before[\s\S]*display:\s*none/,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/SongControls/ProgressionStepList.module.css.test.ts`
Expected: FAIL (no mobile rules yet).

- [ ] **Step 3: Add the mobile rules**

Append to the end of `src/components/SongControls/ProgressionStepList.module.css`:

```css
/* ---------------------------------------------------------------------------
 * Mobile: collapse the master-detail into a single natural-flow column. The
 * bounded inner scroll (max-height + overflow) plus edge fades create a
 * cramped nested-scroll region inside the already-scrolling inspector, which
 * reads as the editor overlapping the list. On mobile the full list flows and
 * the editor sits cleanly below it; the inspector page scroll absorbs height.
 * ------------------------------------------------------------------------- */
/* stylelint-disable selector-pseudo-class-no-unknown */
:global(.app-container[data-layout-tier="mobile"]) .list {
  max-height: none;
  overflow-y: visible;
}

:global(.app-container[data-layout-tier="mobile"]) .scroll::before,
:global(.app-container[data-layout-tier="mobile"]) .scroll::after {
  display: none;
}
/* stylelint-enable selector-pseudo-class-no-unknown */
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/SongControls/ProgressionStepList.module.css.test.ts`
Expected: PASS.

- [ ] **Step 5: Run lint**

Run: `pnpm run lint`
Expected: 0 errors (1 pre-existing warning in `useFretboardTopologyModel.ts` is unrelated).

- [ ] **Step 6: Commit**

```bash
git add src/components/SongControls/ProgressionStepList.module.css src/components/SongControls/ProgressionStepList.module.css.test.ts
git commit -m "fix(mobile): drop nested chord-list scroll so editor stops overlapping"
```

---

## Task 2: Timeline — shortest-duration-driven min-width (stop short blocks squishing)

**Files:**
- Modify: `src/components/ProgressionTrack/hooks/buildTimelineViewModel.ts`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.module.css`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.test.tsx`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts`

Context: blocks are width-weighted by duration (`widthPercent = durationBars / totalBarsForDisplay * 100`). The current mobile rule sizes the timeline from chord count (`--mobile-min-chord-count * 5.25rem`), which assumes equal widths — so a 1-bar block next to 2-bar blocks falls below readable width. Fix: size the timeline so the **shortest** block hits a readable floor: `timelineMinWidthRem = (totalBarsForDisplay / shortestDurationBars) * MIN_BLOCK_REM`. Only total width scales; relative percents (and thus ruler/playhead alignment) are unchanged.

- [ ] **Step 1: Write the failing view-model test**

In `src/components/ProgressionTrack/hooks/buildTimelineViewModel.ts` there is no test file; add the assertion to `ProgressionTrack.test.tsx` after implementing the variable (Step 5). First, extend the view model. Open `buildTimelineViewModel.ts` and add `shortestDurationBars` to the returned model type and value.

Update the type:

```ts
export type TimelineStaticViewModel = {
  blockLayouts: TimelineBlockLayout[];
  totalDurationBars: number;
  totalBarsForDisplay: number;
  subdivisionsPerBar: number;
  shortestDurationBars: number;
};
```

Inside `buildTimelineViewModel`, after `blockLayouts` is built and before the return, compute the shortest positive duration (fall back to 1 when there are no steps):

```ts
    const shortestDurationBars = blockLayouts.reduce(
      (min, layout) =>
        layout.durationBars > 0 ? Math.min(min, layout.durationBars) : min,
      Number.POSITIVE_INFINITY,
    );
    const safeShortest = Number.isFinite(shortestDurationBars)
      ? shortestDurationBars
      : 1;

    return {
      blockLayouts,
      totalDurationBars,
      totalBarsForDisplay,
      subdivisionsPerBar,
      shortestDurationBars: safeShortest,
    };
```

(Replace the existing `return { blockLayouts, totalDurationBars, totalBarsForDisplay, subdivisionsPerBar };` line.)

- [ ] **Step 2: Add the mobile width variable in ProgressionTrack.tsx**

In `src/components/ProgressionTrack/ProgressionTrack.tsx`:

Add a module-level constant above the component (after imports):

```ts
// Readable floor (in rem) for the shortest-duration block on mobile. The whole
// timeline is scaled so the shortest block reaches this width; longer blocks
// grow proportionally, preserving ruler/playhead alignment.
const MIN_BLOCK_REM = 5.25;
```

Destructure `shortestDurationBars` from the view model (add it to the existing destructure list from `useTimelineViewModel()`):

```ts
  const {
    blockLayouts,
    totalDurationBars,
    totalBarsForDisplay,
    subdivisionsPerBar,
    stepAtoms,
    shortestDurationBars,
    displayedStepIndex,
    canPlay,
    playing,
    transportStartBar,
    playbackBlockedReason,
  } = useTimelineViewModel();
```

Compute the min width just before the `return`:

```ts
  const mobileTimelineMinWidthRem =
    (totalBarsForDisplay / shortestDurationBars) * MIN_BLOCK_REM;
```

Replace the timeline `style` object's `--mobile-min-chord-count` line with the new variable:

```tsx
        style={{
          "--bar-count": totalBarsForDisplay,
          "--beats-per-bar": subdivisionsPerBar,
          "--mobile-timeline-min-width": `${mobileTimelineMinWidthRem}rem`,
        } as CSSProperties}
```

- [ ] **Step 3: Update the CSS to use the new variable**

In `src/components/ProgressionTrack/ProgressionTrack.module.css`, replace the `.timeline` mobile rule (the block currently reading `min-width: max(100%, calc(var(--mobile-min-chord-count, 1) * 5.25rem));`) with:

```css
:global(.app-container[data-layout-tier="mobile"]) .timeline {
  /* Width is driven by the shortest block's duration (computed in
     ProgressionTrack.tsx) so even 1-bar blocks beside 2-bar blocks stay
     readable. Only the total width scales — block percents and the playhead
     stay aligned. */
  min-width: max(100%, var(--mobile-timeline-min-width, 100%));
}
```

Also update the explanatory comment on the mobile `.track` block (a few lines above) if it still references a "chord-count driven minimum width" — change that phrase to "duration-driven minimum width" so the comment matches the code.

- [ ] **Step 4: Update the CSS-module test**

In `src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts`, replace the assertion that references `--mobile-min-chord-count` with:

```ts
it("gives mobile progression timelines a duration-driven minimum width", () => {
  expect(css).toMatch(
    /data-layout-tier="mobile"[\s\S]*\.timeline[\s\S]*--mobile-timeline-min-width/,
  );
});
```

- [ ] **Step 5: Update the ProgressionTrack component test**

In `src/components/ProgressionTrack/ProgressionTrack.test.tsx`, find the test that asserts the timeline exposes `--mobile-min-chord-count` (the 8-step "minimum timeline width" test). Replace its assertion so it checks the new variable. For 8 one-bar steps, `totalBarsForDisplay = 8`, `shortestDurationBars = 1`, so the value is `8 / 1 * 5.25 = 42rem`:

```tsx
  expect(screen.getByLabelText("Progression timeline")).toHaveStyle({
    "--mobile-timeline-min-width": "42rem",
  });
```

Update the test title/description from "minimum timeline width / chord count" wording to reflect duration-driven width if needed (keep a `-t` matchable phrase, e.g. "minimum timeline width").

Then add a second assertion proving mixed durations do not squish — a 4-step progression of [2 bar, 2 bar, 1 bar, 1 bar]: `totalBarsForDisplay = 6`, `shortestDurationBars = 1`, value `6 / 1 * 5.25 = 31.5rem` (so each 1-bar block is `1/6 * 31.5 = 5.25rem`, exactly the floor):

```tsx
it("scales the mobile timeline so the shortest block stays readable with mixed durations", () => {
  renderWithAtoms(<ProgressionTrack />, {
    progressionSteps: [
      { id: "a", degree: "I", duration: { value: 2, unit: "bar" }, qualityOverride: null },
      { id: "b", degree: "IV", duration: { value: 2, unit: "bar" }, qualityOverride: null },
      { id: "c", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "d", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    ],
  });

  expect(screen.getByLabelText("Progression timeline")).toHaveStyle({
    "--mobile-timeline-min-width": "31.5rem",
  });
});
```

Use the same `renderWithAtoms` import and seeding shape already in the file (match the existing tests' step object shape — include `manualRoot: null` if the file's other seeds include it).

- [ ] **Step 6: Run the tests**

Run: `pnpm test src/components/ProgressionTrack/ProgressionTrack.test.tsx src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts`
Expected: PASS.

- [ ] **Step 7: Run lint**

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/ProgressionTrack/hooks/buildTimelineViewModel.ts src/components/ProgressionTrack/ProgressionTrack.tsx src/components/ProgressionTrack/ProgressionTrack.module.css src/components/ProgressionTrack/ProgressionTrack.test.tsx src/components/ProgressionTrack/ProgressionTrack.module.css.test.ts
git commit -m "fix(mobile): scale timeline by shortest block so short chords stop squishing"
```

---

## Task 3: Timeline — auto-scroll the active chord into view

**Files:**
- Create: `src/components/ProgressionTrack/hooks/timelineAutoScroll.ts`
- Create: `src/components/ProgressionTrack/hooks/timelineAutoScroll.test.ts`
- Create: `src/components/ProgressionTrack/hooks/useTimelineAutoScroll.ts`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx`

Context: the active block already carries `data-active="true"`. The hook fires only when the active index changes; between changes it never scrolls, so a manual scroll is naturally left alone until the next index change (the "yields to touch" requirement). The geometry decision is extracted into a pure helper so it is unit-testable without jsdom layout.

- [ ] **Step 1: Write the failing helper test**

Create `src/components/ProgressionTrack/hooks/timelineAutoScroll.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeAutoScrollDelta } from "./timelineAutoScroll";

const LEAD = 0.15;

describe("computeAutoScrollDelta", () => {
  const view = { left: 0, width: 300 }; // lead zone = 45px

  it("returns null when the block is comfortably in view", () => {
    expect(computeAutoScrollDelta(view, { left: 100, right: 160 }, LEAD)).toBeNull();
  });

  it("returns a negative delta to scroll left when the block is past the left lead", () => {
    // block left at 20 < lead (45) → delta = 20 - 45 = -25
    expect(computeAutoScrollDelta(view, { left: 20, right: 80 }, LEAD)).toBe(-25);
  });

  it("returns a positive delta to scroll right when the block is past the right lead", () => {
    // right edge 290 > width-lead (255) → delta = 290 - 255 = 35
    expect(computeAutoScrollDelta(view, { left: 230, right: 290 }, LEAD)).toBe(35);
  });

  it("accounts for the container's own left offset", () => {
    // container starts at 50; block left at 60 → relative left = 10 < 45 → 10 - 45 = -35
    expect(
      computeAutoScrollDelta({ left: 50, width: 300 }, { left: 60, right: 120 }, LEAD),
    ).toBe(-35);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/ProgressionTrack/hooks/timelineAutoScroll.test.ts`
Expected: FAIL ("computeAutoScrollDelta is not a function" / module not found).

- [ ] **Step 3: Implement the pure helper**

Create `src/components/ProgressionTrack/hooks/timelineAutoScroll.ts`:

```ts
/** Lead margin as a fraction of the container width: the active block is kept
 *  at least this far from the leading/trailing edge so the next chord is
 *  partially visible. */
export const AUTO_SCROLL_LEAD_FRACTION = 0.15;

interface ViewBox {
  left: number;
  width: number;
}

interface BlockBox {
  left: number;
  right: number;
}

/**
 * Returns the horizontal scroll delta (px) needed to bring `block` inside the
 * lead-inset visible range of `view`, or null when it is already in view.
 * Negative = scroll left, positive = scroll right.
 */
export function computeAutoScrollDelta(
  view: ViewBox,
  block: BlockBox,
  leadFraction: number,
): number | null {
  const lead = view.width * leadFraction;
  const leftEdge = block.left - view.left;
  const rightEdge = block.right - view.left;

  if (leftEdge < lead) return leftEdge - lead;
  if (rightEdge > view.width - lead) return rightEdge - (view.width - lead);
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/ProgressionTrack/hooks/timelineAutoScroll.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the effect hook**

Create `src/components/ProgressionTrack/hooks/useTimelineAutoScroll.ts`:

```ts
import { useEffect, type RefObject } from "react";
import {
  AUTO_SCROLL_LEAD_FRACTION,
  computeAutoScrollDelta,
} from "./timelineAutoScroll";

/**
 * Keeps the active timeline block in view inside a horizontally scrollable
 * container. Fires only when `activeIndex` changes, so it never fights a manual
 * scroll between index changes (it follows playback advances and editor
 * selections, and yields to touch otherwise). No-ops when the container does
 * not horizontally overflow (desktop/tablet).
 */
export function useTimelineAutoScroll(
  containerRef: RefObject<HTMLElement | null>,
  activeIndex: number,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (container.scrollWidth <= container.clientWidth) return;

    const active = container.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return;

    const containerRect = container.getBoundingClientRect();
    const blockRect = active.getBoundingClientRect();

    const delta = computeAutoScrollDelta(
      { left: containerRect.left, width: container.clientWidth },
      { left: blockRect.left, right: blockRect.right },
      AUTO_SCROLL_LEAD_FRACTION,
    );
    if (delta === null) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    container.scrollBy({
      left: delta,
      behavior: prefersReduced ? "auto" : "smooth",
    });
  }, [containerRef, activeIndex]);
}
```

- [ ] **Step 6: Wire the hook into ProgressionTrack.tsx**

In `src/components/ProgressionTrack/ProgressionTrack.tsx`:

Add imports:

```ts
import { useCallback, useRef, type CSSProperties } from "react";
```

(extend the existing `react` import — it currently imports `useCallback` and `CSSProperties`; add `useRef`.)

Add the hook import:

```ts
import { useTimelineAutoScroll } from "./hooks/useTimelineAutoScroll";
```

Inside the component, create the ref and call the hook (after the existing `useCallback` for `selectStep`):

```ts
  const trackRef = useRef<HTMLElement>(null);
  useTimelineAutoScroll(trackRef, displayedStepIndex);
```

Attach the ref to the scrollable `<section className={styles.track}>` element:

```tsx
    <section
      ref={trackRef}
      role="group"
      aria-label="Progression track"
      className={styles.track}
      data-playing={playing ? "true" : undefined}
      title={playbackBlockedReason ?? undefined}
    >
```

- [ ] **Step 7: Run the affected component tests**

Run: `pnpm test src/components/ProgressionTrack/ProgressionTrack.test.tsx`
Expected: PASS (the auto-scroll hook no-ops in jsdom because `scrollWidth <= clientWidth`, so existing rendering tests are unaffected).

- [ ] **Step 8: Run lint**

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/ProgressionTrack/hooks/timelineAutoScroll.ts src/components/ProgressionTrack/hooks/timelineAutoScroll.test.ts src/components/ProgressionTrack/hooks/useTimelineAutoScroll.ts src/components/ProgressionTrack/ProgressionTrack.tsx
git commit -m "feat(mobile): auto-scroll progression timeline to the active chord"
```

---

## Task 4: Preset menu — flatten category submenus on mobile

**Files:**
- Modify: `src/components/PresetMenu/PresetMenu.tsx`
- Modify: `src/components/PresetMenu/PresetMenu.test.tsx`
- Modify: `src/components/SongControls/SongControls.tsx`

Context: categories render as `DropdownMenu.Sub` fly-outs that open sideways and overflow narrow viewports. On mobile we render them as flat `DropdownMenu.Group` + `DropdownMenu.Label` + items inside the single scrollable content (the exact pattern the suggestion groups already use). Desktop keeps the fly-outs. `PresetMenu` stays presentational via a `compact` prop supplied by `SongControls`.

- [ ] **Step 1: Write the failing compact-mode test**

In `src/components/PresetMenu/PresetMenu.test.tsx`, add (the file already defines `baseProps`, imports `render`, `screen`, `userEvent`):

```tsx
it("renders categories as a flat list (no submenu triggers) in compact mode", async () => {
  const user = userEvent.setup();
  render(<PresetMenu {...baseProps} compact />);

  await user.click(screen.getByRole("button", { name: /Preset/i }));

  // The category label appears as a static group label, not a submenu trigger.
  expect(
    screen.queryByRole("menuitem", { name: "Pop / Rock" }),
  ).not.toBeInTheDocument();
  // The category's options are directly visible without opening a submenu.
  expect(screen.getByRole("menuitem", { name: /vi-IV-I-V/ })).toBeInTheDocument();
});

it("keeps category submenus in the default (non-compact) mode", async () => {
  const user = userEvent.setup();
  render(<PresetMenu {...baseProps} />);

  await user.click(screen.getByRole("button", { name: /Preset/i }));

  // Categories are submenu triggers; their options are not yet in the DOM.
  expect(
    screen.getByRole("menuitem", { name: /Pop \/ Rock/ }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: /vi-IV-I-V/ })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/PresetMenu/PresetMenu.test.tsx`
Expected: FAIL (the `compact` prop does not exist; categories always render as submenus).

- [ ] **Step 3: Add the `compact` prop and flat rendering**

In `src/components/PresetMenu/PresetMenu.tsx`:

Add `compact` to the props interface (after `width`):

```ts
  /** When true (mobile), render categories as flat in-menu groups instead of
   *  sideways fly-out submenus, which can overflow narrow viewports. */
  compact?: boolean;
```

Add `compact = false` to the destructured parameters in the function signature.

Extract a reusable flat-group renderer near `MenuOption` (so categories and the existing suggestion groups share the shape):

```tsx
function CategoryGroup({
  category,
  currentId,
  onSelect,
  withSeparator,
}: {
  category: PresetMenuCategory;
  currentId: string;
  onSelect: (id: string) => void;
  withSeparator: boolean;
}) {
  return (
    <DropdownMenu.Group>
      {withSeparator && (
        <DropdownMenu.Separator className={styles["preset-menu-separator"]} />
      )}
      <DropdownMenu.Label className={styles["preset-menu-group-label"]}>
        {category.label}
      </DropdownMenu.Label>
      {category.options.map((option) => (
        <MenuOption
          key={option.id}
          option={option}
          currentId={currentId}
          onSelect={onSelect}
        />
      ))}
    </DropdownMenu.Group>
  );
}
```

Replace the categories `.map(...)` block inside `PresetMenuContent` with a branch on `compact`:

```tsx
          {compact
            ? categories.map((category, index) => (
                <CategoryGroup
                  key={category.label}
                  category={category}
                  currentId={currentId}
                  onSelect={onSelect}
                  withSeparator={index > 0}
                />
              ))
            : categories.map((category) => (
                <DropdownMenu.Sub key={category.label}>
                  <DropdownMenu.SubTrigger className={styles["preset-menu-subtrigger"]}>
                    <span>{category.label}</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <PresetMenuSubContent
                      className={styles["preset-menu-content"]}
                      sideOffset={2}
                      alignOffset={-4}
                    >
                      {category.options.map((option) => (
                        <MenuOption
                          key={option.id}
                          option={option}
                          currentId={currentId}
                          onSelect={onSelect}
                        />
                      ))}
                    </PresetMenuSubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              ))}
```

(The suggestion-groups section below stays unchanged. In compact mode the `Suggested for <scale>` submenu also overflows; wrap it the same way: when `compact`, render its groups inline under a `DropdownMenu.Label` reading `Suggested for ${scaleLabel}` instead of a `DropdownMenu.Sub`. Mirror the structure above — a separator, the label, then the existing `suggestionGroups.map(...)` `DropdownMenu.Group` blocks. Keep the non-compact branch as the current `DropdownMenu.Sub`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/PresetMenu/PresetMenu.test.tsx`
Expected: PASS. Also confirm the existing a11y/label tests in the file still pass.

- [ ] **Step 5: Pass `compact` from SongControls**

In `src/components/SongControls/SongControls.tsx`:

Add the layout hook import near the other hook imports:

```ts
import useLayoutMode from "../../hooks/useLayoutMode";
```

Inside the component, read the tier (near the other hook calls at the top of the component body):

```ts
  const { tier } = useLayoutMode();
```

Pass it to the `PresetMenu` usage (around line 243):

```tsx
                <PresetMenu
```

add the prop:

```tsx
                  compact={tier === "mobile"}
```

- [ ] **Step 6: Run SongControls + PresetMenu tests**

Run: `pnpm test src/components/SongControls/SongControls.test.tsx src/components/PresetMenu/PresetMenu.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run lint**

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/PresetMenu/PresetMenu.tsx src/components/PresetMenu/PresetMenu.test.tsx src/components/SongControls/SongControls.tsx
git commit -m "fix(mobile): flatten preset menu categories so they stop overflowing"
```

---

## Task 5: Mobile e2e geometry guards

**Files:**
- Modify: `e2e/responsive.spec.ts`

Context: add Playwright guards at `390x844` for the three observable behaviors. Reuse the existing `gotoApp` helper and the `responsive layout regressions` describe block. Inspect the file first to match the existing helper names and patterns (`gotoApp`, `getRect`, `expectNoVerticalOverlap` added in the prior sweep).

- [ ] **Step 1: Add the chord-list non-scroll guard**

Inside `test.describe("responsive layout regressions", ...)` add:

```ts
  test("shows the full mobile chord list without an inner scroll", async ({ page }) => {
    await gotoApp(page, 390, 844);
    await page.getByRole("tab", { name: "Song" }).click();

    const list = page.locator('[aria-label="Progression navigation"]');
    await expect(list).toBeVisible();

    const overflow = await list.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    // No bounded inner scroll on mobile: content height is not clipped.
    expect(overflow.scrollHeight, "list inner scroll").toBeLessThanOrEqual(
      overflow.clientHeight + 1,
    );
  });
```

- [ ] **Step 2: Add the preset-menu horizontal-bounds guard**

```ts
  test("keeps the mobile preset menu within the viewport width", async ({ page }) => {
    await gotoApp(page, 390, 844);
    await page.getByRole("tab", { name: "Song" }).click();

    // Open the preset picker (its trigger label comes from the Song controls).
    await page.getByRole("button", { name: /preset/i }).first().click();

    const menu = page.getByRole("menu").first();
    await expect(menu).toBeVisible();

    const rect = await menu.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right) };
    });
    expect(rect.left, "menu left").toBeGreaterThanOrEqual(0);
    expect(rect.right, "menu right").toBeLessThanOrEqual(390);
  });
```

If the trigger's accessible name differs, adjust the `name` regex to match the real Song-tab preset trigger label (inspect the rendered button; it uses the `triggerLabel` passed in `SongControls.tsx`).

- [ ] **Step 3: Add the active-block in-view guard**

```ts
  test("keeps the active timeline chord in view during playback on mobile", async ({ page }) => {
    await gotoApp(page, 390, 844);

    // A progression long enough to overflow the mobile track horizontally.
    // (Load via the same visual/state helper the other timeline tests use, or
    // seed through the UI. Inspect e2e helpers for the established approach;
    // if a loadVisualState helper exists it accepts { progressionSteps }.)
    // After seeding, select a late chord so its block is off the initial view,
    // then assert it scrolls into the track's visible x-range.

    const track = page.getByRole("group", { name: "Progression track" });
    await expect(track).toBeVisible();

    // Select the last chord block; the editor selection drives displayedStepIndex.
    const blocks = track.getByRole("button");
    const count = await blocks.count();
    await blocks.nth(count - 1).click();

    const inView = await track.evaluate((el) => {
      const active = el.querySelector('[data-active="true"]');
      if (!active) return false;
      const c = el.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      return a.left >= c.left - 1 && a.right <= c.right + 1;
    });
    expect(inView, "active block within track viewport").toBe(true);
  });
```

If seeding a long progression through the UI is impractical in this spec, instead add this assertion to the existing `e2e/progression.visual.spec.ts` long-progression mobile state (which already seeds 8 steps) as a `expect(...).toBe(true)` geometry check after selecting the last block. Use whichever matches the established e2e seeding approach in the repo.

- [ ] **Step 4: Run the new e2e guards**

Run: `pnpm run test:e2e -- e2e/responsive.spec.ts -g "mobile chord list|preset menu within|active timeline chord"`
Expected: PASS. (If the dev-server/browser environment is unavailable, note it; the guards still encode the intended invariants.)

- [ ] **Step 5: Commit**

```bash
git add e2e/responsive.spec.ts
git commit -m "test(mobile): guard chord-list scroll, preset bounds, and timeline follow"
```

---

## Task 6: Visual evidence refresh

**Files:**
- Modify: generated snapshots under `e2e/app-mobile.visual.spec.ts-snapshots/` and/or `e2e/progression.visual.spec.ts-snapshots/` (darwin), only where output intentionally changed.

- [ ] **Step 1: Run the mobile visual suites**

Run: `pnpm run test:visual -- e2e/app-mobile.visual.spec.ts e2e/progression.visual.spec.ts`
Expected: PASS, or intentional diffs on the Song tab (taller, full chord list), the mobile preset menu, and the long/mixed-duration progression track.

- [ ] **Step 2: Update snapshots where the diff is intentional**

Run: `pnpm run test:visual:update -- e2e/app-mobile.visual.spec.ts e2e/progression.visual.spec.ts`
Expected: darwin snapshots update. (Linux snapshots regenerate in CI per repo convention.)

- [ ] **Step 3: Commit**

```bash
git add e2e/app-mobile.visual.spec.ts-snapshots e2e/progression.visual.spec.ts-snapshots
git commit -m "test(visual): refresh mobile progression and preset snapshots"
```

---

## Final Verification

- [ ] **Run the full gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: lint 0 errors (1 pre-existing unrelated warning), all unit tests pass, build succeeds.

- [ ] **Run the mobile e2e + visual suites**

Run: `pnpm run test:e2e -- e2e/responsive.spec.ts && pnpm run test:visual -- e2e/app-mobile.visual.spec.ts e2e/progression.visual.spec.ts`
Expected: PASS.
