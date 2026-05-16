# DAW Shell Phase 7 — Mobile Rehost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `Inspector` the single controls component for every tier, deleting the mobile-specific `MobileTabPanel` / `BottomTabBar` / `Card` duplication while keeping mobile thumb ergonomics via a bottom-docked tab bar.

**Architecture:** The `Inspector` gains a `placement: "top" | "bottom"` prop. `placement="top"` is the existing inline desktop tab bar; `placement="bottom"` pulls the Radix `Tabs.List` into a viewport-fixed, icon+label bar. `App.tsx` renders `<Inspector placement="top" />` in the `controlsPanel` slot and `<Inspector placement="bottom" />` in the `mobileTabs` slot (the two slots are already mutually exclusive). The mobile-only components and the persisted `mobileTabAtom` are deleted.

**Tech Stack:** React 19, TypeScript, Jotai, Radix UI Tabs, CSS Modules, `clsx`, `lucide-react`, Vitest + Testing Library, Playwright (visual regression).

---

## Background for the implementer

Read these before starting:

- `docs/superpowers/specs/2026-05-16-daw-shell-phase-7-mobile-rehost-design.md` — the spec this plan implements.
- `src/components/Inspector/Inspector.tsx` — the component being extended. It is a Radix `Tabs.Root` with a `List` of `Trigger`s and one `Content` per tab.
- `src/layout/responsive.ts` — `getResponsiveLayout` returns `showControlsPanel` and `showMobileTabs`. Exactly one is true: `showMobileTabs` for the `mobile` tier and the `tablet-split` variant, `showControlsPanel` otherwise.
- `src/App.tsx` — wires the `controlsPanel` and `mobileTabs` slots into `MainLayoutWrapper`.

Key facts:

- The Inspector's active tab is component-local `useState` (default `"view"`); it is **not** persisted. This is intentional and unchanged by this plan.
- `tabs.ts` will be renamed to `tabs.tsx` because it will contain JSX (icons). Only `Inspector.tsx` imports `./tabs`; the import string `"./tabs"` resolves to `tabs.tsx` unchanged.
- The faceplate CSS tokens used below (`--faceplate-bg`, `--faceplate-bg-elevated`, `--faceplate-border`, `--faceplate-divider`, `--faceplate-accent`, `--faceplate-accent-glow`) are defined in `src/styles/semantic.css` and are theme-adaptive. `--z-bottom-nav` is defined there too.
- Commands use **pnpm** (`pnpm run lint`, `pnpm run test`, `pnpm run build`). Run a single test file with `pnpm run test -- <path>`.

Task order is mandatory: Task 1 → 2 → 3 → 4 → 5. Task 2 removes the `MobileTabPanel` / `BottomTabBar` imports from `App.tsx` so Task 3 can delete those directories without breaking the build. Task 4 removes `mobileTabAtom` after Task 2 stopped using it in `App.tsx`.

---

## File Structure

**Created:**
- `src/components/Inspector/tabs.tsx` — renamed from `tabs.ts`; tab config now carries an `icon`.

**Modified:**
- `src/components/Inspector/Inspector.tsx` — `placement` prop; triggers render icon + label spans.
- `src/components/Inspector/Inspector.module.css` — `top` variant hides icons; `bottom` variant is a fixed bar.
- `src/components/Inspector/Inspector.test.tsx` — placement coverage.
- `src/App.tsx` — both control slots render the `Inspector`; mobile-component wiring removed.
- `src/components/LoadingSkeleton/LoadingSkeleton.tsx` — `MobileTabSkeleton` removed.
- `src/App.test.tsx`, `src/integration.test.tsx` — references to deleted concepts updated.
- `src/store/uiAtoms.ts`, `src/store/atoms.ts`, `src/store/actions.ts` — `mobileTabAtom` removed.
- `src/store/atoms.test.ts` — `mobileTabStorage` suite removed.
- `src/store/MIGRATIONS.md` — note the retired key.
- `e2e/css-scoping.spec.ts`, `e2e/theme-contract.spec.ts`, `e2e/app-mobile.visual.spec.ts` — updated for the deleted components.

**Deleted:**
- `src/components/MobileTabPanel/` (component, CSS module, test).
- `src/components/BottomTabBar/` (component, CSS module, test).
- `src/components/Card/` (component, CSS module, test).
- `src/constants/tabLabels.ts`.

---

