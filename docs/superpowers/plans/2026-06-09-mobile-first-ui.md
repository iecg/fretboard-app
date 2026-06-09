# Mobile-First UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scrolling mobile page with a fixed app shell — fretboard always visible, controls in a vaul bottom sheet whose peek row is the transport mini-player.

**Architecture:** A new structural `MobileShell` renders when the layout resolver sets a new `useSheetShell` flag (mobile tier + tablet-split). All behavioral components (`Inspector` tabs, `TransportBar`, `ProgressionTrack`, settings/help content) stay single-source and adapt via CSS gated on `data-layout-tier` or a new placement variant. Desktop/tablet-stacked trees are unchanged until the final cleanup task, which deletes the legacy bottom-tab path.

**Tech Stack:** React 19 + React Compiler, Jotai, Radix, `vaul` (new dep), motion, CSS Modules, Vitest + Testing Library, Playwright visual suites.

**Spec:** `docs/superpowers/specs/2026-06-09-mobile-first-ui-design.md`

**Worktree:** Execute in a dedicated git worktree (this plan was authored in `claude/musing-gould-9706c8`).

**Repo rules that bite here:**
- `pnpm` only. Conventional Commits with scope.
- React Compiler ESLint rule runs at `error` — no manual memo unless profiled; if vaul misbehaves under the compiler, opt out with `'use no memo'` + `// TODO(react-compiler): <reason>`.
- New user-facing strings need entries in `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts`.
- Unit-test snapshots under `src/__tests__/__snapshots__/` are gitignored; CI seeds them.

---

## File Structure

```text
src/
├── App.tsx                                  # MODIFY: branch MobileShell vs MainLayoutWrapper; extract header actions
├── components/
│   ├── AppHeaderActions/
│   │   ├── AppHeaderActions.tsx             # CREATE: shared theme/mute/settings/help actions (buttons OR menu items)
│   │   └── AppHeaderActions.test.tsx        # CREATE
│   ├── MobileShell/
│   │   ├── MobileShell.tsx                  # CREATE: structural shell (regions as props)
│   │   ├── MobileShell.module.css           # CREATE
│   │   ├── MobileShell.test.tsx             # CREATE
│   │   ├── MobileSheet.tsx                  # CREATE: vaul drawer + snap atom binding
│   │   ├── MobileSheet.module.css           # CREATE
│   │   ├── MobileSheet.test.tsx             # CREATE
│   │   ├── SheetPeekTransport.tsx           # CREATE: mini-player row (play/key/tempo/loop)
│   │   ├── SheetPeekTransport.module.css    # CREATE
│   │   └── SheetPeekTransport.test.tsx      # CREATE
│   ├── shared/
│   │   ├── AdaptiveModal.tsx                # CREATE: Dialog (desktop) / vaul Drawer (mobile) wrapper
│   │   └── AdaptiveModal.test.tsx           # CREATE
│   ├── Inspector/Inspector.tsx              # MODIFY: add placement="sheet"; later delete "bottom"
│   ├── MainLayoutWrapper/MainLayoutWrapper.tsx  # MODIFY (cleanup task): drop mobileTabs/showMobileTabs
│   ├── SettingsOverlay/SettingsOverlay.tsx  # MODIFY: present via AdaptiveModal
│   └── HelpModal/HelpModal.tsx              # MODIFY: present via AdaptiveModal
├── layout/responsive.ts                     # MODIFY: add useSheetShell flag
├── store/uiAtoms.ts                         # MODIFY: add mobileSheetSnapAtom
├── styles/App.css                           # MODIFY: move rotate-overlay css out
└── i18n/{types,en,es}.ts                    # MODIFY: new strings
index.html                                   # MODIFY: viewport-fit=cover
e2e/app-mobile/                              # MODIFY: refreshed snapshots + sheet scenarios
```

---

## Phase 1 — Foundation

### Task 1: Install vaul and smoke-check the build

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Add the dependency**

```bash
pnpm add vaul
```

- [ ] **Step 2: Verify build + lint still pass with the new dep**

Run: `pnpm run build && pnpm run lint`
Expected: both succeed (no source uses vaul yet).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build(deps): add vaul for mobile bottom sheet"
```

### Task 2: `mobileSheetSnapAtom`

**Files:**
- Modify: `src/store/uiAtoms.ts`
- Test: `src/store/uiAtoms.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/store/uiAtoms.test.ts
import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { mobileSheetSnapAtom } from "./uiAtoms";

