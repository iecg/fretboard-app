# Always-On DAW — Phase B: Permanent Chord Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chord track always visible and remove `progressionEnabledAtom` as a visibility gate. The progression workflow becomes unconditionally active; the on/off control is removed.

**Architecture:** State removal — no new atoms. Every consumer of `progressionEnabledAtom` is updated to behave as if progression is always-on. `ProgressionSummarySlot` collapses to always render `ProgressionTrack`. The lens still renders via the existing `FretboardLensOverlay` path (now ungated) so the app stays correct between Phase B and Phase C. **Prerequisite: Phase A is merged** (the header no longer depends on `ProgressionTrack` hosting the transport). Spec: `docs/superpowers/specs/2026-05-18-always-on-daw-model-design.md` §5.

**Tech Stack:** React 19, TypeScript, Jotai, CSS Modules, Vitest + Testing Library, Playwright (visual regression). Package manager is **pnpm**.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/store/progressionAtoms.ts` | Progression domain state | Remove `progressionEnabledAtom`, its auto-set writes, RESET entry, and the gate read in `progressionPlaybackBlockedReasonAtom` |
| `src/store/atoms.ts` | Barrel | Drop the `progressionEnabledAtom` re-export |
| `src/store/chordOverlayAtoms.ts` | Chord overlay derivations | Remove the `progressionEnabledAtom` import + gate read (line ~44, ~209); take the always-on branch |
| `src/store/practiceLensAtoms.ts` | Practice-lens derivations | Remove the `progressionEnabledAtom` import + gate read (line ~62, ~196); take the always-on branch |
| `src/hooks/useProgressionState.ts` | Progression hook surface | Drop `progressionEnabled` / `setProgressionEnabled` |
| `src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx` | Top-band slot | Always render `ProgressionTrack`; keep `ProgressionSummarySlot` as the playback-hook host |
| `src/components/FretboardLensOverlay/FretboardLensOverlay.tsx` | Scale-mode lens overlay | Remove the gate; render the lens unconditionally (full rework deferred to Phase C) |
| `src/components/ProgressionControls/ProgressionControls.tsx` | Progression tab | Remove the on/off toggle UI |
| `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css` | Layout | Remove the `.summary-shell:empty` collapse rule |
| `src/App.tsx` | Orchestrator | Mount `ProgressionTrack` directly if `ProgressionSummarySlot` is removed |
| Test files | — | Update for the removed gate (see Task 6) |

---

## Task 1: Remove `progressionEnabledAtom` from the store

**Files:**
- Modify: `src/store/progressionAtoms.ts`
- Modify: `src/store/atoms.ts`

- [ ] **Step 1: Delete the atom definition**

Remove `progressionEnabledAtom` (the `atomWithStorage<boolean>` at line ~84). **Record its `localStorage` key name in the PR description** — the persisted key is orphaned but harmless; no migration is needed.

- [ ] **Step 2: Remove the playback-blocked gate read**

In `progressionPlaybackBlockedReasonAtom` (line ~329), delete the line `if (!get(progressionEnabledAtom)) return "Enable Progression to start playback.";`. Keep every other blocked reason (disabled pattern, empty steps, no resolvable step) — those are not tied to the gate.

- [ ] **Step 3: Remove the auto-set writes**

In `loadProgressionPresetAtom` (line ~366) and `loadProgressionStepsAtom` (line ~377), delete `set(progressionEnabledAtom, true);`. In the RESET action (line ~523), delete `set(progressionEnabledAtom, RESET);`.

- [ ] **Step 4: Drop the barrel re-export**

In `src/store/atoms.ts`, remove `progressionEnabledAtom` from the export list (line ~124).

- [ ] **Step 4 verification:** `pnpm exec tsc -b` reports errors only in the not-yet-updated consumers (expected) — no errors inside `progressionAtoms.ts` / `atoms.ts`.

---

## Task 2: Update the derivation atoms

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts`
- Modify: `src/store/practiceLensAtoms.ts`

- [ ] **Step 1: `chordOverlayAtoms.ts`** — remove the `progressionEnabledAtom` import (line ~44). At line ~209 the derivation reads `get(progressionEnabledAtom) && …`; delete the `get(progressionEnabledAtom) &&` term so the always-on branch is unconditional.
- [ ] **Step 2: `practiceLensAtoms.ts`** — same treatment: remove the import (line ~62) and the `get(progressionEnabledAtom) &&` term (line ~196).

---

## Task 3: Update the progression hook surface

**Files:**
- Modify: `src/hooks/useProgressionState.ts`