## Task 1: Inspector gains tab icons and a `placement` prop

**Files:**
- Create: `src/components/Inspector/tabs.tsx` (renamed from `src/components/Inspector/tabs.ts`)
- Modify: `src/components/Inspector/Inspector.tsx`
- Modify: `src/components/Inspector/Inspector.module.css`
- Test: `src/components/Inspector/Inspector.test.tsx`

- [ ] **Step 1: Add the failing placement tests**

Append these tests inside the `describe("Inspector", ...)` block in `src/components/Inspector/Inspector.test.tsx`, before the closing `});`:

```tsx
  it("defaults to top placement with no tab icons visible", () => {
    const { container } = renderInspector();
    const root = container.querySelector('[role="tablist"]')?.closest("[data-placement]");
    expect(root?.getAttribute("data-placement")).toBe("top");
  });

  it("renders bottom placement with a data-placement attribute when placement is bottom", () => {
    const { container } = renderWithAtoms(<Inspector placement="bottom" />);
    const root = container.querySelector('[role="tablist"]')?.closest("[data-placement]");
    expect(root?.getAttribute("data-placement")).toBe("bottom");
  });

  it("renders an aria-hidden icon span inside every tab trigger", () => {
    renderWithAtoms(<Inspector placement="bottom" />);
    for (const name of ["View", "Scale", "Chord", "Progression"]) {
      const trigger = screen.getByRole("tab", { name });
      const icon = trigger.querySelector('[aria-hidden="true"]');
      expect(icon).not.toBeNull();
    }
  });

  it("keeps keyboard arrow navigation working in bottom placement", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<Inspector placement="bottom" />);
    screen.getByRole("tab", { name: "View" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Scale" }).getAttribute("aria-selected")).toBe("true");
  });
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `pnpm run test -- src/components/Inspector/Inspector.test.tsx`
Expected: FAIL — `Inspector` does not accept a `placement` prop yet, so the `data-placement` attribute is absent and the TypeScript build of the test reports `placement` is not a valid prop.

- [ ] **Step 3: Rename `tabs.ts` to `tabs.tsx` and add the `icon` field**

Run: `git mv src/components/Inspector/tabs.ts src/components/Inspector/tabs.tsx`

Then replace the entire contents of `src/components/Inspector/tabs.tsx` with:

```tsx
import type { ReactNode } from "react";
import { Layout, Music2, Layers, ListMusic } from "lucide-react";
import type { Dictionary } from "../../i18n/types";

export type InspectorTabId = "view" | "scale" | "chord" | "progression";

export interface InspectorTabConfig {
  id: InspectorTabId;
  labelKey: keyof Dictionary["inspector"];
  icon: ReactNode;
}

