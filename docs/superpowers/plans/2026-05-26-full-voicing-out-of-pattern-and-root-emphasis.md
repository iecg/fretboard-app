# Full-Voicing Out-of-Pattern Notes + Connector Membership + Root Emphasis

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a full-chord CAGED voicing places a note outside the active scale-pattern polygon, render it at full opacity as part of the voicing; ensure every voicing-vertex position is classified as an in-connector chord tone; make the chord-root visually distinct in full-chord-voicing mode where the per-shape color rule currently flattens it.

**Architecture:** Three orthogonal fixes layered onto the existing `useNoteData` + `FretboardNoteLayer` + `FretboardSVG.module.css` pipeline. No new modules. The key insight: `fullChordPositionKeys` (already plumbed through `useNoteData`) is the source of truth for "this coordinate belongs to a voicing" and must (a) suppress out-of-polygon dimming, (b) force a chord-tone class even when the polygon-based `isInPlayableContext` says otherwise, and (c) attach a halo/ring to chord-root squircles that survives the `[data-full-chord-mode="true"]` shape-color override.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library (jsdom), CSS Modules. No new dependencies.

---

## Context recap

Recent CAGED expansion (`2026-05-25-caged-templates-7ths-sus-dim.md`, 50 templates) made full-chord voicings frequently extend past the active CAGED scale-pattern polygon. Three user-visible issues followed:

1. **Out-of-pattern voicing notes look faded.** `useNoteData.ts:325-334` sets `applyDimOpacity = true` whenever a chord-styled note is not inside any `shapePolygon`. Voicing notes outside the polygon get dimmed to opacity 0.8 even though they're part of the played voicing.
2. **Some connector-vertex notes don't get the in-scale chord-tone class.** When `chordToneSet.has(noteName)` returns false (e.g., enharmonic mismatch on a dim/half-dim b5) or `isInPlayableContext` is false (out-of-polygon notes when `chordBoxBounds !== null`), the position falls through to `note-inactive` or `chord-tone-outside-scale` despite being a voicing vertex.
3. **Chord-root is barely distinguishable in full-chord mode.** `FretboardSVG.module.css:98-121` overrides `:is(circle, path, polygon)` fill+stroke per `[data-full-chord-shape="X"]`. Because squircles render via `<path>`, that rule wins over `.chord-root :is(circle, path, polygon)`, leaving roots flat-colored like every other voicing note.

## File map

- `src/components/FretboardSVG/hooks/useNoteData.ts` — predicate updates (dim suppression + class override).
- `src/components/FretboardSVG/hooks/useNoteData.test.ts` — new tests for both predicate changes.
- `src/components/FretboardSVG/FretboardNoteLayer.tsx` — render the chord-root halo unconditionally (already exists; widen its trigger).
- `src/components/FretboardSVG/FretboardSVG.module.css` — chord-root halo + label treatment that survives the full-chord-shape color override.
- `src/components/FretboardSVG/FretboardSVG.test.tsx` — assert the data attributes and CSS classes used by the new selectors.

No new files. No type-shape changes to public exports.

---

## Task 1: Suppress dim opacity for voicing-vertex notes outside polygon

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useNoteData.ts:325-334`
- Test: `src/components/FretboardSVG/hooks/useNoteData.test.ts` (add new `describe` block)

- [ ] **Step 1: Write the failing test**

Append to `useNoteData.test.ts` (the file already has the `fullChordPositionKeys` fixture pattern at line 213 — mirror it):

```typescript
import { describe, it, expect } from "vitest";
import { useNoteData } from "./useNoteData";
// (existing imports already present)

