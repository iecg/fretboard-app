# Onboarding Tutorial — Design

**Status:** Approved (decisions delegated to me). Sequence anywhere — independent of the other specs in this batch.

**Goal:** Lower the cliff for first-time users by introducing FretFlow's core surfaces (fretboard, Overlay tab, Song tab) on first visit, with hooks for surfacing advanced features contextually as the user explores.

**In scope:** item 7 from the 2026-05-27 grab-bag brainstorm.

**Out of scope:** content authoring tooling, analytics, A/B testing infrastructure, advanced sequencing rules. This spec defines the UX and storage contract; the actual tip catalog can grow over time.

---

## Context

### Today

- `HelpModal` exists as a manually-triggered ? button surface. No first-visit detection, no contextual hints.
- `seenChordModeRemovalNoticeAtom` (in `src/store/uiAtoms.ts`) proves the "one-time dismissable, persisted to storage" pattern works.
- `Tooltip` primitive exists at `src/components/Tooltip/Tooltip.tsx` but isn't heavily used elsewhere — available as a positioning foundation.
- The app has three primary surfaces a new user must discover: the **fretboard** (canvas), the **Overlay tab** (scale + chord configuration), and the **Song tab** (progressions + playback).

### Why two phases

A single welcome modal won't surface advanced features (multi-shape CAGED via Shift+click, voicing fallbacks, lock-to-scale, etc.). A full TipKit-style system is significant engineering effort and benefits from real-usage feedback before locking in trigger heuristics. Splitting:

- **Phase 1 — Welcome modal** ships the immediate first-visit win. Self-contained, ~3 days of focused work.
- **Phase 2 — TipPopover primitive + initial tip catalog** layers contextual tips on top once the welcome modal is shipped. Tips can be added/iterated independently.

Phase 1 is the mandatory deliverable. Phase 2 is optional follow-up; ship Phase 1 and defer Phase 2 if priorities shift.

---

## Design — Phase 1: Welcome Modal

### Trigger and persistence

- New atom `seenWelcomeTutorialAtom` in `src/store/onboardingAtoms.ts` (new file): `atomWithStorage<boolean>("fretflow:seenWelcomeTutorial", false, booleanStorage, GET_ON_INIT)`.
- On `App.tsx` mount, if `seenWelcomeTutorial === false` and the app isn't in an automated test environment (e.g. `import.meta.env.MODE !== "test"`), render the `WelcomeModal`.
- Dismissing the modal (Got it / close / Esc / outside click) sets `seenWelcomeTutorial = true`.
- The existing settings-drawer Reset action also resets this atom (add to the reset action's atom list).
- The Help button (?) gets a "Show tour again" affordance that flips `seenWelcomeTutorial = false`, then opens the modal.

**Existing users on v2 launch:** They will see the welcome modal because their localStorage doesn't have `fretflow:seenWelcomeTutorial`. This is intentional — v2 is a redesign worth re-orienting around. (If we ever decide to suppress for existing users, that's a one-line migration in `v2RedesignMigration.ts` setting the key to true for storages that already have any `fretflow:*` key. Not done in this spec.)

### Content — 3 sequential steps

The modal uses a stepped layout with Back / Next / Skip controls. Each step renders a heading, body copy, and an illustrative graphic (screenshot or simplified SVG mock).

**Step 1 — Welcome + the fretboard**

> "FretFlow visualizes scales and chords on a guitar fretboard. Start by picking a root note and a scale — the fretboard lights up with the notes you can play."

Visual: simplified fretboard mockup with C major lit up; arrow pointing at Circle of Fifths control.

**Step 2 — Overlay tab: scale and chord**

> "The **Overlay tab** is where you choose how the fretboard renders. Pick a fingering pattern (CAGED, 3NPS, 1-string, 2-strings). Stack a chord on top to see voicings."

Visual: screenshot of the Overlay tab with Scale and Chord cards labeled.

**Step 3 — Song tab: progressions and playback**

> "The **Song tab** lets you build chord progressions and play them back. The fretboard advances through each chord as it plays, so you can see exactly what's happening."

Visual: screenshot of Song tab with a 4-bar progression and the play button highlighted.

