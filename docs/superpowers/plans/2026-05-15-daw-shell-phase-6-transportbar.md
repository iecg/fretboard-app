# DAW Shell Phase 6 — Extract TransportBar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull the transport row (status lights, play/prev/next/loop cluster, strum/bass/drums/metronome cluster) out of `ProgressionTrack` into a standalone `TransportBar` component, with zero visible change.

**Architecture:** `TransportBar` is a self-contained component that subscribes to the playback atoms via `useProgressionState` directly — no props. Its root element uses `display: contents` so the extracted markup lays out exactly as it did inside `ProgressionTrack`'s `.transportRow` (desktop and mobile). `ProgressionTrack` renders `<TransportBar />` in place of the inline transport markup; the timeline, playhead, position readout, and tempo/scale readouts stay in `ProgressionTrack`.

**Tech Stack:** React 19, TypeScript, CSS Modules, Jotai, Vitest + Testing Library, Playwright visual regression.

---

## Context

Spec: `docs/superpowers/specs/2026-05-15-daw-shell-phases-4-7-design.md` §5 (Phase 6). Build order is Phase 4 → **Phase 6** → Phase 5 → Phase 7; Phase 4 is shipped.

### What moves into `TransportBar`

From `src/components/ProgressionTrack/ProgressionTrack.tsx`, the children of `<div className={styles.transportRow}>`:

- `.statusLights` block (Play / Loop status dots)
- `.transportCluster` block (Previous / Play-Pause / Next / Loop buttons)
- `.clusterDivider` span
- `.instrumentCluster` block (Strum / Bass / Drums / Metronome toggles)

### What stays in `ProgressionTrack`

- `<div className={styles.transportRow}>` itself (now the flex container for `<TransportBar />` + the two readouts)
- `<ProgressionPositionReadout />`
- `.contextReadouts` block (Tempo + Scale)
- `.accompanimentControls` row, `.timeline`, playhead, ruler, blocks — all unchanged

### CSS that moves

These **base** rules move verbatim from `ProgressionTrack.module.css` to a new `TransportBar.module.css`:
`.transportCluster`, `.transportButton`, `.transportButton:hover:not(:disabled)`, `.transportButton:active:not(:disabled)`, `.transportButton:focus-visible`, `.transportButton:disabled`, `.transportButton--accent`, `.playButton`, `.statusLights`, `.statusLight`, `.statusDot`, `.statusLight[data-active="true"]`, `.statusLight[data-active="true"] .statusDot`, `@keyframes track-pulse`, `.instrumentCluster`, `.clusterDivider`.

The **`modern-light` theme overrides** for those classes must move too — `ProgressionTrack.module.css` carries (post-faceplate-merge) a light-mode block, and because CSS Modules hash class names the originals cannot reach the extracted elements. These seven `:global([data-theme="modern-light"])` rules move as well: `.transportButton`, `.transportButton:hover:not(:disabled)`, `.transportButton:focus-visible`, `.transportButton--accent`, `.statusDot`, `.statusLight[data-active="true"] .statusDot`, `.clusterDivider`.

The moved rules resolve `--track-accent`, `--track-accent-dim`, and `--track-text-muted` (plus global `--font-mono` / `--font-sans`). The new `.transportBar` root re-declares those three `--track-*` properties locally so `TransportBar` renders identically whether nested in `ProgressionTrack` or mounted standalone in a test. `--track-accent` follows the theme-adaptive `--faceplate-accent` token (so it auto-adapts per theme); `--track-accent-dim` and `--track-text-muted` are static dark values overridden by a `:global([data-theme="modern-light"]) .transportBar` rule. `ProgressionTrack`'s `.track` keeps its own copies (still used by the readouts/playhead) and its remaining `:global([data-theme="modern-light"]) .track` token block stays.

### Why `display: contents`

The four moved blocks are currently direct flex children of `.transportRow` and participate in its `gap: 0.45rem` and its mobile `flex-wrap: wrap` rule. Wrapping them in a `TransportBar` element with `display: contents` keeps the element out of the layout box tree, so the four blocks still behave as direct children of `.transportRow`. CSS custom properties still inherit through a `display: contents` element, so the locally declared `--track-*` values reach the buttons. Net result: byte-identical rendering, no visual-baseline churn.

---

## Task 1: Create the TransportBar component

