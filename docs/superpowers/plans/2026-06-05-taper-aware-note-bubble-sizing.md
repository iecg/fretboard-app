# Taper-aware Note-bubble Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Size note bubbles to the local vertical string spacing so crowded voicings near the nut relax, while the rest of the neck stays pixel-identical.

**Architecture:** Add one pure scalar `taperAwareRadiusScale(x)` that multiplies the existing per-role `radiusScale` in the visible note marker. It uses the neck's existing closed-form taper (`getStringY`) to compute local string spacing at a note's x, and clamps to 1 wherever a full bubble already fits — so only the converged nut region shrinks. Applied to the visible markers only; touch targets are left full-size.

**Tech Stack:** React 19 + TypeScript, SVG, Vitest + Testing Library (jsdom), Playwright visual regression, pnpm workspace, `@fretflow/core` constants.

**Prerequisite:** This builds on PR #535 (line-only connector spine + color/dash). The connector spine runs through note centers, so it inherits the relief with no connector-side edit.

**Spec:** `docs/superpowers/specs/2026-06-05-taper-aware-note-bubble-sizing-design.md`

---

## File Structure

- **Modify** `src/components/FretboardSVG/utils/noteSizing.ts` — add the pure `taperAwareRadiusScale` helper + its two tuning constants. This file already owns bubble-radius math, so the helper belongs here.
- **Create** `src/components/FretboardSVG/utils/noteSizing.test.ts` — unit tests for the pure helper (no DOM).
- **Modify** `src/components/FretboardSVG/FretboardNote.tsx` — accept three optional layout props and fold the scalar into the rendered radius.
- **Modify** `src/components/FretboardSVG/FretboardNoteLayer.tsx` — forward the three layout props to each `FretboardNote`.
- **Modify** `src/components/FretboardSVG/FretboardSVG.tsx` — pass `neckWidthPx` / `neckHeight` / `numStrings` (all already in scope) into `FretboardNoteLayer`.
- **Modify** `src/components/FretboardSVG/FretboardNoteLayer.test.tsx` — add one test proving near-nut shrink + far-neck no-op. Existing tests are unaffected (they pass no layout props → scalar is 1).
- **Visual** `e2e/` darwin + linux snapshots — refresh nut-region suites.

The **hit-target layer is intentionally not modified** — touch targets stay full-size for tap accuracy (design decision: visible bubbles only).

---

## Task 1: Pure `taperAwareRadiusScale` helper

**Files:**
- Modify: `src/components/FretboardSVG/utils/noteSizing.ts`
- Test: `src/components/FretboardSVG/utils/noteSizing.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/FretboardSVG/utils/noteSizing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  taperAwareRadiusScale,
  NOTE_TAPER_MIN_SCALE,
} from "./noteSizing";

// Reference geometry used across cases: a wide neck so xFrac resolves cleanly.
// maxSpacing = neckHeight * STRING_OCCUPY_FRAC / (numStrings - 1)
//            = 300 * 0.86 / 5 = 51.6
// referenceSpacing = noteBubblePx * (1 + 0.18) = 40 * 1.18 = 47.2
const GEOM = {
  neckWidthPx: 1000,
  neckHeight: 300,
  numStrings: 6,
  noteBubblePx: 40,
};

describe("taperAwareRadiusScale", () => {
  it("returns exactly 1 at the wide (bridge) end where bubbles already fit", () => {
    expect(taperAwareRadiusScale({ x: 1000, ...GEOM })).toBe(1);
  });

  it("shrinks below 1 near the nut where strings have converged", () => {
    const nut = taperAwareRadiusScale({ x: 0, ...GEOM });
    expect(nut).toBeLessThan(1);
    expect(nut).toBeGreaterThan(NOTE_TAPER_MIN_SCALE);
    // spacingRatio(0)=0.76 → localSpacing=39.216 → 39.216/47.2 ≈ 0.8309
    expect(nut).toBeCloseTo(0.8309, 3);
  });

  it("is monotonic: nut scale <= bridge scale", () => {
    const nut = taperAwareRadiusScale({ x: 0, ...GEOM });
    const bridge = taperAwareRadiusScale({ x: 1000, ...GEOM });
    expect(nut).toBeLessThanOrEqual(bridge);
  });

  it("never exceeds 1, even past the right edge", () => {
    expect(taperAwareRadiusScale({ x: 99999, ...GEOM })).toBe(1);
  });

  it("floors at NOTE_TAPER_MIN_SCALE for extreme crowding", () => {
    // Huge bubble vs the same spacing → would compute well below the floor.
    const scale = taperAwareRadiusScale({ x: 0, ...GEOM, noteBubblePx: 200 });
    expect(scale).toBe(NOTE_TAPER_MIN_SCALE);
  });

  it("returns 1 for degenerate geometry (no-op for callers without layout)", () => {
    expect(taperAwareRadiusScale({ x: 0, ...GEOM, neckWidthPx: 0 })).toBe(1);
    expect(taperAwareRadiusScale({ x: 0, ...GEOM, numStrings: 1 })).toBe(1);
    expect(taperAwareRadiusScale({ x: 0, ...GEOM, noteBubblePx: 0 })).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/noteSizing.test.ts`