**Final step — Dismiss**

> "Got it! Tap the (?) icon anytime to see this tour again."

Single primary button: "Get started".

### Component

- `src/components/Onboarding/WelcomeModal.tsx` — composes existing modal chrome (reuse `HelpModal`'s `Dialog` / portal infrastructure if it factors cleanly; otherwise extract).
- `src/components/Onboarding/WelcomeModal.module.css` — local styles for step layout, navigation buttons, illustration container.
- Illustrations live in `src/assets/onboarding/` as static images or inline SVG. Phase 1 ships with placeholder visuals; high-fidelity visuals can be swapped in later without re-spec.
- Accessibility: trap focus within the modal, restore focus on close, Esc dismisses, role="dialog" + aria-labelledby tied to the step heading.

### i18n

All copy lives in `src/i18n/` keys under `onboarding.welcome.*`. Existing translation infrastructure handles the rest.

---

## Design — Phase 2: TipPopover (optional follow-up)

Phase 2 is sketched here so Phase 1's foundations don't need rework when it lands.

### Primitive

- `src/components/Onboarding/TipPopover.tsx` — anchored popover with title, body, dismiss button, optional "Don't show again" affordance. Built on top of existing `Tooltip` positioning (or `floating-ui` if Tooltip's positioning isn't reusable).
- Props: `anchor: RefObject<HTMLElement>`, `tipKey: string`, `title: string`, `body: ReactNode`, `placement?: "top"|"bottom"|"left"|"right"`.
- Per-tip persistence: each `tipKey` maps to an `atomWithStorage<boolean>(...)` lazily registered in `onboardingAtoms.ts`'s tip registry. The atom defaults to `false` (not seen); dismissing the popover sets it to `true`.
- The popover does nothing unless its anchor is mounted, visible, and the tipKey is unseen.

### Trigger model

- Tips are **passive**: they render alongside their anchor and self-show when conditions are met. No global orchestrator.
- A `useShowTip(tipKey)` hook returns `[shouldShow, dismiss]` for components that want to render their own tip imperatively rather than via the `<TipPopover>` JSX.
- Tips can chain by checking sibling tipKeys: e.g. the "voicing mode" tip checks that the "fingering pattern" tip was dismissed before showing. Composition is left to each tip; no central scheduler.

### Initial tip catalog (Phase 2 ship)

Five tips covering the most common discoverability gaps:

1. **`first-shape-multi-select`** — on first user click in the CAGED shape toggle: "Hold Shift to enable multiple shapes at once (or long-press on touch)."
2. **`first-song-tab-visit`** — on first time the user clicks the Song tab: "Build a chord progression here. The fretboard advances through each chord as the progression plays."
3. **`first-voicing-toggle`** — on first user change to voicing mode: "Full draws complete chord shapes; Close draws compact 3-4 note voicings on a specific string set."
4. **`first-fret-zoom`** — on first zoom or fret-range change: "Pinch (touch) or use the controls in Settings to zoom and crop the visible neck."
5. **`first-playback-loop`** — on first time pressing Play in Song tab: "Toggle loop to repeat the progression. The lead lens highlights notes carrying into the next chord."

Each tip has its own atom (auto-registered in the tip registry) and ships dismissed-state in the v2 migration's retired-keys handling if it ever changes name.

### Sequencing primitive (deferred)

Phase 2 ships with passive tips. If we later want true sequenced tutorials ("after dismissing tip A, show tip B 5 seconds later"), that's a Phase 3 follow-up adding an `onboardingSequence` registry + a global orchestrator. Out of scope here.

---

## Storage contract

New atoms in `src/store/onboardingAtoms.ts`:

```ts
export const seenWelcomeTutorialAtom = atomWithStorage<boolean>(
  k("seenWelcomeTutorial"),
  false,
  booleanStorage,
  GET_ON_INIT,
);

// Phase 2 (added when Phase 2 ships):
export const tipSeenAtoms = {
  "first-shape-multi-select": atomWithStorage<boolean>(k("tip:first-shape-multi-select"), false, booleanStorage, GET_ON_INIT),
  // ... one per tip
};
```

Reset action (`src/store/actions.ts`) appends these to the resettable atom list so the settings-drawer Reset re-runs the tour for the user.

---

## Tests

### Phase 1

- **`seenWelcomeTutorialAtom`:** defaults to false on fresh storage; persists true after dismiss; reset action restores false.
- **`WelcomeModal`:**
  - First mount with `seenWelcomeTutorial=false` → modal renders, focus trapped, step 1 visible.
  - Click Next → step 2 visible. Click Next → step 3 visible. Click Next → modal closes, atom is true.
  - Esc dismisses + sets atom true. Outside click dismisses + sets atom true.
  - Skip button on any step dismisses + sets atom true.
  - Help button "Show tour again" flips atom false and opens modal.
  - In `MODE === "test"` env, modal is suppressed so component tests don't trip on it.
- **`HelpModal`:** the "Show tour again" button exists, click invokes the right handler.
- **a11y:** vitest-axe pass for each step.

### Phase 2 (when Phase 2 ships)

- **`TipPopover`:**
  - Unseen tipKey + anchored target visible → popover renders.
  - Seen tipKey → popover does not render.
  - Dismiss → atom flips to true; popover unmounts.
  - Anchor unmounted → popover unmounts.
- **Individual tips:** each tip in the initial catalog has a smoke test asserting it renders on the right trigger and dismisses correctly.

### Visual

- Phase 1: snapshot the WelcomeModal at each step (light + dark mode). Mobile + desktop layout variants.
- Phase 2: snapshot each initial tip in its anchored position.

---

## Files to touch

**Create (Phase 1):**
- `src/store/onboardingAtoms.ts` — `seenWelcomeTutorialAtom`.
- `src/components/Onboarding/WelcomeModal.tsx`
- `src/components/Onboarding/WelcomeModal.module.css`
- `src/components/Onboarding/WelcomeModal.test.tsx`
- `src/assets/onboarding/` — placeholder illustrations (3 images or inline SVG mocks).
- `src/i18n/translations.ts` (or equivalent) — `onboarding.welcome.*` keys.

**Modify (Phase 1):**
- `src/App.tsx` — read `seenWelcomeTutorialAtom`, render `WelcomeModal` conditionally.
- `src/components/HelpModal/HelpModal.tsx` — add "Show tour again" button + handler that resets `seenWelcomeTutorialAtom`.
- `src/store/actions.ts` — append `seenWelcomeTutorialAtom` to the reset action's atom list.

**Create (Phase 2):**
- `src/components/Onboarding/TipPopover.tsx`
- `src/components/Onboarding/TipPopover.module.css`
- `src/components/Onboarding/TipPopover.test.tsx`
- `src/components/Onboarding/tipRegistry.ts` — initial 5-tip catalog.

**Modify (Phase 2):**
- Various component anchors (FingeringPatternControls, VoicingControl, TabBar Song button, etc.) — mount `<TipPopover anchor={ref} tipKey="..." ... />` near each tip's target.

**Visual baselines:** add new snapshots for WelcomeModal (Phase 1); add per-tip snapshots (Phase 2).

---

## Build approach

Recommendation deferred to plan-writing time per your direction. Two viable paths:

1. **Custom build on top of existing primitives.** Reuse `HelpModal`'s dialog infrastructure for Phase 1; reuse `Tooltip` positioning for Phase 2. No new dependency, full styling control. Estimated: ~3 days Phase 1, ~5 days Phase 2.
2. **driver.js or shepherd.js for Phase 2.** Library handles positioning + sequencing. Drops Phase 2 implementation to ~2 days but adds a ~20kb dep and adopts library styling that won't match the app (will need restyling, partially defeating the time savings).

My lean: option 1 (custom). The codebase already has the primitives; bringing in a library for a feature this self-contained is overkill.

---

## Sequencing

Independent of other specs in this 2026-05-27 batch. Recommended ordering: ship after groups A, B, and the Theming spec land so the onboarding screenshots/copy reflect the final UI. Otherwise the welcome modal illustrations need re-shooting after each subsequent change.

If onboarding ships earlier (e.g. alongside v2 launch for maximum first-visit reach), accept that the illustrations and copy will need refresh after the other 2026-05-27 specs land.
