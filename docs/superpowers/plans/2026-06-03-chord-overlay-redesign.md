# Chord Overlay Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the redesigned chord overlay — the A′ "ribbon" connector and the tiered note markers — and a consolidated, token-based color system, replacing the throwaway dev prototype with clean production code.

**Architecture:** The exploration was built behind a `DEV`-only toggle (`connectorPrototypeAtoms`, `markerPrototypeAtoms`, `ConnectorModeDevProbe`) with both old and new render paths coexisting. This plan **bakes the chosen path in as the only path** (ribbon connector, tiered markers), folds the color decisions into OKLCH theme tokens, removes the scaffolding, and fixes the backlog items surfaced during prototyping. Order: markers → connector → color → cleanup → backlog → verify, so the app and tests stay green at every commit.

**Tech Stack:** React 19 + TypeScript, Jotai, CSS Modules (`FretboardSVG.module.css`), global theme tokens (`src/styles/themes.css`), Vitest + Testing Library (jsdom), Playwright visual regression. Package manager: **pnpm**. Verify gates per CLAUDE.md: `pnpm run lint`, `pnpm run test`, `pnpm run build`.

**Source specs:**
- `docs/superpowers/specs/2026-06-03-chord-overlay-grouping-markers-design.md`
- `docs/superpowers/specs/2026-06-03-chord-overlay-color-consistency-design.md`

---

## File Structure

**Modify:**
- `src/components/FretboardSVG/utils/semantics.ts` — collapse `getTieredNoteVisuals` into a single `getNoteVisuals(noteClass)`; remove the `system` param.
- `src/components/FretboardSVG/FretboardNote.tsx` — drop the marker-system atom read, the `data-marker-system` attr, and the `markerSystem` arg; remove the full-chord per-shape recolor (`fullChordStyle`).
- `src/components/FretboardSVG/FretboardConnectorLayer.tsx` — ribbon as the only render path; remove tube/region/hybrid + `connectorRenderModeAtom` plumbing; `spinePath` first-class; band halo off.
- `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts` — drop `regionPath` (region/hybrid gone), keep `spinePath`; drop now-unused `offsetOutlinePath`/`polarSort` import.
- `src/components/FretboardSVG/FretboardSVG.module.css` — replace prototype CSS with permanent tokenized rules; remove `data-connector-mode` / `data-marker-system` selectors; remove dead `[data-practice-lens]` blocks; remove full-chord fill recolor rule.
- `src/styles/themes.css` — add the semantic color tokens (home / guide / neutral / region) for both themes; neutralize role hues.
- `src/components/FretboardSVG/FretboardShapeLayer.tsx` (and its color source) — single neutral region tint instead of 5 CAGED hues.
- `src/App.tsx` — unmount `ConnectorModeDevProbe`.
- Tests: `semantics.test.ts`, `FretboardConnectorLayer.test.tsx`, `useChordConnectorPolylines.test.ts`, `FretboardNote.test.tsx`, `FretboardSVG.test.tsx`.

**Delete:**
- `src/store/connectorPrototypeAtoms.ts`
- `src/store/markerPrototypeAtoms.ts`
- `src/components/ConnectorModeDevProbe/ConnectorModeDevProbe.tsx` (+ folder)

**Create:** none (tokens live in `themes.css`).

---

## Phase 1 — Bake in the tiered markers

### Task 1: Make the tiered marker mapping the only `getNoteVisuals`

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts`
- Test: `src/components/FretboardSVG/utils/semantics.test.ts`

- [ ] **Step 1: Update the `getNoteVisuals` tests to the tiered mapping**

In `semantics.test.ts`, replace the `describe("getNoteVisuals", …)` block (currently lines ~278–294) with:

```ts
describe("getNoteVisuals", () => {
  it("returns squircle for diatonic chord tones (chord size)", () => {
    expect(getNoteVisuals("chord-tone-in-scale")).toEqual({ radiusScale: 0.95, noteShape: "squircle" });
    expect(getNoteVisuals("note-diatonic-chord")).toEqual({ radiusScale: 0.95, noteShape: "squircle" });
    expect(getNoteVisuals("chord-root")).toEqual({ radiusScale: 0.95, noteShape: "squircle" });
  });

  it("returns small circle for scale tones", () => {
    expect(getNoteVisuals("scale-only")).toEqual({ radiusScale: 0.66, noteShape: "circle" });
    expect(getNoteVisuals("note-active")).toEqual({ radiusScale: 0.66, noteShape: "circle" });
  });

  it("returns circle for diatonic color tones", () => {
    expect(getNoteVisuals("color-tone")).toEqual({ radiusScale: 0.8, noteShape: "circle" });
  });

  it("returns DIAMOND for chromatic / outside-key notes", () => {
    expect(getNoteVisuals("chord-tone-outside-scale").noteShape).toBe("diamond");
    expect(getNoteVisuals("note-blue").noteShape).toBe("diamond");
  });

  it("returns circle for key tonic", () => {
    expect(getNoteVisuals("key-tonic").noteShape).toBe("circle");
  });
});
```

- [ ] **Step 2: Run the tests — they fail (current `getNoteVisuals` takes a `system` arg and defaults to the old map)**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts -t getNoteVisuals`
Expected: FAIL — `note-blue`/`chord-tone-outside-scale` return `hexagon`/`diamond` under default, and chord sizes are `0.82` not `0.95`.

