# Progression Playback UX Polish — Round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh of [round-2](2026-05-25-playback-ux-polish-round2.md) after the deferred Q3 investigation produced concrete findings (`docs/superpowers/research/2026-05-25-playback-degradation.md`) AND after several large in-flight changes landed between drafts: O(1) voicing engine (`0e2bd21c`), voicing geometry memoization + pre-warm (`3d6c350d`, `4bc85d2a`), lazy Tone.js loading (`382c3977`/`b5317b5d`), removal of the round-1 AudioContext pre-warm (`fcd8c137`), and two playback-orchestrator bug fixes (`191d8222`, `c12b0f34`). This round converts the research findings into fix tasks, picks up Q1/Q2/Q4 from round-2 unchanged, and adds two quality follow-ups from the just-finished systematic-debugging session.

**Architecture:** Five phases.
- **R1 (was Q1)**: card-level lock + tooltip — replaces per-control disabled props with a single `locked={editsLocked}` on the KEY + PROGRESSION `InspectorCard`s, with a Radix tooltip on the locked body.
- **R2 (was Q2)**: Stop button + tooltips on play/pause/stop — `stopProgressionPlaybackAtom` atomically sets playing=false + activeIndex=0; lucide `Square` icon next to Play.
- **R3 (new — Q3 research findings)**: stabilize `chordHighlightPositionsAtom`'s `Set` return by value-fingerprint, drop the now-anachronistic manual `memo()` on `FretboardSVG`, and pool `Tone.PluckSynth` in `string.ts` so the strum chord instrument stops leaking audio nodes every loop.
- **R4 (was Q4)**: replace `Tone.Loop("4n", ...)` metronome with a `Tone.Part`-driven event stream from `buildAllLayers`, so the metronome wraps in lock-step with the chord/bass/drum parts. The 2026-05-25 first-play tempo-init fix (`191d8222`) handled a *different* metronome bug (Transport at default 120 BPM until the user nudged tempo); this round handles the loop-length symptom the user originally reported ("metronome keeps clicking past the loop end").
- **R5 (new — investigation follow-ups + verification)**: dev-mode `console.warn` on the silent catch in `bus.ts` so future regressions like the one investigated 2026-05-25 surface immediately; suppress the `EnvironmentTeardownError` from the lazy `import()` firing after vitest teardown; final lint/test/build/e2e/visual refresh.

**Tech Stack:** React 19 + Jotai (`useAtomValue`, `useSetAtom`), Tone.js v15 (`Tone.Part`, `Transport`, `getDraw`), `@radix-ui/react-tooltip` (already mounted at app root via `src/components/Tooltip/Tooltip.tsx`), lucide-react (`Square` for Stop), vitest + jsdom.

---

## File Map

**Modify:**
- `src/components/Inspector/InspectorCard.tsx` — add `locked?: boolean` + `lockedHint?: ReactNode` props.
- `src/components/Inspector/InspectorCard.module.css` — `[data-locked="true"]` body dim + `cursor: not-allowed` + child `pointer-events: none`.
- `src/components/Inspector/InspectorCard.test.tsx` — extend with locked + tooltip cases.
- `src/components/SongControls/SongControls.tsx` — replace the 13 per-control `disabled={editsLocked}` props (added in P1-T3) with a single `locked={editsLocked}` on KEY + PROGRESSION InspectorCards; restore the original per-control predicates.
- `src/components/SongControls/SongControls.test.tsx` — swap per-control assertions for card-level locked assertions.
- `src/store/progressionAtoms.ts` — add `stopProgressionPlaybackAtom` write-only setter.
- `src/store/progressionAtoms.test.ts` — coverage for the new setter.
- `src/components/TransportBar/TransportBar.tsx` — add Stop button between Prev and Play; wrap Play + Stop in `<Tooltip>`.
- `src/components/TransportBar/TransportBar.test.tsx` — tests for Stop click + Stop disabled state.
- `src/store/chordOverlayAtoms.ts` — cache `chordHighlightPositionsAtom`'s `Set<string>` return by content-fingerprint so equal chord states share reference identity (kills the "Set ref churns every render" leak that defeats Compiler memoization).
- `src/components/FretboardSVG/FretboardSVG.tsx` — drop the manual `memo(...)` wrapper at line 141; trust React Compiler. Drop the now-unused `memo` import.
- `src/progressions/audio/string.ts` — pool `Tone.PluckSynth` via `createReusableVoicePool` (mirror `bass.ts`).
- `src/progressions/audio/string.test.ts` — assert pool reuse + bounded `live` count under repeated invocation.
- `src/progressions/audio/buildAllLayers.ts` — emit a `metronome` event stream (one event per beat across `totalDurationSec`, with `beatInBar: 1..beatsPerBar`).
- `src/progressions/audio/buildAllLayers.test.ts` — extend with metronome event count + per-bar accent assertions.
- `src/progressions/audio/progressionAudioEngine.ts` — re-export `MetronomeEvent` from `buildAllLayers`; drop the `createMetronomeLoop` / `MetronomeLoopHandle` re-exports (no longer used after R4).
- `src/hooks/useProgressionAudioPlayback.ts` — swap the `createMetronomeLoop` call for a 5th `Tone.Part` consuming `built.metronome`; drop `beatsPerBarRef` (Part owns the beat number via event payload); add `beatsPerBar` to `buildKey`.
- `src/hooks/useProgressionAudioPlayback.test.tsx` — replace Loop assertion with 5-Part assertion.
- `src/progressions/audio/bus.ts` — dev-mode `console.warn` in the silent catch so unexpected init failures surface in development without polluting production logs.
- `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/types.ts` — add tooltip + Stop button strings.

**Delete:**
- `src/progressions/audio/progressionMetronomeLoop.ts` — replaced by Part-based scheduling in R4-T2.
- `src/progressions/audio/progressionMetronomeLoop.test.ts` — same.

**Untouched (verified):**
- `src/components/BackingTrackControls/*` — style switches stay live mid-play per the scope decision locked in by round-1's P1-T3.
- The four other Tone.Parts (chord-onset, chord-strum, bass, drums) and their wiring.
- The progression-audio engine barrel's re-export set for the non-metronome primitives.

---

## Phase R1 — Card-Level Lock + Tooltip

Replaces round-1's P1-T3 (13 individual `disabled` props on SongControls primitives) with a single card-level lock. Centralizes the gate, removes the per-control "not-allowed" cursor with no explanation, and adds a Radix tooltip on the locked body that tells the user *why* they can't edit ("Pause playback to edit"). Every new control added to KEY or PROGRESSION inherits the lock for free — no opt-in required.

### Task R1-T1: Extend `InspectorCard` with `locked` + `lockedHint` props

**Files:**
- Modify: `src/components/Inspector/InspectorCard.tsx`
- Modify: `src/components/Inspector/InspectorCard.module.css`
- Test: `src/components/Inspector/InspectorCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/components/Inspector/InspectorCard.test.tsx`:

```tsx
import { TooltipProvider } from "../Tooltip/Tooltip";
import type { InspectorCardProps } from "./InspectorCard";

function renderCard(props: Partial<InspectorCardProps> = {}) {
  return render(
    <TooltipProvider>
      <InspectorCard name="Test" labelledById="test-h" {...props}>
        <button data-testid="inner-button">Click me</button>
      </InspectorCard>
    </TooltipProvider>,
  );
}

it("sets data-locked on the card body when locked=true", () => {
  const { container } = renderCard({ locked: true, lockedHint: "Pause to edit" });
  expect(container.querySelector("[data-locked='true']")).toBeInTheDocument();
});

it("makes the body inert when locked=true", () => {
  const { container } = renderCard({ locked: true, lockedHint: "Pause to edit" });
  expect(container.querySelector("[data-locked='true']")).toHaveAttribute("inert");
});

it("body is interactive when locked=false (default)", () => {
  const { container, getByTestId } = renderCard();
  expect(getByTestId("inner-button")).toBeEnabled();
  expect(container.querySelector("[data-locked='true']")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/Inspector/InspectorCard.test.tsx -t "locked"`