describe("useNoteData — full-voicing notes outside polygon", () => {
  it("does not dim a chord-tone note that lives outside any shape polygon but is in fullChordPositionKeys", () => {
    // Build minimal inputs: a single position (string 0, fret 7) that is
    // (a) in chordTones, (b) outside the only provided polygon, (c) included
    // in fullChordPositionKeys.
    const polygon = {
      shape: "E",
      vertices: [
        { string: 0, fret: 12 }, { string: 1, fret: 12 }, { string: 2, fret: 13 },
        { string: 3, fret: 14 }, { string: 4, fret: 14 }, { string: 5, fret: 12 },
        { string: 5, fret: 12 }, { string: 4, fret: 14 }, { string: 3, fret: 14 },
        { string: 2, fret: 13 }, { string: 1, fret: 12 }, { string: 0, fret: 12 },
      ],
      truncated: false,
    };
    const layoutRow = ["E", "F", "F#", "G", "G#", "A", "A#", "B", "C", "C#", "D", "D#", "E"];
    const { result } = renderHook(() =>
      useNoteData({
        numStrings: 1,
        fretboardLayout: [layoutRow],
        totalColumns: 12,
        startFret: 0,
        maxFret: 13,
        highlightNotes: ["C", "E", "G"],
        hasChordOverlay: true,
        chordTones: ["C", "E", "G"],
        rootNote: "C",
        chordRoot: "C",
        colorNotes: [],
        // @ts-expect-error minimal polygon shape for test
        shapePolygons: [polygon],
        chordBoxBounds: [{ minFret: 12, maxFret: 14 }],
        chordFretSpread: 0,
        activePattern: "caged",
        shapeScope: "single",
        activeShape: "E",
        scaleName: "major",
        preferFlats: false,
        wrappedNotes: new Set<string>(),
        tuning: ["E"],
        fullChordPositionKeys: new Set(["0-8"]), // C at string 0, fret 8 — outside polygon
        fullChordShapeByPosition: new Map([["0-8", "E"]]),
      })
    );

    const outOfPolygonC = result.current.find(
      (n) => n.stringIndex === 0 && n.fretIndex === 8,
    );
    expect(outOfPolygonC).toBeDefined();
    // Must NOT be dimmed despite living outside the polygon.
    expect(outOfPolygonC!.applyDimOpacity).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/FretboardSVG/hooks/useNoteData.test.ts -t "does not dim a chord-tone"`
Expected: FAIL — `expect(outOfPolygonC!.applyDimOpacity).toBe(false)` receives `true`.

- [ ] **Step 3: Patch the dim predicate**

In `src/components/FretboardSVG/hooks/useNoteData.ts`, replace lines 325-334 (the `const applyDimOpacity = …` block) with:

```typescript
const applyDimOpacity =
  (shapePolygons.length > 0 &&
    !isInsideAnyPolygon &&
    !(hasFullChordPositionFilter && fullChordPositionKeys.has(positionKey)) &&
    (noteClass === "note-blue" ||
      noteClass === "chord-tone-outside-scale" ||
      noteClass === "chord-tone-in-scale" ||
      noteClass === "note-diatonic-chord" ||
      noteClass === "chord-root" ||
      noteClass === "key-tonic")) ||
  (isWrapped && isHighlighted);
```

The new clause says: even if this coordinate is outside every polygon, do not dim it when it is part of the active full-chord voicing.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/FretboardSVG/hooks/useNoteData.test.ts -t "does not dim a chord-tone"`
Expected: PASS.

- [ ] **Step 5: Re-run the full file to confirm no regressions**

Run: `pnpm vitest run src/components/FretboardSVG/hooks/useNoteData.test.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/hooks/useNoteData.ts src/components/FretboardSVG/hooks/useNoteData.test.ts
git commit -m "fix(fretboard): keep full-voicing notes at full opacity outside polygon"
```

---

## Task 2: Force chord-tone classification for every voicing-vertex position

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useNoteData.ts` (the `noteClass` assignment block at lines 286-305)
- Test: `src/components/FretboardSVG/hooks/useNoteData.test.ts`

**Why:** `classifyNote` / `classifyNoteFromSemantics` only return `chord-tone-in-scale` when `isChordTone && isChordInRange && isInActiveShape` all hold. A voicing-vertex outside the polygon has `isInActiveShape = isInPlayableContext = true` (because `fullChordPositionKeys.has(positionKey)` short-circuits the polygon check). But if the note is outside `highlightSet` (scale-hidden mode) or `chordToneSet.has(noteName)` is false for any reason, the classifier falls through to `chord-tone-outside-scale` or `note-inactive`. We want voicing vertices to always read as an in-scale chord tone so the connector membership styling is uniform.

- [ ] **Step 1: Write the failing test**

Append to `useNoteData.test.ts`:

```typescript
describe("useNoteData — full-voicing classifies vertices as in-scale chord tones", () => {
  it("classifies a fullChordPositionKeys member as chord-tone-in-scale even when chordToneSet excludes it", () => {
    const layoutRow = ["E", "F", "F#", "G", "G#", "A", "A#", "B", "C", "C#", "D", "D#", "E"];
    const { result } = renderHook(() =>
      useNoteData({
        numStrings: 1,
        fretboardLayout: [layoutRow],
        totalColumns: 12,
        startFret: 0,
        maxFret: 13,
        highlightNotes: ["C", "E", "G"],
        hasChordOverlay: true,
        // Intentionally omit "Bb" / "A#" from chordTones to simulate a stale
        // chord-tones snapshot for a half-dim voicing whose b5 is part of
        // the rendered voicing but not yet in the overlay's tone list.
        chordTones: ["C", "E", "G"],
        rootNote: "C",
        chordRoot: "C",
        colorNotes: [],
        shapePolygons: [],
        chordBoxBounds: null,
        chordFretSpread: 0,
        activePattern: "caged",
        shapeScope: "single",
        activeShape: "E",
        scaleName: "major",
        preferFlats: false,
        wrappedNotes: new Set<string>(),
        tuning: ["E"],
        // A# (string 0, fret 6) — NOT in chordTones, but IS in the voicing.
        fullChordPositionKeys: new Set(["0-6"]),
        fullChordShapeByPosition: new Map([["0-6", "E"]]),
      })
    );

    const voicingVertex = result.current.find(
      (n) => n.stringIndex === 0 && n.fretIndex === 6,
    );
    expect(voicingVertex).toBeDefined();
    expect(voicingVertex!.noteClass).toBe("chord-tone-in-scale");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/FretboardSVG/hooks/useNoteData.test.ts -t "classifies a fullChordPositionKeys member as chord-tone-in-scale"`
Expected: FAIL — `voicingVertex!.noteClass` is `"note-inactive"` (note A# is not in scale, not in `highlightSet`, not in `chordToneSet`).

- [ ] **Step 3: Add voicing-vertex override**

In `src/components/FretboardSVG/hooks/useNoteData.ts`, after the existing `const noteClass = isNoteHidden ? "note-inactive" : … ;` assignment (ends at line 305), insert:

```typescript
// Voicing-vertex authority: any coordinate that belongs to the active
// full-chord voicing is rendered as an in-scale chord tone regardless of
// what the scale-aware classifiers said. Chord-root takes precedence so
// the root squircle keeps its dedicated role.
const isVoicingVertex =
  hasFullChordPositionFilter && fullChordPositionKeys.has(positionKey);
const finalNoteClass = isVoicingVertex && noteClass !== "chord-root"
  ? "chord-tone-in-scale"
  : noteClass;
```

Then change every later reference from `noteClass` to `finalNoteClass` within the loop body — there are four call sites: the `applyDimOpacity` ternary checks (Task 1 patched them), the `getLensEmphasis(noteClass, …)` call, the `isHidden = noteClass === "note-inactive"` assignment, and the `objectToBePushed.noteClass` field. Do a careful pass:

```typescript
const applyDimOpacity =
  (shapePolygons.length > 0 &&
    !isInsideAnyPolygon &&
    !(hasFullChordPositionFilter && fullChordPositionKeys.has(positionKey)) &&
    (finalNoteClass === "note-blue" ||
      finalNoteClass === "chord-tone-outside-scale" ||
      finalNoteClass === "chord-tone-in-scale" ||
      finalNoteClass === "note-diatonic-chord" ||
      finalNoteClass === "chord-root" ||
      finalNoteClass === "key-tonic")) ||
  (isWrapped && isHighlighted);

// … (lensEmphasis block) …
const lensEmphasis = getLensEmphasis(
  finalNoteClass,
  activeLens,
  effectiveSemantics?.isGuideTone ?? false,
  leadContext,
);

const isHidden = finalNoteClass === "note-inactive";

// … (objectToBePushed) …
const objectToBePushed = {
  stringIndex,
  fretIndex,
  noteName,
  octave,
  noteClass: finalNoteClass,
  displayValue,
  applyDimOpacity,
  applyLensEmphasis: lensEmphasis,
  isHidden,
  isTension: effectiveSemantics?.isTension ?? false,
  isGuideTone: effectiveSemantics?.isGuideTone ?? false,
  scaleDegree,
  degreeColor,
  fullChordShape,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/FretboardSVG/hooks/useNoteData.test.ts -t "classifies a fullChordPositionKeys member as chord-tone-in-scale"`
Expected: PASS.

- [ ] **Step 5: Run the whole file plus FretboardSVG suite**

Run: `pnpm vitest run src/components/FretboardSVG/`
Expected: all tests pass. If `FretboardSVG.test.tsx` line 462 (`querySelectorAll('.chord-tone-in-scale:not([data-note-role="chord-root"])').length`) changes count, update the assertion to the new count and add a code comment explaining the voicing-vertex override is the cause.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/hooks/useNoteData.ts \
        src/components/FretboardSVG/hooks/useNoteData.test.ts \
        src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "fix(fretboard): force voicing-vertex notes to chord-tone-in-scale class"
```

---

## Task 3: Chord-root halo that survives the full-chord-shape color override

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css` (add new rule block near the existing `.chord-root` block at lines 81-89 and the `[data-full-chord-mode="true"]` block at lines 98-121).
- Test: `src/components/FretboardSVG/FretboardSVG.test.tsx` (add assertion for the new CSS class hook).

**Why:** The existing chord-root halo in `FretboardNoteLayer.tsx:98-111` already renders a squircle halo outline when `noteClass === "chord-root"`, but the inner squircle's `fill` and `stroke` are flattened to the CAGED shape color by the `[data-full-chord-mode="true"] [data-full-chord-shape="X"]` rules. We layer two reinforcements: (a) a thicker outer stroke on the inner squircle in full-chord mode that uses the tonic ring color, and (b) a white label override so the root reads against the saturated shape fill.

- [ ] **Step 1: Write the failing test**

Append to `src/components/FretboardSVG/FretboardSVG.test.tsx`:

```typescript
it("renders chord-root in full-chord mode with the tonic-ring stroke even when data-full-chord-shape is set", () => {
  // (Build the same setup as the existing line-227 test that asserts
  // ".chord-root[data-full-chord-shape='E']" exists — re-use that helper.)
  const { container } = renderFretboardWithFullChord();
  const rootNote = container.querySelector('.chord-root[data-full-chord-shape="E"] path:last-of-type');
  expect(rootNote).not.toBeNull();
  const stroke = window.getComputedStyle(rootNote as Element).stroke;
  // jsdom returns CSS-variable strings as-is when not resolved; the rule below
  // sets stroke explicitly to var(--note-ring-tonic) at heavier weight, so the
  // computed string must contain "note-ring-tonic" OR the resolved color.
  expect(stroke).toMatch(/note-ring-tonic|rgb/);
});
```

If `renderFretboardWithFullChord` doesn't yet exist as a helper, inline the same `<FretboardSVG …>` props block used at line 251 of the existing file, with `fullChordVoicings` populated.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/FretboardSVG/FretboardSVG.test.tsx -t "renders chord-root in full-chord mode with the tonic-ring stroke"`
Expected: FAIL — current style has `stroke: var(--caged-e)` and no chord-root-specific override.

- [ ] **Step 3: Add the CSS override**

In `src/components/FretboardSVG/FretboardSVG.module.css`, immediately after the `[data-full-chord-shape="G"] text` rule (line 141) and before the `.fretboard-note.note-active` block (line 143), insert:

```css
/* Chord-root emphasis layer for full-chord-voicing mode.
   The earlier [data-full-chord-mode="true"][data-full-chord-shape="X"] rules
   (lines 98-121) flatten every voicing note to the CAGED shape color, which
   makes the root visually identical to the rest of the voicing. We restore
   chord-root distinction by (a) keeping the shape fill but overlaying a thick
   tonic-ring stroke on the inner squircle, and (b) using white-on-color label
   treatment so the root reads against the saturated background. */
.fretboard-board[data-full-chord-mode="true"] .fretboard-note.chord-root[data-full-chord-shape] :is(circle, path, polygon):last-of-type {
  stroke: var(--note-ring-tonic);
  stroke-width: 3.2;
  paint-order: stroke fill;
}

.fretboard-board[data-full-chord-mode="true"] .fretboard-note.chord-root[data-full-chord-shape] text {
  fill: #ffffff;
  stroke: rgb(0 0 0 / 0.45);
  stroke-width: 0.6;
  paint-order: stroke fill;
  font-weight: 700;
}

/* Light theme: same treatment — the saturated shape fill already provides
   contrast for white labels. */
:global([data-theme="modern-light"]) .fretboard-board[data-full-chord-mode="true"] .fretboard-note.chord-root[data-full-chord-shape] text {
  fill: var(--note-label-on-color);
  stroke: var(--note-label-on-color-stroke);
}
```

The `:last-of-type` selector targets the inner solid squircle path (the chord-root halo path comes first in DOM order via `FretboardNoteLayer.tsx:98-111`). The existing halo path keeps its own translucent neon-orange stroke and remains visible outside the new thicker tonic ring.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/FretboardSVG/FretboardSVG.test.tsx -t "renders chord-root in full-chord mode with the tonic-ring stroke"`
Expected: PASS.

- [ ] **Step 5: Run the whole FretboardSVG suite**

Run: `pnpm vitest run src/components/FretboardSVG/`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "feat(fretboard): emphasize chord-root in full-chord-voicing mode"
```

---

## Task 4: Visual baseline refresh

**Files:**
- Modify: snapshot directories under `e2e/__screenshots__/` for the four affected suites (`app-components`, `app-overlays`, `fretboard-svg`).

- [ ] **Step 1: Run the visual suite, expect failures**

Run: `pnpm test:visual`
Expected: failures in any test that captures a fretboard with full-chord-voicing enabled or with a chord overlay near the polygon edge. The root squircle now has a heavier ring and white label; out-of-polygon voicing notes are no longer dimmed.

- [ ] **Step 2: Inspect the diffs**

Open the diff PNGs under `test-results/`. Confirm each diff is one of:
- Brighter (no longer dimmed) voicing notes outside the active polygon.
- Heavier amber/tonic-ring + white label on chord-root in full-chord mode.
- Newly classified `chord-tone-in-scale` styling on a voicing vertex that previously rendered as scale-only or outside-scale.

Reject the run and investigate if any diff falls outside those three categories.

- [ ] **Step 3: Refresh baselines for darwin**

Run: `pnpm test:visual:update`
Expected: snapshot files updated under `e2e/__screenshots__/<suite>/darwin/`.

- [ ] **Step 4: Commit**

```bash
git add e2e/__screenshots__/
git commit -m "test(visual): refresh baselines for full-voicing dim + root emphasis"
```

---

## Task 5: Full verification

- [ ] **Step 1: lint + test + build**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 2: e2e production**

Run: `pnpm test:e2e:production`
Expected: all green.

- [ ] **Step 3: Manual smoke**

Run `pnpm dev`, open the app, configure a CAGED scale pattern (e.g., C major, E shape, frets 7-10), enable Full Chord overlay, and step through diatonic chords. Confirm:
- Voicing notes that fall outside the visible scale-pattern polygon render at full opacity (no 0.8 dim).
- Every connector-vertex note shows the in-scale chord-tone treatment (cream squircle, amber ring) — none drop to gray scale-only styling.
- The chord-root squircle is clearly distinct from non-root voicing notes — heavier amber outer ring, white label — at all four CAGED shape colors.

- [ ] **Step 4: Final commit (if any leftovers)**

```bash
git status
# If only docs/plan updates remain, commit them with:
git commit -am "docs(plans): mark full-voicing emphasis plan complete"
```

---

## Reused utilities / patterns

- `useNoteData` hook test scaffold (already covers `fullChordPositionKeys` at line 213).
- Existing chord-root halo render in `FretboardNoteLayer.tsx:98-111` — the new CSS layers on top, no JSX changes needed.
- `paint-order: stroke fill` pattern already used for tonic / chord-root in dark mode label overrides.
- Visual snapshot refresh workflow per `CLAUDE.md` (`pnpm test:visual:update` for darwin).

## Files untouched

- `useChordConnectorPolylines.ts` — connector geometry is correct; the membership/style fix happens upstream in `useNoteData` so the connector layer keeps emitting the same vertex set.
- `templates.ts` / `fullChordShapes.ts` — voicing geometry is fine; we only adjust how those positions render.
- `FretboardNoteLayer.tsx` — the existing halo render already handles chord-root squircles; CSS-only reinforcement covers the new emphasis.