- [ ] **Step 3: Collapse the two functions into one**

In `semantics.ts`, delete the old `switch`-based body of `getNoteVisuals` and the separate `getTieredNoteVisuals`, leaving a single function (the tiered mapping is now canonical). Keep the `TIERED_RADIUS_*` consts but rename for clarity:

```ts
// Marker sizing: chord tier large, scale tier small (recedes), outside tier medium.
const RADIUS_CHORD = 0.95;
const RADIUS_SCALE = 0.66;
const RADIUS_OUTSIDE = 0.8;

export function getNoteVisuals(noteClass: string): NoteVisuals {
  switch (noteClass) {
    case "key-tonic":
      return { radiusScale: RADIUS_SCALE_KEY_TONIC, noteShape: "circle" };
    case "chord-root":
    case "chord-tone-in-scale":
    case "note-diatonic-chord":
      return { radiusScale: RADIUS_CHORD, noteShape: "squircle" };
    case "note-active":
    case "scale-only":
      return { radiusScale: RADIUS_SCALE, noteShape: "circle" };
    case "color-tone":
      return { radiusScale: RADIUS_OUTSIDE, noteShape: "circle" };
    // Shape encodes harmonic insideness: chromatic / outside-key → angular diamond.
    case "note-blue":
    case "chord-tone-outside-scale":
      return { radiusScale: RADIUS_OUTSIDE, noteShape: "diamond" };
    default:
      return { radiusScale: RADIUS_SCALE_DEFAULT, noteShape: "circle" };
  }
}
```

`RADIUS_SCALE_CHORD_TONE`, `RADIUS_SCALE_NOTE_ACTIVE`, `RADIUS_SCALE_COLOR_TONE` may now be unused imports — remove any that ESLint flags. `"hexagon"` is no longer produced; leave the `NoteShape` type as-is (the `FretboardNote` hexagon branch becomes dead but harmless; remove it in Task 2).