**Files:**
- Create: `src/components/TransportBar/TransportBar.tsx`
- Create: `src/components/TransportBar/TransportBar.module.css`
- Create: `src/components/TransportBar/TransportBar.test.tsx`

First, create the feature branch off `main`:

```bash
git checkout main && git pull && git checkout -b claude/daw-shell-phase-6-transportbar
```

- [ ] **Step 1: Write the failing test**

Create `src/components/TransportBar/TransportBar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import {
  beatsPerBarAtom,
  progressionBassEnabledAtom,
  progressionDrumsEnabledAtom,
  progressionEnabledAtom,
  progressionLoopEnabledAtom,
  progressionMetronomeEnabledAtom,
  progressionPlayingAtom,
  progressionStepsAtom,
  progressionStrumEnabledAtom,
} from "../../store/atoms";
import { TransportBar } from "./TransportBar";

const fourStepProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
] as const;

// A playable progression: enabled, with steps, so playback is not blocked.
const playableAtoms = [
  [progressionEnabledAtom, true],
  [progressionStepsAtom, fourStepProgression],
  [beatsPerBarAtom, 4],
] as const;

describe("TransportBar", () => {
  it("renders the transport and instrument buttons", () => {
    renderWithAtoms(<TransportBar />, [...playableAtoms]);

    expect(screen.getByRole("button", { name: "Previous chord" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play progression" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next chord" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Loop progression" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chord strum" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bassline" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Drums" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Metronome" })).toBeTruthy();
    expect(screen.getByText("Play")).toBeTruthy();
    expect(screen.getByText("Loop")).toBeTruthy();
  });

  it("toggles playback when the play button is clicked", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<TransportBar />, store);

    fireEvent.click(screen.getByRole("button", { name: "Play progression" }));

    expect(store.get(progressionPlayingAtom)).toBe(true);
  });

  it("disables the transport buttons when playback is blocked", () => {
    renderWithAtoms(<TransportBar />, [[progressionEnabledAtom, false]]);

    expect(screen.getByRole("button", { name: "Play progression" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous chord" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next chord" })).toBeDisabled();
  });

  it("toggles the loop atom when the loop button is clicked", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<TransportBar />, store);

    fireEvent.click(screen.getByRole("button", { name: "Loop progression" }));

    expect(store.get(progressionLoopEnabledAtom)).toBe(true);
  });

  it("toggles each backing-instrument atom when its button is clicked", () => {
    const cases = [
      ["Chord strum", progressionStrumEnabledAtom],
      ["Bassline", progressionBassEnabledAtom],
      ["Drums", progressionDrumsEnabledAtom],
      ["Metronome", progressionMetronomeEnabledAtom],
    ] as const;

    for (const [label, atom] of cases) {
      const store = makeAtomStore([...playableAtoms]);
      const { unmount } = renderWithStore(<TransportBar />, store);
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(store.get(atom)).toBe(true);
      unmount();
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<TransportBar />, [...playableAtoms]);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/TransportBar/TransportBar.test.tsx`
Expected: FAIL — `Failed to resolve import "./TransportBar"` (component does not exist yet).

- [ ] **Step 3: Create the stylesheet**

Create `src/components/TransportBar/TransportBar.module.css`:

