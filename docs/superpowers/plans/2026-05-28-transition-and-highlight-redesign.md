# Transition & Highlight Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make progression-playback chord transitions smooth and synchronized, make the next chord visible before it arrives, and make every highlight role unambiguous — without reintroducing a per-frame performance cost.

**Architecture:** Separate the fretboard's two visual channels by meaning — *identity* (static fill + ring; root gets a double-ring, loses its resting glow) and *voice-leading* (glow + motion, playback-only). Drive note emphasis from a **discrete phase** (`anticipationActive` boolean + step index) instead of the per-frame `localFraction`, so the existing per-frame `getEmphasis` recompute is eliminated and all boundary animation runs on the compositor via CSS. Restore the connector crossfade during playback by enabling the existing (memoized, GPU-composited) `motion.g` group rather than a new signal.

**Tech stack:** React 19 + TypeScript, Jotai atoms, `motion/react` (`motion.g` + `AnimatePresence`), SVG, CSS Modules, Vitest + Testing Library (unit/component), Playwright (visual regression). Package manager: **pnpm**. Spec: `docs/superpowers/specs/2026-05-28-transition-and-highlight-redesign-design.md`.

---

## File structure

**New:**
- `src/components/FretboardSVG/hooks/useEmphasisContext.ts` — reads the discrete emphasis atoms (anticipation phase, common tones, next guide tones, playing) so emphasis no longer depends on the per-frame frame atom. One responsibility: produce a frame-stable emphasis context.

**Modified:**
- `src/store/practiceLensAtoms.ts` — `isInAnticipationWindow` pure helper + `anticipationActiveAtom`.
- `src/components/FretboardSVG/utils/semantics.ts` — `LeadLensContext` becomes discrete; `getEmphasis` anticipation branch keys on `anticipationActive`.
- `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` — consume `useEmphasisContext`; drop per-frame emphasis dependency.
- `src/components/FretboardSVG/motionPolicy.ts` — `connectorMode: "group"` during playback.
- `src/components/FretboardSVG/FretboardConnectorLayer.tsx` — frame-stable memo; render-pass split (`pass: "below" | "above"`); ghost incoming-voicing preview.
- `src/components/FretboardSVG/FretboardNoteLayer.tsx` — single layer, stable keys, glow-underlay element, `transform: scale` radius emphasis, double-ring root.
- `src/components/FretboardSVG/FretboardSVG.tsx` — one note layer between connector below/above passes; pass next-voicing geometry.
- `src/components/FretboardSVG/FretboardSVG.module.css` — extend note transition set; glow-underlay + tempo-matched pulse `@keyframes`; double-ring root; drop root static glow.
- `src/styles/semantic.css` / `src/styles/themes.css` — stop applying a resting glow to the root note.

**Tests modified/added:**
- `src/store/practiceLensAtoms.test.ts` (or new) — window helper + atom.
- `src/components/FretboardSVG/utils/semantics.test.ts` — discrete anticipation inputs.
- `src/components/FretboardSVG/motionPolicy.test.ts` — playback connector branch.

---

## Slice 1 — Discrete-phase emphasis (perf)

### Task 1: `isInAnticipationWindow` pure helper

**Files:**
- Modify: `src/store/practiceLensAtoms.ts`
- Test: `src/store/practiceLensAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/store/practiceLensAtoms.test.ts` (create the file if absent, with the import line):

```ts
import { describe, it, expect } from "vitest";
import { isInAnticipationWindow } from "./practiceLensAtoms";

describe("isInAnticipationWindow", () => {
  it("is false when stepDurationBeats is non-positive", () => {
    expect(isInAnticipationWindow(0.99, 0)).toBe(false);
    expect(isInAnticipationWindow(0.99, -1)).toBe(false);
  });
  it("is false before the last beat", () => {
    // 4-beat step: threshold = 3/4 = 0.75
    expect(isInAnticipationWindow(0.74, 4)).toBe(false);
  });
  it("is true at/after the start of the last beat", () => {
    expect(isInAnticipationWindow(0.75, 4)).toBe(true);
    expect(isInAnticipationWindow(0.99, 4)).toBe(true);
  });
  it("treats a 1-beat step as always in-window", () => {
    expect(isInAnticipationWindow(0, 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "isInAnticipationWindow"`