- [ ] **Step 4: Run the tests — they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/utils/semantics.test.ts
git commit -m "refactor(fretboard): make tiered marker mapping the canonical getNoteVisuals"
```

### Task 2: Remove the marker-system toggle from FretboardNote

**Files:**
- Modify: `src/components/FretboardSVG/FretboardNote.tsx`
- Delete: `src/store/markerPrototypeAtoms.ts`
- Test: `src/components/FretboardSVG/FretboardNote.test.tsx`

- [ ] **Step 1: Remove the atom read and arg**

In `FretboardNote.tsx`:
- Delete the import `import { markerSystemAtom } from "../../store/markerPrototypeAtoms";` and `useAtomValue` if it becomes unused.
- Delete `const markerSystem = useAtomValue(markerSystemAtom);`.
- Change `getNoteVisuals(noteClass, markerSystem)` → `getNoteVisuals(noteClass)`.
- Delete the `data-marker-system={markerSystem}` attribute on the `<g>`.
- Delete the now-dead `noteShape === "hexagon"` branch in `shapeEl` (no class produces hexagon anymore).

- [ ] **Step 2: Delete the marker prototype atom file**

Run: `git rm src/store/markerPrototypeAtoms.ts`

- [ ] **Step 3: Run the component tests + typecheck**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNote.test.tsx && pnpm exec tsc -b`
Expected: PASS, exit 0. (If a test asserts `data-marker-system`, remove that assertion.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(fretboard): drop marker-system dev toggle, tiered markers are default"
```

### Task 3: Verify & fix diamond rendering for chromatic notes

**Context:** During prototyping, chromatic / blue-note positions still rendered round. `getNoteVisuals` now returns `diamond` for `chord-tone-outside-scale` / `note-blue`, so the gap is upstream in classification or note data. Diagnose with a test before fixing.

**Files:**
- Test: `src/components/FretboardSVG/utils/semantics.test.ts` (classification), and the live app for the integration check.
- Modify: wherever classification is found wanting (likely `semantics.ts#classifyNote` / `classifyNoteFromSemantics`, or the note-data flags feeding it).

- [ ] **Step 1: Write a classification test that reproduces the case**

The scale-membership logic lives in `classifyNoteFromSemantics` (the `sem.isInScale` branches), not the boolean `classifyNote`. Add to `semantics.test.ts` (match the real `classifyNoteFromSemantics(sem, isInActiveShape, isHighlighted)` signature and `NoteSemantics` field names — see the existing import on line 2 and the `sem` usage in `semantics.ts` ~lines 150–159):

```ts
it("classifies an in-shape chord tone not in the scale as chord-tone-outside-scale", () => {
  const sem = {
    isChordRoot: false, isDiatonicChord: false, isInScale: false,
    isChordTone: true, isColorTone: false,
  } as NoteSemantics;
  expect(classifyNoteFromSemantics(sem, /* isInActiveShape */ true, /* isHighlighted */ true))
    .toBe("chord-tone-outside-scale");
});
```

- [ ] **Step 2: Run it**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts -t "not in the scale"`
Expected: PASS if classification is correct (then the bug is in the note-data flags feeding `sem`, not the classifier). If it FAILS, fix `classifyNoteFromSemantics` so an in-shape chord tone that is not in scale and not diatonic returns `"chord-tone-outside-scale"`.

- [ ] **Step 3: Integration check in the live app (manual, per CLAUDE.md visual workflow)**

Run `pnpm run dev`, load a key + a borrowed/secondary chord (e.g. C major scale, an E major or D7 chord) so a chord tone falls outside the scale, plus a blues scale for blue notes. Confirm those positions render as **diamonds**. If they still render round, use **superpowers:systematic-debugging**: trace the note's `noteClass` through `useNoteData` → `useAnimatedFretboardView` → `FretboardNote` and confirm `getNoteVisuals` receives `chord-tone-outside-scale` / `note-blue`. The most likely culprit is a note-data flag (e.g. `isInScale` computed against the wrong scale, or `isColorNote` masking `note-blue`); fix at the source and add a regression test mirroring the failure.

- [ ] **Step 4: Run the full unit suite + commit**

Run: `pnpm exec vitest run src/components/FretboardSVG`
Expected: PASS.

```bash
git add -A
git commit -m "fix(fretboard): chromatic and blue-note positions render as diamonds"
```

---

## Phase 2 — Bake in the A′ ribbon connector

### Task 4: Ribbon as the only connector render path

**Files:**
- Modify: `src/components/FretboardSVG/FretboardConnectorLayer.tsx`
- Delete: `src/store/connectorPrototypeAtoms.ts`
- Test: `src/components/FretboardSVG/FretboardConnectorLayer.test.tsx`

- [ ] **Step 1: Update the connector layer test for the ribbon contract**

The renderer must, per voicing, emit: a `halo` path (kept for structure but visually `stroke:none` via CSS), a `fill` path (the band), and a `spine` path (the center line). It must NOT emit a separate `outline` edge path. Replace the fixture + relevant assertions in `FretboardConnectorLayer.test.tsx`:

```ts
const makePolyline = (voicingKey: string, shape?: CagedShape): ChordConnectorVoicing => ({
  paths: { fill: "M0,0 L10,0", outline: "M0,0 L10,0" },
  spinePath: "M 0 0 L 10 0",
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  paletteIndex: 0,
  shape,
  voicingKey,
});
```

Add an assertion (in the existing render test) that the "above"/spine path is present and no `data-layer="outline"` edge is emitted:

```ts
expect(container.querySelector('path[data-layer="spine"]')).toBeTruthy();
expect(container.querySelector('path[data-layer="outline"]')).toBeNull();
```

(Remove `regionPath` from the fixture — that field is deleted in Task 5.)

- [ ] **Step 2: Run the test — it fails (renderer still emits outline + reads the mode atom)**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardConnectorLayer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite the render logic to ribbon-only**

In `FretboardConnectorLayer.tsx`:
- Remove `import { useAtomValue } from "jotai";` (if unused after) and `import { connectorRenderModeAtom, type ConnectorRenderMode } from "../../store/connectorPrototypeAtoms";`.
- Remove `const connectorRenderMode = useAtomValue(connectorRenderModeAtom);` and all `mode` params/branches.
- `renderChordLayers` becomes (below pass = halo + band fill + center line; above pass = nothing for edges):

```tsx
const renderChordLayers = (
  chordPolylines: ChordConnectorVoicing[],
  pass: "below" | "above",
) => (
  <>
    {pass === "below" && chordPolylines.map((v) => renderChordPath(v, "halo"))}
    {pass === "below" && chordPolylines.map((v) => renderChordPath(v, "fill"))}
    {/* Center line renders BELOW the notes so the markers occlude it. */}
    {pass === "below" && chordPolylines.map((v) => renderChordPath(v, "spine"))}
  </>
);
```

- `renderChordPath` drops the `mode` arg and the region/tube branching:

```tsx
const renderChordPath = (v: ChordConnectorVoicing, layer: "halo" | "fill" | "spine") => (
  <path
    key={`${layer}-${v.voicingKey}`}
    className={layer === "halo" ? undefined : styles["chord-connector-path"]}
    d={layer === "spine" ? v.spinePath : v.paths.fill}
    data-layer={layer}
    data-caged-shape={v.shape}
    data-palette-index={v.paletteIndex + 1}
    data-fallback={v.isFallback ? "true" : undefined}
  />
);
```

- Remove the `data-connector-mode` attribute from both group renderers and drop the `mode` params they pass through.

Note: the "above" pass now renders no chord paths; leave the interval-connector block in the "below" pass untouched.

- [ ] **Step 3b: Make the connector CSS unconditional (no `data-connector-mode`)**

In `FretboardSVG.module.css`, the prototype connector rules are gated on `:not([data-connector-mode="tube"])` and `[data-connector-mode="hybrid"|"ribbon"|"edge-line"]`, which break once the attribute is gone. Replace them with unconditional ribbon rules:
- **Color:** `.chord-connectors path[data-layer] { color: var(--fb-connector-accent); }` (the token added in Task 6 — until then, keep `var(--chord-connector-color-1)` and the light `:global([data-theme="modern-light"]) … { color: var(--chord-connector-color-2); }` override; Task 7 swaps to the token). This *overrides* the per-`data-palette-index` / `data-caged-shape` color rules — keep those rules for the interval connectors but ensure the chord-connector accent wins (the `[data-layer]` attribute gives it the higher specificity it already had).
- **Halo off:** `.chord-connectors path[data-layer="halo"] { stroke: none; }`.
- **Spine solid:** fold the ribbon/edge-line solid-spine override into the base `path[data-layer="spine"]` rule (solid, `stroke-width: 1.6px; stroke-opacity: 0.9; stroke-dasharray: none;`); delete the dotted-hybrid spine variant and the `[data-connector-mode="hybrid"]` fill-opacity rule.
- **Fallback normalization:** change `.chord-connectors:not([data-connector-mode="tube"]) path[data-layer="fill"][data-fallback="true"]` (and the outline variant) to plain `.chord-connectors path[data-layer="fill"][data-fallback="true"] { fill-opacity: var(--chord-connector-fill-opacity, 0.15); }` so close voicings stay at full strength.

Run `pnpm exec stylelint src/components/FretboardSVG/FretboardSVG.module.css` → exit 0.

- [ ] **Step 4: Delete the connector prototype atom file**

Run: `git rm src/store/connectorPrototypeAtoms.ts`

- [ ] **Step 5: Run the test + typecheck — pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardConnectorLayer.test.tsx && pnpm exec tsc -b`
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(fretboard): ribbon is the only connector render, drop mode toggle"
```

### Task 5: Drop `regionPath` from the geometry

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`
- Test: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`

- [ ] **Step 1: Remove `regionPath` from the interface + builder**

In `useChordConnectorPolylines.ts`:
- Delete the `regionPath: string;` field from the `ChordConnectorVoicing` interface (keep `spinePath`).
- In `finalizeChordConnectorPolylines`, delete the `const regionPath = offsetOutlinePath(polarSort(pv.rawVertices), r);` line and the `regionPath,` in the returned object. Keep `spinePath`.
- Change the import back to `import { offsetOpenPolylinePath } from "../utils/pathGeometry";` (drop `offsetOutlinePath, polarSort` if now unused — `pathGeometry.ts` keeps exporting them for other callers/tests, just don't import here).

- [ ] **Step 2: Update any test asserting `regionPath`**

Run: `grep -rn "regionPath" src` — remove the field from any remaining fixture/assertion (e.g. `useChordConnectorPolylines.test.ts`). Keep `spinePath` assertions.

- [ ] **Step 3: Run geometry tests + typecheck — pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts && pnpm exec tsc -b`
Expected: PASS, exit 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(fretboard): drop unused regionPath from connector geometry"
```

---

## Phase 3 — Color consistency

### Task 6: Define the semantic color tokens (both themes)

**Files:**
- Modify: `src/styles/themes.css`

- [ ] **Step 1: Add the semantic tokens to each theme block**

In `[data-theme="modern-dark"]` add:

```css
  /* Chord-overlay semantic color system (2026-06 redesign).
     amber = key home · teal = chord identity (guide tones) · neutral = everything else. */
  --fb-home-fill: #b5670a;        /* amber root / tonic */
  --fb-home-stroke: var(--note-ring-tonic);
  --fb-guide-fill: #1f5876;       /* teal guide tones (3rd/7th) */
  --fb-guide-stroke: #7cecff;
  --fb-neutral-fill: #1b232c;     /* diatonic chord/scale notes */
  --fb-neutral-stroke: #9aa3ab;
  --fb-region-tint: rgba(154, 163, 171, 0.14); /* single neutral shape tint */
  --fb-connector-accent: var(--chord-connector-color-1); /* orange */
```

In `[data-theme="modern-light"]` add:

```css
  --fb-home-fill: #b5670a;
  --fb-home-stroke: var(--note-ring-tonic);
  --fb-guide-fill: #cfeefb;
  --fb-guide-stroke: #1583a6;
  --fb-neutral-fill: #e3ddd8;
  --fb-neutral-stroke: #6b5d4f;
  --fb-region-tint: rgba(107, 93, 79, 0.20);
  --fb-connector-accent: var(--chord-connector-color-2); /* vermillion */
```

These are starting anchors carried over from the prototype; final values are tuned in Task 14 against APCA. (Migration to OKLCH `oklch()` notation is an optional cleanup — see Task 14 backlog; semantics don't depend on the notation.)

- [ ] **Step 2: Lint + build — pass**

Run: `pnpm run lint && pnpm run build`
Expected: exit 0 (tokens are unused yet; no visual change).

- [ ] **Step 3: Commit**

```bash
git add src/styles/themes.css
git commit -m "feat(fretboard): add chord-overlay semantic color tokens (home/guide/neutral/region)"
```

### Task 7: Apply tokens to markers; neutralize role hues

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css`

- [ ] **Step 1: Replace the role-color marker rules with the token-based system**

Remove the prototype-marked blocks (root amber, guide-tone lift, hollow lower tiers, `data-marker-system` selectors) and the cyan/violet role fills, replacing with theme-agnostic token rules. Net rules:

```css
/* Root = amber "home" anchor (white label set elsewhere). */
.fretboard-note.chord-root :is(path, circle, polygon) {
  fill: var(--fb-home-fill);
  stroke: var(--fb-home-stroke);
}

/* Diatonic chord tones (incl. 5th) = neutral filled. */
.fretboard-note:is(.chord-tone-in-scale, .note-diatonic-chord) :is(path, circle, polygon) {
  fill: var(--fb-neutral-fill);
  stroke: var(--fb-neutral-stroke);
}

/* Guide tones (3rd/7th) = teal "chord identity" (hue, not a brightness lift). */
.fretboard-note[data-note-guide-tone]:is(.chord-tone-in-scale, .note-diatonic-chord) :is(path, circle, polygon) {
  fill: var(--fb-guide-fill);
  stroke: var(--fb-guide-stroke);
}

/* Scale tones + diatonic color tones = neutral hollow (recede). */
.fretboard-note:is(.scale-only, .note-active, .color-tone) :is(circle, path, polygon) {
  fill: none;
  stroke: var(--fb-neutral-stroke);
}

/* Chromatic / outside-key diamonds = neutral filled (shape carries the meaning). */
.fretboard-note:is(.chord-tone-outside-scale, .note-blue) :is(circle, path, polygon) {
  fill: var(--fb-neutral-fill);
  stroke: var(--fb-neutral-stroke);
}
```

Also: ensure the chord-root label stays white in both themes (keep the existing
`.fretboard-note.chord-root text { fill: #fff3e0; }` + the light-mode `stroke` rule).
Remove any `data-marker-system` selector still present.

- [ ] **Step 2: Stylelint — pass**

Run: `pnpm exec stylelint src/components/FretboardSVG/FretboardSVG.module.css`
Expected: exit 0.

- [ ] **Step 3: Visual check (manual)**

`pnpm run dev` → confirm in **both themes**: amber root, teal 3/7, neutral everything else, hollow scale/color circles, neutral diamonds for chromatic. No cyan/violet on plain chord/scale tones.

- [ ] **Step 4: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "feat(fretboard): tokenized marker colors — amber home, teal guide, neutral rest"
```

### Task 8: Remove the full-chord per-shape recolor

**Files:**
- Modify: `src/components/FretboardSVG/FretboardNote.tsx`, `src/components/FretboardSVG/FretboardSVG.module.css`
- Test: `src/components/FretboardSVG/FretboardNote.test.tsx`

- [ ] **Step 1: Write a test that full-chord notes are NOT recolored by shape**

In `FretboardNote.test.tsx`, render a note with `fullChordShape: "E"` and assert the `<g>` does not set a `--shape-fill` style and is colored by role instead:

```ts
it("does not recolor notes by CAGED shape in full-chord mode", () => {
  const { container } = renderNote({ noteClass: "chord-tone-in-scale", fullChordShape: "E" });
  const g = container.querySelector("g.fretboard-note") as HTMLElement;
  expect(g.style.getPropertyValue("--shape-fill")).toBe("");
});
```

(Use the file's existing render helper / prop shape; `renderNote` is illustrative — match the established harness.)

- [ ] **Step 2: Run it — fails (fullChordStyle still sets --shape-fill)**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNote.test.tsx -t "full-chord"`
Expected: FAIL.

- [ ] **Step 3: Remove the recolor**

In `FretboardNote.tsx`: delete the `fullChordStyle` object (the `--shape-fill` / `--shape-stroke` / `--shape-stroke-width` / `--text-fill` block) and the `...(fullChordStyle as React.CSSProperties)` spread in the `<g>` style. Keep `data-full-chord-mode={fullChordShape || undefined}` only if other logic needs it; otherwise remove it too. Remove now-unused `CAGED_SHAPE_CSS_VAR` / `CAGED_SHAPE_TEXT_VAR` consts if unreferenced.

In `FretboardSVG.module.css`: delete the `.fretboard-board[data-full-chord-mode="true"] .fretboard-note[data-full-chord-mode] :is(circle, path, polygon)` fill/stroke rule and its sibling `text` rule (lines ~105–113).

- [ ] **Step 4: Run tests + typecheck — pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNote.test.tsx && pnpm exec tsc -b`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(fretboard): role-based note colors in all voicing modes (drop full-chord recolor)"
```

### Task 9: Demote CAGED shape shading to a single neutral tint

**Files:**
- Modify: `src/components/FretboardSVG/FretboardShapeLayer.tsx` and the polygon color source (`packages/core/src/shapes/polygons.ts` and/or the `svgPolygons` builder that maps `--caged-*-bg`).
- Test: the relevant shape-layer / polygon test if one exists.

- [ ] **Step 1: Point the shape polygons at the neutral tint**

Find where each polygon's `color` is set to `var(--caged-{shape}-bg)` (per the color map: `packages/core/src/shapes/polygons.ts` `CAGED_SHAPE_COLORS[shape].bg`, surfaced into `svgPolygons`). Change the rendered fill so the **active** shape region uses `var(--fb-region-tint)` for all shapes instead of a per-shape hue. Lowest-risk implementation: in `FretboardShapeLayer.tsx`, override the polygon `fill` to `var(--fb-region-tint)` rather than the passed `color`:

```tsx
const polygons = svgPolygons.map(({ points, key }) => (
  <polygon key={key} points={points} fill="var(--fb-region-tint)" stroke="none" style={{ pointerEvents: "none" }} />
));
```

(Leave the per-shape `--caged-*` tokens defined in `themes.css` — they remain available for the future opt-in "show all positions" overview, listed in the spec backlog.)

- [ ] **Step 2: Run shape-layer tests + typecheck**

Run: `pnpm exec vitest run src/components/FretboardSVG && pnpm exec tsc -b`
Expected: PASS, exit 0. Update any snapshot/assertion that checked a per-shape `fill`.

- [ ] **Step 3: Visual check (manual)** — CAGED region shows one neutral tint in both themes; 3NPS/no-pattern unchanged.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(fretboard): single neutral region tint for active shape (CAGED rainbow → overview-only)"
```

### Task 10: Remove the dead practice-lens emphasis CSS

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css`

- [ ] **Step 1: Confirm it's unwired**

Run: `grep -rn "data-practice-lens" src --include=*.tsx --include=*.ts | grep -v test`
Expected: no app code sets it (only CSS + tests reference it). If app code DOES set it, STOP and keep the rules.

- [ ] **Step 2: Delete the blocks**

Remove every `[data-practice-lens="guide-tones"] …` and `[data-practice-lens="tension"] …` rule (and their light-mode `:global(...)` text variants). Remove any test that only asserted those dead rules.

- [ ] **Step 3: Lint + test + build — pass**

Run: `pnpm run lint && pnpm exec vitest run src/components/FretboardSVG && pnpm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(fretboard): remove dead practice-lens emphasis CSS"
```

---

## Phase 4 — Remove remaining prototype scaffolding

### Task 11: Delete the dev probe and unmount it

**Files:**
- Delete: `src/components/ConnectorModeDevProbe/ConnectorModeDevProbe.tsx` (+ folder)
- Modify: `src/App.tsx`

- [ ] **Step 1: Unmount from App**

In `src/App.tsx` remove the import `import { ConnectorModeDevProbe } from "./components/ConnectorModeDevProbe/ConnectorModeDevProbe";` and the line `{import.meta.env.DEV && <ConnectorModeDevProbe />}`.

- [ ] **Step 2: Delete the component**

Run: `git rm -r src/components/ConnectorModeDevProbe`

- [ ] **Step 3: Confirm no prototype references remain**

Run: `grep -rn "Prototype\|connectorRenderMode\|markerSystem\|ConnectorModeDevProbe\|data-connector-mode\|data-marker-system" src`
Expected: no matches (CSS comments mentioning "THROWAWAY PROTOTYPE" should also be gone — remove any stragglers).

- [ ] **Step 4: Lint + test + build — pass**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(fretboard): remove connector/marker dev prototype scaffolding"
```

---

## Phase 5 — Backlog fixes

### Task 12: Vertical-voicing band visibility near the nut

**Context:** For tight vertical voicings, the band + center line hide behind the close-spaced markers. Floor the band half-width so it always exceeds the marker radius.

**Files:**
- Modify: `src/components/FretboardSVG/utils/connectorRadius.ts` (the radius floor helper) or `useChordConnectorPolylines.ts#computeFinalConnectorRadii`.
- Test: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`

- [ ] **Step 1: Write a failing test**

Add a test that a vertical voicing (e.g. vertices stacked at near-equal x, small y gaps) produces a band radius `>= markerRadius + 2`. Express it against `applyConnectorRadiusFloor` / `resolveConnectorRadiusPx` with a small `stringRowPx` so the floor matters:

```ts
it("floors the connector radius above the marker radius for tight voicings", () => {
  const stringRowPx = 18;          // tight spacing near the nut
  const markerRadius = stringRowPx / 2 * 0.95; // chord-tone radius
  const r = applyConnectorRadiusFloor(stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR, stringRowPx);
  expect(r).toBeGreaterThanOrEqual(markerRadius + 2);
});
```

- [ ] **Step 2: Run — fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts -t "floors the connector radius"`
Expected: FAIL.

- [ ] **Step 3: Raise the floor**

In `connectorRadius.ts#applyConnectorRadiusFloor`, raise the minimum so the band half-width exceeds the marker radius (marker radius ≈ `stringRowPx/2 * RADIUS_CHORD` minus the squircle reduction). Set the floor to `stringRowPx * 0.5 + 2` (band edge sits ≥2px outside a chord-tone marker), keeping the existing upper behavior:

```ts
export function applyConnectorRadiusFloor(preferred: number, stringRowPx: number): number {
  const floor = stringRowPx * 0.5 + 2;
  return Math.max(preferred, floor);
}
```

(Match the real signature; if a floor already exists, raise its constant and keep the test as the spec.)

- [ ] **Step 4: Run test + the connector suite — pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`
Expected: PASS. Manually confirm a nut-position vertical voicing now shows a visible band column.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(fretboard): floor connector band width so tight vertical voicings stay visible"
```

### Task 13: ♭6 / outside-root marker treatment

**Context:** A chord root outside the scale renders as a muddy dashed-orange + glow blob, worst on light wood. Give it a clean treatment: it is still the root (amber home) but flag "outside the key" with the same neutral-diamond logic the system uses for chromatic — i.e. an **amber-filled diamond** (home color + chromatic shape), no dashed orange, no extra glow.

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts` (so an outside-key chord root maps to `diamond`), `src/components/FretboardSVG/FretboardSVG.module.css`.
- Test: `src/components/FretboardSVG/utils/semantics.test.ts`

- [ ] **Step 1: Decide the class.** An outside-key root currently classifies as `chord-root` (the root branch in `classifyNoteFromSemantics` ignores `sem.isInScale`) → squircle + amber. To flag chromaticism, add a dedicated class `chord-root-outside`. Add a test against `classifyNoteFromSemantics`:

```ts
it("classifies an outside-key chord root as chord-root-outside", () => {
  const sem = {
    isChordRoot: true, isDiatonicChord: false, isInScale: false,
    isChordTone: true, isColorTone: false,
  } as NoteSemantics;
  expect(classifyNoteFromSemantics(sem, true, true)).toBe("chord-root-outside");
});
```

(In `classifyNoteFromSemantics`, the root branch becomes: return `"chord-root"` when `sem.isInScale`, else `"chord-root-outside"`.)

- [ ] **Step 2: Run — fails.** Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts -t "outside-key chord root"` → FAIL.

- [ ] **Step 3: Implement.**
  - `classifyNoteFromSemantics`: split the root branch into `chord-root` (in scale) / `chord-root-outside` (not in scale).
  - `getNoteVisuals`: `case "chord-root-outside": return { radiusScale: RADIUS_CHORD, noteShape: "diamond" };`
  - CSS: `.fretboard-note.chord-root-outside :is(path,circle,polygon){ fill: var(--fb-home-fill); stroke: var(--fb-home-stroke); }` (amber + diamond, no dash, no glow). Add `chord-root-outside` to the `CHORD_TONE_CLASSES` sets in `semantics.ts` and `useChordConnectorPolylines.ts` so it still joins the connector and emphasis logic. Remove the old `.chord-root[data-note-tension] path:last-of-type` dashed-blob rule.

- [ ] **Step 4: Run tests + typecheck — pass.** Run: `pnpm exec vitest run src/components/FretboardSVG && pnpm exec tsc -b` → PASS. Manually confirm a ♭6-rooted chord shows a clean amber diamond in both themes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(fretboard): outside-key chord root renders as a clean amber diamond"
```

---

## Phase 6 — Verification

### Task 14: Full verification, snapshots, and color tuning

**Files:** visual regression snapshots under `e2e/`; `src/styles/themes.css` (final color values).

- [ ] **Step 1: Run the full local gate (CLAUDE.md mandatory)**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all exit 0.

- [ ] **Step 2: Refresh visual regression snapshots**

The overlay's appearance changed intentionally, so darwin snapshots must be regenerated and reviewed.
Run: `pnpm run test:visual:update`
Then inspect the regenerated `e2e/**/__snapshots__` diffs to confirm the new look is correct (amber root, teal guide tones, neutral rest, diamonds, ribbon connector, neutral region tint) in the captured states. Re-run `pnpm run test:visual` to confirm green.

- [ ] **Step 3: APCA / contrast + value tuning (manual, with the user)**

Per CLAUDE.md the user verifies visually. With `pnpm run dev`, review **both themes** and tune the `--fb-*` token values in `themes.css` for: amber-home contrast on both woods, teal legibility at marker size, neutral foreground contrast, region-tint subtlety, and the warm proximity of amber-home vs the connector accent (shift the connector hue if they compete). Check each token pair against its background with an APCA tool. Commit value changes:

```bash
git add src/styles/themes.css
git commit -m "style(fretboard): tune chord-overlay color token values for both themes"
```

- [ ] **Step 4: (Optional) OKLCH migration**

If desired, rewrite the `--fb-*` values as `oklch()` with shared hue tokens and lightness-derived light/dark variants. Behavior-preserving; verify with `pnpm run test:visual`.

- [ ] **Step 5: Commit the specs + plan**

```bash
git add docs/superpowers/specs/2026-06-03-chord-overlay-grouping-markers-design.md \
        docs/superpowers/specs/2026-06-03-chord-overlay-color-consistency-design.md \
        docs/superpowers/plans/2026-06-03-chord-overlay-redesign.md
git commit -m "docs(fretboard): chord-overlay redesign specs + implementation plan"
```

- [ ] **Step 6: Finish the branch** — use **superpowers:finishing-a-development-branch** (PR per CLAUDE.md trunk-based workflow). Visual handoff: the user confirms both themes before merge.

---

## Notes for the implementer

- **Visual truth is the user's.** Several steps end in a manual visual check; do not claim "looks right" — show the snapshot/build output and let the user confirm (CLAUDE.md + superpowers:verification-before-completion).
- **React Compiler** auto-memoizes; don't add manual `useMemo`/`memo` unless profiling demands it.
- **Notes stored as sharps** internally; flats resolved at render — don't touch that.
- **Commit cadence:** one commit per task as shown; keep the tree green at every commit.
- The two design specs are the source of truth for *intent*; if a step conflicts with a spec, the spec wins — flag it.