```css
/* ----------------------------------------------------------------------------
 * Transport bar — playback + backing-instrument controls for the DAW track.
 *
 * Extracted verbatim from ProgressionTrack. The `.transportBar` root uses
 * `display: contents` so its children behave as direct flex children of the
 * host `.transportRow` (preserving desktop spacing and mobile wrapping). The
 * three `--track-*` custom properties are re-declared here so the component
 * renders identically whether nested in ProgressionTrack or mounted alone.
 * ------------------------------------------------------------------------- */

.transportBar {
  /* `display: contents` removes this box from the layout tree; the children
     lay out against the host `.transportRow`. Custom properties still
     inherit through a `display: contents` element. */
  display: contents;

  --track-accent: var(--faceplate-accent, #4DE4FF);
  --track-accent-dim: rgb(77 228 255 / 0.55);
  --track-text-muted: rgb(193 218 235 / 0.32);
}

/* ----------------------------------------------------------------------------
 * Transport cluster — previous / play-pause / next / loop
 * ------------------------------------------------------------------------- */

.transportCluster {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  flex-shrink: 0;
}

.transportButton {
  --tb-fg: var(--track-accent-dim);
  --tb-border: rgb(77 228 255 / 0.18);
  --tb-bg: rgb(77 228 255 / 0.03);

  width: 1.85rem;
  height: 1.85rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--tb-border);
  border-radius: 7px;
  background: var(--tb-bg);
  color: var(--tb-fg);
  cursor: pointer;
  transition:
    color 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 200ms ease,
    transform 120ms ease;
}

.transportButton:hover:not(:disabled) {
  --tb-fg: var(--track-accent);
  --tb-border: rgb(77 228 255 / 0.45);
  --tb-bg: rgb(77 228 255 / 0.08);
}

.transportButton:active:not(:disabled) {
  transform: translateY(0.5px) scale(0.97);
}

.transportButton:focus-visible {
  outline: none;
  --tb-border: var(--track-accent);
  box-shadow:
    0 0 0 1px var(--track-accent),
    0 0 10px rgb(77 228 255 / 0.45);
}

.transportButton:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.transportButton--accent {
  --tb-fg: var(--track-accent);
  --tb-border: rgb(77 228 255 / 0.6);
  --tb-bg: rgb(77 228 255 / 0.1);

  box-shadow:
    0 0 0 1px rgb(77 228 255 / 0.55),
    0 0 14px rgb(77 228 255 / 0.32),
    inset 0 0 14px rgb(77 228 255 / 0.1);
}

.playButton {
  color: var(--track-accent);
}

/* ----------------------------------------------------------------------------
 * Status lights — small dot + uppercase label, stacked
 * ------------------------------------------------------------------------- */

.statusLights {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.15rem;
  flex-shrink: 0;
  padding-inline: 0.08rem 0.2rem;
}

.statusLight {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  color: var(--track-text-muted);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  transition: color 180ms ease;
}

.statusDot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 999px;
  background: rgb(193 218 235 / 0.2);
  box-shadow: inset 0 0 0 1px rgb(193 218 235 / 0.15);
  transition: background-color 200ms ease, box-shadow 200ms ease;
}

.statusLight[data-active="true"] {
  color: var(--track-accent);
}

.statusLight[data-active="true"] .statusDot {
  background: var(--track-accent);
  box-shadow:
    0 0 5px var(--track-accent),
    0 0 10px rgb(77 228 255 / 0.5);
  animation: track-pulse 1.4s ease-in-out infinite;
}

@keyframes track-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

/* ----------------------------------------------------------------------------
 * Instrument cluster — strum / bass / drums / metronome
 *
 * Visually a continuation of the transport cluster: same buttons, same
 * sizing, same accent treatment. A faint vertical divider separates the two
 * functional groups.
 * ------------------------------------------------------------------------- */

.instrumentCluster {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  flex-shrink: 0;
}

/* Standalone divider sibling of the two clusters; the host row's `gap`
 * provides even spacing on both sides automatically. */
.clusterDivider {
  width: 1px;
  height: 1.1rem;
  align-self: center;
  flex-shrink: 0;
  background: linear-gradient(
    to bottom,
    transparent,
    rgb(193 218 235 / 0.18),
    transparent
  );
}

/* =========================================================================
 * Light-mode overrides — moved verbatim from ProgressionTrack.module.css.
 * `--track-accent` follows the theme-adaptive `--faceplate-accent` token, so
 * only the dim/muted tokens and the per-element treatments need overriding.
 * ========================================================================= */

/* stylelint-disable selector-pseudo-class-no-unknown */
:global([data-theme="modern-light"]) .transportBar {
  --track-accent-dim: rgb(46 181 204 / 0.6);
  --track-text-muted: rgb(15 23 42 / 0.42);
}

/* Transport buttons: teal-tinted with subtle depth instead of neon glow */
:global([data-theme="modern-light"]) .transportButton {
  --tb-fg: rgb(46 181 204 / 0.7);
  --tb-border: rgb(46 181 204 / 0.3);
  --tb-bg: rgb(46 181 204 / 0.05);
}

:global([data-theme="modern-light"]) .transportButton:hover:not(:disabled) {
  --tb-fg: #2EB5CC;
  --tb-border: rgb(46 181 204 / 0.55);
  --tb-bg: rgb(46 181 204 / 0.1);
}

:global([data-theme="modern-light"]) .transportButton:focus-visible {
  --tb-border: #2EB5CC;
  box-shadow:
    0 0 0 1px #2EB5CC,
    0 0 6px rgb(46 181 204 / 0.25);
}

:global([data-theme="modern-light"]) .transportButton--accent {
  --tb-fg: #2EB5CC;
  --tb-border: rgb(46 181 204 / 0.65);
  --tb-bg: rgb(46 181 204 / 0.1);

  box-shadow:
    0 0 0 1px rgb(46 181 204 / 0.45),
    0 2px 8px rgb(46 181 204 / 0.15);
}

/* Status dots: opaque on light surface instead of luminous glow */
:global([data-theme="modern-light"]) .statusDot {
  background: rgb(15 23 42 / 0.15);
  box-shadow: inset 0 0 0 1px rgb(15 23 42 / 0.1);
}

:global([data-theme="modern-light"]) .statusLight[data-active="true"] .statusDot {
  background: #2EB5CC;
  box-shadow: 0 0 4px rgb(46 181 204 / 0.35);
}

/* Cluster divider */
:global([data-theme="modern-light"]) .clusterDivider {
  background: linear-gradient(to bottom, transparent, rgb(15 23 42 / 0.12), transparent);
}
/* stylelint-enable selector-pseudo-class-no-unknown */
```