Expected: FAIL — `isInAnticipationWindow` is not exported.

- [ ] **Step 3: Add the helper**

Near the top of `src/store/practiceLensAtoms.ts` (after imports), add:

```ts
/**
 * True when the playhead is inside the final beat of the active step — the
 * window in which the next chord's guide tones are previewed (anticipation).
 * Pure so it can be unit-tested without atom plumbing.
 */
export function isInAnticipationWindow(
  localFraction: number,
  stepDurationBeats: number,
): boolean {
  if (stepDurationBeats <= 0) return false;
  return localFraction >= (stepDurationBeats - 1) / stepDurationBeats;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "isInAnticipationWindow"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(lens): add isInAnticipationWindow helper"
```

### Task 2: `anticipationActiveAtom`

**Files:**
- Modify: `src/store/practiceLensAtoms.ts`
- Test: `src/store/practiceLensAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/store/practiceLensAtoms.test.ts`:

```ts
import { createStore } from "jotai";
import { anticipationActiveAtom } from "./practiceLensAtoms";
import { progressionPlayingStateAtom } from "./progressionAtoms";
import { progressionVisualFrameAtom } from "./progressionVisualAtoms";

describe("anticipationActiveAtom", () => {
  it("is false when not playing", () => {
    const store = createStore();
    store.set(progressionPlayingStateAtom, false);
    store.set(progressionVisualFrameAtom, {
      stepIndex: 0, globalFraction: 0.9, localFraction: 0.9, paused: false,
    });
    expect(store.get(anticipationActiveAtom)).toBe(false);
  });
  it("is false when there is no frame", () => {
    const store = createStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(progressionVisualFrameAtom, null);
    expect(store.get(anticipationActiveAtom)).toBe(false);
  });
  it("is false when paused", () => {
    const store = createStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(progressionVisualFrameAtom, {
      stepIndex: 0, globalFraction: 0.9, localFraction: 0.9, paused: true,
    });
    expect(store.get(anticipationActiveAtom)).toBe(false);
  });
});
```

> Note: `activeStepDurationBeatsAtom` is derived from progression state and defaults to a non-positive value with no progression loaded, so a positive-window assertion is covered by the pure-helper test in Task 1. These atom tests assert the playing/frame/paused gates that the helper cannot.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "anticipationActiveAtom"`
Expected: FAIL — `anticipationActiveAtom` is not exported.

- [ ] **Step 3: Add the atom**

Add imports at the top of `src/store/practiceLensAtoms.ts` if not already present:

```ts
import { progressionPlayingAtom } from "./progressionAtoms";
import { progressionVisualFrameAtom } from "./progressionVisualAtoms";
```

Then, after `activeStepDurationBeatsAtom` is defined (so it is in scope), add:

```ts
/**
 * Discrete anticipation phase. Reads the per-frame visual-frame atom but its
 * VALUE only flips at the last-beat threshold, so Jotai subscribers re-render
 * at most twice per step instead of every animation frame.
 */