Expected: FAIL — `taperAwareRadiusScale` / `NOTE_TAPER_MIN_SCALE` are not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/components/FretboardSVG/utils/noteSizing.ts`, update the import block and append the helper. The top import becomes:

```ts
import {
  NOTE_BUBBLE_RATIO,
  RADIUS_SCALE_CHORD_ROOT,
  STRING_SPREAD_LEFT_FRAC,
  STRING_OCCUPY_FRAC,
} from "@fretflow/core";
```

Append at the end of the file:

```ts
/** Radius floor near the nut — keeps labels legible at the tightest spacing. */
export const NOTE_TAPER_MIN_SCALE = 0.72;

/**
 * Desired clear gap between adjacent bubbles, as a fraction of a full bubble
 * diameter. Folded into `referenceSpacing` so the shrink kicks in slightly
 * before bubbles actually touch.
 */
export const NOTE_TAPER_GAP_FRACTION = 0.18;

/**
 * Per-note radius multiplier (∈ [minScale, 1]) that relieves bubble crowding
 * where the neck taper converges the strings toward the nut.
 *
 * Pure f(x): the scale depends only on the note's pixel x, via the local
 * vertical string spacing derived from the same taper model as
 * `fretboardGeometry.ts#getStringY`. Every note in a fret column therefore
 * shrinks by the same factor — no per-string jitter.
 *
 * The clamp-to-1 guarantees mid/high neck is pixel-identical: wherever local
 * spacing already exceeds a comfortable bubble (`referenceSpacing`), the scale
 * is exactly 1. Only the nut region — where strings are closer than one
 * bubble-plus-gap — dips below.
 *
 * Returns 1 for degenerate geometry so callers that omit layout info (e.g.
 * existing unit tests) are unaffected.
 */