- [ ] **Step 4: Create the component**

Create `src/components/TransportBar/TransportBar.tsx`. The JSX is moved verbatim from `ProgressionTrack.tsx` (lines ~123–220), wrapped in a single `display: contents` root that carries `data-testid="transport-bar"`:

```tsx
import clsx from "clsx";
import {
  AudioWaveform,
  Drum,
  Guitar,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Timer,
} from "lucide-react";
import { useProgressionState } from "../../hooks/useProgressionState";
import styles from "./TransportBar.module.css";

/**
 * Playback + backing-instrument controls for the DAW progression track.
 * Self-contained: subscribes to the playback atoms via `useProgressionState`.
 */
export function TransportBar() {
  const {
    progressionPlaying,
    progressionPlaybackBlockedReason,
    setProgressionPlaying,
    advanceProgressionPlayback,
    previousProgressionStep,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    progressionStrumEnabled,
    setProgressionStrumEnabled,
    progressionBassEnabled,
    setProgressionBassEnabled,
    progressionDrumsEnabled,
    setProgressionDrumsEnabled,
    progressionMetronomeEnabled,
    setProgressionMetronomeEnabled,
  } = useProgressionState();

  const canPlay = !progressionPlaybackBlockedReason;

  return (
    <div className={styles.transportBar} data-testid="transport-bar">
      <div className={styles.statusLights} aria-label="Playback status">
        <span className={styles.statusLight} data-active={progressionPlaying ? "true" : undefined}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.statusLabel}>Play</span>
        </span>
        <span className={styles.statusLight} data-active={progressionLoopEnabled ? "true" : undefined}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.statusLabel}>Loop</span>
        </span>
      </div>

      <div className={styles.transportCluster}>
        <button
          type="button"
          className={styles.transportButton}
          onClick={() => previousProgressionStep()}
          disabled={!canPlay}
          aria-label="Previous chord"
        >
          <SkipBack size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={clsx(styles.transportButton, styles.playButton, progressionPlaying && styles["transportButton--accent"])}
          onClick={() => setProgressionPlaying(!progressionPlaying)}
          disabled={!canPlay}
          aria-label={progressionPlaying ? "Pause progression" : "Play progression"}
        >
          {progressionPlaying ? (
            <Pause size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
          ) : (
            <Play size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          className={styles.transportButton}
          onClick={() => advanceProgressionPlayback()}
          disabled={!canPlay}
          aria-label="Next chord"
        >
          <SkipForward size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={clsx(styles.transportButton, progressionLoopEnabled && styles["transportButton--accent"])}
          onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
          aria-pressed={progressionLoopEnabled}
          aria-label="Loop progression"
        >
          <Repeat size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      <span className={styles.clusterDivider} aria-hidden="true" />

      <div className={styles.instrumentCluster} role="group" aria-label="Backing instruments">
        <button
          type="button"
          className={clsx(styles.transportButton, progressionStrumEnabled && styles["transportButton--accent"])}
          onClick={() => setProgressionStrumEnabled(!progressionStrumEnabled)}
          aria-pressed={progressionStrumEnabled}
          aria-label="Chord strum"
          title="Chord strum"
        >
          <Guitar size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={clsx(styles.transportButton, progressionBassEnabled && styles["transportButton--accent"])}
          onClick={() => setProgressionBassEnabled(!progressionBassEnabled)}
          aria-pressed={progressionBassEnabled}
          aria-label="Bassline"
          title="Bassline"
        >
          <AudioWaveform size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={clsx(styles.transportButton, progressionDrumsEnabled && styles["transportButton--accent"])}
          onClick={() => setProgressionDrumsEnabled(!progressionDrumsEnabled)}
          aria-pressed={progressionDrumsEnabled}
          aria-label="Drums"
          title="Drums"
        >
          <Drum size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={clsx(styles.transportButton, progressionMetronomeEnabled && styles["transportButton--accent"])}
          onClick={() => setProgressionMetronomeEnabled(!progressionMetronomeEnabled)}
          aria-pressed={progressionMetronomeEnabled}
          aria-label="Metronome"
          title="Metronome"
        >
          <Timer size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
```

