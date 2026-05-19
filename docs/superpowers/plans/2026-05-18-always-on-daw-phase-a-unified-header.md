# Always-On DAW — Phase A: Unified Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the transport bar, position readout, tempo readout, and scale readout out of `ProgressionTrack` and into `AppHeader`, so the header is the single chrome row from the `FretFlow DAW.html` mockup: brand · transport · position · tempo · scale · utility.

**Architecture:** Additive relocation only. The `progressionEnabledAtom` mode-swap still exists underneath; this phase keeps the app correct in an intermediate state. The transport bar and readouts simply change their mount point — atom wiring is unchanged. `ProgressionTrack` keeps the timeline, ruler, playhead, and chord clips. Spec: `docs/superpowers/specs/2026-05-18-always-on-daw-model-design.md` §4.

**Tech Stack:** React 19, TypeScript, Jotai, CSS Modules, Vitest + Testing Library, Playwright (visual regression). Package manager is **pnpm**.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/components/HeaderTransportCluster/HeaderTransportCluster.tsx` | New — composes `TransportBar` + `ProgressionPositionReadout` + tempo/scale chips for the header | Create |
| `src/components/HeaderTransportCluster/HeaderTransportCluster.module.css` | Cluster layout (flex row, dividers, spacer) | Create |
| `src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx` | Cluster render + wiring tests | Create |
| `src/components/HeaderTransportCluster/ProgressionPositionReadout.tsx` | Live timeline position readout | Move from `ProgressionTrack/` |
| `src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx` | Position readout tests | Move from `ProgressionTrack/` |
| `src/components/ProgressionTrack/ProgressionTrack.tsx` | DAW track | Remove `transportRow`, `TransportBar`, position/tempo/scale readouts |
| `src/components/ProgressionTrack/ProgressionTrack.module.css` | Track styles | Remove `.transportRow`, `.contextReadouts`, `.contextBox`, `.readoutLabel`, `.tempoValue`, `.tempoUnit`, `.scaleValue`, `.scalePrimary`, `.scaleSecondary` |
| `src/components/ProgressionTrack/ProgressionTrack.test.tsx` | Track tests | Drop assertions for transport/readouts |
| `src/components/AppHeader/AppHeader.tsx` | App header | Accept a `transport` slot rendered between brand and actions |
| `src/components/AppHeader/AppHeader.module.css` | Header layout | Add wrapping flex row, hairline dividers, flexible spacer |
| `src/components/AppHeader/AppHeader.test.tsx` | Header tests | Assert transport slot renders |
| `src/components/TransportBar/TransportBar.test.tsx` | Transport bar tests | Confirm unchanged under the new mount point |
| `src/App.tsx` | Orchestrator | Pass `<HeaderTransportCluster />` to `AppHeader` |

---

## Task 1: Extract a header transport cluster component

**Files:**
- Create: `src/components/HeaderTransportCluster/HeaderTransportCluster.tsx`
- Create: `src/components/HeaderTransportCluster/HeaderTransportCluster.module.css`

- [ ] **Step 1: Build the cluster component**

Move the JSX currently inside `ProgressionTrack`'s `.transportRow` into a new component. It composes, in order: `TransportBar`, `ProgressionPositionReadout`, then the tempo and scale context chips. Source the same data via `useProgressionState()` (`progressionTempoBpm`, `progressionPlaying`, `progressionPlaybackBlockedReason`, `currentProgressionBar`, `activeProgressionStepIndex`, `resolvedProgressionSteps`, `totalProgressionBars`, `beatsPerBar`) and `useScaleState()` (`scaleLabel`). Reuse the existing `splitScaleLabel` and `durationToBars` helpers — copy them into this file (or extract to a shared util if a third consumer appears; for now copy is fine, they are 3 lines each).

The mockup's `PlayIndicator` (play/loop status dots) belongs with the transport cluster. `TransportBar` already owns transport controls — check whether it renders play/loop status. If it does, no extra work. If not, add the status dots here bound to `progressionPlaying` and `progressionLoopEnabledAtom`. (Confirm during implementation; do not add a duplicate indicator.)

- [ ] **Step 2: Style the cluster**

Port `.contextReadouts`, `.contextBox`, `.readoutLabel`, `.tempoValue`, `.tempoUnit`, `.scaleValue`, `.scalePrimary`, `.scaleSecondary` from `ProgressionTrack.module.css` into the new module. The cluster is a flex row with `gap` and hairline dividers between logical groups (transport | position | tempo · scale). Use existing CSS tokens for colors and spacing.

---

## Task 2: Strip the transport row from `ProgressionTrack`

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.module.css`

