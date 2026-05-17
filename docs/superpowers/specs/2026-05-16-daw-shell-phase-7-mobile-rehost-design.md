# DAW Shell Phase 7 — Mobile Rehost Design

**Status:** Sub-brainstorm spec. The parent spec
(`docs/superpowers/specs/2026-05-15-daw-shell-phases-4-7-design.md`, §7) deliberately
deferred the exact mobile tab placement to a dedicated sub-brainstorm. This document is
that sub-brainstorm's result and supersedes §7 of the parent spec for implementation
purposes.

**Date:** 2026-05-16

**Scope:** Phase 7 of the DAW shell redesign — remove the mobile-specific controls
duplication and unify every tier on the `Inspector`. Phases 4, 5, and 6 are shipped.

---

## 1. Background

Phases 1-6 reshaped FretFlow's controls into the DAW visual language and built the
`Inspector` — a Radix Tabs panel (`src/components/Inspector/`) with View / Scale / Chord /
Progression tabs — as the controls panel for desktop and tablet.

Mobile and the `tablet-split` variant still run a separate code path:

- `getResponsiveLayout` (`src/layout/responsive.ts`) sets `showMobileTabs = true` for the
  `mobile` tier **and** the `tablet-split` variant, and `showControlsPanel = true`
  otherwise. The two flags are mutually exclusive — exactly one is true per layout.
- When `showMobileTabs` is true, `App.tsx` renders `MobileTabPanel` in the
  `MainLayoutWrapper` `mobileTabs` slot and a fixed `BottomTabBar` (rendered outside
  `MainLayoutWrapper`). When `showControlsPanel` is true it renders `<Inspector />` in the
  `controlsPanel` slot.
- `MobileTabPanel` (`src/components/MobileTabPanel/`) renders five tabs — Scales, Chords,
  Progression, CoF, View — each wrapped in a `Card`. Tab selection is held in the
  persisted `mobileTabAtom`.
- `BottomTabBar` (`src/components/BottomTabBar/`) is the icon+label, thumb-reachable nav
  that drives `mobileTabAtom`.
- `Card` (`src/components/Card/`) is used only by `MobileTabPanel`.
- `ToggleBar` is **shared** by Inspector leaf controls (`FingeringPatternControls`,
  `ChordOverlayControls`, `ProgressionControls`, `ScaleSelector`) — it is not mobile-only.

This duplicates the entire controls surface: the same leaf controls are hosted twice,
once by the `Inspector` and once by `MobileTabPanel`.

---

## 2. Goals and Non-Goals

### Goals

- Make the `Inspector` the single controls component for every tier.
- Delete the mobile-specific controls duplication (`MobileTabPanel`, `BottomTabBar`,
  `Card`) and its supporting state (`mobileTabAtom`).
- Preserve mobile thumb ergonomics: on mobile and `tablet-split`, the Inspector's tab
  triggers dock at the bottom of the viewport as an icon+label bar.

### Non-Goals

- No changes to music theory, audio synthesis, the fretboard SVG renderer, or any leaf
  control's internals.
- No changes to the Inspector's tab set or tab bodies — still View / Scale / Chord /
  Progression. The Circle of Fifths stays folded into the Scale tab on every tier; mobile
  does **not** get a standalone CoF tab.
- No new Jotai atoms. This phase removes `mobileTabAtom`; it adds none.

---

## 3. Architecture

The `Inspector` becomes the single controls component for every tier. It gains one new
prop:

```ts
placement?: "top" | "bottom"  // default "top"
```

`placement` selects a CSS-module variant on the Radix `Tabs.Root`:

- **`"top"`** — inline tab triggers at the top of the panel, text-only. Identical to the
  current desktop Inspector. Used by the `controlsPanel` slot.
- **`"bottom"`** — the `Tabs.List` is pulled to a viewport-fixed bar at the bottom of the
  screen, with stacked icon-over-label triggers. Used by the `mobileTabs` slot.