Note: `styles.statusLabel` resolves to `undefined` — there is no `.statusLabel` rule. This is pre-existing behavior in `ProgressionTrack` and is moved verbatim; do not "fix" it in this extraction.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/components/TransportBar/TransportBar.test.tsx`
Expected: PASS — all 6 tests green.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: PASS — no eslint or stylelint errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/TransportBar/
git commit -m "feat(transport): add standalone TransportBar component"
```

---

## Task 2: Wire TransportBar into ProgressionTrack and remove inline transport

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.module.css`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.test.tsx`

- [ ] **Step 1: Replace the import block in `ProgressionTrack.tsx`**

Replace lines 1–22 (the imports). Remove the `lucide-react` import entirely (no icons are used in `ProgressionTrack` after extraction) and add the `TransportBar` import. `clsx` stays — it is still used by the ruler ticks.

New import block:

```tsx
import { useCallback, type CSSProperties } from "react";
import clsx from "clsx";
import { useProgressionState } from "../../hooks/useProgressionState";
import { useScaleState } from "../../hooks/useScaleState";
import { GENRE_STYLES } from "../../progressions/audio/genres";
import { CHORD_PATTERNS, BASS_PATTERNS, DRUM_PATTERNS } from "../../progressions/audio/patterns";
import type { ChordInstrumentId } from "../../progressions/audio/instruments/types";
import styles from "./ProgressionTrack.module.css";
import { ProgressionBlock } from "./ProgressionBlock";
import { ProgressionPlayhead } from "./ProgressionPlayhead";
import { ProgressionPositionReadout } from "./ProgressionPositionReadout";
import { TransportBar } from "../TransportBar/TransportBar";
```

- [ ] **Step 2: Trim the `useProgressionState` destructure in `ProgressionTrack.tsx`**

Replace the destructure block (lines ~56–91) with the reduced set — the transport-only fields now live in `TransportBar`:

```tsx
  const {
    progressionTempoBpm,
    progressionGenreStyle,
    applyGenreStyle,
    progressionChordInstrument,
    setProgressionChordInstrument,
    progressionChordPattern,
    setProgressionChordPattern,
    progressionBassPattern,
    setProgressionBassPattern,
    progressionDrumPattern,
    setProgressionDrumPattern,
    progressionSwing,
    setProgressionSwing,
    progressionPlaying,
    progressionPlaybackBlockedReason,
    currentProgressionBar,
    totalProgressionBars,
    activeProgressionStepIndex,
    resolvedProgressionSteps,
    setActiveProgressionStepIndex,
    beatsPerBar,
  } = useProgressionState();
  const { scaleLabel } = useScaleState();
```

`progressionPlaying` and `progressionPlaybackBlockedReason` stay — `ProgressionTrack` still uses them for the `data-playing` attribute, the `title`, the `canPlay` flag passed to the playhead/readout, and the `statusNote`. The line `const canPlay = !progressionPlaybackBlockedReason;` (currently line 94) is unchanged.

- [ ] **Step 3: Replace the inline transport markup with `<TransportBar />` in `ProgressionTrack.tsx`**