- [ ] **Step 1: Remove the `.transportRow` block**

Delete the `<div className={styles.transportRow}>…</div>` (lines 84-114) including the `TransportBar` import and the position/tempo/scale readout JSX. Keep `useProgressionState` and `useScaleState` only for the values still used by the timeline (`scaleLabel` and `splitScaleLabel` are no longer used here — remove them too). `ProgressionTrack` now renders only the `.timeline` section.

- [ ] **Step 2: Remove orphaned CSS**

Delete `.transportRow`, `.contextReadouts`, `.contextBox`, `.readoutLabel`, `.tempoValue`, `.tempoUnit`, `.scaleValue`, `.scalePrimary`, `.scaleSecondary` from `ProgressionTrack.module.css`.

---

## Task 3: Wire the cluster into `AppHeader`

**Files:**
- Modify: `src/components/AppHeader/AppHeader.tsx`
- Modify: `src/components/AppHeader/AppHeader.module.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add a `transport` slot to `AppHeader`**

Add an optional `transport?: ReactNode` prop. Render it in a `<div className={styles['app-header-transport']}>` between the brand block and the actions block. The header row wraps (`flex-wrap: wrap`) and uses a flexible spacer so the actions cluster pushes right. Match the mockup `app.jsx:76-99` layout: brand · divider · transport · spacer · actions.

- [ ] **Step 2: Style the header row**

In `AppHeader.module.css`, make `.app-header` a wrapping flex row. Add `.app-header-transport` and a hairline divider treatment (a `border-left` on the transport block, or a dedicated `.app-header-divider` span — match how the brand/actions are currently separated). Add a flexible spacer between transport and actions.

- [ ] **Step 2 verification:** Header renders on all three layout tiers without overflow; transport wraps below brand on narrow widths rather than clipping.

- [ ] **Step 3: Pass the cluster from `App.tsx`**

Add `transport={<HeaderTransportCluster />}` to the `<AppHeader>` element (around line 159). Keep `ProgressionSummarySlot` and `FretboardLensOverlay` mounted as-is — the mode-swap is untouched in Phase A.

---

## Task 4: Tests

**Files:**
- Create: `src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx`
- Modify: `src/components/AppHeader/AppHeader.test.tsx`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.test.tsx`

- [ ] **Step 1: Cluster tests** — renders transport controls, position readout, tempo, and scale; transport controls still drive playback atoms (use `renderWithAtoms`).
- [ ] **Step 2: `AppHeader` test** — when a `transport` node is passed, it renders inside `app-header-transport`.
- [ ] **Step 3: `ProgressionTrack` test** — assertions for the transport bar and tempo/scale/position readouts are removed; timeline, ruler, playhead, and chord clips still render.
- [ ] **Step 4: `TransportBar.test.tsx`** — confirm it still passes unchanged under the new mount point (no edit expected; run it).

---

## Task 5: Visual regression + verification

- [ ] **Step 1:** `pnpm run lint` passes.
- [ ] **Step 2:** `pnpm run test` passes.
- [ ] **Step 3:** `pnpm run build` passes.
- [ ] **Step 4:** Refresh visual snapshots: `pnpm run test:visual:update` (darwin) for `app-layout`, `app-components`, `app-overlays`. Regenerate linux snapshots via the cross-platform path. Review diffs — only the header and progression track should change.

---

## Acceptance Criteria

- The header is one row: brand · transport · position · tempo · scale · utility.
- `ProgressionTrack` no longer hosts the transport bar or the readouts.
- Playback, tempo, and scale readouts behave exactly as before.
- The `progressionEnabledAtom` mode-swap is untouched; the app is correct and releasable.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.