export const INSPECTOR_TABS: InspectorTabConfig[] = [
  { id: "view", labelKey: "viewTab", icon: <Layout size={18} /> },
  { id: "scale", labelKey: "scaleTab", icon: <Music2 size={18} /> },
  { id: "chord", labelKey: "chordTab", icon: <Layers size={18} /> },
  { id: "progression", labelKey: "progressionTab", icon: <ListMusic size={18} /> },
];
```

- [ ] **Step 4: Add the `placement` prop and icon/label spans to `Inspector.tsx`**

Replace the entire contents of `src/components/Inspector/Inspector.tsx` with:

```tsx
import { useState, type ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import clsx from "clsx";
import { useTranslation } from "../../hooks/useTranslation";
import { INSPECTOR_TABS, type InspectorTabId } from "./tabs";
import { ViewTab } from "./ViewTab";
import { ScaleTab } from "./ScaleTab";
import { ChordTab } from "./ChordTab";
import { ProgressionTab } from "./ProgressionTab";
import styles from "./Inspector.module.css";

const TAB_BODIES: Record<InspectorTabId, () => ReactNode> = {
  view: () => <ViewTab />,
  scale: () => <ScaleTab />,
  chord: () => <ChordTab />,
  progression: () => <ProgressionTab />,
};

export interface InspectorProps {
  /**
   * "top" (default) renders inline text-only tabs at the top of the panel.
   * "bottom" docks the tab list to the bottom of the viewport as an
   * icon+label bar — used on the mobile tier and the tablet-split variant.
   */
  placement?: "top" | "bottom";
}

export function Inspector({ placement = "top" }: InspectorProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<InspectorTabId>("view");

  return (
    <RadixTabs.Root
      className={clsx(styles.root, placement === "bottom" && styles.placementBottom)}
      data-placement={placement}
      value={active}
      onValueChange={(value) => setActive(value as InspectorTabId)}
    >
      <RadixTabs.List className={styles.tabList} aria-label="Inspector">
        {INSPECTOR_TABS.map((tab) => (
          <RadixTabs.Trigger key={tab.id} value={tab.id} className={styles.tab}>
            <span className={styles.tabIcon} aria-hidden="true">
              {tab.icon}
            </span>
            <span className={styles.tabLabel}>{t(`inspector.${tab.labelKey}`)}</span>
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {INSPECTOR_TABS.map((tab) => (
        <RadixTabs.Content
          key={tab.id}
          value={tab.id}
          className={styles.tabPanel}
          data-tab-id={tab.id}
        >
          {TAB_BODIES[tab.id]()}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
```

The icon span is `aria-hidden`, so each trigger's accessible name stays the label text — the existing `getByRole("tab", { name: "View" })` queries keep working.

- [ ] **Step 5: Add the placement CSS variants to `Inspector.module.css`**

Append to the end of `src/components/Inspector/Inspector.module.css`:

```css
/* Tab icons are present in the DOM for both placements but only shown in the
 * bottom-docked variant — the top variant stays text-only, as on desktop. */
.tabIcon {
  display: none;
}

/* Bottom-docked placement — a viewport-fixed icon+label tab bar for the
 * mobile tier and the tablet-split variant. The panel reserves bottom space
 * so its content is never occluded by the fixed bar. */
.placementBottom {
  padding-bottom: calc(3.5rem + env(safe-area-inset-bottom));
}

.placementBottom .tabList {
  position: fixed;
  inset: auto 0 0 0;
  z-index: var(--z-bottom-nav);
  border-bottom: 0;
  border-top: 1px solid var(--faceplate-border);
  background: linear-gradient(
    180deg,
    var(--faceplate-bg-elevated),
    var(--faceplate-bg)
  );
  padding-bottom: env(safe-area-inset-bottom);
}

.placementBottom .tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border-bottom: 0;
  border-top: 2px solid transparent;
  padding: var(--space-2, 0.5rem) 2px;
}

.placementBottom .tab[data-state="active"] {
  border-bottom-color: transparent;
  border-top-color: var(--faceplate-accent);
}

.placementBottom .tabIcon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.placementBottom .tabLabel {
  font-size: 9px;
}
```

- [ ] **Step 6: Run the Inspector tests and verify they pass**

Run: `pnpm run test -- src/components/Inspector/Inspector.test.tsx`
Expected: PASS — all tests, including the four new placement tests, pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/Inspector/tabs.tsx src/components/Inspector/Inspector.tsx src/components/Inspector/Inspector.module.css src/components/Inspector/Inspector.test.tsx
git commit -m "feat(inspector): add placement prop and tab icons"
```

---

## Task 2: Rewire `App.tsx` to render the Inspector on every tier

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/LoadingSkeleton/LoadingSkeleton.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Update the failing App tests**

In `src/App.test.tsx`, replace the test named `"persists mobile tab selection to localStorage"` (the whole `it(...)` block, including its multi-line comment) with:

```tsx
    it("renders the Inspector on the mobile tier", async () => {
      setViewport(390, 844);
      render(<App />);
      expect(
        await screen.findByRole("tablist", { name: "Inspector" }),
      ).toBeInTheDocument();
    });
```

In the same file, in the test named `"renders mobile tabs and hides the shared controls panel"`, replace this line:

```tsx
      expect(document.querySelector(".mobile-tab-content")).toBeTruthy();
```

with:

```tsx
      expect(
        await screen.findByRole("tablist", { name: "Inspector" }),
      ).toBeInTheDocument();
```

(The `.controls-panel` assertion on the next line stays — that class never existed on the Inspector, so it remains `null`.)

The three remaining `expect(document.querySelector(".mobile-tab-content")).toBeNull()` assertions in the "Desktop layout variants" suite stay as-is: `.mobile-tab-content` no longer exists anywhere, so `toBeNull()` still holds.

- [ ] **Step 2: Run the App tests and verify the rewire is needed**

Run: `pnpm run test -- src/App.test.tsx`
Expected: FAIL — `findByRole("tablist", { name: "Inspector" })` times out on the mobile tier because `App.tsx` still renders `MobileTabPanel` there.

- [ ] **Step 3: Remove `MobileTabSkeleton` from `LoadingSkeleton.tsx`**

In `src/components/LoadingSkeleton/LoadingSkeleton.tsx`, delete this exported function entirely:

```tsx
export function MobileTabSkeleton() {
  return (
    <div className={styles["mobile-tab-skeleton"]} aria-label="Loading tab" role="status">
      <CardSkeleton rows={4} />
    </div>
  );
}
```

Leave every other export (`ControlsPanelSkeleton`, `CircleOfFifthsSkeleton`, `OverlaySpinner`) untouched.

- [ ] **Step 4: Rewire `App.tsx`**

Apply all of the following edits to `src/App.tsx`:

1. In the `lucide-react` import, remove `Music2, ListMusic, Layers, Layout, Compass` (they were only used by `MOBILE_TAB_ITEMS`). The line becomes:

```tsx
import { HelpCircle, Settings2, Volume2, VolumeX } from "lucide-react";
```

2. Remove the `mobileTabAtom` entry from the `./store/atoms` import block. The block becomes:

```tsx
import {
  isMutedAtom,
  settingsOverlayOpenAtom,
  toggleMuteAtom,
  chordRootAtom,
  chordTypeAtom,
  rootNoteAtom,
  scaleNameAtom,
  chordOverlayHiddenAtom,
  audioErrorAtom,
} from "./store/atoms";
```

3. Delete these two import lines:

```tsx
import { BottomTabBar, type BottomTabItem } from "./components/BottomTabBar/BottomTabBar";
import { TAB_LABELS } from "./constants/tabLabels";
```

4. In the `./components/LoadingSkeleton/LoadingSkeleton` import, remove `MobileTabSkeleton`. The line becomes:

```tsx
import { ControlsPanelSkeleton } from "./components/LoadingSkeleton/LoadingSkeleton";
```

5. Delete the `MobileTabPanel` lazy import entirely:

```tsx
const MobileTabPanel = lazy(() =>
  import("./components/MobileTabPanel/MobileTabPanel").then((m) => ({
    default: m.MobileTabPanel,
  }))
);
```

6. Delete the `MOBILE_TAB_ITEMS` constant entirely:

```tsx
const MOBILE_TAB_ITEMS: BottomTabItem[] = [
  { id: "scales", label: TAB_LABELS.scales, icon: <Music2 size={18} /> },
  { id: "chords", label: TAB_LABELS.chords, icon: <Layers size={18} /> },
  { id: "progression", label: TAB_LABELS.progression, icon: <ListMusic size={18} /> },
  { id: "cof", label: TAB_LABELS.cof, icon: <Compass size={18} /> },
  { id: "view", label: TAB_LABELS.view, icon: <Layout size={18} /> },
];
```

7. Delete the `translatedTabItems` `useMemo` block inside `AppContent`:

```tsx
  const translatedTabItems = useMemo(() => MOBILE_TAB_ITEMS.map((item) => ({
    ...item,
    label: t(`tabs.${item.id}`),
  })), [t]);
```

8. Delete the `mobileTab` line from the atom hooks:

```tsx
  const [mobileTab, setMobileTab] = useAtom(mobileTabAtom);
```

9. Replace the `controlsPanel` slot:

```tsx
      controlsPanel={
        <Suspense fallback={<ControlsPanelSkeleton mode={layout.panelMode} />}>
          <Inspector placement="top" />
        </Suspense>
      }
```

10. Replace the `mobileTabs` slot:

```tsx
      mobileTabs={
        <Suspense fallback={<ControlsPanelSkeleton mode={layout.panelMode} />}>
          <Inspector placement="bottom" />
        </Suspense>
      }
```

11. Delete the entire `BottomTabBar` JSX block:

```tsx
    {layout.showMobileTabs && !settingsOverlayOpen && (
      <BottomTabBar
        items={translatedTabItems}
        activeId={mobileTab}
        onSelect={(id) => setMobileTab(id as "scales" | "chords" | "progression" | "cof" | "view")}
        aria-label="Mobile navigation"
      />
    )}
```

After these edits, check the remaining imports: if `useMemo` is no longer referenced anywhere in `App.tsx`, remove it from the `react` import. (`useAtom` is still used for `settingsOverlayOpen` and `audioError`, so it stays.)

- [ ] **Step 5: Run lint and the App tests**

Run: `pnpm run lint`
Expected: PASS — no unused-import or unused-variable errors. If lint flags an unused import, remove it.

Run: `pnpm run test -- src/App.test.tsx`
Expected: PASS — including the rewritten mobile-tier and tablet-split tests.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/LoadingSkeleton/LoadingSkeleton.tsx src/App.test.tsx
git commit -m "feat(layout): render Inspector on every tier"
```

---

## Task 3: Delete the mobile-specific components

**Files:**
- Delete: `src/components/MobileTabPanel/` (`MobileTabPanel.tsx`, `MobileTabPanel.module.css`, `MobileTabPanel.test.tsx`)
- Delete: `src/components/BottomTabBar/` (`BottomTabBar.tsx`, `BottomTabBar.module.css`, `BottomTabBar.test.tsx`)
- Delete: `src/components/Card/` (`Card.tsx`, `Card.module.css`, `Card.test.tsx`)
- Delete: `src/constants/tabLabels.ts`
- Modify: `src/integration.test.tsx`
- Modify: `e2e/css-scoping.spec.ts`
- Modify: `e2e/theme-contract.spec.ts`
- Modify: `e2e/app-mobile.visual.spec.ts`

- [ ] **Step 1: Remove the `MobileTabPanel` import and obsolete tests from `integration.test.tsx`**

In `src/integration.test.tsx`, delete this line (near the top, ~line 9):

```tsx
import "./components/MobileTabPanel/MobileTabPanel";
```

Then delete the test(s) that exercise `mobileTab` localStorage persistence — the block(s) containing `localStorage.getItem(k("mobileTab"))` / `localStorage.setItem(k("mobileTab"), ...)` (around lines 390-428). These cover the deleted persistence behavior. If removing them leaves an empty `describe(...)`, remove that `describe` too. If the `k` import from `./utils/storage` becomes unused after this, remove it.

- [ ] **Step 2: Delete the component directories and the constants file**

```bash
git rm -r src/components/MobileTabPanel src/components/BottomTabBar src/components/Card
git rm src/constants/tabLabels.ts
```

- [ ] **Step 3: Update `e2e/css-scoping.spec.ts`**

This spec targets `[data-testid="mobile-tab-content"]`, a testid that lived on `MobileTabPanel` and no longer exists. The mobile controls are now the `Inspector`, whose tab list is `[role="tablist"][aria-label="Inspector"]` and whose tab panels are `[data-tab-id]`.

In `e2e/css-scoping.spec.ts`, replace every `page.locator('[data-testid="mobile-tab-content"]')` and `page.waitForSelector('[data-testid="mobile-tab-content"]')` with the Inspector tab panel selector `[data-tab-id]`, and replace `document.querySelector('[data-testid="mobile-tab-content"]')` (inside `page.evaluate`) with `document.querySelector('[data-tab-id]')`. Update the adjacent comment that says "Mobile layout uses the BottomTabBar + MobileTabPanel" to "Mobile layout uses the Inspector (bottom placement)".

- [ ] **Step 4: Update `e2e/theme-contract.spec.ts`**

The test `"BottomTabBar should use theme-appropriate active indicators"` targets a deleted component. Replace the whole `test(...)` block with one that checks the bottom-placed Inspector's active tab indicator:

```ts
  test("Inspector bottom tab bar uses theme-appropriate active indicators", async ({ page }) => {
    // Mobile layout renders the Inspector with placement="bottom"; the default
    // active tab is "View".
    const activeTab = page.locator(
      '[data-placement="bottom"] [role="tab"][data-state="active"]',
    );
    await expect(activeTab).toBeVisible();
    const borderTopColor = await activeTab.evaluate(
      (el) => getComputedStyle(el).borderTopColor,
    );
    expect(borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
  });
```

- [ ] **Step 5: Update `e2e/app-mobile.visual.spec.ts`**

This spec asserts `page.getByTestId("mobile-tab-content")` is visible. Replace each `page.getByTestId("mobile-tab-content")` with `page.getByRole("tablist", { name: "Inspector" })`. Update the comment referencing `ANIMATION_DURATION_XFADE + ANIMATION_EASE constants in MobileTabPanel` to note that the Inspector tab switch is instant (no cross-fade).

- [ ] **Step 6: Verify the build has no dangling references**

Run: `pnpm run build`
Expected: PASS — `tsc -b` reports no missing modules. If it reports an unresolved import of `MobileTabPanel`, `BottomTabBar`, `Card`, or `tabLabels`, fix that reference.

Run: `grep -rn "MobileTabPanel\|BottomTabBar\|/Card/Card\|tabLabels\|TAB_LABELS\|MobileTabSkeleton" src e2e`
Expected: no output.

- [ ] **Step 7: Run the unit tests**

Run: `pnpm run test`
Expected: PASS — no test imports a deleted file.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(mobile): delete MobileTabPanel, BottomTabBar, Card"
```

---

## Task 4: Remove `mobileTabAtom` from the store

**Files:**
- Modify: `src/store/uiAtoms.ts`
- Modify: `src/store/atoms.ts`
- Modify: `src/store/actions.ts`
- Modify: `src/store/atoms.test.ts`
- Modify: `src/store/MIGRATIONS.md`

- [ ] **Step 1: Remove the `mobileTabStorage` suite from `atoms.test.ts`**

In `src/store/atoms.test.ts`:

1. Delete the entire `describe("mobileTabStorage", ...)` block (around lines 254-317).
2. Delete the `mobileTabAtom` entry from the import block at the top of the file.
3. Remove any other line referencing `mobileTabAtom` — specifically `store.set(mobileTabAtom, "view")` (~line 706) and `expect(store.get(mobileTabAtom)).toBe("scales")` (~line 720). If those lines sit inside a test asserting the reset action clears `mobileTabAtom`, remove just those two lines; keep the rest of that test (it asserts other atoms reset).

- [ ] **Step 2: Run `atoms.test.ts` and verify it fails to compile**

Run: `pnpm run test -- src/store/atoms.test.ts`
Expected: FAIL — `mobileTabAtom` is still exported, but if Step 1 missed a reference TypeScript reports it. The real driver for this task is the build in Step 6; this step confirms the test file no longer references the atom. If it PASSES, that is also acceptable — proceed.

- [ ] **Step 3: Remove `mobileTabAtom` from `uiAtoms.ts`**

In `src/store/uiAtoms.ts`, delete:

1. The `MOBILE_TABS` const and `MobileTab` type:

```ts
const MOBILE_TABS = ["scales", "chords", "progression", "cof", "view"] as const;
type MobileTab = (typeof MOBILE_TABS)[number];
```

2. The `mobileTabStorage` declaration:

```ts
const mobileTabStorage = createStorage<MobileTab>({
  validate: (v) => (MOBILE_TABS as readonly string[]).includes(v),
  onRead: (v) => {
    // Migrate legacy values from old tab ids to new tab ids.
    if (v === ("key" as unknown as string) || v === ("scale" as unknown as string) || v === ("theory" as unknown as string)) return "scales";
    if (v === ("settings" as unknown as string) || v === ("fretboard" as unknown as string)) return "view";
    return v;
  },
});
```

3. The `mobileTabAtom` export:

```ts
export const mobileTabAtom = atomWithStorage<MobileTab>(
  k("mobileTab"),
  "scales",
  mobileTabStorage,
  GET_ON_INIT,
);
```

After deleting these, check the file's imports from `../utils/storage`: `createStorage` may now be unused. If `createStorage` is no longer referenced anywhere in `uiAtoms.ts`, remove it from the import. Leave `k`, `rawStringStorage`, and `GET_ON_INIT` — they are still used by the other atoms.

- [ ] **Step 4: Remove the `mobileTabAtom` re-export from the barrel**

In `src/store/atoms.ts`, delete the `mobileTabAtom,` line from the `uiAtoms` re-export block (~line 96).

- [ ] **Step 5: Remove `mobileTabAtom` from `actions.ts`**

In `src/store/actions.ts`:

1. Delete `mobileTabAtom,` from the `./uiAtoms` import block. It becomes:

```ts
import {
  displayFormatAtom,
  scaleDegreeColorsEnabledAtom,
  themeAtom,
} from "./uiAtoms";
```

2. Delete this line from the reset-all action body:

```ts
  set(mobileTabAtom, RESET);
```

- [ ] **Step 6: Add a migration note**

In `src/store/MIGRATIONS.md`, add a dated bullet recording that the persisted `fretflow:mobileTab` key is retired as of Phase 7 (mobile rehost) — the Inspector holds its active tab in component-local state and no longer persists it. Match the existing formatting of that file. (Leave `"mobileTab"` in `LEGACY_KEYS` in `src/utils/storageConstants.ts` — that entry still purges the now-orphaned persisted key from users' browsers, so it is intentionally kept.)

- [ ] **Step 7: Verify the build and tests**

Run: `pnpm run build`
Expected: PASS — no unresolved `mobileTabAtom` reference.

Run: `grep -rn "mobileTabAtom" src`
Expected: no output.

Run: `pnpm run test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/store/uiAtoms.ts src/store/atoms.ts src/store/actions.ts src/store/atoms.test.ts src/store/MIGRATIONS.md
git commit -m "refactor(store): remove mobileTabAtom"
```

---

## Task 5: Refresh visual baselines and run the full verification

**Files:**
- Modify (regenerated): `e2e/app-mobile.visual.spec.ts-snapshots/*`, `e2e/app-layout.visual.spec.ts-snapshots/*`, and any other snapshot directory whose images changed.

- [ ] **Step 1: Run the mandatory pre-PR checks**

Run: `pnpm run lint`
Expected: PASS.

Run: `pnpm run test`
Expected: PASS.

Run: `pnpm run build`
Expected: PASS.

- [ ] **Step 2: Refresh the darwin visual-regression baselines**

Run: `pnpm run test:visual:update`
Expected: the suite rebuilds and rewrites darwin snapshots. New/changed images appear under `e2e/app-mobile.visual.spec.ts-snapshots/` and `e2e/app-layout.visual.spec.ts-snapshots/` (and any other suite that captured the old mobile components).

- [ ] **Step 3: Refresh the linux baselines**

Run: `pnpm run test:visual:update:linux`
Expected: linux snapshots are regenerated for the same suites.

- [ ] **Step 4: Confirm the visual suite passes against the new baselines**

Run: `pnpm run test:visual`
Expected: PASS — every visual spec matches the freshly updated baselines.

- [ ] **Step 5: Manual sanity check of the snapshot diff**

Run: `git status --short e2e`
Inspect the changed snapshot images: the mobile and tablet-split captures should now show the DAW-styled Inspector with a bottom-docked icon+label tab bar, and no `MobileTabPanel` card chrome. If any snapshot still shows the old mobile layout, the corresponding source change was missed — fix it before committing.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "test(visual): refresh baselines for mobile rehost"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Spec §3 / §4a-4c (Inspector `placement` prop, tab icons, CSS variants) → Task 1.
- Spec §4d (App rewire) and §4e (`MobileTabSkeleton` removal) → Task 2.
- Spec §4g (delete `MobileTabPanel` / `BottomTabBar` / `Card` / `tabLabels.ts`) → Task 3.
- Spec §4f (store cleanup of `mobileTabAtom`) → Task 4.
- Spec §4h (`MainLayoutWrapper` unchanged) → no task needed; the plan deliberately leaves it untouched, and Task 2 step 5 lint/test confirms the slots still work.
- Spec §7 (testing: Inspector placement tests, App/layout tests, e2e updates, visual refresh) → Tasks 1, 2, 3, 5.
- Spec §8 acceptance criteria → verified across Task 3 step 6 (grep), Task 4 step 7 (grep), Task 5 step 1 (lint/test/build).

One deviation from spec §4f: the spec said "remove the `mobileTab` storage key" from `storageConstants.ts`. The only occurrence there is in `LEGACY_KEYS`, which exists to purge orphaned keys from users' browsers — removing it would strand the old persisted value. Task 4 step 6 keeps it intentionally and documents why. This is a correctness improvement over the spec wording.

**Placeholder scan:** No "TBD"/"TODO"/"handle edge cases" placeholders; every code step shows complete code.

**Type consistency:** `placement?: "top" | "bottom"` and `InspectorProps` are used identically in Task 1 (definition), Task 2 (`<Inspector placement="top" />` / `placement="bottom"`), and the Task 1 tests. `InspectorTabConfig.icon: ReactNode` is consistent between `tabs.tsx` and `Inspector.tsx`'s `tab.icon` usage. `data-placement` and the `[data-tab-id]` / `[role="tablist"][aria-label="Inspector"]` selectors are used consistently across the Inspector tests and the e2e specs.

---

## Execution complete

After Task 5, the branch is ready for a PR per the parent spec's cross-phase notes: one PR for Phase 7, with `pnpm run lint`, `pnpm run test`, and `pnpm run build` all green and visual baselines refreshed.