In the returned JSX, replace the contents of `<div className={styles.transportRow}>` — currently the `.statusLights`, `.transportCluster`, `.clusterDivider`, and `.instrumentCluster` blocks (lines ~123–220) — with a single `<TransportBar />`. The `ProgressionPositionReadout` and `.contextReadouts` block stay as the remaining siblings:

```tsx
      <div className={styles.transportRow}>
        <TransportBar />

        <ProgressionPositionReadout
          playing={progressionPlaying && canPlay}
          stepStartBar={currentProgressionBar}
          stepBars={activeStepBars}
          stepIndex={activeProgressionStepIndex}
          totalProgressionBars={totalProgressionBars}
          beatsPerBar={beatsPerBar}
        />

        <div className={styles.contextReadouts}>
          <div className={styles.contextBox}>
            <span className={styles.readoutLabel}>Tempo</span>
            <span className={styles.tempoValue}>
              {progressionTempoBpm}
              <span className={styles.tempoUnit}>BPM</span>
            </span>
          </div>
          <div className={styles.contextBox}>
            <span className={styles.readoutLabel}>Scale</span>
            <span className={styles.scaleValue}>
              <span className={styles.scalePrimary}>{scale.primary}</span>
              {scale.secondary ? (
                <span className={styles.scaleSecondary}>{scale.secondary}</span>
              ) : null}
            </span>
          </div>
        </div>
      </div>
```

Everything below `</div>` (the `.accompanimentControls` row and the `.timeline` block) is unchanged.

- [ ] **Step 4: Remove the moved CSS rules from `ProgressionTrack.module.css`**

Delete these rules (they now live in `TransportBar.module.css`):

- `.transportCluster`
- `.transportButton` and its `:hover:not(:disabled)`, `:active:not(:disabled)`, `:focus-visible`, `:disabled` variants
- `.transportButton--accent`
- `.playButton`
- `.statusLights`
- `.statusLight`
- `.statusDot`
- `.statusLight[data-active="true"]`
- `.statusLight[data-active="true"] .statusDot`
- `@keyframes track-pulse`
- `.instrumentCluster`
- `.clusterDivider`

Also delete the seven `modern-light` theme overrides for the moved classes (they now live in `TransportBar.module.css`): `:global([data-theme="modern-light"]) .transportButton`, `:global(...) .transportButton:hover:not(:disabled)`, `:global(...) .transportButton:focus-visible`, `:global(...) .transportButton--accent`, `:global(...) .statusDot`, `:global(...) .statusLight[data-active="true"] .statusDot`, and `:global(...) .clusterDivider`.

**Keep** `.transportRow` (still the flex container), `.positionReadout`, `.contextReadouts`, `.contextBox`, all readout/digit/tempo/scale rules, `.accompanimentControls`, `.timeline`, ruler/lane/blocks/playhead rules, `.statusNote`, the entire mobile responsive block at the bottom, **and the `:global([data-theme="modern-light"]) .track` token-override block** (it still drives the readouts and chord blocks). Only the seven transport/status/divider light overrides above are removed; all other `modern-light` overrides (`.digitBar`, `.tempoValue`, `.scalePrimary`, the `.genreSelect`/`.instrumentSelect`/`.patternSelect` group, ruler/block/playhead overrides) stay.

After deletion, the `Transport row`, `Status lights`, and `Instrument cluster` comment banners that introduced the removed rules should also be removed; keep the `.transportRow` rule under a short comment, e.g. `/* Transport row — container for TransportBar + readouts */`.

- [ ] **Step 5: Add a `TransportBar` assertion to `ProgressionTrack.test.tsx`**

The existing tests query the transport buttons by role/name; they still pass because `<TransportBar />` renders them as descendants of `<ProgressionTrack />`. No existing test needs changing. Add one test inside the `describe("ProgressionTrack", ...)` block confirming the extraction:

```tsx
  it("renders the extracted TransportBar with the timeline intact", () => {
    const { container } = renderWithAtoms(<ProgressionTrack />, [
      [progressionEnabledAtom, true],
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    expect(container.querySelector("[data-testid='transport-bar']")).toBeTruthy();
    // Timeline + position readout stay in ProgressionTrack, not TransportBar.
    expect(container.querySelector("[aria-label='Progression timeline']")).toBeTruthy();
    expect(screen.getByText("Position")).toBeTruthy();
  });
```

- [ ] **Step 6: Run the affected tests to verify they pass**