- [ ] **Step 1:** Remove the `progressionEnabledAtom` import and the `useAtom(progressionEnabledAtom)` call (line ~48). Drop `progressionEnabled` and `setProgressionEnabled` from the returned object. Update the hook's return type accordingly.

---

## Task 4: Always render the chord track and the lens

**Files:**
- Modify: `src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx`
- Modify: `src/components/FretboardLensOverlay/FretboardLensOverlay.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css`

- [ ] **Step 1: Collapse `ProgressionSummarySlot`**

The component runs `useProgressionPlaybackLoop()` and `useProgressionAudioPlayback()` unconditionally and then gates `ProgressionTrack` on the atom. Remove the gate so it always returns `<ProgressionTrack />`. Keep the component — the two playback hooks must still run from somewhere in the tree, and this slot is their host. Update the file's doc comment to drop the mode-swap description.

- [ ] **Step 2: Ungate `FretboardLensOverlay`**

Remove the `progressionEnabledAtom` import and the early-return guard that hides the overlay while progression is active. Note the *current* guard is `if (progressionEnabled) return null;` — it returns `null` when progression **is** enabled, because the overlay hosts the scale-mode lens (shown only when progression is off). Delete that exact guard (not the inverse) so the overlay always renders `TopBandSummary`. (Phase C reworks this component into an inline strip; Phase B only ungates it so the lens is visible in the intermediate state.)

- [ ] **Step 3: Remove the empty-shell collapse rule**

In `MainLayoutWrapper.module.css`, delete the `.summary-shell:empty` rule (line ~18) — the summary shell always has content now.

- [ ] **Step 3 verification:** The summary shell renders the chord track on every layout tier; no collapsed/empty state remains.

---

## Task 5: Remove the on/off toggle from the Progression tab

**Files:**
- Modify: `src/components/ProgressionControls/ProgressionControls.tsx`

- [ ] **Step 1:** Remove the progression on/off toggle UI — the `ToggleBar`/checkbox bound to `progressionEnabled` (around line 128, `checked={progressionEnabled}`). Remove the now-unused `progressionEnabled` destructure. Leave the rest of the tab — meter row, chord list, selected-chord editor, backing track — untouched.

---

## Task 6: Tests

**Files:**
- Modify: `src/store/progressionAtoms.test.ts`, `src/store/chordOverlayAtoms.test.ts`, `src/store/practiceLens.test.ts`, `src/store/atoms.test.ts`
- Modify: `src/components/ProgressionControls/ProgressionControls.test.tsx`
- Modify: `src/components/ProgressionSummarySlot/ProgressionSummarySlot.test.tsx`
- Modify: `src/components/FretboardLensOverlay/FretboardLensOverlay.test.tsx`, `src/components/TopBandSummary/TopBandSummary.test.tsx`, `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`, `src/components/ChordOverlayDock/ChordOverlayDock.test.tsx`, `src/components/Inspector/ChordTab.test.tsx`, `src/components/Inspector/ProgressionTab.test.tsx`, `src/components/Inspector/Inspector.test.tsx`, `src/components/ProgressionTrack/ProgressionTrack.test.tsx`, `src/components/TransportBar/TransportBar.test.tsx`, `src/hooks/useProgressionPlaybackLoop.test.tsx`

- [ ] **Step 1:** Remove every `progressionEnabledAtom` import and every test setup that sets it. The always-on branch is now the only branch — delete gate-off test cases or convert them to assert always-on behavior.
- [ ] **Step 2:** `progressionAtoms.test.ts` — drop the "Enable Progression to start playback" blocked-reason case; keep the other blocked-reason cases.
- [ ] **Step 3:** `ProgressionControls.test.tsx` — assert the on/off toggle is absent; chord editing and backing track still work.
- [ ] **Step 4:** `ProgressionSummarySlot.test.tsx` — assert `ProgressionTrack` always renders.
- [ ] **Step 5:** App / layout tests — the chord track is always visible; there is no scale-mode fallback.

---

## Task 7: Visual regression + verification

- [ ] **Step 1:** `pnpm run lint` passes.
- [ ] **Step 2:** `pnpm run test` passes — confirm no remaining reference to `progressionEnabledAtom` (`grep -rn progressionEnabledAtom src` returns nothing).
- [ ] **Step 3:** `pnpm run build` passes.
- [ ] **Step 4:** Refresh visual snapshots for `app-layout`, `app-overlays`, `app-mobile` (darwin + linux).

---

## Acceptance Criteria

- The chord track (`ProgressionTrack`) is always visible.
- No progression on/off control exists anywhere.
- `progressionEnabledAtom` is gone; `grep` finds no consumer; the app behaves as progression-always-on.
- All progression editing, playback, and accompaniment behavior is unchanged.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.