There is one `Tabs.Root`, one set of `Tabs.Trigger`s, one set of `Tabs.Content`s, and one
local `useState` for the active tab. The only thing `placement` changes is layout and
which decorations are visible. Radix Tabs already provides roving-tabindex keyboard
navigation, `role="tab"`/`role="tablist"`, and `aria-selected`, so `BottomTabBar`'s
hand-rolled keyboard handler is not lost when `BottomTabBar` is deleted.

`MobileTabPanel`, `BottomTabBar`, `Card`, `mobileTabAtom`, and `constants/tabLabels.ts`
are deleted.

---

## 4. Components

### 4a. `src/components/Inspector/tabs.ts` (modified)

`InspectorTabConfig` gains an `icon` field. The icons reuse the current mobile set from
`App.tsx`'s `MOBILE_TAB_ITEMS`:

```ts
import type { ReactNode } from "react";
import { Layout, Music2, Layers, ListMusic } from "lucide-react";

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

Because `tabs.ts` now holds JSX it must be renamed to `tabs.tsx` (or the icons moved to a
small `.tsx` module). The plan picks one and applies it consistently.

### 4b. `src/components/Inspector/Inspector.tsx` (modified)

- Accept `placement?: "top" | "bottom"` (default `"top"`).
- Pass `data-placement={placement}` and a placement variant class onto `Tabs.Root`.
- Each `Tabs.Trigger` renders an icon span and a label span:

```tsx
<RadixTabs.Trigger key={tab.id} value={tab.id} className={styles.tab}>
  <span className={styles.tabIcon} aria-hidden="true">{tab.icon}</span>
  <span className={styles.tabLabel}>{t(`inspector.${tab.labelKey}`)}</span>