Run: `npm run test -- src/components/ProgressionTrack/ src/components/TransportBar/`
Expected: PASS — all `ProgressionTrack`, `ProgressionPlayhead`, `ProgressionPositionReadout`, and `TransportBar` tests green, including the new assertion.

- [ ] **Step 7: Lint and type-check / build**

Run: `npm run lint && npm run build`
Expected: PASS — no eslint/stylelint errors, `tsc -b` clean (confirms the trimmed destructure has no unused-variable or missing-symbol errors), production build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/ProgressionTrack/
git commit -m "refactor(transport): render TransportBar in ProgressionTrack"
```

---

## Task 3: Verify visual parity and run the full quality gate

**Files:** none modified unless a visual baseline genuinely changes.

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test`
Expected: PASS — the whole Vitest suite green.

- [ ] **Step 2: Run the visual regression suite**

Run: `npm run test:visual`
Expected: PASS with **zero pixel diffs**. The extraction uses `display: contents`, so the rendered DOM box tree — and therefore every screenshot in `e2e/progression.visual.spec.ts` and `e2e/app-layout.visual.spec.ts` — is unchanged.

If any diff appears, the extraction is **not** pixel-identical — investigate and fix the cause (likely a missing `--track-*` property on `.transportBar`, or a moved CSS rule dropped). Do **not** blindly refresh baselines to paper over a real regression. Only if a diff is confirmed to be an unavoidable, intentional sub-pixel artifact should baselines be refreshed via `npm run test:visual:update` (darwin) and `npm run test:visual:update:linux` (linux), and that must be called out in the PR.

- [ ] **Step 3: Run the production e2e suite**

Run: `npm run test:e2e:production`
Expected: PASS — all e2e specs green.

- [ ] **Step 4: Commit any baseline changes (expected: none)**

If Step 2 produced no diffs, there is nothing to commit and Task 3 is complete. If baselines were legitimately refreshed:

```bash
git add e2e/
git commit -m "test(transport): refresh visual baselines after TransportBar extraction"
```

---

## Acceptance Criteria

- A new `src/components/TransportBar/` directory contains `TransportBar.tsx`, `TransportBar.module.css`, and `TransportBar.test.tsx`.
- `ProgressionTrack.tsx` renders `<TransportBar />` and contains no transport/status/instrument JSX and no `lucide-react` import.
- `ProgressionTrack.module.css` contains no `.transportButton` / `.transportCluster` / `.statusLight*` / `.instrumentCluster` / `.clusterDivider` rules; the timeline, readout, and accompaniment styling is untouched.
- Transport controls (play/pause, prev, next, loop) and backing-instrument toggles (strum/bass/drums/metronome) behave identically to before the extraction.
- The DAW track is visually unchanged in both themes and at all layout tiers (zero visual-regression diffs).
- `npm run lint`, `npm run test`, `npm run build`, `npm run test:visual`, and `npm run test:e2e:production` all pass.

---

## Self-Review Notes

- **Spec coverage (§5):** new `TransportBar.tsx` ✓ (Task 1), new `TransportBar.module.css` with the transport/cluster styles ✓ (Task 1), `ProgressionTrack.tsx` renders `<TransportBar />` ✓ (Task 2), timeline/playhead/position readout stay in `ProgressionTrack` ✓ (Task 2 Step 3), `TransportBar.test.tsx` covers play/pause + loop + each feature toggle + blocked-disables-play ✓ (Task 1 Step 1), `ProgressionTrack.test.tsx` asserts it renders `<TransportBar />` ✓ (Task 2 Step 5), visual baselines addressed ✓ (Task 3).
- **Scope decision:** per the resolved design question, `TransportBar` contains the status lights + both button clusters; `ProgressionPositionReadout` and the tempo/scale `.contextReadouts` stay in `ProgressionTrack` (spec §5: "position readout stay in `ProgressionTrack`"). The accompaniment selects/swing slider also stay.
- **No new atoms** — `TransportBar` reuses `useProgressionState`, consistent with spec §2 non-goals.
- **Type consistency:** `TransportBar` destructures only playback fields from `useProgressionState`; `ProgressionTrack`'s trimmed destructure keeps every field still referenced (`progressionPlaying`, `progressionPlaybackBlockedReason`, tempo, accompaniment, timeline fields). `tsc -b` in Task 2 Step 7 catches any mismatch.
```
