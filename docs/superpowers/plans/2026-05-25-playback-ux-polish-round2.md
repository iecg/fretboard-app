# Progression Playback UX Polish — Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Round-2 polish on top of `2026-05-25-playback-ux-polish.md`: replace per-control lock with card-level lock + tooltip, add a Stop button, fix the time-signature-aware loop length so the metronome doesn't continue past the loop, and scope a separate debugging investigation for the loop-degradation + chord-transition stutter (out of plan because root cause is unknown).

**Architecture:**

- **Q1** moves the lock semantics from 13 individual `disabled` props on SongControls primitives up to the `InspectorCard` boundary. Two cards become "locked" mid-play: KEY and PROGRESSION. A tooltip on the locked body explains how to unlock. Reverts the now-unused per-primitive `disabled` props introduced in P1-T3 on `DegreeGrid`, `StepperControl`, and `ToggleBar` only if they have no other callers.
- **Q2** adds a Stop button (Square icon) next to Play that calls a new `stopProgressionPlaybackAtom` setter — sets `playing=false` AND `activeProgressionStepIndex=0` in one transaction so the cursor returns to bar 1. Both Play and Stop wrap in a `<Tooltip>` describing their action.
- **Q3** is **deferred to a separate debugging session** via the `superpowers:systematic-debugging` skill. The "playback degrades after a few loops" and "visual stutter at chord transition" symptoms need reproduction + instrumentation before a fix can be specified. This plan adds **no fix tasks for Q3**; it adds one investigation task that produces a `RESEARCH.md` with root cause + recommended fix shape, suitable to feed a follow-up plan.
- **Q4** rewrites the metronome from a `Tone.Loop("4n", ...)` to a `Tone.Part` with explicit per-beat events spanning `totalDurationSec`. The Part loops at the same boundary as the chord/bass/drum Parts, so the metronome wraps to beat 1 in lock-step with everything else. Solves the "metronome continues an extra beat past the loop" symptom.

**Tech Stack:** React 19 + Jotai (`useAtomValue`, `useSetAtom`), Tone.js v15 (`Tone.Part`, `Transport`), `@radix-ui/react-tooltip` (already integrated via `src/components/Tooltip/Tooltip.tsx`), lucide-react (`Square` for Stop), vitest + jsdom.

---

## File Map