Expected: FAIL — `locked` / `lockedHint` props don't exist.

- [ ] **Step 3: Extend `InspectorCardProps` and JSX**

Edit `src/components/Inspector/InspectorCard.tsx` — add two props, wrap the body in `<Tooltip>` when locked, and set `inert` + `data-locked`:

```tsx
import type { ReactNode } from "react";
import clsx from "clsx";
import { Switch } from "../Switch/Switch";
import { Tooltip } from "../Tooltip/Tooltip";
import styles from "./InspectorCard.module.css";

export interface InspectorCardProps {
  name: string;
  description?: string;
  labelledById: string;
  active?: boolean;
  onToggle?: (next: boolean) => void;
  toggleLabel?: string;
  stateLabel?: string;
  actions?: ReactNode;
  bodyClassName?: string;
  /**
   * When true, the card body becomes non-interactive (HTML5 `inert`) and
   * visually dims. Pair with `lockedHint` to explain how to unlock.
   * Independent of `active` (which dims via the master toggle).
   */
  locked?: boolean;
  /** Tooltip content shown when hovering the locked body. Required when locked=true. */
  lockedHint?: ReactNode;
  children: ReactNode;
}

export function InspectorCard({
  name,
  description,
  labelledById,
  active,
  onToggle,
  toggleLabel,
  stateLabel,
  actions,
  bodyClassName,
  locked = false,
  lockedHint,
  children,
}: InspectorCardProps) {
  const hasToggle = onToggle !== undefined && toggleLabel !== undefined && active !== undefined;
  const isActive = hasToggle ? active : true;

  const body = (
    <div
      className={clsx(styles.cardBody, bodyClassName)}
      data-locked={locked ? "true" : undefined}
      // React 19 accepts `inert` as a prop. `inert=""` matches the HTML5 spec.
      {...(locked ? { inert: "" } : {})}
    >
      {children}
    </div>
  );

  return (
    <section
      className={styles.card}
      data-active={isActive ? "true" : "false"}
      aria-labelledby={labelledById}
    >
      <header className={styles.cardHead}>
        {hasToggle ? <Switch label={toggleLabel} checked={active} onChange={onToggle} /> : null}
        <h3 id={labelledById} className={styles.cardName}>{name}</h3>
        {stateLabel ? <span className={styles.cardState} aria-hidden="true">{stateLabel}</span> : null}
        {description ? <span className={styles.cardDesc}>{description}</span> : <span className={styles.cardDesc} aria-hidden="true" />}
        {actions ? <div className={styles.cardHeadActions}>{actions}</div> : null}
      </header>
      {locked && lockedHint ? <Tooltip content={lockedHint}>{body}</Tooltip> : body}
    </section>
  );
}
```

- [ ] **Step 4: Add CSS rules**

Append to `src/components/Inspector/InspectorCard.module.css`:

```css
.cardBody[data-locked="true"] {
  opacity: 0.42;
  cursor: not-allowed;
  /* Outer body accepts pointer events so cursor + tooltip work; every direct
     child has pointer-events:none so the user can't interact with anything
     below. `inert` already covers focus + screen reader exclusion. */
  pointer-events: auto;
}

.cardBody[data-locked="true"] > * {
  pointer-events: none;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/components/Inspector/InspectorCard.test.tsx`
Expected: all cases PASS (existing + new).

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/InspectorCard.tsx src/components/Inspector/InspectorCard.module.css src/components/Inspector/InspectorCard.test.tsx
git commit -m "feat(inspector-card): add locked prop + lockedHint tooltip"
```

### Task R1-T2: Switch SongControls KEY + PROGRESSION cards to card-level lock

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`
- Modify: `src/components/SongControls/SongControls.test.tsx`
- Modify: `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/types.ts`

- [ ] **Step 1: Add the i18n key**

Edit `src/i18n/types.ts` — add to the `controls` interface:

```ts
controls: {
  // ... existing keys ...
  lockedHint: string;
};
```

Edit `src/i18n/en.ts`:

```ts
lockedHint: "Pause playback to edit",
```

Edit `src/i18n/es.ts`:

```ts
lockedHint: "Pausa la reproducción para editar",
```

- [ ] **Step 2: Write the failing tests**

Replace the existing per-control "disables structural-edit controls" test in `src/components/SongControls/SongControls.test.tsx` with these two card-level assertions:

```tsx
it("locks the KEY and PROGRESSION cards while progression is playing", () => {
  const store = createStore();
  store.set(progressionStepsAtom, [{ id: "a", root: "C", quality: "M", duration: { value: 1, unit: "bar" } }]);
  store.set(progressionPlayingStateAtom, true);

  render(
    <Provider store={store}>
      <SongControls />
    </Provider>,
  );

  const keyCard = screen.getByRole("region", { name: /key/i });
  const progressionCard = screen.getByRole("region", { name: /progression/i });

  expect(keyCard.querySelector("[data-locked='true']")).toBeInTheDocument();
  expect(progressionCard.querySelector("[data-locked='true']")).toBeInTheDocument();
});

it("does NOT lock the TIME or BACKING TRACK cards while playing", () => {
  const store = createStore();
  store.set(progressionPlayingStateAtom, true);

  render(
    <Provider store={store}>
      <SongControls />
    </Provider>,
  );

  const timeCard = screen.getByRole("region", { name: /time/i });
  const backingCard = screen.getByRole("region", { name: /backing/i });

  expect(timeCard.querySelector("[data-locked='true']")).toBeNull();
  expect(backingCard.querySelector("[data-locked='true']")).toBeNull();
});
```