describe("mobileSheetSnapAtom", () => {
  it("defaults to peek", () => {
    const store = createStore();
    expect(store.get(mobileSheetSnapAtom)).toBe("peek");
  });

  it("accepts the three snap ids", () => {
    const store = createStore();
    for (const snap of ["peek", "half", "full"] as const) {
      store.set(mobileSheetSnapAtom, snap);
      expect(store.get(mobileSheetSnapAtom)).toBe(snap);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/store/uiAtoms.test.ts`
Expected: FAIL — `mobileSheetSnapAtom` is not exported.

- [ ] **Step 3: Implement the atom**

Append to `src/store/uiAtoms.ts` (storage helpers `k`, `rawStringStorage`, `GET_ON_INIT` are already imported at the top of the file):

```ts
export type MobileSheetSnap = "peek" | "half" | "full";

/**
 * Persisted snap position of the mobile bottom sheet. "peek" shows only the
 * mini-player transport row; "half" and "full" expose the Inspector tabs.
 */
export const mobileSheetSnapAtom = atomWithStorage<MobileSheetSnap>(
  k("mobileSheetSnap"),
  "peek",
  rawStringStorage<MobileSheetSnap>(),
  GET_ON_INIT,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/store/uiAtoms.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/uiAtoms.ts src/store/uiAtoms.test.ts
git commit -m "feat(store): add persisted mobileSheetSnapAtom"
```

### Task 3: `useSheetShell` layout flag

**Files:**
- Modify: `src/layout/responsive.ts`
- Test: `src/layout/responsive.test.ts` (exists — check with `ls src/layout/`; if missing, create with only the new describe block)

- [ ] **Step 1: Write the failing test**

Add to the responsive test file:

```ts
import { describe, expect, it } from "vitest";
import { getResponsiveLayout } from "./responsive";

describe("useSheetShell flag", () => {
  it("is true for the mobile tier", () => {
    expect(getResponsiveLayout(375, 812).useSheetShell).toBe(true);
  });

  it("is true for tablet-split (tablet width, tall viewport)", () => {
    expect(getResponsiveLayout(800, 1100).useSheetShell).toBe(true);
  });

  it("is false for tablet-stacked (tablet width, compact height)", () => {
    expect(getResponsiveLayout(800, 700).useSheetShell).toBe(false);
  });

  it("is false for all desktop variants", () => {
    expect(getResponsiveLayout(1280, 1000).useSheetShell).toBe(false);
    expect(getResponsiveLayout(1100, 700).useSheetShell).toBe(false);
  });
});
```

Note: `tablet-split` is the **non**-compact-height tablet variant (see `getResponsiveVariant`), hence 800×1100 → split, 800×700 → stacked.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/layout/responsive.test.ts`
Expected: FAIL — `useSheetShell` does not exist on the returned object (TypeScript error or undefined).

- [ ] **Step 3: Implement the flag**

In `src/layout/responsive.ts`:

1. Add to the `ResponsiveLayout` interface (after `showMobileTabs`):

```ts
  /** True when the surface uses the MobileShell + bottom sheet (touch contexts). */
  useSheetShell: boolean;
```

2. In `getResponsiveLayout`, the existing `showMobileTabs` condition is exactly the sheet-shell condition. Compute once and return both (`showMobileTabs` is deleted in Task 16):

```ts
  const useSheetShell = tier === "mobile" || variant === "tablet-split";

  return {
    // ...existing fields...
    showMobileTabs: useSheetShell,
    useSheetShell,
    // ...
  };
```

- [ ] **Step 4: Run tests + lint**

Run: `pnpm run test -- src/layout/ && pnpm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/layout/responsive.ts src/layout/responsive.test.ts
git commit -m "feat(layout): add useSheetShell flag for touch contexts"
```

### Task 4: `MobileShell` structural component

**Files:**
- Create: `src/components/MobileShell/MobileShell.tsx`
- Create: `src/components/MobileShell/MobileShell.module.css`
- Test: `src/components/MobileShell/MobileShell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/MobileShell/MobileShell.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileShell } from "./MobileShell";

describe("MobileShell", () => {
  it("renders header, track, fretboard stage, and sheet regions", () => {
    render(
      <MobileShell
        layoutTier="mobile"
        layoutVariant="mobile"
        header={<div data-testid="hdr" />}
        track={<div data-testid="trk" />}
        sheet={<div data-testid="sht" />}
      >
        <div data-testid="fret" />
      </MobileShell>,
    );
    expect(screen.getByTestId("hdr")).toBeInTheDocument();
    expect(screen.getByTestId("trk")).toBeInTheDocument();
    expect(screen.getByTestId("fret")).toBeInTheDocument();
    expect(screen.getByTestId("sht")).toBeInTheDocument();
    const shell = screen.getByTestId("mobile-shell");
    expect(shell).toHaveAttribute("data-layout-tier", "mobile");
    expect(shell).toHaveAttribute("data-layout-variant", "mobile");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/components/MobileShell/MobileShell.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the shell**

```tsx
// src/components/MobileShell/MobileShell.tsx
import { type ReactNode } from "react";
import styles from "./MobileShell.module.css";

interface MobileShellProps {
  /** Fretboard stage content. */
  children: ReactNode;
  header: ReactNode;
  /** Progression chip strip. */
  track: ReactNode;
  /** Bottom sheet (MobileSheet). */
  sheet: ReactNode;
  layoutTier: string;
  layoutVariant: string;
}

/**
 * Fixed, non-scrolling mobile app surface. Owns only structure: compact
 * header, progression strip, fretboard stage (fills remaining height), and
 * the bottom sheet. All behavior lives in the shared components passed in.
 */
export function MobileShell({
  children,
  header,
  track,
  sheet,
  layoutTier,
  layoutVariant,
}: MobileShellProps) {
  return (
    <div
      className={styles.shell}
      data-layout-tier={layoutTier}
      data-layout-variant={layoutVariant}
      data-testid="mobile-shell"
    >
      <div className={styles.header}>{header}</div>
      <div className={styles.track}>{track}</div>
      <main className={styles.stage} data-testid="mobile-stage">
        {children}
      </main>
      {sheet}
    </div>
  );
}
```

```css
/* src/components/MobileShell/MobileShell.module.css */
.shell {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  padding-top: env(safe-area-inset-top, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  background: var(--color-bg, #0d1420);
}

.header,
.track {
  flex: none;
}

.stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* Reserve room for the sheet's peek height so the fretboard is never covered. */
  padding-bottom: var(--mobile-sheet-peek, 96px);
}
```

Check `src/styles/tokens.css` for the real background token name (`--color-bg` is a guess — use whatever `MainLayoutWrapper.module.css` / `App.css` use for the app background).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/components/MobileShell/MobileShell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MobileShell/
git commit -m "feat(mobile): add MobileShell structural component"
```

### Task 5: Branch `App.tsx` between shells

**Files:**
- Modify: `src/App.tsx`
- Modify: `index.html` (viewport-fit)
- Test: existing `src/App.test.tsx` if present (check `ls src/*.test.tsx`); otherwise rely on component tests + visual run

- [ ] **Step 1: Add `viewport-fit=cover` to index.html**

In `index.html`, change the viewport meta to:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

(Preserve any existing attributes in the current tag — read it first.)

- [ ] **Step 2: Render MobileShell when `layout.useSheetShell`**

In `src/App.tsx`, import the shell:

```tsx
import { MobileShell } from "./components/MobileShell/MobileShell";
```

Inside `AppContent`'s return, replace the single `<MainLayoutWrapper …>` expression with a branch. The shared pieces (`AppHeader` element, `ProgressionSummarySlot`, modals) are extracted to local variables so they aren't duplicated:

```tsx
const headerNode = (
  <AppHeader
    brandTitle="FretFlow"
    brandWordmark={<FretFlowWordmark />}
    brandIcon={<BrandMark />}
    transport={layout.useSheetShell ? undefined : <HeaderTransportCluster />}
    actions={/* existing actions JSX, unchanged for now (Task 10 replaces) */}
  />
);

const overlaysNode = (
  <>
    <Suspense fallback={null}>
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} triggerRef={helpTriggerRef} />
    </Suspense>
    <Suspense fallback={null}>
      <SettingsOverlay />
    </Suspense>
  </>
);
```

Branch (sheet placeholder until Task 6 — render the Inspector bottom variant inside a plain fixed footer so the app stays usable between commits):

```tsx
{layout.useSheetShell ? (
  <MobileShell
    layoutTier={layout.tier}
    layoutVariant={layout.variant}
    header={headerNode}
    track={<ProgressionSummarySlot />}
    sheet={
      <Suspense fallback={null}>
        <Inspector placement="bottom" />
      </Suspense>
    }
  >
    <Fretboard stringRowPx={layout.stringRowPx} />
    {overlaysNode}
  </MobileShell>
) : (
  <MainLayoutWrapper /* …exactly the existing props… */>
    <Fretboard stringRowPx={layout.stringRowPx} />
  </MainLayoutWrapper>
)}
```

Important: `ProgressionSummarySlot` hosts `useProgressionAudioPlayback()` — it must render in **both** branches (it already does via the `summary` prop on the desktop side).

Note `AppHeader`'s `transport` prop: check its prop types — if `transport` is required, make it optional (`transport?: ReactNode`) and conditionally render. The mobile header carries no transport cluster.

- [ ] **Step 3: Verify in browser**

Run: `pnpm run dev`, open at 375×812 (browser devtools device mode).
Expected: fixed surface — header, chip strip, fretboard filling height, Inspector pinned at bottom; no page scroll. Desktop (1280×1000) unchanged.

- [ ] **Step 4: Run full unit suite + lint**

Run: `pnpm run test && pnpm run lint`
Expected: PASS (App-level tests may need the same updates if they assert on a single wrapper — fix any that assume `MainLayoutWrapper` always renders).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx index.html src/components/AppHeader/
git commit -m "feat(mobile): render MobileShell for sheet-shell layouts"
```

---

## Phase 2 — Bottom Sheet

### Task 6: `MobileSheet` (vaul wrapper bound to the snap atom)

**Files:**
- Create: `src/components/MobileShell/MobileSheet.tsx`
- Create: `src/components/MobileShell/MobileSheet.module.css`
- Test: `src/components/MobileShell/MobileSheet.test.tsx`

- [ ] **Step 1: Write the failing test**

vaul's drag physics can't run in jsdom; test the pure snap-mapping helpers plus shallow rendering:

```tsx
// src/components/MobileShell/MobileSheet.test.tsx
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { mobileSheetSnapAtom } from "../../store/uiAtoms";
import { MobileSheet, SNAP_POINTS, snapIdToPoint, pointToSnapId } from "./MobileSheet";

describe("snap mapping", () => {
  it("maps ids to vaul snap points and back", () => {
    expect(snapIdToPoint("peek")).toBe(SNAP_POINTS[0]);
    expect(snapIdToPoint("half")).toBe(SNAP_POINTS[1]);
    expect(snapIdToPoint("full")).toBe(SNAP_POINTS[2]);
    expect(pointToSnapId(SNAP_POINTS[0])).toBe("peek");
    expect(pointToSnapId(SNAP_POINTS[2])).toBe("full");
    expect(pointToSnapId(null)).toBe("peek");
  });
});

describe("MobileSheet", () => {
  it("renders peek content and sheet body", () => {
    renderWithAtoms(
      <MobileSheet peek={<div data-testid="peek" />}>
        <div data-testid="body" />
      </MobileSheet>,
      [[mobileSheetSnapAtom, "full"]],
    );
    expect(screen.getByTestId("peek")).toBeInTheDocument();
    expect(screen.getByTestId("body")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/components/MobileShell/MobileSheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the sheet**

```tsx
// src/components/MobileShell/MobileSheet.tsx
import { type ReactNode } from "react";
import { Drawer } from "vaul";
import { useAtom } from "jotai";
import { mobileSheetSnapAtom, type MobileSheetSnap } from "../../store/uiAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./MobileSheet.module.css";

/** Peek must match --mobile-sheet-peek in MobileShell.module.css. */
export const SNAP_POINTS = ["96px", 0.45, 0.85] as const;

const SNAP_BY_ID: Record<MobileSheetSnap, (typeof SNAP_POINTS)[number]> = {
  peek: SNAP_POINTS[0],
  half: SNAP_POINTS[1],
  full: SNAP_POINTS[2],
};

export function snapIdToPoint(id: MobileSheetSnap): string | number {
  return SNAP_BY_ID[id];
}

export function pointToSnapId(point: string | number | null): MobileSheetSnap {
  if (point === SNAP_POINTS[2]) return "full";
  if (point === SNAP_POINTS[1]) return "half";
  return "peek";
}

interface MobileSheetProps {
  /** Mini-player transport row, always visible, pinned at sheet top. */
  peek: ReactNode;
  /** Expanded content (tabs). */
  children: ReactNode;
}

/**
 * Always-open, non-modal bottom sheet. Non-modal so the fretboard stays
 * interactive behind it; non-dismissible so it can never be flung away —
 * "peek" is the floor.
 */
export function MobileSheet({ peek, children }: MobileSheetProps) {
  const { t } = useTranslation();
  const [snapId, setSnapId] = useAtom(mobileSheetSnapAtom);

  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      snapPoints={[...SNAP_POINTS]}
      activeSnapPoint={snapIdToPoint(snapId)}
      setActiveSnapPoint={(p) => setSnapId(pointToSnapId(p))}
    >
      <Drawer.Portal>
        <Drawer.Content
          className={styles.content}
          data-testid="mobile-sheet"
          aria-label={t("mobileSheet.label")}
        >
          <div className={styles.handle} aria-hidden="true" />
          <div className={styles.peek}>{peek}</div>
          <div
            className={styles.body}
            data-snap={snapId}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

```css
/* src/components/MobileShell/MobileSheet.module.css */
.content {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  height: 92dvh;
  display: flex;
  flex-direction: column;
  border-radius: 14px 14px 0 0;
  border-top: 1px solid var(--color-border, #3a5068);
  background: var(--color-surface, #141e2c);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  z-index: 30;
}

.handle {
  flex: none;
  width: 36px;
  height: 4px;
  border-radius: 2px;
  margin: 8px auto 4px;
  background: var(--color-border, #5a728e);
}

.peek {
  flex: none;
  padding: 4px 12px 8px;
}

.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* At peek the body is hidden so the tab content can't half-show. */
.body[data-snap="peek"] {
  visibility: hidden;
}
```

Replace the CSS-var fallbacks with the project's actual tokens from `src/styles/tokens.css`.

Add the i18n string: in `src/i18n/types.ts` add a `mobileSheet: { label: string }` section; in `en.ts`: `label: "Playback and controls"`; in `es.ts`: `label: "Reproducción y controles"`.

vaul caveats to verify during this task (fix in place if they appear):
- vaul logs a missing `Drawer.Title` a11y warning → add `<Drawer.Title className={visuallyHidden}>` (a `sr-only` style exists in `shared.module.css`; check for it) instead of `aria-label` if so.
- If the React Compiler breaks vaul's internal refs (symptom: sheet doesn't drag), add `'use no memo'` with a `// TODO(react-compiler): vaul drag refs` comment.
- vaul snap points with non-modal drawers require `snapToSequentialPoint` in some versions — test on a real touch device/emulator, not just jsdom.

- [ ] **Step 4: Run tests, lint, build**

Run: `pnpm run test -- src/components/MobileShell/ && pnpm run lint && pnpm run build`
Expected: PASS.

- [ ] **Step 5: Wire into App.tsx**

Replace the Task-5 placeholder sheet:

```tsx
sheet={
  <MobileSheet peek={<SheetPeekTransport />}>
    <Suspense fallback={null}>
      <Inspector placement="sheet" />
    </Suspense>
  </MobileSheet>
}
```

`SheetPeekTransport` and `placement="sheet"` arrive in Tasks 7–8; until both land, keep `<Inspector placement="bottom" />` as the sheet child and `peek={null}`. Commit message reflects partial wiring.

- [ ] **Step 6: Verify in browser**

Run: `pnpm run dev` at 375×812.
Expected: sheet pinned at bottom at 96px; dragging up snaps to ~45% and ~85%; cannot be dismissed; fretboard interactive behind it; snap position survives reload (localStorage).

- [ ] **Step 7: Commit**

```bash
git add src/components/MobileShell/ src/App.tsx src/i18n/
git commit -m "feat(mobile): vaul bottom sheet with persisted snap points"
```

### Task 7: `SheetPeekTransport` mini-player

**Files:**
- Create: `src/components/MobileShell/SheetPeekTransport.tsx`
- Create: `src/components/MobileShell/SheetPeekTransport.module.css`
- Test: `src/components/MobileShell/SheetPeekTransport.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/MobileShell/SheetPeekTransport.test.tsx
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms, makeAtomStore } from "../../test-utils/renderWithAtoms";
import { Provider } from "jotai";
import { render } from "@testing-library/react";
import {
  progressionPlayingAtom,
  progressionTempoBpmAtom,
  progressionLoopEnabledAtom,
} from "../../store/progressionAtoms";
import { SheetPeekTransport } from "./SheetPeekTransport";

describe("SheetPeekTransport", () => {
  it("shows play button, tempo, scale, and loop toggle", () => {
    renderWithAtoms(<SheetPeekTransport />, [[progressionTempoBpmAtom, 90]]);
    expect(screen.getByTestId("peek-play")).toBeInTheDocument();
    expect(screen.getByTestId("peek-tempo")).toHaveTextContent("90");
    expect(screen.getByTestId("peek-scale")).toBeInTheDocument();
    expect(screen.getByTestId("peek-loop")).toBeInTheDocument();
  });

  it("toggles loop on tap", async () => {
    const store = makeAtomStore([[progressionLoopEnabledAtom, false]]);
    render(
      <Provider store={store}>
        <SheetPeekTransport />
      </Provider>,
    );
    await userEvent.click(screen.getByTestId("peek-loop"));
    expect(store.get(progressionLoopEnabledAtom)).toBe(true);
  });
});
```

Adjust atom names against `src/store/progressionAtoms.ts` exports before running — `progressionLoopEnabledAtom`, `progressionTempoBpmAtom`, `progressionPlayingAtom` are the names used by `usePlaybackTransportModel`. If `setProgressionPlayingAtom` requires the audio engine, the play-click test may need the same mocks `TransportBar.test.tsx` uses — copy its mock setup.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/components/MobileShell/SheetPeekTransport.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/MobileShell/SheetPeekTransport.tsx
import clsx from "clsx";
import { Play, Pause, Repeat } from "lucide-react";
import { usePlaybackTransportModel } from "../../hooks/usePlaybackTransportModel";
import { useScaleState } from "../../hooks/useScaleState";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./SheetPeekTransport.module.css";

/**
 * Mini-player row shown in the sheet's peek state and pinned above the tabs
 * when expanded: play/pause, key, tempo, loop. The full transport set lives
 * in the expanded sheet (TransportBar / Song tab).
 */
export function SheetPeekTransport() {
  const { t } = useTranslation();
  const {
    progressionPlaying,
    progressionPlaybackBlockedReason,
    progressionTempoBpm,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    setProgressionPlaying,
  } = usePlaybackTransportModel();
  const { scaleLabel } = useScaleState();

  const canPlay = !progressionPlaybackBlockedReason;
  const scale = scaleLabel.split(" (")[0].trim();

  return (
    <div className={styles.row} data-testid="sheet-peek-transport">
      <button
        type="button"
        className={styles.play}
        data-testid="peek-play"
        disabled={!canPlay}
        aria-label={progressionPlaying ? t("transport.pause") : t("transport.play")}
        onClick={() => setProgressionPlaying(!progressionPlaying)}
      >
        {progressionPlaying ? <Play /* swap: Pause */ /> : <Play />}
      </button>

      <span className={styles.chip} data-testid="peek-scale">{scale}</span>

      <span className={styles.chip} data-testid="peek-tempo">
        {progressionTempoBpm}
        <span className={styles.unit}>BPM</span>
      </span>

      <button
        type="button"
        className={clsx(styles.chip, styles.toggle, progressionLoopEnabled && styles.on)}
        data-testid="peek-loop"
        aria-pressed={progressionLoopEnabled}
        aria-label={t("transport.loop")}
        onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
      >
        <Repeat />
      </button>
    </div>
  );
}
```

Notes for the implementer:
- Use `Pause` icon when playing (the comment marks the spot).
- Check `src/i18n/en.ts` for existing transport strings (`transport.play` etc.) — `TransportBar.tsx` already labels these buttons; reuse its exact keys rather than inventing new ones.
- Check how `TransportBar` calls play (it may go through `setProgressionPlayingAtom` with an object or need `stopProgressionPlayback`) — mirror its handler exactly.

```css
/* src/components/MobileShell/SheetPeekTransport.module.css */
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.play {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent, #2d9fc4);
  color: #fff;
  flex: none;
}

.play:disabled { opacity: 0.5; }

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--color-border, #33485f);
  background: var(--color-surface-raised, #1d2a3c);
  font-size: 0.85rem;
}

.unit { font-size: 0.65rem; opacity: 0.7; }

.toggle.on {
  border-color: var(--color-accent, #62c6e8);
  color: var(--color-accent, #62c6e8);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/components/MobileShell/SheetPeekTransport.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire into App.tsx sheet `peek` prop, verify in browser, commit**

```bash
git add src/components/MobileShell/ src/App.tsx
git commit -m "feat(mobile): sheet peek mini-player transport"
```

### Task 8: Inspector `placement="sheet"` + full transport in expanded sheet

**Files:**
- Modify: `src/components/Inspector/Inspector.tsx`
- Modify: `src/components/Inspector/Inspector.module.css`
- Modify: `src/App.tsx`
- Test: `src/components/Inspector/Inspector.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `Inspector.test.tsx` (mirror its existing render helpers):

```tsx
it("sheet placement renders tab list above panels with sheet styling hook", () => {
  renderInspector({ placement: "sheet" }); // adapt to the file's existing helper
  const root = screen.getByTestId("inspector-root"); // add testid if missing
  expect(root).toHaveAttribute("data-placement", "sheet");
});
```

The existing component already emits `data-placement` on its Radix root — assert on whatever node the test file already queries.

- [ ] **Step 2: Run, verify it fails** (`placement` type rejects "sheet").

- [ ] **Step 3: Implement**

In `Inspector.tsx`:

```tsx
export interface InspectorProps {
  placement?: "top" | "bottom" | "sheet";
}
```

Sheet placement renders the tab list **above** the panels (like "top") but with sheet styling:

```tsx
{placement === "bottom" ? (
  <>{/* existing bottom order */}</>
) : (
  <div className={styles.tabHeader}>{tabList}</div>
)}
```

Concretely: the current code is `placement === "top" ? <div className={styles.tabHeader}>{tabList}</div> : tabList` followed by panels — change the condition to `placement !== "bottom"` so "sheet" gets the header treatment, and add a `placementSheet` class on the root:

```tsx
className={clsx(
  styles.root,
  placement === "bottom" && styles.placementBottom,
  placement === "sheet" && styles.placementSheet,
)}
```

In `Inspector.module.css` add:

```css
.placementSheet {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.placementSheet .tabPanel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 16px;
}
```

- [ ] **Step 4: Wire the expanded sheet in App.tsx**

The sheet body becomes the full transport bar + Inspector:

```tsx
sheet={
  <MobileSheet peek={<SheetPeekTransport />}>
    <div className={/* small wrapper class or inline layout in MobileSheet.module.css */ undefined}>
      <TransportBar />
    </div>
    <Suspense fallback={null}>
      <Inspector placement="sheet" />
    </Suspense>
  </MobileSheet>
}
```

`TransportBar` (instrument toggles, status lights) renders above the tabs; give it a wrapper class in `MobileSheet.module.css` (`.expandedTransport { flex: none; padding: 0 12px 8px; }`). Its desktop styling may need a `[data-layout-tier="mobile"]` override in `TransportBar`'s own module CSS to shrink — CSS only, no fork.

- [ ] **Step 5: Run suite, lint, verify in browser, commit**

Run: `pnpm run test -- src/components/Inspector/ && pnpm run lint`

```bash
git add src/components/Inspector/ src/components/MobileShell/ src/App.tsx
git commit -m "feat(mobile): Inspector sheet placement + full transport in expanded sheet"
```

---

## Phase 3 — Header, Controls, Stage

### Task 9: Shared header actions + mobile overflow menu

**Files:**
- Create: `src/components/AppHeaderActions/AppHeaderActions.tsx`
- Test: `src/components/AppHeaderActions/AppHeaderActions.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/AppHeaderActions/AppHeaderActions.test.tsx
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { AppHeaderActions } from "./AppHeaderActions";

describe("AppHeaderActions", () => {
  it("buttons variant renders four icon buttons", () => {
    renderWithAtoms(
      <AppHeaderActions variant="buttons" onShowHelp={() => {}} />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("menu variant renders a single trigger that opens all actions", async () => {
    renderWithAtoms(
      <AppHeaderActions variant="menu" onShowHelp={() => {}} />,
    );
    const trigger = screen.getByTestId("header-overflow-trigger");
    await userEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run, verify failure** (module not found).

- [ ] **Step 3: Implement**

Move the four actions (theme, settings, mute, help) out of `App.tsx` into one component with two render variants. The handlers come from the same atoms App.tsx uses today (`themeAtom`, `settingsOverlayOpenAtom`, `toggleMuteAtom`, `isMutedAtom`); `onShowHelp` and `helpTriggerRef` stay props because help open-state is local to App.

```tsx
// src/components/AppHeaderActions/AppHeaderActions.tsx
import { type RefObject } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
import { HelpCircle, Moon, MoreVertical, Settings2, Sun, Volume2, VolumeX } from "lucide-react";
import { isMutedAtom, toggleMuteAtom } from "../../store/audioAtoms";
import { settingsOverlayOpenAtom, themeAtom } from "../../store/uiAtoms";
import { useResolvedTheme } from "../../hooks/useResolvedTheme";
import { useTranslation } from "../../hooks/useTranslation";
import sharedStyles from "../shared/shared.module.css";

interface AppHeaderActionsProps {
  variant: "buttons" | "menu";
  onShowHelp: () => void;
  helpTriggerRef?: RefObject<HTMLButtonElement | null>;
}

export function AppHeaderActions({ variant, onShowHelp, helpTriggerRef }: AppHeaderActionsProps) {
  const { t } = useTranslation();
  const theme = useResolvedTheme();
  const setTheme = useSetAtom(themeAtom);
  const isMuted = useAtomValue(isMutedAtom);
  const toggleMute = useSetAtom(toggleMuteAtom);
  const setSettingsOverlayOpen = useSetAtom(settingsOverlayOpenAtom);

  const isDark = theme === "modern-dark";
  const actions = [
    {
      id: "theme",
      label: isDark ? t("common.themeToLight") : t("common.themeToDark"),
      icon: isDark ? <Sun className="icon" /> : <Moon className="icon" />,
      run: () => setTheme(isDark ? "light" : "dark"),
    },
    {
      id: "settings",
      label: t("settings.open"),
      icon: <Settings2 className="icon" />,
      run: () => setSettingsOverlayOpen((v) => !v),
    },
    {
      id: "mute",
      label: isMuted ? t("common.unmute") : t("common.mute"),
      icon: isMuted ? <VolumeX className="icon" /> : <Volume2 className="icon" />,
      run: toggleMute,
    },
    {
      id: "help",
      label: t("common.help"),
      icon: <HelpCircle className="icon" />,
      run: onShowHelp,
    },
  ];

  if (variant === "buttons") {
    return (
      <>
        {actions.map((a) => (
          <button
            key={a.id}
            ref={a.id === "help" ? helpTriggerRef : undefined}
            type="button"
            onClick={a.run}
            className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--sm"])}
            title={a.label}
            aria-label={a.label}
          >
            {a.icon}
          </button>
        ))}
      </>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--sm"])}
          data-testid="header-overflow-trigger"
          aria-label={t("common.moreActions")}
        >
          <MoreVertical className="icon" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6}>
          {actions.map((a) => (
            <DropdownMenu.Item key={a.id} onSelect={a.run}>
              {a.icon}
              {a.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

Migration notes:
- This drops the desktop mute button's `AnimatePresence` icon crossfade and `SettingsTooltip` wrapper unless re-added — **preserve both in the buttons variant** by porting the existing JSX from App.tsx verbatim per action (the desktop result must be pixel-identical; compare before/after screenshots).
- Style `DropdownMenu.Content`/`Item` with a new module CSS file matching the app's menu look (`PresetMenu` already styles a Radix dropdown — copy its classes).
- Add `common.moreActions` to `src/i18n/types.ts`, `en.ts` ("More actions"), `es.ts` ("Más acciones").

In `App.tsx`: `actions={<AppHeaderActions variant={layout.useSheetShell ? "menu" : "buttons"} onShowHelp={() => setShowHelp(true)} helpTriggerRef={helpTriggerRef} />}` — and delete the now-unused inline buttons + imports.

- [ ] **Step 4: Run suite + lint, verify desktop header unchanged in browser**

Run: `pnpm run test && pnpm run lint`

- [ ] **Step 5: Commit**

```bash
git add src/components/AppHeaderActions/ src/App.tsx src/i18n/
git commit -m "feat(header): shared header actions with mobile overflow menu"
```

### Task 10: Touch CSS pass on shared controls

**Files:**
- Modify: `src/components/LabeledSelect/LabeledSelect.module.css` (and `.tsx` only if needed)
- Modify: `src/components/StepperControl/*.module.css`
- Modify: `src/components/ToggleBar/*.module.css`
- Modify: `src/components/shared/shared.module.css`

- [ ] **Step 1: Audit current hit sizes**

Run dev server at 375×812, expand sheet to full, and measure (devtools) every interactive element in both tabs. List anything under 44×44px.

- [ ] **Step 2: Apply 44px minimums under the mobile tier**

Pattern (repeat per module, scoped so desktop is untouched):

```css
[data-layout-tier="mobile"] .select-trigger,
[data-layout-tier="mobile"] .stepper-button,
[data-layout-tier="mobile"] .toggle-option {
  min-height: 44px;
  min-width: 44px;
}
```

Use each module's real class names. CSS Modules note: `[data-layout-tier]` lives on an ancestor (`MobileShell` root), so write these as descendant selectors inside the module (`:global` not needed — attribute selectors on ancestors work via `[data-layout-tier="mobile"] .localClass` only when the attribute is global; if the module build rejects it, wrap as `:global([data-layout-tier="mobile"]) .localClass`).

- [ ] **Step 3: Confirm `LabeledSelect` uses native `<select>`**

Read `src/components/LabeledSelect/LabeledSelect.tsx`. If it renders a native `<select>`, nothing to do — iOS/Android already present the platform picker. If it renders Radix Select, add a mobile branch that renders the native element with the same props (this is the one permitted variant-prop refactor; do not fork the component).

- [ ] **Step 4: Verify visually at 375×812 and on desktop; run suite**

Run: `pnpm run test && pnpm run lint`

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "style(mobile): 44px touch targets for sheet controls"
```

### Task 11: Fretboard stage sizing

**Files:**
- Modify: `src/layout/responsive.ts` (STRING_ROW_PX_MOBILE)
- Test: `src/layout/responsive.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("mobile string rows grow to use reclaimed chrome space", () => {
  expect(getResponsiveLayout(375, 812).stringRowPx).toBe(38);
});
```

- [ ] **Step 2: Run, verify it fails** (currently 34).

- [ ] **Step 3: Bump the constant**

In `src/layout/responsive.ts`: `const STRING_ROW_PX_MOBILE = 38;`

- [ ] **Step 4: Verify fretboard rendering**

Run dev at 375×812: 6 strings × 38px fits the stage with the sheet at peek; check `src/core/fretboardLayoutCache.ts` consumers for any hardcoded height assumptions (grep `stringRowPx` and `34`). Fix anything that breaks.

Run: `pnpm run test && pnpm run lint`

- [ ] **Step 5: Commit**

```bash
git add src/layout/
git commit -m "feat(mobile): larger fretboard string rows in sheet shell"
```

---

## Phase 4 — Secondary Surfaces

### Task 12: `AdaptiveModal` shared primitive

**Files:**
- Create: `src/components/shared/AdaptiveModal.tsx`
- Test: `src/components/shared/AdaptiveModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/shared/AdaptiveModal.test.tsx
import { describe, expect, it } from "vitest";
import { screen, render } from "@testing-library/react";
import { AdaptiveModal } from "./AdaptiveModal";

describe("AdaptiveModal", () => {
  it("renders children in a dialog on desktop", () => {
    render(
      <AdaptiveModal open onOpenChange={() => {}} presentation="dialog" label="Test">
        <p>content</p>
      </AdaptiveModal>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders children in a drawer sheet on mobile", () => {
    render(
      <AdaptiveModal open onOpenChange={() => {}} presentation="sheet" label="Test">
        <p>content</p>
      </AdaptiveModal>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.getByTestId("adaptive-modal-sheet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify failure.**

- [ ] **Step 3: Implement**

```tsx
// src/components/shared/AdaptiveModal.tsx
import { type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import styles from "./AdaptiveModal.module.css";

interface AdaptiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "dialog" = centered Radix dialog (desktop), "sheet" = full-height vaul drawer (mobile). */
  presentation: "dialog" | "sheet";
  label: string;
  children: ReactNode;
}

/**
 * Tier-adaptive modal wrapper. Content components (settings, help) stay
 * single-source; only the chrome differs: centered dialog on desktop,
 * swipe-dismissible full-height sheet on mobile.
 */
export function AdaptiveModal({ open, onOpenChange, presentation, label, children }: AdaptiveModalProps) {
  if (presentation === "sheet") {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className={styles.overlay} />
          <Drawer.Content className={styles.sheet} data-testid="adaptive-modal-sheet" aria-label={label}>
            <div className={styles.sheetHandle} aria-hidden="true" />
            <div className={styles.sheetBody}>{children}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialog} aria-label={label}>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Create `AdaptiveModal.module.css` with `.overlay`, `.dialog`, `.sheet { height: 94dvh; border-radius: 14px 14px 0 0; }`, `.sheetHandle`, `.sheetBody { overflow-y: auto; }` reusing tokens. Same vaul `Drawer.Title` caveat as Task 6.

- [ ] **Step 4: Run, verify pass, commit**

```bash
git add src/components/shared/AdaptiveModal*
git commit -m "feat(shared): AdaptiveModal dialog/sheet wrapper"
```

### Task 13: Settings + Help adopt AdaptiveModal on mobile

**Files:**
- Modify: `src/components/SettingsOverlay/SettingsOverlay.tsx`
- Modify: `src/components/HelpModal/HelpModal.tsx`
- Tests: their existing test files

- [ ] **Step 1: Decide the integration seam by reading both components**

Both wrap content in `Dialog.Root` + `AnimatePresence`/`motion` today. Plan of record:
- Extract each component's content (everything inside `Dialog.Content`) into a local `…Content` function component in the same file.
- The default export keeps the existing Dialog+motion path for desktop **unchanged**, and renders `AdaptiveModal presentation="sheet"` with the same content when the tier is mobile. `SettingsOverlay` already computes `layout` from the viewport (see its `getResponsiveLayout` usage) — reuse it: `const presentation = layout.tier === "mobile" ? "sheet" : "dialog"`. `HelpModal` gets the same viewport snapshot logic (copy the small `getViewportSnapshot`/resize effect or read tier once on open).

- [ ] **Step 2: Write failing tests**

Add to each existing test file (mock viewport):

```tsx
it("presents as a sheet on mobile widths", () => {
  window.innerWidth = 375;
  window.innerHeight = 812;
  window.dispatchEvent(new Event("resize"));
  // render open (per the file's existing open-state helper)
  expect(screen.getByTestId("adaptive-modal-sheet")).toBeInTheDocument();
});
```

- [ ] **Step 3: Implement; keep desktop snapshot tests passing untouched.**

- [ ] **Step 4: Verify both surfaces at 375×812 (full-height sheet, swipe-down dismisses, content scrolls) and desktop (identical to before).**

Run: `pnpm run test && pnpm run lint`

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsOverlay/ src/components/HelpModal/
git commit -m "feat(mobile): settings and help present as full-height sheets"
```

### Task 14: Banners + rotate overlay relocation

**Files:**
- Modify: `src/components/AudioErrorBanner/AudioErrorBanner.module.css`
- Modify: `src/styles/App.css`
- Create: rotate overlay markup moves into `src/components/MobileShell/MobileShell.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Banners above the sheet + safe areas**

In `AudioErrorBanner.module.css`, add a mobile override so banners sit above the sheet peek and inside safe areas:

```css
:global([data-layout-tier="mobile"]) .banner {
  bottom: calc(var(--mobile-sheet-peek, 96px) + env(safe-area-inset-bottom, 0px) + 8px);
  z-index: 40;
}
```

(Inspect the existing `.banner` positioning first; adjust top/bottom property accordingly.)

- [ ] **Step 2: Move the rotate overlay into MobileShell**

- Cut the `.rotate-overlay*` rules and `@keyframes rotate-hint` from `src/styles/App.css` into `MobileShell.module.css` (converting class names to module locals).
- Cut the rotate-overlay JSX from `App.tsx` into `MobileShell.tsx` (top of the shell), using the module classes and the existing `t("common.rotateMessage")`.
- MobileShell needs `useTranslation` for this — fine, it's still structural.

- [ ] **Step 3: Verify: landscape phone viewport shows the overlay; desktop unaffected. Run suite + lint.**

- [ ] **Step 4: Commit**

```bash
git add src/components/MobileShell/ src/components/AudioErrorBanner/ src/styles/App.css src/App.tsx
git commit -m "refactor(mobile): banners respect sheet + rotate overlay owned by shell"
```

---

## Phase 5 — Cleanup, Tests, Verification

### Task 15: Delete the legacy bottom-tab path

**Files:**
- Modify: `src/components/Inspector/Inspector.tsx` + `Inspector.module.css` (drop `placement="bottom"`, `placementBottom`)
- Modify: `src/components/MainLayoutWrapper/MainLayoutWrapper.tsx` + module css (drop `mobileTabs`, `showMobileTabs`, `mobile-tabs-shell`)
- Modify: `src/layout/responsive.ts` (drop `showMobileTabs`; keep `useSheetShell`)
- Modify: `src/App.tsx` (drop `mobileTabs` prop usage)
- Tests: update `Inspector.test.tsx`, `MainLayoutWrapper` tests, `responsive.test.ts`, `Inspector.module.css.test.ts`

- [ ] **Step 1: Update tests first** — remove/replace every assertion referencing `placement="bottom"`, `showMobileTabs`, `mobile-tabs-shell`. Run: expect failures pointing at the code to delete.

- [ ] **Step 2: Delete the code paths listed above.** `Inspector` placement type becomes `"top" | "sheet"`. `MainLayoutWrapper` loses two props. `getResponsiveLayout` loses `showMobileTabs` (grep for remaining consumers first: `grep -rn showMobileTabs src/`).

- [ ] **Step 3: Full suite, lint, build**

Run: `pnpm run test && pnpm run lint && pnpm run build`
Expected: PASS, no references remain (`grep -rn 'placementBottom\|mobile-tabs-shell\|showMobileTabs' src/` returns nothing).

- [ ] **Step 4: Commit**

```bash
git add -A src/
git commit -m "refactor(mobile): delete legacy bottom-tab Inspector path"
```

### Task 16: Visual e2e refresh + sheet scenarios

**Files:**
- Modify: `e2e/app-mobile/` specs + snapshots
- Possibly: `e2e/app-layout/`, `e2e/app-components/` if mobile viewports appear there (check specs)

- [ ] **Step 1: Add sheet-state scenarios**

In the `app-mobile` spec, add cases that seed the snap atom via localStorage before load (storage key prefix is in `src/utils/storage.ts` — read `k()` to get the exact key, e.g. `ff.mobileSheetSnap`):

```ts
test("sheet at half snap", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("<prefix>mobileSheetSnap", "half");
  });
  await page.goto("/");
  await expect(page.getByTestId("mobile-sheet")).toBeVisible();
  await expect(page).toHaveScreenshot("sheet-half.png");
});
```

Repeat for `peek` and `full`. Follow the suite's existing helpers/conventions (read the current spec file first).

- [ ] **Step 2: Refresh darwin snapshots**

Run: `pnpm run test:visual:update`
Expected: all `app-mobile` snapshots regenerate; inspect each updated image — this diff IS the feature, review it like UI code.

- [ ] **Step 3: Refresh linux snapshots**

Run: `pnpm run test:visual:update:linux`

- [ ] **Step 4: Run the suite green**

Run: `pnpm run test:visual`
Expected: PASS.

- [ ] **Step 5: Commit (snapshots in their own commit for reviewability)**

```bash
git add e2e/
git commit -m "test(visual): refresh mobile snapshots for sheet shell"
```

### Task 17: Final verification

- [ ] **Step 1: Full local gate**

Run: `pnpm run lint && pnpm run test && pnpm run build && pnpm run test:e2e:production`
Expected: all PASS.

- [ ] **Step 2: Manual device pass**

- Browser at 375×812 and 360×640: peek/half/full drag, tab switching, native select pickers, overflow menu, settings/help sheets, banners, no page scroll anywhere.
- Desktop 1280×1000 and 1100×700: pixel-identical to `main` (compare screenshots).
- Capacitor shells if available: safe-area insets top/bottom, sheet drag feel.

- [ ] **Step 3: Open PR** (squash; not a breaking change — no footer needed).

---

## Self-Review Notes (already applied)

- Spec coverage: shell (T4–5), sheet+peek transport (T6–8), sharing policy (T8–10 reuse, T12 wrapper), touch pass (T10), tablet-split (T3 flag), settings/help (T12–13), banners/rotate (T14), cleanup (T15), tests (T16–17). Landscape correctly absent (non-goal).
- Known unknowns flagged inline rather than hidden: vaul Title warning, React Compiler interplay, exact token/class names, TransportBar play-handler shape — each task says where to look.
- Type consistency: `MobileSheetSnap` ids ("peek"/"half"/"full") used consistently across atom, sheet, e2e seeds.