**Modify:**
- `src/components/Inspector/InspectorCard.tsx` — add `locked?: boolean` + `lockedHint?: string` props.
- `src/components/Inspector/InspectorCard.module.css` — add `data-locked="true"` styling (dim + cursor: not-allowed on body) and a `.cardBodyLockedWrap` wrapper class.
- `src/components/Inspector/InspectorCard.test.tsx` — extend with locked-state + tooltip tests.
- `src/components/SongControls/SongControls.tsx` — remove the per-control `disabled={editsLocked}` props from P1-T3; replace with `locked={editsLocked}` on the KEY card and the PROGRESSION card (both InspectorCards).
- `src/components/SongControls/SongControls.test.tsx` — replace per-control assertions with card-level locked-state assertions.
- `src/components/shared/DegreeGrid.tsx`, `src/components/StepperControl/StepperControl.tsx`, `src/components/ToggleBar/ToggleBar.tsx` — **keep the `disabled` prop** added in P1-T3 (it's idiomatic, may have future uses, and removing now would require more code churn than leaving). No code change here.
- `src/store/progressionAtoms.ts` — add `stopProgressionPlaybackAtom` write-only setter.
- `src/store/progressionAtoms.test.ts` — assertion for the new setter.
- `src/components/TransportBar/TransportBar.tsx` — add Stop button between Prev and Play; wrap Stop + Play in `<Tooltip>`.
- `src/components/TransportBar/TransportBar.module.css` — no new rules likely needed; the Stop button reuses `transportButton`.
- `src/components/TransportBar/TransportBar.test.tsx` — tests for Stop click + Stop disabled state + tooltip presence.
- `src/hooks/useProgressionAudioPlayback.ts` — swap `createMetronomeLoop` for a metronome Part built inside `buildAllLayers` (Q4); also drop the orchestrator-owned `beatCounter` and the `beatsPerBarRef` since the Part owns its own beat-in-bar.
- `src/hooks/useProgressionAudioPlayback.test.tsx` — replace the existing metronome-Loop assertion with one that asserts a 4th `Tone.Part` is created for metronome ticks.
- `src/progressions/audio/buildAllLayers.ts` — emit a `metronome` event stream (mirrors the existing `bass` / `drums` shape) with one event per beat across `totalDurationSec`, carrying `beatInBar: 1..beatsPerBar`.
- `src/progressions/audio/buildAllLayers.test.ts` — extend with metronome event count + per-bar accent assertions.
- `src/progressions/audio/progressionMetronomeLoop.ts` — **delete** the file and its test (replaced by Part-based scheduling).
- `src/progressions/audio/progressionMetronomeLoop.test.ts` — **delete**.
- `src/i18n/en.ts` + `src/i18n/es.ts` + `src/i18n/types.ts` — add tooltip strings (`controls.stopProgression` / `controls.lockedHint`).

**Create:**
- `docs/superpowers/research/2026-05-25-playback-degradation.md` — output of Q3-T1 investigation. **Created by the spawned subagent, not by an implementer.**

**Untouched:**
- The `ProgressionPartHandle` / `createProgressionPart` wrapper (used as-is for metronome).
- The four other Parts (chord-onset, chord-strum, bass, drums) — orchestrator wiring stays.
- BackingTrackControls — still allowed mid-play (style switches).

---

## Phase Q1 — Card-Level Lock + Tooltip

The P1-T3 approach put `disabled={editsLocked}` on 13 individual controls. Two costs: (1) the user sees a "not allowed" cursor over each control with no explanation of why, (2) every new control added to KEY or PROGRESSION must remember to opt into the lock. The card-level approach centralizes the gate: lock the InspectorCard body once, all descendants are unreachable via pointer + keyboard, and a tooltip on the body explains "Pause to edit."

### Task Q1-T1: Extend `InspectorCard` with `locked` + `lockedHint` props

**Files:**
- Modify: `src/components/Inspector/InspectorCard.tsx`
- Modify: `src/components/Inspector/InspectorCard.module.css`
- Test: `src/components/Inspector/InspectorCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/components/Inspector/InspectorCard.test.tsx`:

```tsx
import { TooltipProvider } from "../Tooltip/Tooltip";

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
  const body = container.querySelector("[data-locked='true']");
  expect(body).toBeInTheDocument();
});

it("makes the body inert when locked=true", () => {
  const { container } = renderCard({ locked: true, lockedHint: "Pause to edit" });
  const body = container.querySelector("[data-locked='true']");
  expect(body).toHaveAttribute("inert");
});

it("body is interactive when locked=false (default)", () => {
  const { container, getByTestId } = renderCard();
  expect(getByTestId("inner-button")).toBeEnabled();
  expect(container.querySelector("[data-locked='true']")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/Inspector/InspectorCard.test.tsx -t "locked"`
Expected: FAIL — props don't exist.

- [ ] **Step 3: Extend `InspectorCardProps` and JSX**

Edit `src/components/Inspector/InspectorCard.tsx`:

```tsx
import type { ReactNode } from "react";
import clsx from "clsx";
import { Switch } from "../Switch/Switch";
import { Tooltip } from "../Tooltip/Tooltip";
import styles from "./InspectorCard.module.css";

export interface InspectorCardProps {
  // ... existing props ...
  /**
   * When true, the card body becomes non-interactive (HTML5 `inert`) and
   * visually dims. Pair with `lockedHint` to show a tooltip explaining
   * how the user unlocks. Independent of `active` (which dims the body
   * via the master toggle).
   */
  locked?: boolean;
  /** Tooltip content shown when hovering the locked body. Required when `locked=true`. */
  lockedHint?: ReactNode;
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
      // HTML5 `inert` makes the subtree non-focusable + non-clickable +
      // hidden from a11y tree. React 19 supports it as a prop directly.
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

(Type-note on `inert`: React 19 accepts `inert` as a prop. In TypeScript it lands in `HTMLAttributes` per `@types/react@19`. The `{...(locked ? { inert: "" } : {})}` spread guards against passing `inert={false}` which behaves the same as `inert=""` in some React versions.)

- [ ] **Step 4: Add CSS rules**

Append to `src/components/Inspector/InspectorCard.module.css`:

```css
.cardBody[data-locked="true"] {
  opacity: 0.42;
  cursor: not-allowed;
  /* `inert` already blocks pointer events at the DOM level, but we set
     pointer-events: none too so the cursor:not-allowed style applies on hover. */
  pointer-events: auto;
}

.cardBody[data-locked="true"] > * {
  pointer-events: none;
}
```

(The trick: the outer `cardBody` accepts pointer events so the cursor + tooltip work, but every direct child has `pointer-events: none` so the user can't actually interact with anything below.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/components/Inspector/InspectorCard.test.tsx`
Expected: PASS (all cases, including the existing ones).

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/InspectorCard.tsx src/components/Inspector/InspectorCard.module.css src/components/Inspector/InspectorCard.test.tsx
git commit -m "feat(inspector-card): add locked prop + lockedHint tooltip"
```

### Task Q1-T2: Switch SongControls KEY + PROGRESSION cards to card-level lock

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`
- Modify: `src/components/SongControls/SongControls.test.tsx`
- Modify: `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/types.ts`

- [ ] **Step 1: Add the i18n key**

`src/i18n/types.ts` — add `controls.lockedHint: string`:

```ts
controls: {
  // ... existing keys ...
  lockedHint: string;
};
```

`src/i18n/en.ts`:

```ts
lockedHint: "Pause playback to edit",
```

`src/i18n/es.ts`:

```ts
lockedHint: "Pausa la reproducción para editar",
```

- [ ] **Step 2: Write the failing test**

Replace the existing per-control "disables structural-edit controls" test in `src/components/SongControls/SongControls.test.tsx` with a card-level test (delete the old assertions):

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

(Remove or update the prior "keeps style-switch controls enabled" test if it now overlaps — the card-level test above is the right abstraction.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/components/SongControls/SongControls.test.tsx -t "locks the KEY"`
Expected: FAIL — InspectorCards aren't locked.

- [ ] **Step 4: Implement — replace per-control `disabled={editsLocked}` with card-level `locked={editsLocked}`**

In `src/components/SongControls/SongControls.tsx`:

(a) Find the KEY InspectorCard and add `locked` + `lockedHint`:

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
        // REMOVE: disabled={editsLocked}
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
        // REMOVE: disabled={editsLocked}
        hideLabel
      />
    </Prop>
  </PropGrid>
</InspectorCard>
```

(b) Same for the PROGRESSION InspectorCard — add `locked={editsLocked}` + `lockedHint={t("controls.lockedHint")}`, then strip every `disabled={editsLocked}` / `disabled={... || editsLocked}` (OR them back to whatever predicate they had pre-P1-T3) from the children: Preset select, Add button, Move-up/down, Duplicate, Remove, pip-row buttons, DegreeGrid, Quality select, Duration StepperControl, Duration ToggleBar.

Specifically, restore these to their original disabled predicates:
- Move-up: `disabled={!activeStep || activeProgressionStepIndex === 0}`
- Move-down: `disabled={!activeStep || activeProgressionStepIndex === progressionSteps.length - 1}`
- Duplicate / Remove: `disabled={!activeStep}`
- Add / Preset / DegreeGrid / Quality / Duration / pip-row: drop the `disabled` prop entirely (they had none pre-P1-T3).

(c) The `const editsLocked = progressionPlaying;` line stays — it now feeds two `locked={...}` props instead of 13 `disabled={...}`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/components/SongControls/SongControls.test.tsx`
Expected: all cases PASS.

- [ ] **Step 6: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/SongControls/SongControls.tsx src/components/SongControls/SongControls.test.tsx src/i18n/en.ts src/i18n/es.ts src/i18n/types.ts
git commit -m "refactor(song-controls): card-level lock + tooltip replaces per-control disabled"
```

---

## Phase Q2 — Stop Button

### Task Q2-T1: Add `stopProgressionPlaybackAtom`

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
Expected: FAIL.

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

### Task Q2-T2: Add Stop button to TransportBar with tooltips

**Files:**
- Modify: `src/components/TransportBar/TransportBar.tsx`
- Test: `src/components/TransportBar/TransportBar.test.tsx`
- Modify: `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/types.ts`

- [ ] **Step 1: Add i18n keys**

`src/i18n/types.ts`:

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

(a) Import `Square` from lucide, `Tooltip` from the project, the new atom + the active-index atom:

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

(b) Add reads + setter inside the component:

```ts
const { t } = useTranslation();
const stopProgressionPlayback = useSetAtom(stopProgressionPlaybackAtom);
const activeIndex = useAtomValue(activeProgressionStepIndexAtom);
const stopDisabled = !canPlay || (!progressionPlaying && activeIndex === 0);
```

(c) Insert the Stop button between Prev and Play in the transport cluster. Wrap Play and Stop in `<Tooltip>`:

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

(Tooltip's `asChild` semantics let the trigger forward to the underlying `<button>` so a11y is preserved.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/components/TransportBar/TransportBar.test.tsx`
Expected: all 14+ tests PASS.

- [ ] **Step 6: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/TransportBar/TransportBar.tsx src/components/TransportBar/TransportBar.test.tsx src/i18n/en.ts src/i18n/es.ts src/i18n/types.ts
git commit -m "feat(transport): add stop button with tooltips on play/pause/stop"
```

---

## Phase Q4 — Time-Signature-Aware Loop Length (Metronome Fix)

**The bug:** the metronome is a `Tone.Loop` with subdivision `"4n"` — it keeps ticking on its own schedule independent of the chord/bass/drum Parts' `loopEnd`. So when the Parts wrap (e.g., at 3 seconds for a 1-bar progression in 3/4 at 60 BPM), the metronome continues clicking until the next quarter-note boundary instead of restarting at beat 1 alongside the chord. In a 4-bar progression in 3/4 (12 beats), the metronome can end up firing extra clicks until t=16 beats before the Loop's next iteration.

**The fix:** treat the metronome the same way as bass/drums — generate explicit per-beat events in `buildAllLayers`, then schedule them via a 5th `Tone.Part`. The Part loops at the same `loopEnd = totalDurationSec` boundary as everything else, so the metronome naturally wraps to beat 1 in lock-step with the chord onsets.

### Task Q4-T1: Emit a `metronome` event stream from `buildAllLayers`

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts`
- Test: `src/progressions/audio/buildAllLayers.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/buildAllLayers.test.ts`:

```ts
it("emits one metronome event per beat across totalDurationSec, with beatInBar 1-based and bar-cyclic", () => {
  const built = buildAllLayers({
    steps: [{ id: "a", root: "C", quality: "M", duration: { value: 1, unit: "bar" } }],
    tempoBpm: 60,
    beatsPerBar: 3, // 3/4
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
Expected: FAIL — no `metronome` field on the output.

- [ ] **Step 3: Implement — add `MetronomeEvent` type, emit array**

In `src/progressions/audio/buildAllLayers.ts`:

(a) Add to the exported types:

```ts
export interface MetronomeEvent {
  /** 1-based, cycles 1..beatsPerBar. Beat 1 is the bar downbeat (consumer
   *  uses this to switch to an accent click). */
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

(d) At the END of the function (just before `return`), generate beats spanning the whole `cumulativeSec`:

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

### Task Q4-T2: Schedule the metronome as a `Tone.Part`, delete the Loop wrapper

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`
- Modify: `src/hooks/useProgressionAudioPlayback.test.tsx`
- Delete: `src/progressions/audio/progressionMetronomeLoop.ts`
- Delete: `src/progressions/audio/progressionMetronomeLoop.test.ts`

- [ ] **Step 1: Write the failing test**

Edit `src/hooks/useProgressionAudioPlayback.test.tsx` to replace the existing metronome-Loop assertion with a Part-based one. Find the test that asserts `createMetronomeLoop` was called and rewrite as:

```tsx
it("schedules the metronome as a 5th Tone.Part (not a Tone.Loop)", () => {
  const store = createStore();
  store.set(progressionStepsAtom, [{ id: "a", root: "C", quality: "M", duration: { value: 1, unit: "bar" } }]);
  store.set(progressionPlayingStateAtom, true);

  renderHook(() => useProgressionAudioPlayback(), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });

  // 5 Parts: chord-onset, chord-strum, bass, drums, metronome.
  expect(capturedPartHandles).toHaveLength(5);
});

it("metronome Part loop boundary matches totalDurationSec (loops in sync with chord parts)", () => {
  // ... fire build for a 1-bar 3/4 progression, assert the 5th Part was
  // configured with loopEnd === 3 (3 beats × 1 second/beat at 60 BPM).
  const lastPartOpts = capturedCreateProgressionPartCalls.at(-1);
  expect(lastPartOpts.loopEnd).toBe(3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx -t "metronome"`
Expected: FAIL — only 4 Parts created today.

- [ ] **Step 3: Implement — swap Loop for Part**

In `src/hooks/useProgressionAudioPlayback.ts`:

(a) Replace the metronome imports:

```ts
// REMOVE:
import {
  createMetronomeLoop,
  type MetronomeLoopHandle,
} from "../progressions/audio/progressionMetronomeLoop";

// REPLACE the import that brings in BassEvent etc. — add MetronomeEvent:
import {
  buildAllLayers,
  type BassEvent,
  type ChordOnsetEvent,
  type ChordStrumEvent,
  type DrumEvent,
  type MetronomeEvent,
} from "../progressions/audio/buildAllLayers";
```

(b) Update `PlaybackPrimitives`:

```ts
interface PlaybackPrimitives {
  parts: ProgressionPartHandle[];
  endEventId: number | null;
  totalDurationSec: number;
  // REMOVE: loop: MetronomeLoopHandle | null;
}
```

(c) Remove `beatsPerBarRef` (the metronome Part now reads `beatInBar` from the event payload, not from a ref):

```ts
// REMOVE:
const beatsPerBarRef = useRef(beatsPerBar);
```

(and remove the Effect 4 line that writes to it — Effect 4 keeps only `transport.timeSignature = beatsPerBar`)

(d) Replace the `createMetronomeLoop` block with a 5th Part:

```ts
// 5. Metronome Part — explicit per-beat events spanning totalDurationSec,
//    so loop wraps in lock-step with the chord/bass/drum parts. Replaces
//    the previous Tone.Loop("4n", ...) which fired on an independent
//    schedule and continued ticking past loop boundaries when the time
//    signature wasn't 4/4.
const metronomePart = createProgressionPart<MetronomeEvent>({
  events: built.metronome,
  loop: inputs.loopEnabled,
  loopEnd: totalDurationSec,
  onEvent: (audioTime, value) => {
    scheduleClick(audio.layers.metronome, audioTime, {
      accent: value.beatInBar === 1,
    });
  },
});
metronomePart.start(partStart, 0);
parts.push(metronomePart);
```

(Remove the local `beatCounter` variable and the `createMetronomeLoop` invocation; the Part owns the beat accounting now via event payloads.)

(e) Update `primsRef.current` assignment to drop the `loop` field:

```ts
primsRef.current = { parts, endEventId, totalDurationSec };
```

(f) Update `disposeAll`:

```ts
function disposeAll(prims: PlaybackPrimitives | null) {
  if (!prims) return;
  prims.parts.forEach((p) => p.dispose());
  // REMOVE: prims.loop?.dispose();
  if (prims.endEventId !== null) {
    getTransport().clear(prims.endEventId);
  }
}
```

(g) Update Effect 4 (live time signature) to remove the `beatsPerBarRef.current = beatsPerBar` write — it's no longer used:

```ts
useEffect(() => {
  const transport = getTransport() as unknown as { timeSignature?: number } | null;
  if (transport && transport.timeSignature !== undefined) {
    transport.timeSignature = beatsPerBar;
  }
}, [beatsPerBar]);
```

(h) Add `beatsPerBar` to `buildKey` so a live time-signature change rebuilds the metronome event stream (it must, because the events have baked-in `beatInBar` values + total beat count depends on the meter):

```ts
const buildKey = useMemo(
  () =>
    JSON.stringify({
      beatsPerBar,  // ← NEW; required because metronome event stream is baked
      steps: steps.map((s) => ({ /* ... */ })),
      chordPatternId,
      bassPatternId,
      drumPatternId,
      drumVariations,
    }),
  [beatsPerBar, steps, chordPatternId, bassPatternId, drumPatternId, drumVariations],
);
```

Add `beatsPerBar` to `buildInputsRef`'s tracked fields too.

**Caveat noted:** with `beatsPerBar` in `buildKey`, a live time-signature change now triggers a rebuild instead of just a Transport setter. That's a regression vs. the previous design where Effect 4 was a live update. The tradeoff is correct behavior > smoothness — and the rebuild is identical in cost to a tempo / pattern switch which users already accept. If a future round wants live time-signature changes, the fix is to rebuild ONLY the metronome Part on `beatsPerBar` change (a 6th effect that disposes + re-creates `parts[4]`), but that's out of scope here.

- [ ] **Step 4: Delete the obsolete metronome-loop files**

```bash
rm src/progressions/audio/progressionMetronomeLoop.ts
rm src/progressions/audio/progressionMetronomeLoop.test.ts
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx src/progressions/audio/`
Expected: green (apart from the pre-existing timeline.test.ts failures from a prior task).

- [ ] **Step 6: Lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean. The deleted file removal must propagate; if there's still a stale import in any test file, fix it.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts src/hooks/useProgressionAudioPlayback.test.tsx src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git add -u src/progressions/audio/progressionMetronomeLoop.ts src/progressions/audio/progressionMetronomeLoop.test.ts
git commit -m "fix(audio): metronome loops in sync with chord parts (time-signature-aware)"
```

---

## Phase Q3 — Deferred Investigation (Separate Skill)

**Why this isn't a fix task in this plan:** the symptoms ("playback degrades after a few loops", "visual stutter on chord transition") have no confirmed root cause. Per `superpowers:systematic-debugging`'s iron law — **NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST** — committing to a fix here without reproducing + diagnosing would be guessing. The plan adds one task that produces a research note; a follow-up plan can adopt its findings.

### Task Q3-T1: Investigation — playback degradation + chord-transition stutter

**Owner:** subagent dispatched via `superpowers:systematic-debugging` (NOT the regular implementer).

**Output:** `docs/superpowers/research/2026-05-25-playback-degradation.md` containing:
1. Reproduction steps for each symptom (audio degradation; visual stutter)
2. Phase 1 (Root Cause): instrumentation added, evidence gathered, candidate hypotheses with the data that supports or refutes each
3. Phase 2 (Pattern): working comparison if applicable (e.g., does a single chord without overlay update glitch?)
4. Phase 3 (Hypothesis): the single hypothesis confirmed by minimal experiment
5. Recommended fix shape (specific files + approach), suitable as input to a future plan
6. Any "out of scope" findings (orthogonal bugs surfaced during instrumentation)

**Hypotheses to investigate first** (don't fix; just rule in / out with data):

- **H1 (audio degradation):** `Tone.Draw`'s internal queue accumulates events that don't get pruned correctly during long loops. Verify by reading `getDraw()._events.length` at intervals during 10+ loop passes.
- **H2 (audio degradation):** AudioContext clock drift vs Transport — `Transport.seconds % totalDurationSec` slowly diverges from event onset times over many loops. Log delta-from-expected for the chord-onset Part's callbacks over 20 loops.
- **H3 (audio degradation):** Voice pool growth — `createReusableVoicePool`'s entries keep growing because `busyUntil` math underestimates voice duration. Snapshot voice counts across 10 loops.
- **H4 (visual stutter):** `setActiveStepIndex` Jotai write triggers a synchronous re-render of the entire Fretboard tree, blocking the next animation frame. Profile in Chrome DevTools at chord transition; check React render flamegraph.
- **H5 (visual stutter):** `setActiveStep` (timeline state) is called every BAR, not just every chord onset — so multi-bar steps still fire a heavy React commit at every bar boundary. Check the chord-onset Part callback: `setActiveStep` is called unconditionally, `setActiveStepIndex` only when `isFirstBar`.
- **H6 (visual stutter):** `ProgressionPlayhead.tsx` uses `requestAnimationFrame` for the 60Hz position update. If the chord-overlay swap triggers layout thrashing in the Fretboard, the playhead RAF stalls. Profile RAF timing during chord transitions.

The investigation agent picks the most likely hypothesis to test first based on a 10-minute initial reproduction session.

**Plan handler:** offer this task as a separate spawn via `mcp__ccd_session__spawn_task` rather than executing inline. The implementer subagent flow is wrong for this kind of work — it would commit to a fix prematurely.

---

## Phase Q5 — Verification

### Task Q5-T1: Full local verification + visual baseline refresh

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 2: Unit tests**

Run: `pnpm test`
Expected: same pass count as the prior plan's verification (1967+ pass) PLUS the new tests added by Q1/Q2/Q4 (roughly +15). The 9 pre-existing failures in `timeline.test.ts` / `ProgressionPlayhead.test.tsx` / `ProgressionPositionReadout.test.tsx` should remain — they're tracked separately and orthogonal.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: clean.

- [ ] **Step 4: E2E production**

Run: `pnpm test:e2e:production`
Expected: 50/50.

- [ ] **Step 5: Visual regression refresh**

The TransportBar gains a Stop button — every visual snapshot that includes the transport cluster will need a refresh. Run:

```bash
pnpm test:visual:update
pnpm test:visual
```

Inspect the diff for the transport bar — confirm Stop is positioned between Prev and Play, both Play and Stop show tooltip-triggered styling on hover (Radix tooltips usually appear via portals so they won't land in static snapshots, but mid-frame they might — re-run if a snapshot looks tooltip-contaminated).

- [ ] **Step 6: Commit visual baseline updates**

```bash
git add e2e/
git commit -m "test(visual): refresh transport-bar baselines after stop button + tooltips"
```

---

## Self-Review Notes

**Spec coverage:**
- Concern 1 (disable whole card instead of individual controls): Q1-T1 (InspectorCard prop) + Q1-T2 (apply to KEY + PROGRESSION).
- Concern 2 (tooltip on locked state + Stop button): Q1-T1 (locked-body tooltip) + Q2-T1 (atom) + Q2-T2 (Stop button + tooltips on play/pause/stop).
- Concern 3 (degradation + chord-transition stutter): Q3-T1 (investigation only — explicitly NOT a fix task, per debugging skill).
- Concern 4 (time signature not honored in loop): Q4-T1 (build metronome event stream) + Q4-T2 (schedule via Part).

**Placeholder scan:** clean. The only "investigation" task (Q3-T1) is intentional and clearly scoped as research output, not a code fix.

**Type consistency:**
- `MetronomeEvent` introduced in Q4-T1, consumed in Q4-T2. Single export name.
- `stopProgressionPlaybackAtom` introduced in Q2-T1, consumed in Q2-T2.
- `locked` + `lockedHint` props introduced in Q1-T1, consumed in Q1-T2.
- `editsLocked` local constant stays the same name in SongControls; only its consumers shrink from 13 to 2.

**Risk callouts:**
- Q4-T2 adds `beatsPerBar` to `buildKey`, which makes live time-signature changes trigger a full rebuild instead of just `transport.timeSignature = N`. That's a regression vs. P5's live updates but accepts the tradeoff for correctness (metronome must wrap to beat 1 in lock-step). Future round could add a 6th effect that rebuilds ONLY the metronome Part on `beatsPerBar` change.
- Q1-T1's `inert` attribute requires React 19 + a modern browser. Both are already the project baseline.
- Q3 produces no code change. If the user expects fixes from this plan for concerns 1-4 but ALSO concern 3, that mismatch is explicit in the architecture summary above.