export function taperAwareRadiusScale({
  x,
  neckWidthPx,
  neckHeight,
  numStrings,
  noteBubblePx,
  minScale = NOTE_TAPER_MIN_SCALE,
  gapFraction = NOTE_TAPER_GAP_FRACTION,
}: {
  x: number;
  neckWidthPx: number;
  neckHeight: number;
  numStrings: number;
  noteBubblePx: number;
  minScale?: number;
  gapFraction?: number;
}): number {
  if (neckWidthPx <= 0 || numStrings < 2 || noteBubblePx <= 0) return 1;

  const xFrac = Math.max(0, Math.min(1, x / neckWidthPx));
  const spacingRatio =
    STRING_SPREAD_LEFT_FRAC + (1 - STRING_SPREAD_LEFT_FRAC) * xFrac;
  const maxSpacing = (neckHeight * STRING_OCCUPY_FRAC) / (numStrings - 1);
  const localSpacing = spacingRatio * maxSpacing;
  const referenceSpacing = noteBubblePx * (1 + gapFraction);

  const scale = localSpacing / referenceSpacing;
  return Math.max(minScale, Math.min(1, scale));
}
```

> Note: `NOTE_BUBBLE_RATIO` / `RADIUS_SCALE_CHORD_ROOT` stay imported (used by the existing `chordRootVisualRadiusPx`). Keep them.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/noteSizing.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/utils/noteSizing.ts src/components/FretboardSVG/utils/noteSizing.test.ts
git commit -m "feat(fretboard): add taper-aware note radius scalar

Pure f(x) multiplier that shrinks bubbles only where the neck taper
converges strings near the nut; clamps to 1 elsewhere so mid/high neck
is unchanged. No call sites yet.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Apply the scalar to the visible note markers

**Files:**
- Modify: `src/components/FretboardSVG/FretboardNote.tsx`
- Modify: `src/components/FretboardSVG/FretboardNoteLayer.tsx`
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx`
- Test: `src/components/FretboardSVG/FretboardNoteLayer.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this test inside the `describe("FretboardNoteLayer", ...)` block in `src/components/FretboardSVG/FretboardNoteLayer.test.tsx` (after the existing radius tests). It renders the layer directly so it can pass the new layout props:

```tsx
it("shrinks near-nut bubbles but leaves the far neck pixel-identical", () => {
  const noteBubblePx = 40;
  const layout = { neckWidthPx: 1000, neckHeight: 300, numStrings: 6 };
  const fullRadius =
    (noteBubblePx / 2) * getNoteVisuals("note-active").radiusScale -
    CIRCLE_RADIUS_REDUCTION_PX;

  const { container } = render(
    <svg>
      <FretboardNoteLayer
        notes={[
          makeNote("note-active", { stringIndex: 0, fretIndex: 0, cx: 0, cy: 30 }),
          makeNote("note-active", { stringIndex: 1, fretIndex: 12, cx: 1000, cy: 60 }),
        ]}
        noteBubblePx={noteBubblePx}
        displayFormat="notes"
        {...layout}
      />
    </svg>,
  );

  const markers = [...container.querySelectorAll('circle:not([data-glow])')];
  expect(markers).toHaveLength(2);
  const [nutR, bridgeR] = markers.map((c) => Number(c.getAttribute("r")));

  // Far end: unchanged (scale === 1).
  expect(bridgeR).toBeCloseTo(fullRadius);
  // Nut end: strictly smaller.
  expect(nutR).toBeLessThan(bridgeR);
  // Nut end: scale 0.8309 applied to rawRadius BEFORE the px reduction.
  const expectedNut =
    (noteBubblePx / 2) * getNoteVisuals("note-active").radiusScale * 0.8309 -
    CIRCLE_RADIUS_REDUCTION_PX;
  expect(nutR).toBeCloseTo(expectedNut, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNoteLayer.test.tsx -t "shrinks near-nut"`
Expected: FAIL — `FretboardNoteLayer` ignores the layout props, so `nutR === bridgeR` (both `fullRadius`).

- [ ] **Step 3: Add the layout props to `FretboardNote` and apply the scalar**

In `src/components/FretboardSVG/FretboardNote.tsx`:

Update the import on line 6 to add `taperAwareRadiusScale`:

```ts
import { glowUnderlayRadiusPx, reduceCircleRadius, taperAwareRadiusScale } from "./utils/noteSizing";
```

Extend the props interface (replace the existing `FretboardNoteProps`):

```ts
interface FretboardNoteProps {
  note: RenderedFretboardNote;
  noteBubblePx: number;
  displayFormat: "notes" | "degrees" | "none";
  /** Layout geometry for taper-aware sizing. Omitted → no shrink (scale 1). */
  neckWidthPx?: number;
  neckHeight?: number;
  numStrings?: number;
  onNoteClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
}
```

Add the new params to the destructured function signature:

```ts
export const FretboardNote = memo(function FretboardNote({
  note,
  noteBubblePx,
  displayFormat,
  neckWidthPx,
  neckHeight,
  numStrings,
  onNoteClick,
}: FretboardNoteProps) {
```

Replace the radius computation (currently lines 65-68) with:

```ts
  const baseRadius = noteBubblePx / 2;
  const { radiusScale, noteShape } = getNoteVisuals(noteClass);
  const taperScale = taperAwareRadiusScale({
    x: cx,
    neckWidthPx: neckWidthPx ?? 0,
    neckHeight: neckHeight ?? 0,
    numStrings: numStrings ?? 0,
    noteBubblePx,
  });
  const rawRadius = baseRadius * radiusScale * taperScale;
  const r = reduceCircleRadius(rawRadius);
```

(`cx` is already destructured from `note` above — no other change needed; `glowR`, the guide ring `r + 4`, and label offsets all derive from `r` automatically.)

- [ ] **Step 4: Forward the props through `FretboardNoteLayer`**

In `src/components/FretboardSVG/FretboardNoteLayer.tsx`, extend the props interface:

```ts
interface FretboardNoteLayerProps {
  notes: RenderedFretboardNote[];
  noteBubblePx: number;
  displayFormat: "notes" | "degrees" | "none";
  animationMode?: NoteAnimationMode;
  /** Layout geometry for taper-aware bubble sizing. */
  neckWidthPx?: number;
  neckHeight?: number;
  numStrings?: number;
}
```

Update the component signature and the `FretboardNote` element:

```tsx
export const FretboardNoteLayer = memo(({
  notes,
  noteBubblePx,
  displayFormat,
  animationMode = "css",
  neckWidthPx,
  neckHeight,
  numStrings,
}: FretboardNoteLayerProps) => (
  <g data-motion={animationMode}>
    {notes.map((note) => (
      <FretboardNote
        key={`note-${note.stringIndex}-${note.fretIndex}`}
        note={note}
        noteBubblePx={noteBubblePx}
        displayFormat={displayFormat}
        neckWidthPx={neckWidthPx}
        neckHeight={neckHeight}
        numStrings={numStrings}
      />
    ))}
  </g>
));
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNoteLayer.test.tsx`
Expected: PASS — the new test plus all existing tests (existing tests pass no layout props → scale 1 → radii unchanged).

- [ ] **Step 6: Wire the layout props at the call site in `FretboardSVG.tsx`**

In `src/components/FretboardSVG/FretboardSVG.tsx`, find the `<FretboardNoteLayer ... />` usage (~line 704) and add the three props (`neckWidthPx`, `neckHeight`, `numStrings` are all already in scope in this component):

```tsx
                  <FretboardNoteLayer
                    notes={renderedNotes}
                    noteBubblePx={noteBubblePx}
                    displayFormat={displayFormat}
                    animationMode={motionPolicy.noteMode}
                    neckWidthPx={neckWidthPx}
                    neckHeight={neckHeight}
                    numStrings={numStrings}
                  />
```

- [ ] **Step 7: Verify the whole suite + types**

Run: `pnpm exec vitest run src/components/FretboardSVG/`
Expected: PASS.

Run: `pnpm exec tsc -b`
Expected: clean (no errors).

- [ ] **Step 8: Commit**

```bash
git add src/components/FretboardSVG/FretboardNote.tsx src/components/FretboardSVG/FretboardNoteLayer.tsx src/components/FretboardSVG/FretboardSVG.tsx src/components/FretboardSVG/FretboardNoteLayer.test.tsx
git commit -m "feat(fretboard): shrink crowded near-nut note bubbles

Thread neckWidthPx/neckHeight/numStrings into the note layer and fold
taperAwareRadiusScale into the visible marker radius. Touch targets are
deliberately left full-size. Mid/high neck is pixel-identical.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Visual regression + §2/§3 acceptance check

**Files:**
- Modify (regenerated): darwin + linux snapshots under `e2e/`

- [ ] **Step 1: Refresh darwin visual snapshots**

Run: `pnpm run test:visual:update`
Expected: snapshots for the fretboard suites regenerate. Inspect the diff for the nut-region suites (`fretboard-svg`, `app-components`): near-nut bubbles should be visibly smaller; mid/high-neck bubbles unchanged.

- [ ] **Step 2: Refresh linux visual snapshots**

Run: `pnpm run test:visual:update:linux`
Expected: linux snapshots regenerate (Docker). Required so CI's linux visual job passes.

- [ ] **Step 3: §2 acceptance check (spine routing)**

Visually inspect a cramped near-nut voicing (e.g. an open-position chord with stacked fret-1 notes) in the refreshed snapshots / `pnpm run dev`.
**Criterion:** no voicing's spine is fully occluded by its own bubbles at minimum zoom.
- PASS → record in commit body, no further code.
- FAIL → stop and open a follow-up (rim-routing in `useChordConnectorPolylines.ts`); do not bolt it onto this task.

- [ ] **Step 4: §3 acceptance check (color/dash legibility)**

On the refreshed board, both wood themes:
**Criteria:** every concurrent voicing distinguishable; dash legible at minimum zoom; no palette entry low-contrast on wood.
- PASS → record in commit body.
- FAIL → open a follow-up to tune `CONNECTOR_PALETTE_ROTATION` / dash; out of scope here.

- [ ] **Step 5: Commit the snapshots**

```bash
git add e2e
git commit -m "test(visual): refresh snapshots for taper-aware bubble sizing

Near-nut bubbles shrink; mid/high neck unchanged. §2 (spine occlusion)
and §3 (color/dash legibility) acceptance criteria checked on the
post-shrink board: [PASS / follow-up filed].

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Full local gate

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: clean.

- [ ] **Step 2: Unit/component tests**

Run: `pnpm run test`
Expected: all pass.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: `tsc -b && vite build` succeed.

- [ ] **Step 4: Confirm tuning values**

If the §1 visual pass showed the shrink too weak or too strong, adjust `NOTE_TAPER_MIN_SCALE` (floor) and/or `NOTE_TAPER_GAP_FRACTION` (how early shrink begins) in `noteSizing.ts`, re-run Task 1 tests (update the `toBeCloseTo(0.8309, 3)` expectation if `NOTE_TAPER_GAP_FRACTION` changed), re-run Task 3 snapshot refresh, and amend/commit. The mechanism does not change — only these two constants.

- [ ] **Step 5: Final commit (if any tuning changed)**

```bash
git add -A
git commit -m "chore(fretboard): tune taper shrink constants after visual pass

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **Why `cx` and not `fretIndex`:** the scalar must respond to pixel x, and `cx = fretCenterX(fretIndex)` already accounts for the open column and fret-scale. The note carries `cx`; use it directly.
- **Why the props are optional / default to scale 1:** existing `FretboardNoteLayer` tests render without layout props. The degenerate guard in `taperAwareRadiusScale` keeps them green and makes the helper safe before wiring.
- **Do not touch `renderedNoteSignature`:** the new inputs are component props, not `RenderedFretboardNote` fields. `cx` (the only note field the scalar reads) is already in the signature.
- **Hit targets stay full-size:** do not add scaling to `FretboardHitTargetLayer` — shrinking touch areas near the nut is an accessibility regression and this effort is purely visual.