export const anticipationActiveAtom = atom((get): boolean => {
  if (!get(progressionPlayingAtom)) return false;
  const frame = get(progressionVisualFrameAtom);
  if (!frame || frame.paused) return false;
  return isInAnticipationWindow(frame.localFraction, get(activeStepDurationBeatsAtom));
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "anticipationActiveAtom"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(lens): add anticipationActiveAtom discrete phase"
```

### Task 3: `getEmphasis` keys anticipation on the discrete boolean

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts:25-36,67-121`
- Test: `src/components/FretboardSVG/utils/semantics.test.ts`

- [ ] **Step 1: Update the failing tests first**

In `src/components/FretboardSVG/utils/semantics.test.ts`, every `getEmphasis` call that builds a `leadContext` currently passes `beatPosition` + `stepDurationBeats`. Replace those two fields with a single `anticipationActive` boolean. Add/confirm these cases exist:

```ts
it("anticipation: next-chord guide tone while anticipationActive", () => {
  const ctx = {
    notePc: "B",
    commonWithNext: new Set<string>(),
    nextGuideTones: new Set(["B"]),
    anticipationActive: true,
  };
  expect(getEmphasis("scale-only", false, ctx)).toEqual({
    glowColor: "var(--note-glow-anticipation)", radiusBoost: 1.15, opacityBoost: 1,
  });
});

it("no anticipation when anticipationActive is false", () => {
  const ctx = {
    notePc: "B",
    commonWithNext: new Set<string>(),
    nextGuideTones: new Set(["B"]),
    anticipationActive: false,
  };
  // Falls through to tones-base (scale-only dim).
  expect(getEmphasis("scale-only", false, ctx)).toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: FAIL — `anticipationActive` is not a recognized field; type/shape mismatch.

- [ ] **Step 3: Update `LeadLensContext` and `getEmphasis`**

In `src/components/FretboardSVG/utils/semantics.ts`, replace the `LeadLensContext` type (lines ~25-36):

```ts
export type LeadLensContext = {
  /** Pitch class of the note being classified. */
  notePc: string;
  /** Notes shared between the active chord and the next chord (common tones). */
  commonWithNext: Set<string>;
  /** Guide tones (3rd/7th) of the next chord — shown as anticipation in the last beat. */
  nextGuideTones: Set<string>;
  /** Discrete phase: true only during the final beat of the active step. */
  anticipationActive: boolean;
};
```

Replace the destructure + anticipation branch in `getEmphasis` (lines ~86-104):

```ts
  const { notePc, commonWithNext, nextGuideTones, anticipationActive } = leadContext;

  const isCurrentChordTone = CHORD_TONE_CLASSES.has(noteClass);

  // 1. Anticipation: next chord's guide tone during the last-beat window.
  if (anticipationActive && nextGuideTones.has(notePc)) {
    return { glowColor: "var(--note-glow-anticipation)", radiusBoost: 1.15, opacityBoost: 1 };
  }
```

Leave hold / departing / tones-base branches unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/utils/semantics.test.ts
git commit -m "refactor(lens): drive anticipation from discrete phase, not beat position"
```

### Task 4: Feed the discrete context into the note view

**Files:**
- Create: `src/components/FretboardSVG/hooks/useEmphasisContext.ts`
- Modify: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts:12-85,102-138`
- Modify: `src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.ts` (remove `beatPosition` if now unused by emphasis; keep `localFraction` for any playhead consumer)

- [ ] **Step 1: Create the emphasis-context hook**

`src/components/FretboardSVG/hooks/useEmphasisContext.ts`:

```ts
import { useAtomValue } from "jotai";
import {
  anticipationActiveAtom,
  commonTonesWithNextAtom,
  nextChordGuideTonesAtom,
} from "../../../store/practiceLensAtoms";
import { progressionPlayingAtom } from "../../../store/progressionAtoms";

export interface EmphasisContext {
  commonWithNext: Set<string>;
  nextGuideTones: Set<string>;
  anticipationActive: boolean;
}

/**
 * Frame-stable emphasis context. Every field changes only at a step boundary
 * or the anticipation threshold — never per animation frame — so note emphasis
 * recomputes at most twice per step.
 */
export function useEmphasisContext(enabled: boolean): EmphasisContext | null {
  const playing = useAtomValue(progressionPlayingAtom);
  const anticipationActive = useAtomValue(anticipationActiveAtom);
  const commonWithNext = useAtomValue(commonTonesWithNextAtom);
  const nextGuideTones = useAtomValue(nextChordGuideTonesAtom);
  if (!enabled || !playing) return null;
  return { commonWithNext, nextGuideTones, anticipationActive };
}
```

- [ ] **Step 2: Rewire `useAnimatedFretboardView` to use it**

In `useAnimatedFretboardView.ts`: replace `LeadLensSnapshot` and `buildLeadLensSnapshot` with the `EmphasisContext` shape. The `leadContext` built per note in `buildAnimatedFretboardNotes` now sets `anticipationActive` (from the context) instead of `beatPosition`/`stepDurationBeats`:

```ts
import { useEmphasisContext, type EmphasisContext } from "./useEmphasisContext";
// ...
export function buildAnimatedFretboardNotes({
  topology, hasChordOverlay, emphasisContext,
}: { topology: StaticFretboardTopologyNote[]; hasChordOverlay: boolean; emphasisContext?: EmphasisContext | null }): NoteData[] {
  return topology.map((note) => {
    let leadContext;
    if (hasChordOverlay && emphasisContext) {
      leadContext = {
        notePc: note.noteName,
        commonWithNext: emphasisContext.commonWithNext,
        nextGuideTones: emphasisContext.nextGuideTones,
        anticipationActive: emphasisContext.anticipationActive,
      };
    }
    return { ...note, applyLensEmphasis: getEmphasis(note.noteClass, note.isGuideTone, leadContext) };
  });
}
```

In the `useAnimatedFretboardView` hook body, replace the `playbackEmphasisSnapshot` memo with:

```ts
  const emphasisContext = useEmphasisContext(hasChordOverlay);
  const noteData = useMemo(
    () => buildAnimatedFretboardNotes({ topology, hasChordOverlay, emphasisContext }),
    [topology, hasChordOverlay, emphasisContext],
  );
```

Remove the now-unused `playbackSnapshot` emphasis path (the prop may remain for cx/cy geometry, which does not depend on it — if `playbackSnapshot` is now entirely unused by this hook, delete it from `UseAnimatedFretboardViewProps` and its call site in `FretboardSVG.tsx`).

- [ ] **Step 3: Update callers + types so the project type-checks**

Run: `pnpm exec tsc -b`
Expected initially: errors at the `useAnimatedFretboardView` call site / `useFretboardPlaybackSnapshot` references to removed fields. Fix each: drop `beatPosition` from `FretboardPlaybackSnapshot` if no remaining consumer (grep first: `grep -rn "beatPosition" src`), and remove the `leadLensSnapshot`/`playbackSnapshot` emphasis wiring from the `FretboardSVG.tsx` call.

- [ ] **Step 4: Run unit tests + typecheck**

Run: `pnpm exec tsc -b && pnpm exec vitest run src/components/FretboardSVG`
Expected: PASS (type-checks clean; existing component tests green).

- [ ] **Step 5: Verify the perf win in the browser**

Start the dev server (preview_start). Load a 4-bar progression, press Play. Confirm via the React DevTools profiler *or* a `console.count` temporarily added in `buildAnimatedFretboardNotes` that emphasis rebuilds ~twice per step, not ~60×/sec. Remove the temporary instrumentation.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/hooks/useEmphasisContext.ts \
  src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts \
  src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.ts \
  src/components/FretboardSVG/FretboardSVG.tsx
git commit -m "perf(fretboard): rebuild note emphasis on step boundary, not per frame"
```

---

## Slice 2 — Restore connector crossfade during playback

### Task 5: motionPolicy enables connectors during playback

**Files:**
- Modify: `src/components/FretboardSVG/motionPolicy.ts:28-29`
- Test: `src/components/FretboardSVG/motionPolicy.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/components/FretboardSVG/motionPolicy.test.ts`:

```ts
it("playback keeps connector group fade but freezes shapes", () => {
  expect(resolveFretboardMotionPolicy({ prefersReducedMotion: false, playbackActive: true }))
    .toEqual({ noteMode: "css", shapeMode: "none", connectorMode: "group" });
});
it("reduced motion overrides playback", () => {
  expect(resolveFretboardMotionPolicy({ prefersReducedMotion: true, playbackActive: true }))
    .toEqual({ noteMode: "none", shapeMode: "none", connectorMode: "none" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/motionPolicy.test.ts`
Expected: FAIL — current playback branch returns `connectorMode: "none"`.

- [ ] **Step 3: Update the policy**

In `motionPolicy.ts`, change the playback branch (line ~28):

```ts
  if (input.playbackActive ?? false) {
    // Connector crossfade stays on: motion.g animates only opacity (compositor)
    // and AnimatePresence only fires on chord-identity key changes, never on
    // RAF frame ticks. Shapes stay frozen — they don't change mid-playback.
    return { noteMode: "css", shapeMode: "none", connectorMode: "group" };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/FretboardSVG/motionPolicy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/motionPolicy.ts src/components/FretboardSVG/motionPolicy.test.ts
git commit -m "fix(transitions): re-enable connector crossfade during playback"
```

### Task 6: Guarantee `FretboardConnectorLayer` is frame-stable

**Files:**
- Modify: `src/components/FretboardSVG/FretboardConnectorLayer.tsx`
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx` (props passed to the connector evaluator/layer)

- [ ] **Step 1: Audit prop stability**

In `FretboardSVG.tsx`, locate the `<ChordConnectorEvaluator ... />` props (around lines 687-705). Confirm which props are recreated each render: `chordTones` (array), `clipPathUrl` (`svgDefUrl(...)` call), and any inline arrays. These break the `memo` on `FretboardConnectorLayer` every frame during playback.

- [ ] **Step 2: Stabilize them**

Memoize the offending values so identity is stable across frames (only changing on chord identity / layout change):

```ts
const connectorClipUrl = useMemo(() => svgDefUrl("fretboard-svg-box"), [svgDefUrl]);
const stableChordTones = useMemo(() => chordTones, [chordTones.join("-")]);
```

Pass `connectorClipUrl` and `stableChordTones` instead of the inline expressions.

- [ ] **Step 3: Verify no per-frame connector re-render**

Start the dev server. Add a temporary `console.count("connector-render")` at the top of `FretboardConnectorLayer`'s function body. Play a progression. Confirm the count increments only at chord boundaries, not every frame. Remove the instrumentation.

- [ ] **Step 4: Verify the crossfade + frame rate**

With the dev server running and a progression playing at a fast tempo: open preview, set BPM to 240, press Play. Capture a screenshot mid-transition (preview_screenshot) and confirm connectors crossfade rather than snap. Check preview_console_logs for dropped-frame warnings; confirm smooth playback.

- [ ] **Step 5: Run the full check + commit**

Run: `pnpm exec tsc -b && pnpm run test`
Expected: PASS.

```bash
git add src/components/FretboardSVG/FretboardConnectorLayer.tsx src/components/FretboardSVG/FretboardSVG.tsx
git commit -m "perf(transitions): keep connector layer frame-stable during playback"
```

---

## Slice 3 — Single note layer + transitionable emphasis

### Task 7: Split the connector render into below/above passes

**Files:**
- Modify: `src/components/FretboardSVG/FretboardConnectorLayer.tsx`
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx:665-719`

- [ ] **Step 1: Add a `pass` prop to the connector layer**

Give `FretboardConnectorLayer` (and the `renderStaticChordConnectorGroup` / `renderAnimatedChordConnectorGroup` / `renderChordPath` helpers) a `pass: "below" | "above"` prop. `"below"` renders only `halo` + `fill` layers; `"above"` renders only the `outline` layer. Interval connectors render only in the `"below"` pass (unchanged visual). The `motionKey` must include `pass` so the two passes have distinct keys:

```tsx
const motionKey = `chord-connectors-${pass}-${connectorSource}-${chordRoot}-${chordTones?.join("-") ?? "none"}-${polylinesKey}`;
```

```tsx
{pass === "below" && chordPolylines.map((v) => renderChordPath(v, "halo"))}
{pass === "below" && chordPolylines.map((v) => renderChordPath(v, "fill"))}
{pass === "above" && chordPolylines.map((v) => renderChordPath(v, "outline"))}
```

- [ ] **Step 2: Render below pass, then a single note layer, then above pass**

In `FretboardSVG.tsx`, replace the two `FretboardNoteLayer` instances + single `ChordConnectorEvaluator` (lines ~665-719) with: connector `pass="below"`, then **one** `FretboardNoteLayer` (no `filter` prop), then connector `pass="above"`:

```tsx
<ChordConnectorEvaluator {/* …existing props… */} pass="below" />
<g clipPath={svgDefUrl("fretboard-taper")}>
  <FretboardNoteLayer
    notes={renderedNotes}
    noteBubblePx={noteBubblePx}
    displayFormat={displayFormat}
    degreeColorsEnabled={degreeColorsEnabled}
    onNoteClick={onNoteClick}
    animationMode={motionPolicy.noteMode}
  />
</g>
<ChordConnectorEvaluator {/* …same props… */} pass="above" />
```

`ChordConnectorEvaluator` forwards the new `pass` prop to `FretboardConnectorLayer`. Both passes receive identical chord data (frame-stable from Task 6).

- [ ] **Step 3: Remove the `filter`/`CHORD_NOTE_CLASSES` split**

In `FretboardNoteLayer.tsx`, delete the `filter` prop, the `CHORD_NOTE_CLASSES` set, and the `filteredNotes` derivation; map `notes` directly. Keys stay `note-${stringIndex}-${fretIndex}` (now globally unique in one layer).

- [ ] **Step 4: Typecheck + visual verify**

Run: `pnpm exec tsc -b && pnpm run test`
Then start the dev server, enable a chord overlay (no playback). Screenshot. Confirm: chord-voicing polygon fill reads behind notes; the thin outline traces on top; non-chord scale notes are no longer underneath the fill in a way that looks broken. If the outline-over-chord-notes look is undesired, keep outline in the `"below"` pass too (move the `pass === "above"` outline line to `"below"`) — the single-note-layer fix still stands.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardConnectorLayer.tsx src/components/FretboardSVG/FretboardSVG.tsx src/components/FretboardSVG/FretboardNoteLayer.tsx
git commit -m "refactor(fretboard): single note layer between connector passes"
```

### Task 8: Transitionable radius + glow underlay

**Files:**
- Modify: `src/components/FretboardSVG/FretboardNoteLayer.tsx:100-206`
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css:38-41,387-396`

- [ ] **Step 1: Apply radius emphasis via transform, not geometry**

In `FretboardNoteLayer.tsx`, stop folding `applyLensEmphasis.radiusBoost` into the geometric radius. Compute `r` from `baseRadius * radiusScale` only, and set the emphasis boost as a scale transform on the note `<g>` so it can transition on the compositor:

```ts
const rawRadius = baseRadius * radiusScale;            // no radiusBoost here
// …
style={{
  "--note-r": r,
  "--emph-scale": applyLensEmphasis.radiusBoost,        // 1 = neutral
  transformBox: "fill-box",
  transformOrigin: "center",
  transform: `scale(var(--emph-scale, 1))`,
  opacity: finalOpacity !== 1 ? finalOpacity : undefined,
  // …existing fullChordStyle / degreeColor …
} as React.CSSProperties}
```

- [ ] **Step 2: Render glow as a transitionable underlay**

Replace the `data-lens-emphasis`-driven SVG `filter` with a dedicated underlay shape behind `shapeEl`, painted only when `applyLensEmphasis.glowColor` is set. Keep `data-lens-emphasis` on the `<g>` for the CSS hooks:

```tsx
{applyLensEmphasis.glowColor && (
  <circle
    className={styles["note-glow-underlay"]}
    cx={cx}
    cy={cy}
    r={r}
    style={{ fill: applyLensEmphasis.glowColor }}
    aria-hidden="true"
  />
)}
{shapeEl}
```

- [ ] **Step 3: Extend the CSS transition set + glow underlay styles**

In `FretboardSVG.module.css`, replace the opacity-only rule (lines 38-41) and the filter-based lens rules (lines 387-396):

```css
[data-motion="css"] .fretboard-note {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
[data-motion="css"] .fretboard-note :is(circle, path, polygon) {
  transition: fill 0.15s ease, stroke 0.15s ease, stroke-width 0.15s ease;
}

/* Voice-leading glow underlay — fades/scales on the compositor. */
.note-glow-underlay {
  pointer-events: none;
  opacity: 0.55;
  transform-box: fill-box;
  transform-origin: center;
  filter: blur(3px);
  transition: opacity 0.15s ease, fill 0.15s ease;
}

/* Anticipation pulse — duration matched to one beat via --beat-duration. */
.fretboard-note[data-lens-emphasis="var(--note-glow-anticipation)"] .note-glow-underlay {
  animation: note-anticipation-pulse var(--beat-duration, 0.5s) ease-in-out infinite alternate;
}
@keyframes note-anticipation-pulse {
  from { opacity: 0.4; transform: scale(1); }
  to   { opacity: 0.85; transform: scale(1.18); }
}
@media (prefers-reduced-motion: reduce) {
  .fretboard-note[data-lens-emphasis="var(--note-glow-anticipation)"] .note-glow-underlay {
    animation: none;
  }
}
```

Delete the SVG-filter rules that bound `--fretboard-svg-glow-cyan-url` / `-orange-url` to `.fretboard-note` (lines 389-396). Leave the `glowFilterUrls` `<defs>` in `FretboardSVG.tsx` if other code references them; otherwise remove in a follow-up.

- [ ] **Step 4: Write `--beat-duration` once per step (no per-frame JS)**

In `FretboardSVG.tsx`, on the board root element where `data-motion`/theme attributes live, set `--beat-duration` from the current tempo only when it changes:

```ts
const beatDurationSec = useMemo(
  () => (bpm > 0 ? 60 / bpm : 0.5),
  [bpm],
);
// on the board <g>/<svg> style:
style={{ "--beat-duration": `${beatDurationSec}s` } as React.CSSProperties}
```

(Source `bpm` from the existing tempo atom used by playback; grep `grep -rn "bpm" src/store` to find it.)

- [ ] **Step 5: Verify in the browser**

Start the dev server. With a chord overlay, confirm hold notes show a steady glow underlay and the root has no resting glow. Play a progression: confirm anticipation notes pulse during the last beat and the pulse speed tracks BPM (compare 60 vs 240). Confirm reduced-motion (emulate in preview) disables the pulse.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/FretboardNoteLayer.tsx src/components/FretboardSVG/FretboardSVG.module.css src/components/FretboardSVG/FretboardSVG.tsx
git commit -m "feat(fretboard): transitionable radius + glow underlay with tempo-matched pulse"
```

---

## Slice 4 — Channel separation: identity vs voice-leading

### Task 9: Root double-ring; remove root resting glow

**Files:**
- Modify: `src/components/FretboardSVG/FretboardNoteLayer.tsx:123-141`
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css`
- Modify: `src/styles/semantic.css` / `src/styles/themes.css` (only if the root note currently binds `--note-glow-tonic` as a resting glow)

- [ ] **Step 1: Confirm where the root resting glow comes from**

Run: `grep -rn "note-glow-tonic\|chord-root" src/components/FretboardSVG src/styles | grep -i glow`
Identify any rule that applies a glow filter/shadow to `.chord-root` / `key-tonic` at rest (not via `data-lens-emphasis`). That is the resting glow to remove.

- [ ] **Step 2: Give the root a double-ring marker**

The chord-root squircle already renders a halo path (lines 126-139). Make it a clear **second ring** (concentric, consistent stroke) rather than a faint tension-only halo, so root identity is unmistakable without glow:

```tsx
{noteClass === "chord-root" && (
  <path
    d={squirclePath(cx, cy, r + CHORD_ROOT_HALO_RADIUS_PX)}
    className={styles["note-root-ring"]}
    style={{
      fill: "none",
      stroke: "var(--note-ring-tonic)",
      strokeWidth: isTension ? 2 : 1.6,
      strokeDasharray: isTension ? "6 3" : undefined,
      paintOrder: "stroke",
    }}
  />
)}
```

Add to `FretboardSVG.module.css`:

```css
.note-root-ring { transition: stroke 0.15s ease; }
```

- [ ] **Step 3: Remove the resting glow**

Delete/neutralize the rule found in Step 1 so the root note has no resting glow (glow is now exclusively voice-leading via the underlay). If it lived in `semantic.css`/`themes.css` as a token application, drop that application; keep the `--note-glow-tonic` token definition only if still referenced elsewhere (`grep -rn "note-glow-tonic" src`).

- [ ] **Step 4: Verify legibility in both modes**

Start the dev server. In light mode and dark mode, with a chord overlay: confirm the root reads as a double-ring (no glow); chord tones read as single teal ring; during playback, anticipation (rust pulse) vs hold (steady teal) vs departing (dim, no glow) are each distinguishable. Capture before/after screenshots (preview_screenshot) in both modes.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardNoteLayer.tsx src/components/FretboardSVG/FretboardSVG.module.css src/styles/semantic.css src/styles/themes.css
git commit -m "feat(fretboard): root double-ring marker; reserve glow for voice-leading"
```

---

## Slice 5 — Ghost next-chord preview

### Task 10: Render the incoming voicing as a ghost during anticipation

**Files:**
- Modify: `src/store/practiceLensAtoms.ts` (or wherever next-step chord data resolves) — expose the next step's voicing geometry input
- Modify: `src/components/FretboardSVG/FretboardConnectorLayer.tsx`
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx`

- [ ] **Step 1: Resolve the incoming voicing geometry**

Find the atom chain that produces `fullChordVoicings` for the active step (`grep -rn "fullChordVoicings\|nextResolved\|displayedProgressionStepIndexAtom" src/store`). Add a selector that resolves the **next** step's chord the same way the active step is resolved, producing the next step's connector-voicing input (root + tones). Expose it as `nextChordVoicingInputAtom`. If the next step is unavailable (end of loop boundary handling), it returns `null`.

- [ ] **Step 2: Compute ghost polylines**

In `FretboardSVG.tsx`, feed `nextChordVoicingInputAtom` (gated by `anticipationActiveAtom`) through the same connector-polyline computation used for the active chord (the `ChordConnectorEvaluator` / `useChordConnectorPolylines` path), producing `ghostPolylines`. When `anticipationActive` is false, `ghostPolylines` is empty.

- [ ] **Step 3: Render the ghost in the below pass**

Pass `ghostPolylines` into `FretboardConnectorLayer` and render them in the `"below"` pass as a separate group with a ghost class:

```tsx
{pass === "below" && ghostPolylines.length > 0 && (
  <g className={styles["chord-connectors-ghost"]} aria-hidden="true" pointerEvents="none">
    {ghostPolylines.map((v) => renderChordPath(v, "outline"))}
  </g>
)}
```

Add to `FretboardSVG.module.css`:

```css
.chord-connectors-ghost path {
  fill: none;
  stroke: var(--note-ring);
  stroke-width: 1.5px;
  stroke-dasharray: 5 4;
  opacity: 0.45;
  transition: opacity 0.15s ease;
}
@media (prefers-reduced-motion: reduce) {
  .chord-connectors-ghost { display: none; }
}
```

- [ ] **Step 4: Verify**

Start the dev server. Play a 4-bar progression at a slow tempo (e.g. 70 BPM) so the last beat is easy to see. Confirm a dashed ghost of the next chord's shape appears during the final beat of each step and resolves into the full connector at the boundary. Screenshot the anticipation frame. Confirm reduced-motion hides the ghost.

- [ ] **Step 5: Run full suite + commit**

Run: `pnpm exec tsc -b && pnpm run test`
Expected: PASS.

```bash
git add src/store src/components/FretboardSVG/FretboardConnectorLayer.tsx src/components/FretboardSVG/FretboardSVG.tsx src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "feat(transitions): ghost incoming-voicing preview during anticipation"
```

---

## Slice 6 — Verification & visual baselines

### Task 11: Lint, build, full test, visual refresh

**Files:** none (verification) + regenerated snapshots under `e2e/`

- [ ] **Step 1: Lint + typecheck + unit/component tests**

Run: `pnpm run lint && pnpm exec tsc -b && pnpm run test`
Expected: all PASS. Fix any failures before continuing.

- [ ] **Step 2: Refresh visual baselines**

Run: `pnpm run test:visual:update`
Expected: darwin snapshots regenerated for `app-components/fretboard-svg-*`, chord-overlay, and any playback-frame suites in both light + dark modes.

- [ ] **Step 3: Review the snapshot diff**

Run: `git status` and inspect the changed PNGs. Confirm the diffs match intended changes (root double-ring, glow underlay, no resting root glow, connector crossfade frames). No unexpected layout shifts.

- [ ] **Step 4: Production e2e**

Run: `pnpm run test:e2e:production`
Expected: PASS.

- [ ] **Step 5: Manual smoke (preview)**

Start the dev server. Verify the full matrix from the spec's Testing section: both modes; CAGED + 3NPS; idle vs playback; root legibility; guide/anticipation/hold/departing distinct; ghost preview in last beat; smooth at 60 and 240 bpm; reduced-motion fully static. Capture a short set of confirming screenshots.

- [ ] **Step 6: Commit baselines**

```bash
git add e2e
git commit -m "test(visual): refresh baselines for transition + highlight redesign"
```

---

## Self-review notes

- **Spec coverage:** §1 channel separation → Tasks 8-9; §2 discrete phase → Tasks 1-4; §3 connector crossfade + transition mechanics → Tasks 5-8; §4 ghost preview → Task 10; §5 tokens → Task 9; testing/perf → Tasks 4, 6, 11.
- **Type consistency:** `LeadLensContext` field renamed `beatPosition`/`stepDurationBeats` → `anticipationActive` is applied in Task 3 (type + producer in Task 4 + tests in Task 3). `EmphasisContext` defined once in Task 4 and consumed there. `pass: "below" | "above"` defined in Task 7 and consumed in Tasks 7 + 10.
- **Open decision (visual review):** Task 7 Step 4 — outline in `"above"` vs `"below"` pass. Task 9 — exact double-ring radius/stroke. Both resolved by preview inspection during implementation, not re-spec.