</RadixTabs.Trigger>
```

The icon span is always in the DOM; CSS hides it in the `top` variant.

### 4c. `src/components/Inspector/Inspector.module.css` (modified)

- `top` variant: `.tabIcon { display: none; }` — triggers stay text-only, matching the
  current desktop look exactly.
- `bottom` variant: `.tabList` becomes `position: fixed; inset: auto 0 0 0;` with the DAW
  navy faceplate, cyan top border, and cyan glow; triggers are flex-column (icon over
  label) with thumb-sized tap targets. The tab-panel/content area gets `padding-bottom`
  equal to the bar height so content is never occluded; honor `env(safe-area-inset-bottom)`
  so the bar clears the iOS home indicator.
- The active trigger keeps the existing cyan-underline/glow treatment, adapted to the
  bottom edge.

### 4d. `src/App.tsx` (modified)

- `controlsPanel` slot → `<Inspector placement="top" />`.
- `mobileTabs` slot → `<Inspector placement="bottom" />`.
- Remove: the `BottomTabBar` import and its JSX block; `MOBILE_TAB_ITEMS`;
  `translatedTabItems`; the `MobileTabPanel` lazy import; all `mobileTabAtom` /
  `mobileTab` / `setMobileTab` usage; the `TAB_LABELS` import.
- The `mobileTabs` Suspense fallback changes from `<MobileTabSkeleton />` to
  `<ControlsPanelSkeleton mode={layout.panelMode} />` (or another existing skeleton); the
  `MobileTabSkeleton` import is removed.
- Icon imports that become unused after removing `MOBILE_TAB_ITEMS` (`Music2`,
  `ListMusic`, `Layers`, `Layout`, `Compass`) are pruned from the `App.tsx` import.

### 4e. `src/components/LoadingSkeleton/LoadingSkeleton.tsx` (modified)

Remove the `MobileTabSkeleton` export — it has no remaining consumer after 4d.

### 4f. Store cleanup

- `src/store/uiAtoms.ts` — remove `mobileTabAtom` and its type.
- `src/store/atoms.ts` — remove the `mobileTabAtom` re-export from the barrel.
- `src/store/actions.ts` — remove the `mobileTab`-related action.
- `src/utils/storageConstants.ts` — remove the `mobileTab` storage key.
- `src/store/MIGRATIONS.md` — add a note that the `mobileTab` persisted key is retired.

### 4g. Deletions

- `src/components/MobileTabPanel/` (component, CSS module, test).
- `src/components/BottomTabBar/` (component, CSS module, test).
- `src/components/Card/` (component, CSS module, test) — used only by `MobileTabPanel`.
- `src/constants/tabLabels.ts` — used only by `MobileTabPanel` and the removed `App.tsx`
  code.

### 4h. `MainLayoutWrapper`

`MainLayoutWrapper` is unchanged structurally — it keeps both the `controlsPanel` and
`mobileTabs` slots, gated by `showControlsPanel` / `showMobileTabs` as today. Only the
`mobileTabs` slot's content changes (now an `Inspector`). The `mobile-tabs-shell` wrapper
div stays; since the bottom tab bar is `position: fixed`, that wrapper just contains the
Inspector body. Its CSS module may need a `padding-bottom` review so the body does not
sit under the fixed bar — handled in the plan.

---

## 5. Data flow

- Leaf controls subscribe directly to their own Jotai atoms, exactly as they do inside
  the Inspector today. No prop drilling, no new atoms.
- The active tab is Inspector-local `useState` (default `"view"`), per component mount —
  identical to how the desktop Inspector already works.
- `mobileTabAtom` was persisted, so mobile previously restored its last-used tab on
  reload. After this phase the active tab no longer persists, which makes mobile
  consistent with desktop. This is an accepted, intentional behavior change.

---

## 6. Trade-offs accepted

- `MobileTabPanel`'s slide cross-fade animation between tabs is dropped. Radix Tabs switch
  instantly — the same behavior the desktop Inspector already has.
- Mobile loses its standalone Circle of Fifths tab. CoF remains available inside the
  Scale tab (alongside `ScaleSelector`) on every tier; on mobile that Scale tab is
  scrollable if its content exceeds the viewport.
- `ToggleBar` is intentionally **kept** — it is shared by the Inspector leaf controls.

---

## 7. Testing

- `Inspector.test.tsx` — extend:
  - `placement="bottom"` renders the tab icons and applies the bottom-placement
    variant/data attribute.
  - `placement="top"` (default) does not surface the icons (text-only triggers).
  - Keyboard navigation across triggers still works in both placements (Radix roving
    tabindex) — arrow keys move the active tab.
- App / layout tests — assert that on the `mobile` tier and the `tablet-split` variant the
  Inspector renders and `MobileTabPanel` / `BottomTabBar` do not.
- Delete `MobileTabPanel.test.tsx`, `BottomTabBar.test.tsx`, and the `Card` test.
- Grep the tree after the change for dangling references to `mobileTabAtom`,
  `MobileTabPanel`, `BottomTabBar`, `Card`, `TAB_LABELS`, and `MobileTabSkeleton`; there
  must be none.
- Visual regression — refresh darwin + linux baselines for the `app-mobile` and
  `app-layout` suites (any suite that captured `MobileTabPanel` or `BottomTabBar`).

---

## 8. Acceptance criteria

- `src/components/MobileTabPanel/`, `src/components/BottomTabBar/`,
  `src/components/Card/`, and `src/constants/tabLabels.ts` no longer exist.
- `mobileTabAtom` and its persisted storage key are removed; no dangling references
  remain anywhere in `src/`.
- `ToggleBar` is intact and still used by the Inspector leaf controls.
- On the `mobile` tier and the `tablet-split` variant, controls are served by the
  `Inspector` with a viewport-fixed, icon+label bottom tab bar.
- On all other tiers the Inspector renders unchanged (inline top, text-only tabs).
- `pnpm run lint`, `pnpm run test`, and `pnpm run build` all pass.

---

## 9. Relationship to the parent spec

This document fulfills the deferred sub-brainstorm called for in
`2026-05-15-daw-shell-phases-4-7-design.md` §7 ("Deferred sub-brainstorm"). Decisions
locked here that the parent spec left open:

- **Tab placement:** bottom-docked, viewport-fixed bar on mobile + `tablet-split`;
  inline-top on desktop/tablet.
- **Tab visuals:** icon + label on the bottom bar; text-only at the top.
- **`tablet-split`:** treated like mobile — it gets the bottom-docked bar.
- **Tab set:** unchanged four-tab set on every tier; no standalone mobile CoF tab.

Phase 7 ships as its own PR with its own implementation plan and its own visual-regression
baseline refresh, per the parent spec's cross-phase notes.