(Delete the old `disables structural-edit controls while progression is playing` test from P1-T3 — it's superseded.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/components/SongControls/SongControls.test.tsx -t "locks the KEY"`
Expected: FAIL.

- [ ] **Step 4: Implement — replace per-control `disabled={editsLocked}` with card-level `locked={editsLocked}`**

In `src/components/SongControls/SongControls.tsx`:

(a) **KEY InspectorCard** — add `locked` + `lockedHint`, strip per-control `disabled={editsLocked}`:

```tsx
<InspectorCard
  name={t("inspector.groupKey")}
  description={t("inspector.groupKeyDesc")}
  labelledById="song-key-heading"
  locked={editsLocked}
  lockedHint={t("controls.lockedHint")}
>
  <PropGrid columns={6}>
    <Prop label={t("controls.root")} span={3}>
      <LabeledSelect
        label={t("controls.root")}
        hideLabel
        width="fill"
        value={rootNote}
        onChange={handleRootNote}
        options={NOTES.map((note) => ({
          value: note,
          label: getNoteDisplay(note, rootNote, preferFlats),
        }))}
      />
    </Prop>
    <Prop label={t("inspector.scaleLabel")} span={3}>
      <LabeledSelect
        label={t("inspector.scaleLabel")}
        value={scaleName}
        groups={scaleGroups}
        onChange={handleScaleName}
        hideLabel
      />
    </Prop>
  </PropGrid>
</InspectorCard>
```

(b) **PROGRESSION InspectorCard** — same pattern; add `locked={editsLocked}` + `lockedHint={t("controls.lockedHint")}`. Then go through every child and revert the per-control `disabled={... || editsLocked}` predicates to their pre-P1-T3 form:

| Control | Predicate after revert |
|---|---|
| Preset `LabeledSelect` | _drop_ `disabled` (originally had none) |
| Add chord button | _drop_ `disabled` (originally had none) |
| Move-up button | `disabled={!activeStep || activeProgressionStepIndex === 0}` |
| Move-down button | `disabled={!activeStep || activeProgressionStepIndex === progressionSteps.length - 1}` |
| Duplicate button | `disabled={!activeStep}` |
| Remove button | `disabled={!activeStep}` |
| Pip-row tabs | _drop_ `disabled` |
| `DegreeGrid` | _drop_ `disabled` prop |
| Quality `LabeledSelect` | _drop_ `disabled` |
| Duration `StepperControl` | _drop_ `disabled` |
| Duration `ToggleBar` | _drop_ `disabled` |

(c) `const editsLocked = progressionPlaying;` stays — it now feeds two `locked={...}` props instead of 13 `disabled={...}`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/components/SongControls/SongControls.test.tsx`
Expected: all green.

- [ ] **Step 6: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/SongControls/SongControls.tsx src/components/SongControls/SongControls.test.tsx src/i18n/en.ts src/i18n/es.ts src/i18n/types.ts
git commit -m "refactor(song-controls): card-level lock + tooltip replaces per-control disabled"
```

---

## Phase R2 — Stop Button

Adds a Stop button between Prev and Play that atomically sets `playing=false` + `activeProgressionStepIndex=0` (i.e., return to bar 1). Stop is disabled when there's nothing to stop (not playing AND already at bar 1). Wrap Play + Stop in `<Tooltip>` to clarify intent — pairs with R1's lockedHint tooltip in establishing a tooltip-first UX pattern for ambiguous controls.

### Task R2-T1: Add `stopProgressionPlaybackAtom`

**Files:**
- Modify: `src/store/progressionAtoms.ts`
- Test: `src/store/progressionAtoms.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/store/progressionAtoms.test.ts`:

```ts
import { stopProgressionPlaybackAtom } from "./progressionAtoms";

describe("stopProgressionPlaybackAtom", () => {
  it("sets playing=false and activeIndex=0 atomically", () => {
    const store = createStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(activeProgressionStepIndexAtom, 3);

    store.set(stopProgressionPlaybackAtom);

    expect(store.get(progressionPlayingStateAtom)).toBe(false);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });

  it("is idempotent when already stopped at index 0", () => {
    const store = createStore();
    store.set(stopProgressionPlaybackAtom);
    expect(store.get(progressionPlayingStateAtom)).toBe(false);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/store/progressionAtoms.test.ts -t "stopProgressionPlaybackAtom"`
Expected: FAIL — atom doesn't exist.

- [ ] **Step 3: Implement the atom**

In `src/store/progressionAtoms.ts`, near `setProgressionPlayingAtom`:

```ts
/**
 * Atomic "stop": set playing=false AND active step index=0. The orchestrator's
 * Effect 1 tear-down path will dispose the Tone Parts because playing flipped
 * false; the activeIndex reset is what distinguishes Stop from Pause.
 */
export const stopProgressionPlaybackAtom = atom(null, (_get, set) => {
  set(progressionPlayingStateAtom, false);
  set(activeProgressionStepIndexAtom, 0);
  set(progressionStepDeadlineAtom, null);
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/store/progressionAtoms.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/store/progressionAtoms.ts src/store/progressionAtoms.test.ts
git commit -m "feat(progression): add stopProgressionPlaybackAtom"
```

### Task R2-T2: Add Stop button to TransportBar with tooltips on play/pause/stop

**Files:**
- Modify: `src/components/TransportBar/TransportBar.tsx`
- Test: `src/components/TransportBar/TransportBar.test.tsx`
- Modify: `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/types.ts`

- [ ] **Step 1: Add i18n keys**

`src/i18n/types.ts` — extend `controls`:

```ts
controls: {
  // ... existing keys ...
  stopProgression: string;
  playProgressionTooltip: string;
  pauseProgressionTooltip: string;
  stopProgressionTooltip: string;
};
```

`src/i18n/en.ts`:

```ts
stopProgression: "Stop",
playProgressionTooltip: "Play",
pauseProgressionTooltip: "Pause",
stopProgressionTooltip: "Stop and return to bar 1",
```

`src/i18n/es.ts`:

```ts
stopProgression: "Detener",
playProgressionTooltip: "Reproducir",
pauseProgressionTooltip: "Pausar",
stopProgressionTooltip: "Detener y volver al compás 1",
```

- [ ] **Step 2: Write the failing tests**

Add to `src/components/TransportBar/TransportBar.test.tsx`:

```tsx
it("renders a Stop button next to Play", () => {
  renderWithStore(<TransportBar />, makeAtomStore());
  expect(screen.getByLabelText(/^stop$/i)).toBeInTheDocument();
});

it("Stop button is disabled when not playing AND activeIndex is already 0", () => {
  const store = makeAtomStore();
  store.set(progressionPlayingStateAtom, false);
  store.set(activeProgressionStepIndexAtom, 0);
  renderWithStore(<TransportBar />, store);
  expect(screen.getByLabelText(/^stop$/i)).toBeDisabled();
});

it("Stop button is enabled when activeIndex > 0 even if paused", () => {
  const store = makeAtomStore();
  store.set(progressionPlayingStateAtom, false);
  store.set(activeProgressionStepIndexAtom, 2);
  renderWithStore(<TransportBar />, store);
  expect(screen.getByLabelText(/^stop$/i)).toBeEnabled();
});

it("clicking Stop sets playing=false and activeIndex=0", () => {
  const store = makeAtomStore();
  store.set(progressionPlayingStateAtom, true);
  store.set(activeProgressionStepIndexAtom, 3);
  renderWithStore(<TransportBar />, store);

  fireEvent.click(screen.getByLabelText(/^stop$/i));

  expect(store.get(progressionPlayingStateAtom)).toBe(false);
  expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/components/TransportBar/TransportBar.test.tsx -t "Stop"`
Expected: FAIL.

- [ ] **Step 4: Implement the Stop button + tooltip wrappers**

In `src/components/TransportBar/TransportBar.tsx`:

(a) Imports:

```ts
import {
  AudioWaveform,
  Drum,
  Guitar,
  Loader2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Square,
  Timer,
} from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import { Tooltip } from "../Tooltip/Tooltip";
import {
  activeProgressionStepIndexAtom,
  progressionPlaybackLoadingAtom,
  stopProgressionPlaybackAtom,
} from "../../store/progressionAtoms";
import { useTranslation } from "../../hooks/useTranslation";
```

(b) Reads + setter inside the component:

```ts
const { t } = useTranslation();
const stopProgressionPlayback = useSetAtom(stopProgressionPlaybackAtom);
const activeIndex = useAtomValue(activeProgressionStepIndexAtom);
const stopDisabled = !canPlay || (!progressionPlaying && activeIndex === 0);
```

(c) Insert Stop between Prev and Play; wrap Play + Stop in `<Tooltip>`:

```tsx
<button
  type="button"
  className={styles.transportButton}
  onClick={() => previousProgressionStep()}
  disabled={!canPlay || progressionPlaying}
  aria-label="Previous chord"
>
  <SkipBack size={13} strokeWidth={2.4} aria-hidden="true" />
</button>

<Tooltip content={t("controls.stopProgressionTooltip")}>
  <button
    type="button"
    className={styles.transportButton}
    onClick={() => stopProgressionPlayback()}
    disabled={stopDisabled}
    aria-label={t("controls.stopProgression")}
  >
    <Square size={13} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
  </button>
</Tooltip>

<Tooltip content={progressionPlaying ? t("controls.pauseProgressionTooltip") : t("controls.playProgressionTooltip")}>
  <button
    type="button"
    className={clsx(styles.transportButton, styles.playButton, progressionPlaying && styles["transportButton--accent"])}
    onClick={() => setProgressionPlaying(!progressionPlaying)}
    disabled={!canPlay}
    aria-label={progressionPlaying ? "Pause progression" : "Play progression"}
    aria-busy={progressionPlaybackLoading || undefined}
  >
    {progressionPlaybackLoading ? (
      <Loader2 size={14} strokeWidth={2.4} aria-hidden="true" className={styles.spinner} data-testid="transport-play-spinner" />
    ) : progressionPlaying ? (
      <Pause size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
    ) : (
      <Play size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
    )}
  </button>
</Tooltip>
```

(Radix Tooltip's `asChild` forwards trigger semantics to the underlying button so a11y is preserved.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/components/TransportBar/TransportBar.test.tsx`
Expected: all PASS (existing + new).

- [ ] **Step 6: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/TransportBar/TransportBar.tsx src/components/TransportBar/TransportBar.test.tsx src/i18n/en.ts src/i18n/es.ts src/i18n/types.ts
git commit -m "feat(transport): add stop button with tooltips on play/pause/stop"
```

---

## Phase R3 — Stutter + Degradation Fixes (Research Findings)

The deferred Q3 investigation produced `docs/superpowers/research/2026-05-25-playback-degradation.md` with two high-confidence root causes:

- **Symptom 1 (audio degradation):** `src/progressions/audio/string.ts:43-72` allocates a brand-new `Tone.PluckSynth` every strum note with no pool — the only voice in the package that skipped the `createReusableVoicePool` migration. ~64 PluckSynth construct/dispose cycles per bar at default tempo with a 1.1s overlap. **R3-T3 fixes this.**
- **Symptom 2 (chord-transition stutter):** `chordOverlayAtoms` returns a freshly-built `Set<string>` / voicings array on every chord change, defeating both React Compiler auto-memoization and the manual `memo()` on `FretboardSVG` (added pre-Compiler in PR #388, never removed in the Compiler adoption PR #456). **R3-T1 + R3-T2 fix this.**

The big in-flight change since the research was written is `0e2bd21c perf(core): replace DFS voicing search with O(1) mathematical geometry engine` (and the related memoization in `3d6c350d`). That kills H7 (voicing engine compute time) as a contributor — the per-chord voicing search is now O(1) instead of O(n) DFS. **However, the structural issue (Set/array ref freshness defeats memoization) remains** because the atom still builds a fresh `Set` per evaluation, and downstream geometry hooks still re-run when their `Set` input changes by reference. R3-T1 + R3-T2 stay relevant.

After this phase, profile in a real browser before deciding whether to also defer the React commit off the audio-sync frame (the optional step 3 from the research). That's a "measure first" decision, not adopted here.

### Task R3-T1: Stabilize `chordHighlightPositionsAtom` by content-fingerprint

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts`
- Test: `src/store/chordOverlayAtoms.test.ts` (create if it doesn't exist)

- [ ] **Step 1: Confirm test file path + existing patterns**

Run: `ls src/store/chordOverlayAtoms.test.ts 2>&1 && grep -n "chordHighlightPositionsAtom" src/store/chordOverlayAtoms.test.ts 2>&1 | head -5`

If no test file exists, create one with the project's standard `createStore` + atom-set pattern (mirror `src/store/progressionAtoms.test.ts`).

- [ ] **Step 2: Write the failing test**

Add to `src/store/chordOverlayAtoms.test.ts`:

```ts
import { createStore } from "jotai";
import { chordHighlightPositionsAtom, chordRootAtom, chordQualityAtom } from "./chordOverlayAtoms";

describe("chordHighlightPositionsAtom referential stability", () => {
  it("returns the SAME Set reference on consecutive reads with no atom changes", () => {
    const store = createStore();
    store.set(chordRootAtom, "C");
    store.set(chordQualityAtom, "M");
    const first = store.get(chordHighlightPositionsAtom);
    const second = store.get(chordHighlightPositionsAtom);
    expect(second).toBe(first); // identity, not just equality
  });

  it("returns the SAME Set reference after a setter writes a value-equal state", () => {
    // Touch an unrelated atom that causes chordHighlightPositionsAtom to
    // re-evaluate, but the inputs that determine the highlight set haven't
    // changed in value. Without the cache, this returns a fresh Set; with
    // the cache, it returns the prior Set reference.
    const store = createStore();
    store.set(chordRootAtom, "C");
    store.set(chordQualityAtom, "M");
    const first = store.get(chordHighlightPositionsAtom);
    store.set(chordRootAtom, "C"); // no-op value change
    const second = store.get(chordHighlightPositionsAtom);
    expect(second).toBe(first);
  });

  it("returns a DIFFERENT Set reference when the underlying highlight content changes", () => {
    const store = createStore();
    store.set(chordRootAtom, "C");
    store.set(chordQualityAtom, "M");
    const first = store.get(chordHighlightPositionsAtom);
    store.set(chordRootAtom, "G");
    const second = store.get(chordHighlightPositionsAtom);
    expect(second).not.toBe(first);
  });
});
```

(Confirm the exact atom names — `chordRootAtom`, `chordQualityAtom` — by reading `src/store/chordOverlayAtoms.ts`. If they're named differently, use the actual names.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts -t "referential stability"`
Expected: FAIL on the first two tests (second call returns a fresh `Set`).

- [ ] **Step 4: Implement — value-fingerprint cache**

In `src/store/chordOverlayAtoms.ts`, find `chordHighlightPositionsAtom` (around line 545-583 per the research doc — verify by `grep -n`). Wrap the `new Set(...)` builder with a module-scoped cache keyed on a content fingerprint.

The pattern:

```ts
// Module-scoped cache: holds the last computed Set + a fingerprint of the
// inputs that determined it. Returning the cached reference (instead of a
// fresh Set each evaluation) lets React Compiler's auto-memoization actually
// short-circuit downstream consumers (FretboardSVG, useChordConnectorPolylines,
// useNoteData) when the chord highlight set is value-equal.
let cachedHighlightSet: Set<string> = new Set();
let cachedHighlightKey = "";

export const chordHighlightPositionsAtom = atom((get) => {
  // ... existing derivation that produces an array / Set of position keys ...
  const positionKeys: string[] = /* whatever the existing builder yields */;

  // Build the new fingerprint by sorting + joining (stable across iteration order).
  const sortedKeys = [...positionKeys].sort();
  const fingerprint = sortedKeys.join("|");

  if (fingerprint === cachedHighlightKey) {
    return cachedHighlightSet;
  }
  cachedHighlightKey = fingerprint;
  cachedHighlightSet = new Set(sortedKeys);
  return cachedHighlightSet;
});
```

Read the existing atom body first and adapt — the goal is "build the same content, but return the cached reference when fingerprint matches." If the atom currently does `return new Set([...generated])`, replace that with the cache check.

If the atom is a `selectAtom`-style derivation, the same fingerprint pattern works inside the derived getter.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts -t "referential stability"`
Expected: all 3 PASS.

- [ ] **Step 6: Run the wider atom + chord-overlay test surface to check for regressions**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts src/components/FretboardSVG/`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/store/chordOverlayAtoms.ts src/store/chordOverlayAtoms.test.ts
git commit -m "perf(chord-overlay): stabilize Set reference by content fingerprint"
```

### Task R3-T2: Drop the manual `memo()` wrapper from `FretboardSVG`

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx`

The manual `memo()` wrapper at `FretboardSVG.tsx:141` predates React Compiler. PR #388 added it (`1b06e9eb perf(fretboard): optimize animation performance`) before the Compiler existed; PR #456 (`41dba986 perf(react): adopt react-compiler app-wide`) turned the Compiler on with `compilationMode: 'infer'` but never removed the wrapper. With R3-T1 making the upstream `Set` reference stable, the Compiler's auto-memoization now correctly short-circuits — the manual wrapper becomes pure overhead (cost of shallow-equality check, no payoff). Per `CLAUDE.md`: *"manual useMemo / useCallback / React.memo is rarely needed for render-perf and should be added only when profiling proves it."*

- [ ] **Step 1: Read the relevant lines**

Run: `grep -n "memo\|^import\|^export" src/components/FretboardSVG/FretboardSVG.tsx | head -10`

Expected output includes:
```
1:import { useId, useMemo, useCallback, memo, type CSSProperties } from "react";
141:export const FretboardSVG = memo(function FretboardSVG({
```

- [ ] **Step 2: Remove the `memo` wrapper**

Edit `src/components/FretboardSVG/FretboardSVG.tsx`:

(a) Change line 1 — drop `memo` from the React imports:

```ts
import { useId, useMemo, useCallback, type CSSProperties } from "react";
```

(b) Change line 141 — replace the `memo` wrapper with a plain function export:

```tsx
export function FretboardSVG({
  // ... existing destructured props ...
}) {
  // ... existing body, ends with `}`
}
```

(That is: replace `export const FretboardSVG = memo(function FretboardSVG({` with `export function FretboardSVG({`, and remove the closing `)` of the `memo(` wrapper at the end of the function.)

- [ ] **Step 3: Run lint to confirm no unused imports + no rule violations**

Run: `pnpm lint`
Expected: clean. (If the React Compiler ESLint rule fires, the fix is correct — the rule should now be satisfied because the function is no longer manually-wrapped.)

- [ ] **Step 4: Run the broader test suite to ensure no behavior regression**

Run: `pnpm vitest run src/components/FretboardSVG/ src/components/Fretboard/`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.tsx
git commit -m "refactor(fretboard-svg): drop manual memo; trust react-compiler"
```

### Task R3-T3: Pool `Tone.PluckSynth` in `string.ts`

**Files:**
- Modify: `src/progressions/audio/string.ts`
- Test: `src/progressions/audio/string.test.ts`

Every other voice in the package (`bass.ts`, `drumKit.ts`, the chord voices in `instruments/`) uses `createReusableVoicePool` to lease + reuse synth instances. `string.ts` is the only outlier — it constructs a new `PluckSynth` per note with `setTimeout(dispose, 1100ms)`. The research confirmed this is the leading hypothesis for audio degradation over many loops (64+ PluckSynth nodes in flight per bar, accumulating until the dispose timeouts catch up).

- [ ] **Step 1: Read the existing `string.ts` + reference `bass.ts` pool pattern**

Run:
```bash
cat src/progressions/audio/string.ts src/progressions/audio/bass.ts
```

Identify the lease pattern in `bass.ts` (`createReusableVoicePool`, `lease(dest, now)`, `setBusyUntil`, `dispose`). The strum equivalent should follow the same shape.

- [ ] **Step 2: Write the failing test**

Add to `src/progressions/audio/string.test.ts` (create the file if it doesn't exist):

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { pluckString } from "./string";

// Minimal AudioContext + Tone mocks; mirror src/progressions/audio/timeline.test.ts.
// This is a smoke test for pool reuse — we don't actually run audio.
// The point: after N successive plucks against the same destination, the
// number of PluckSynth instances created is bounded by the peak concurrent
// `busyUntil` count, NOT by N.

vi.mock("tone", async () => {
  const actual = await vi.importActual<typeof import("tone")>("tone");
  let pluckCount = 0;
  class MockPluckSynth {
    constructor() { pluckCount++; }
    static get count() { return pluckCount; }
    static reset() { pluckCount = 0; }
    connect() { return this; }
    triggerAttack() {}
    triggerRelease() {}
    dispose() {}
    get volume() { return { value: 0 }; }
  }
  return { ...actual, PluckSynth: MockPluckSynth };
});

it("pool reuses PluckSynth across non-overlapping plucks against the same dest", () => {
  const dest = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;
  const { PluckSynth } = await import("tone");
  (PluckSynth as unknown as { reset: () => void }).reset();

  // Pluck 5 times in sequence with non-overlapping times.
  for (let i = 0; i < 5; i++) {
    pluckString(dest, 440, i * 2, { velocity: 0.8 });
  }

  // Pool should reuse the same voice — final live count <= peak concurrent (1)
  // since hits don't overlap. Without pooling, count would be 5.
  expect((PluckSynth as unknown as { count: number }).count).toBeLessThan(5);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/string.test.ts -t "pool reuses"`
Expected: FAIL — count is 5 (no pooling today).

- [ ] **Step 4: Implement — wrap `pluckString` in `createReusableVoicePool`**

Rewrite `src/progressions/audio/string.ts` to follow the `bass.ts` pattern. Approximate shape (adapt to existing `pluckString` signature):

```ts
import * as Tone from "tone";
import { createReusableVoicePool } from "./createReusableVoicePool";

const RELEASE_TAIL_SEC = 1.1;

interface PluckVoice {
  synth: Tone.PluckSynth;
  connect(dest: AudioNode): void;
  dispose(): void;
}

function createPluckVoice(): PluckVoice {
  const synth = new Tone.PluckSynth({
    attackNoise: 1,
    dampening: 4000,
    resonance: 0.7,
  });
  return {
    synth,
    connect(dest: AudioNode) { synth.connect(dest); },
    dispose() { synth.dispose(); },
  };
}

const pool = createReusableVoicePool<PluckVoice>({ createVoice: createPluckVoice });

export interface PluckOptions {
  velocity?: number;
}

export function pluckString(
  dest: AudioNode,
  frequency: number,
  startTime: number,
  opts: PluckOptions = {},
): void {
  const now = Tone.now();
  const lease = pool.lease(dest, Math.max(now, startTime));
  const velocity = opts.velocity ?? 0.8;
  lease.voice.synth.volume.value = Tone.gainToDb(velocity);
  lease.voice.synth.triggerAttack(frequency, startTime);
  lease.setBusyUntil(startTime + RELEASE_TAIL_SEC);
}
```

(The exact `Tone.PluckSynth` options + `pluckString` signature must match what `strumVoice.ts` passes today — read `src/progressions/audio/instruments/strumVoice.ts:18-24` to confirm the call shape before refactoring.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/string.test.ts -t "pool reuses"`
Expected: PASS — count is bounded (likely 1 or 2).

- [ ] **Step 6: Run the broader audio + strum-voice test surface**

Run: `pnpm vitest run src/progressions/audio/`
Expected: all green (the changes are isolated to `string.ts`'s internals; `pluckString`'s signature is preserved).

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/string.ts src/progressions/audio/string.test.ts
git commit -m "perf(audio): pool Tone.PluckSynth to stop audio-graph churn over loops"
```

---

## Phase R4 — Time-Signature-Aware Loop (Metronome via Tone.Part)

**The bug (user-reported in round-2):** the metronome `Tone.Loop("4n", ...)` fires on its own quarter-note schedule, independent of the chord/bass/drum Parts' `loopEnd`. So when the time signature is anything other than 4/4 — or when `totalDurationSec` doesn't fall on a quarter-note boundary — the metronome keeps clicking past the natural loop end before its own next iteration.

**The fix:** treat the metronome like the bass/drum layers — generate explicit per-beat events in `buildAllLayers`, schedule via a 5th `Tone.Part`. The Part loops at the same `loopEnd = totalDurationSec` boundary, so the metronome wraps to beat 1 in lock-step with the chord onsets. The metronome's beat-in-bar accent comes from the event payload (`beatInBar: 1..beatsPerBar`), not from an orchestrator-owned counter.

**Caveat:** with metronome events baked into the Part, the metronome event stream depends on `beatsPerBar`. So R4 adds `beatsPerBar` to `buildKey`, which makes live time-signature changes rebuild the Parts. That regresses round-1's P5 live-time-signature setter — accepted tradeoff: correctness over smoothness. A future round could rebuild ONLY the metronome Part on `beatsPerBar` change (a dedicated effect) if the rebuild glitch is noticeable in practice.

### Task R4-T1: Emit a `metronome` event stream from `buildAllLayers`

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts`
- Test: `src/progressions/audio/buildAllLayers.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/progressions/audio/buildAllLayers.test.ts`:

```ts
it("emits one metronome event per beat across totalDurationSec, with beatInBar 1-based and bar-cyclic (3/4)", () => {
  const built = buildAllLayers({
    steps: [{ id: "a", root: "C", quality: "M", duration: { value: 1, unit: "bar" } }],
    tempoBpm: 60,
    beatsPerBar: 3,
    swing: 0,
    chordPatternId: "ballad-whole",
    bassPatternId: "root-fifth",
    drumPatternId: "rock",
    drumVariations: [],
    loop: false,
  });

  // 1 bar of 3/4 at 60 BPM = 3 seconds = 3 beats.
  expect(built.metronome).toHaveLength(3);
  expect(built.metronome[0]).toMatchObject({ time: 0, value: { beatInBar: 1 } });
  expect(built.metronome[1]).toMatchObject({ time: 1, value: { beatInBar: 2 } });
  expect(built.metronome[2]).toMatchObject({ time: 2, value: { beatInBar: 3 } });
});

it("metronome beatInBar wraps to 1 every beatsPerBar beats across multi-bar progressions", () => {
  const built = buildAllLayers({
    steps: [{ id: "a", root: "C", quality: "M", duration: { value: 2, unit: "bar" } }],
    tempoBpm: 60,
    beatsPerBar: 3,
    swing: 0,
    chordPatternId: "ballad-whole",
    bassPatternId: "root-fifth",
    drumPatternId: "rock",
    drumVariations: [],
    loop: false,
  });

  // 2 bars × 3 beats = 6 events; pattern: 1,2,3,1,2,3
  expect(built.metronome).toHaveLength(6);
  expect(built.metronome.map((e) => e.value.beatInBar)).toEqual([1, 2, 3, 1, 2, 3]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts -t "metronome"`
Expected: FAIL — `built.metronome` is undefined.

- [ ] **Step 3: Implement — add `MetronomeEvent` type, emit array**

In `src/progressions/audio/buildAllLayers.ts`:

(a) Add to the exported types:

```ts
export interface MetronomeEvent {
  /** 1-based, cycles 1..beatsPerBar. Beat 1 is the bar downbeat (consumer
   *  switches to accent click). */
  beatInBar: number;
}
```

(b) Extend `BuiltLayers`:

```ts
export interface BuiltLayers {
  chordOnsets: Array<{ time: number; value: ChordOnsetEvent }>;
  chordStrums: Array<{ time: number; value: ChordStrumEvent }>;
  bass: Array<{ time: number; value: BassEvent }>;
  drums: Array<{ time: number; value: DrumEvent }>;
  metronome: Array<{ time: number; value: MetronomeEvent }>;  // ← NEW
  totalDurationSec: number;
}
```

(c) Inside `buildAllLayers`, after declaring `const drums = ...`:

```ts
const metronome: Array<{ time: number; value: MetronomeEvent }> = [];
```

(d) At the END of the function (just before `return`), generate per-beat events spanning `cumulativeSec`:

```ts
const totalBeats = Math.round(cumulativeSec / secondsPerBeat);
for (let beat = 0; beat < totalBeats; beat++) {
  metronome.push({
    time: beat * secondsPerBeat,
    value: { beatInBar: (beat % input.beatsPerBar) + 1 },
  });
}
```

(e) Add `metronome` to the return:

```ts
return {
  chordOnsets,
  chordStrums,
  bass,
  drums,
  metronome,
  totalDurationSec: cumulativeSec,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(audio): emit per-beat metronome event stream from buildAllLayers"
```

### Task R4-T2: Schedule the metronome as a `Tone.Part`; delete the Loop wrapper

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`
- Modify: `src/hooks/useProgressionAudioPlayback.test.tsx`
- Modify: `src/progressions/audio/progressionAudioEngine.ts` — drop `createMetronomeLoop` / `MetronomeLoopHandle` re-exports; add `MetronomeEvent` to the type re-exports.
- Delete: `src/progressions/audio/progressionMetronomeLoop.ts`
- Delete: `src/progressions/audio/progressionMetronomeLoop.test.ts`

- [ ] **Step 1: Update the engine barrel**

Edit `src/progressions/audio/progressionAudioEngine.ts`:

(a) Remove these lines:
```ts
export { createMetronomeLoop } from "./progressionMetronomeLoop";
export type { MetronomeLoopHandle } from "./progressionMetronomeLoop";
import type { MetronomeLoopHandle } from "./progressionMetronomeLoop";
```

(b) Add `MetronomeEvent` to the type re-exports from `./buildAllLayers`:

```ts
export type { BassEvent, ChordOnsetEvent, ChordStrumEvent, DrumEvent, MetronomeEvent } from "./buildAllLayers";
```

(c) Remove `loop: MetronomeLoopHandle | null;` from `PlaybackPrimitives`:

```ts
export interface PlaybackPrimitives {
  parts: ProgressionPartHandle[];
  endEventId: number | null;
  totalDurationSec: number;
}
```

(d) Remove `prims.loop?.dispose();` from `disposeAll`.

- [ ] **Step 2: Write the failing test in the orchestrator suite**

Edit `src/hooks/useProgressionAudioPlayback.test.tsx`. Find the existing test that asserts `toneMocks.loops.length === 1` (the metronome Loop assertion from round-1 P5-T1). Update to:

```tsx
it("schedules the metronome as a 5th Tone.Part (not a Tone.Loop)", async () => {
  const store = makeAtomStore([
    [rootNoteAtom, "C"],
    [scaleNameAtom, "major"],
    [progressionStepsAtom, threeBars],
    [progressionTempoBpmAtom, 60],
    [beatsPerBarAtom, 4],
  ]);
  store.set(setProgressionPlayingAtom, true);
  renderWithStore(<Harness />, store);

  await vi.waitFor(() => {
    expect(toneMocks.parts).toHaveLength(5);  // chord-onset, chord-strum, bass, drums, metronome
    expect(toneMocks.loops).toHaveLength(0);
  });
});

it("metronome Part loopEnd matches totalDurationSec (loops in sync with chord parts)", async () => {
  const store = makeAtomStore([
    [rootNoteAtom, "C"],
    [scaleNameAtom, "major"],
    [progressionStepsAtom, threeBars],
    [progressionTempoBpmAtom, 60],
    [beatsPerBarAtom, 3], // 3/4 time
    [progressionLoopEnabledAtom, true],
  ]);
  store.set(setProgressionPlayingAtom, true);
  renderWithStore(<Harness />, store);

  await vi.waitFor(() => {
    expect(toneMocks.parts).toHaveLength(5);
  });
  // Every Part's loopEnd equals totalDurationSec = 3 bars * 3 beats * 1 sec/beat = 9
  toneMocks.parts.forEach((p) => {
    expect(p.loopEnd).toBe(9);
  });
});
```

(Update the existing "constructs 4 Parts" test to expect 5 Parts and 0 Loops, OR delete it in favor of the new tests above.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx -t "metronome"`
Expected: FAIL — 4 Parts + 1 Loop today.

- [ ] **Step 4: Swap Loop for Part in the orchestrator**

In `src/hooks/useProgressionAudioPlayback.ts`:

(a) Update the type import (add `MetronomeEvent`):

```ts
import type {
  PlaybackPrimitives,
  BassEvent,
  ChordOnsetEvent,
  ChordStrumEvent,
  DrumEvent,
  MetronomeEvent,
  ProgressionPartHandle,
} from "../progressions/audio/progressionAudioEngine";
```

(b) Remove the `beatsPerBarRef` declaration + assignment (the metronome Part owns beat-in-bar via the event payload):

```ts
// DELETE: const beatsPerBarRef = useRef(beatsPerBar);
```

…and update Effect 4 to drop the ref write:

```ts
useEffect(() => {
  if (!engine) return;
  engine.setPlaybackTimeSignature(beatsPerBar);
}, [beatsPerBar]);
```

(c) Inside Effect 1's `.then(eng => { ... })`, replace the `createMetronomeLoop` block (around lines 224-233) with a 5th Part:

```ts
// 5. Metronome Part — explicit per-beat events spanning totalDurationSec
//    so the loop wraps in lock-step with the chord/bass/drum parts. Replaces
//    the prior Tone.Loop("4n", ...) which fired on an independent schedule
//    and clicked past the loop end whenever totalDurationSec didn't fall on
//    a quarter-note boundary.
const metronomePart = eng.createProgressionPart<MetronomeEvent>({
  events: built.metronome,
  loop: inputs.loopEnabled,
  loopEnd: totalDurationSec,
  onEvent: (audioTime, value) => {
    eng.scheduleClick(audio.layers.metronome, audioTime, {
      accent: value.beatInBar === 1,
    });
  },
});
metronomePart.start(partStart, 0);
parts.push(metronomePart);
```

(d) Update `primsRef.current` assignment to drop `loop`:

```ts
primsRef.current = { parts, endEventId, totalDurationSec };
```

(e) **Add `beatsPerBar` to `buildKey`** — the metronome event stream depends on `beatsPerBar`, so a live time-signature change must rebuild:

```ts
const buildKey = useMemo(
  () =>
    JSON.stringify({
      beatsPerBar,  // ← NEW: metronome event stream is baked per meter
      steps: steps.map((s) => ({
        root: s.root,
        quality: s.quality,
        dur: s.duration,
        unavailable: s.unavailable ?? false,
      })),
      chordPatternId,
      bassPatternId,
      drumPatternId,
      drumVariations,
    }),
  [beatsPerBar, steps, chordPatternId, bassPatternId, drumPatternId, drumVariations],
);
```

Also add `beatsPerBar` to the `buildInputsRef` tracked fields so the build path sees the up-to-date value.

- [ ] **Step 5: Delete the obsolete metronome-loop files**

```bash
rm src/progressions/audio/progressionMetronomeLoop.ts
rm src/progressions/audio/progressionMetronomeLoop.test.ts
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx src/progressions/audio/`
Expected: all green.

- [ ] **Step 7: Lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean. If any stale imports of `progressionMetronomeLoop` remain, fix them.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts src/hooks/useProgressionAudioPlayback.test.tsx src/progressions/audio/progressionAudioEngine.ts
git add -u src/progressions/audio/progressionMetronomeLoop.ts src/progressions/audio/progressionMetronomeLoop.test.ts
git commit -m "fix(audio): metronome loops in sync with chord parts (time-signature-aware)"
```

---

## Phase R5 — Investigation Follow-ups + Verification

Two quality-of-life follow-ups identified by the systematic-debugging session on 2026-05-25, plus final verification.

### Task R5-T1: Add dev-mode `console.warn` to the silent catch in `bus.ts`

**Files:**
- Modify: `src/progressions/audio/bus.ts`

The silent try/catch in `ensureProgressionAudio()` hid the P2-T1 `getDraw().expiration = 5` regression for the entire round-1 plan. The fix in commit `c12b0f34` moved that specific line out of the main try, but the main try is still completely silent — if a future change introduces another unexpected failure inside the bus init, it'll surface as "audio just doesn't work" with zero diagnostic. Add a `console.warn` in dev mode so the next regression surfaces immediately, while keeping production logs quiet.

- [ ] **Step 1: Read the current shape**

Run: `grep -n "catch\|console" src/progressions/audio/bus.ts | head -10`

- [ ] **Step 2: Write the failing test**

Add to `src/progressions/audio/bus.test.ts` (or `toneBus.test.ts`, wherever the existing bus tests live — confirm via `ls`):

```ts
import { _resetProgressionAudioForTests, ensureProgressionAudio } from "./bus";

it("logs a dev-mode warning when ensureProgressionAudio init throws", () => {
  _resetProgressionAudioForTests();
  // Force a throw inside the try: monkey-patch window.AudioContext to throw.
  const origCtor = (window as unknown as { AudioContext: unknown }).AudioContext;
  (window as unknown as { AudioContext: unknown }).AudioContext = vi.fn(() => {
    throw new Error("induced failure for warn-test");
  }) as unknown as typeof AudioContext;
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  const audio = ensureProgressionAudio();

  expect(audio).toBeNull();
  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining("[progression-audio]"),
    expect.any(Error),
  );

  warnSpy.mockRestore();
  (window as unknown as { AudioContext: unknown }).AudioContext = origCtor;
  _resetProgressionAudioForTests();
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/bus.test.ts -t "dev-mode warning"`
Expected: FAIL — console.warn isn't called today.

- [ ] **Step 4: Implement the warn**

Edit `src/progressions/audio/bus.ts` — change the main catch:

```ts
  try {
    ctx = new Ctor();
    bus = ctx.createGain();
    bus.gain.value = BUS_GAIN;
    bus.connect(ctx.destination);
    layers = buildLayerBuses(ctx, bus);
    bindToneToProgressionContext({ ctx, bus, layers });
  } catch (err) {
    // Dev-mode diagnostic — silent in production. The 2026-05-25 P2-T1
    // regression (Tone.Draw.expiration assignment on undefined) hid in this
    // try/catch for the entire round-1 plan because the catch logged
    // nothing. The console.warn flips a known-recoverable failure into an
    // observable one during development without polluting production logs.
    if (import.meta.env.DEV) {
      console.warn("[progression-audio] ensureProgressionAudio init failed:", err);
    }
    unsupported = true;
    ctx = null;
    bus = null;
    layers = null;
    return null;
  }
```

(Vitest sets `import.meta.env.DEV === true` by default, so the warn fires during the test.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/bus.test.ts`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/bus.ts src/progressions/audio/bus.test.ts
git commit -m "chore(audio): dev-mode warn on bus init failure for observability"
```

### Task R5-T2: Suppress `EnvironmentTeardownError` from lazy `import()` after teardown

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`

When vitest tears down the jsdom environment between tests, an in-flight `getEngine()` dynamic `import()` can still resolve and try to access the engine — vitest reports this as `EnvironmentTeardownError: Cannot load '/src/progressions/progressionAudio.ts' imported from /src/progressions/audio/buildAllLayers.ts after the environment was torn down`. It doesn't fail any test (the assertion phase is over by then), but it pollutes output and would mask a real failure if one occurred.

The fix: the cleanup function in Effect 1 already bumps `genRef.current++`, but the `getEngine().then(...)` callback only bails when `gen !== genRef.current` BEFORE touching the engine. If the dynamic import itself is in flight at teardown, the resolution lands on a torn-down environment first. We need to swallow the post-teardown rejection at the `.then().catch(...)` boundary so it doesn't bubble.

- [ ] **Step 1: Reproduce the warning baseline**

Run: `pnpm test 2>&1 | grep -A2 "EnvironmentTeardownError" | head -10`
Expected: at least one stack trace mentioning `progressionAudio.ts` import after teardown.

- [ ] **Step 2: Implement — chain a noop `.catch()` on the lazy import**

In `src/hooks/useProgressionAudioPlayback.ts`, find `getEngine` (around line 42):

```ts
async function getEngine(): Promise<AudioEngine> {
  if (!enginePromise) {
    enginePromise = import("../progressions/audio/progressionAudioEngine").then((mod) => {
      engine = mod;
      return mod;
    }).catch((err) => {
      console.error("getEngine import failed:", err);
      throw err;
    });
  }
  return enginePromise;
}
```

Update the catch to detect post-teardown rejections (their messages contain "after the environment was torn down" or "Cannot load") and swallow them silently — they're not real failures, just a vitest-internal race:

```ts
async function getEngine(): Promise<AudioEngine> {
  if (!enginePromise) {
    enginePromise = import("../progressions/audio/progressionAudioEngine").then((mod) => {
      engine = mod;
      return mod;
    }).catch((err: unknown) => {
      const msg = (err as Error)?.message ?? "";
      // Vitest tears down the jsdom env between tests; an in-flight dynamic
      // import can resolve into that void and reject with one of these
      // messages. They are NOT real failures — the caller bails via genRef
      // mismatch — but the rejection still bubbles as an unhandled error
      // and pollutes test output. Swallow them; re-throw anything else.
      if (msg.includes("after the environment was torn down") || msg.includes("Cannot load")) {
        // Reset the promise so a later getEngine() call retries.
        enginePromise = null;
        engine = null;
        return null as unknown as AudioEngine;
      }
      console.error("getEngine import failed:", err);
      throw err;
    });
  }
  return enginePromise;
}
```

And in Effect 1's `.then(eng => ...)`, add an early bail if `eng === null` (the post-teardown sentinel):

```ts
getEngine().then((eng) => {
  if (eng === null) return; // post-teardown noop (R5-T2)
  if (gen !== genRef.current) return;
  // ... existing body ...
});
```

- [ ] **Step 3: Verify the warning is gone**

Run: `pnpm test 2>&1 | grep "EnvironmentTeardownError"`
Expected: no matches.

- [ ] **Step 4: Run the full hook test suite to confirm no regression**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts
git commit -m "chore(audio): swallow vitest post-teardown rejection in lazy engine import"
```

### Task R5-T3: Full local verification + visual baseline refresh

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 2: Unit tests**

Run: `pnpm test`
Expected: ≥1975 pass + 1 skipped + 0 fail + 0 errors. The 9 timeline/playhead/readout failures were fixed by `c12b0f34`; R5-T2 silences the `EnvironmentTeardownError`. Net new tests from this plan: roughly +20 (R1+R2+R3+R4+R5 each add 2-5 cases).

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: clean. The `vendor-tone` chunk should remain separately code-split (introduced by the audio-lazy-load plan).

- [ ] **Step 4: E2E production**

Run: `pnpm test:e2e:production`
Expected: 50/50.

- [ ] **Step 5: Visual regression refresh**

The TransportBar gains a Stop button (R2-T2) and the SongControls KEY/PROGRESSION cards now have a `data-locked` body when playing (R1-T2). Snapshots that include those surfaces will need refresh. Run:

```bash
pnpm test:visual:update
pnpm test:visual
```

Inspect the diff: confirm Stop sits between Prev and Play, locked cards visibly dim. Radix tooltips render via portal so they shouldn't land in static snapshots — re-run if any look tooltip-contaminated.

- [ ] **Step 6: Commit visual baseline updates**

```bash
git add e2e/
git commit -m "test(visual): refresh baselines after stop button + card-level lock"
```

---

## Self-Review Notes

**Spec coverage:**
- Round-2 Q1 (card-level lock) → R1-T1, R1-T2 ✓
- Round-2 Q2 (Stop button + tooltips) → R2-T1, R2-T2 ✓
- Round-2 Q3 (deferred investigation) → now converted to R3-T1 (Set fingerprint), R3-T2 (drop memo), R3-T3 (pool PluckSynth) based on research findings ✓
- Round-2 Q4 (metronome loop sync) → R4-T1, R4-T2 ✓
- New: dev-mode warn on bus.ts silent catch → R5-T1 ✓
- New: suppress post-teardown lazy-import rejection → R5-T2 ✓
- Verification → R5-T3 ✓

**Changes from round-2 that this refresh accounts for:**
- O(1) voicing engine (`0e2bd21c`) — kills H7 from the research; R3-T1 + R3-T2 still relevant because reference freshness is the structural root cause regardless of compute cost. Updated R3 prose to note the partial mitigation.
- AudioContext pre-warm removed (`fcd8c137`) — no round-2 task referenced it; no changes needed.
- Lazy Tone.js loading — orchestrator is now async; R4-T2's metronome Part scheduling lands inside the existing `.then(eng => ...)` flow; updated the implementation snippets accordingly.
- Bus.ts Tone.Draw guard (`c12b0f34`) — already in place; R5-T1 builds on top with the warn.
- Metronome sync fix (`191d8222`) — addressed a different bug (first-play tempo init); R4 still needed.

**Placeholder scan:** clean. Every code-changing step has the code. R3-T1's atom rewrite block has a `/* whatever the existing builder yields */` placeholder for the existing derivation body — that's correct because the existing body is the source of truth, and the spec is "wrap it with a fingerprint cache." Implementer reads the file then applies the wrapper.

**Type consistency:**
- `MetronomeEvent` introduced in R4-T1, consumed in R4-T2. Single export name. Engine barrel re-export updated.
- `stopProgressionPlaybackAtom` introduced in R2-T1, consumed in R2-T2.
- `locked` + `lockedHint` props introduced in R1-T1, consumed in R1-T2.
- `cachedHighlightSet` + `cachedHighlightKey` are module-locals in R3-T1 only — no cross-task contract.
- `import.meta.env.DEV` (R5-T1) — vitest sets DEV=true; production build sets DEV=false. Confirmed via vite docs.

**Risk callouts:**
- R3-T1's atom fingerprint cache uses sorted-keys-join. If the position-key format ever changes to include characters that conflict with `|`, the fingerprint becomes ambiguous. Mitigation: pipe is safe today; if it becomes unsafe, switch to `JSON.stringify(sortedKeys)`. Not blocking.
- R3-T2 (drop manual `memo`) assumes R3-T1 lands first — without the upstream Set stability, dropping the memo would cause more re-renders, not fewer. Tasks land in order.
- R4-T2 adds `beatsPerBar` to `buildKey`, which makes live time-signature changes trigger a rebuild instead of just a Transport setter. Documented in R4's preamble; correctness > smoothness here.
- R5-T2's message-matching against "after the environment was torn down" couples to vitest's internal error text. If vitest renames the message in a future version, the swallow stops working and the warning returns. Mitigation: the test in R5-T2's verification step (`grep "EnvironmentTeardownError"` returns no matches) will catch the regression at upgrade time.

**Out of scope (call out if the user re-asks):**
- The optional step 3 from the research ("defer React commit off audio-sync frame via `startTransition`") is NOT in this plan. Once R3-T1+T2+T3 land, profile in a real browser; only adopt step 3 if measurable stutter remains.
- The `progressionStepDeadlineAtom` is still read by `practiceLensAtoms.ts:458` for a tension/decay effect but the Tone.Part rewrite no longer updates it. Lens visualisation may be stale during playback. Not user-reported; left for a follow-up.
- The `e2e/visual-helpers.ts` and similar test-utility surfaces are NOT touched — they only support visual regression and don't need updating for these changes.
