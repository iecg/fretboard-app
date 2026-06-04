# Marker Vocabulary v2 + Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the fretboard marker shape vocabulary to circle (in-key) / diamond (chromatic) only, make salience figure-relative (scale tones present when no chord overlay), and land the batch of marker/color fixes from the v2 design spec.

**Architecture:** All changes live in the `FretboardSVG` domain. Note *classification* (role → string) is in `utils/semantics.ts` and `hooks/buildStaticFretboardTopology.ts`; note *visuals* (role → shape/size) in `utils/semantics.ts#getNoteVisuals`; note *rendering* in `FretboardNote.tsx` + `FretboardSVG.module.css`. Tests are co-located; integration tests render `<FretboardSVG>` and assert `data-note-shape` / role classes. Visual regression is Playwright (`pnpm run test:visual`).

**Tech Stack:** React 19 + TypeScript, CSS Modules, Vitest + Testing Library (jsdom), Playwright visual regression, pnpm workspace.

**Scope note:** The degree-lens Hooktheory pass (spec §3.10) is a **separate plan** — it touches only degree tokens/CSS and is independent. This plan covers spec §3.1–3.9 and §3.11.

**Source spec:** `docs/superpowers/specs/2026-06-03-marker-color-followups-design.md`
**Research/rationale:** `docs/design/fretboard-visual-language.md`

**Conventions:** branch `claude/marker-color-followups` (not main). Lowercase Conventional Commit subjects (commitlint). End every commit body with:
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
Run from: `/Users/isaaccocar/repos/fretboard-app/.claude/worktrees/marker-color-followups`

---

## File structure

| File | Responsibility | Tasks |
|---|---|---|
| `src/components/FretboardSVG/utils/semantics.ts` | `getNoteVisuals` shape map; `classifyNoteFromSemantics` `note-blue` branch; drop guide-tone glow in `getEmphasis`/`applyTonesBase` | 1, 4, 5 |
| `src/components/FretboardSVG/FretboardNote.tsx` | render circle/diamond only; drop concentric ring; label markup | 2, 8 |
| `src/components/FretboardSVG/utils/noteSizing.ts` | retire squircle/halo helpers if unused | 2 |
| `src/components/FretboardSVG/hooks/buildStaticFretboardTopology.ts` | remove full-voicing diamond override | 3 |
| `src/components/FretboardSVG/FretboardSVG.module.css` | figure-relative fill; scale stroke; diamond label; glow-filter removal | 6, 7, 8, 9 |
| `src/components/FretboardSVG/FretboardDefs.tsx`, `FretboardSVG.tsx` | drop orphaned glow filter defs | 9 |
| `src/components/FretboardSVG/FretboardNoteLayer.tsx` / animated view | marker jitter fix | 10 |
| Co-located `*.test.tsx`, `e2e/` snapshots | tests | all |

**Order rationale:** Task 1–2 (squircle→circle) are the widest-reaching and must land first so later visual tasks build on the final shape set.

---

## Task 1: getNoteVisuals → circle / diamond only

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts` (`getNoteVisuals`, ~lines 172-196)
- Test: `src/components/FretboardSVG/utils/semantics.test.ts`

- [ ] **Step 1: Update the failing unit tests**

In `src/components/FretboardSVG/utils/semantics.test.ts`, change every `getNoteVisuals` expectation that currently expects `"squircle"` to `"circle"`. The chord-tone roles are the ones affected:
```ts
it("returns a circle for chord roles (squircle retired in v2)", () => {
  expect(getNoteVisuals("chord-root").noteShape).toBe("circle");
  expect(getNoteVisuals("chord-tone-in-scale").noteShape).toBe("circle");
  expect(getNoteVisuals("note-diatonic-chord").noteShape).toBe("circle");
});
it("keeps diamonds for chromatic / outside-key roles", () => {
  expect(getNoteVisuals("chord-root-outside").noteShape).toBe("diamond");
  expect(getNoteVisuals("chord-tone-outside-scale").noteShape).toBe("diamond");
  expect(getNoteVisuals("note-blue").noteShape).toBe("diamond");
});
```
Keep the existing `radiusScale` assertions (sizes are unchanged in this task).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: FAIL — `getNoteVisuals("chord-root")` still returns `"squircle"`.

- [ ] **Step 3: Change the shape map**

In `src/components/FretboardSVG/utils/semantics.ts`, change the chord-tone case in `getNoteVisuals` from `"squircle"` to `"circle"`, and drop `"squircle"` from the `NoteShape` type:
```ts
type NoteShape = "circle" | "diamond";
```
```ts
    case "chord-root":
    case "chord-tone-in-scale":
    case "note-diatonic-chord":
      return { radiusScale: RADIUS_CHORD, noteShape: "circle" };
```
Leave the `chord-root-outside`, `chord-tone-outside-scale`, `note-blue` (diamond) and the scale/key-tonic (circle) cases unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the integration-test expectations**

In `src/components/FretboardSVG/FretboardSVG.test.tsx`, the role-shape table (~lines 327-366) asserts `chord-root` → `"squircle"` and `chord-tone-in-scale` → `"squircle"`. Change both expected shapes to `"circle"`. Leave `chord-tone-outside-scale`, `note-blue` (diamond), `scale-only`, `note-active`, `color-tone` (circle) rows unchanged. Also update the outside-key root test (~line 438) — it already expects `diamond`; no change.

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/utils/semantics.test.ts src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "refactor(fretboard): chord tones are circles — retire the squircle shape"
```

---

## Task 2: Render circle/diamond only + drop the root concentric ring

**Files:**
- Modify: `src/components/FretboardSVG/FretboardNote.tsx` (shape render, ~lines 68-111)
- Modify: `src/components/FretboardSVG/utils/noteSizing.ts` (retire squircle/halo helpers)
- Test: `src/components/FretboardSVG/FretboardNoteLayer.test.tsx`

- [ ] **Step 1: Update the layer test (drop halo-path assertion)**

`src/components/FretboardSVG/FretboardNoteLayer.test.tsx` imports `CHORD_ROOT_HALO_RADIUS_PX` (~line 24) and asserts a chord-root halo path at `visualRadius + CHORD_ROOT_HALO_RADIUS_PX` (~line 143). Replace that assertion with one that confirms a chord-root renders **exactly one** shape path and **no** extra halo outline:
```ts
it("chord-root renders a single circle, no concentric halo ring", () => {
  const { container } = renderNote({ noteClass: "chord-root" /* + existing required props */ });
  const g = container.querySelector('[data-note-shape="circle"]');
  expect(g).not.toBeNull();
  // exactly one <circle> (the marker) — no second halo-ring circle
  expect(g!.querySelectorAll("circle").length).toBe(1);
});
```
Remove the `CHORD_ROOT_HALO_RADIUS_PX` import and the old halo assertion.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNoteLayer.test.tsx`
Expected: FAIL — two circles render (marker + halo ring) and/or shape is still `squircle`.

- [ ] **Step 3: Simplify the shape render in `FretboardNote.tsx`**

Replace the `shapeEl` block (the `noteShape === "squircle" ? … : noteShape === "diamond" ? … : …` expression, ~lines 79-111) with circle/diamond only, no concentric ring:
```tsx
  const r = reduceCircleRadius(rawRadius);
  const glowR = glowUnderlayRadiusPx(r, false);

  const shapeEl =
    noteShape === "diamond" ? (
      <polygon
        points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
      />
    ) : (
      <circle cx={cx} cy={cy} r={r} />
    );
```
This removes: the squircle branch, the `chord-root` halo `<path>`, and the `key-tonic` halo `<circle>` (spec §3.4). Remove the now-unused imports `reduceSquircleRadius`, `squirclePath`, `CHORD_ROOT_HALO_RADIUS_PX` from the import on line 6 (keep `glowUnderlayRadiusPx`, `reduceCircleRadius`).

- [ ] **Step 4: Retire unused helpers in `noteSizing.ts`**

Run `git grep -n "reduceSquircleRadius\|squirclePath\|CHORD_ROOT_HALO_RADIUS_PX\|GLOW_RADIUS_SCALE_SQUIRCLE\|SQUIRCLE_RADIUS_REDUCTION_PX\|SQUIRCLE_K\|chordRootVisualRadiusPx" src` to find remaining consumers. For each symbol with **zero** non-test consumers after Task 2-3, delete it from `noteSizing.ts`. `glowUnderlayRadiusPx` stays (still called) but its `isSquircle` param is now always `false` — simplify its body to `return radiusPx;` and drop the param, updating the one caller in `FretboardNote.tsx` to `glowUnderlayRadiusPx(r)`. If any squircle helper still has a consumer (e.g. `chordRootVisualRadiusPx` used elsewhere), leave it and note it in the report.

- [ ] **Step 5: Run to verify it passes + typecheck**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNoteLayer.test.tsx && pnpm exec tsc -b`
Expected: PASS; no TS errors (catches any dangling import/usage).

- [ ] **Step 6: Commit**
```bash
git add src/components/FretboardSVG/FretboardNote.tsx src/components/FretboardSVG/utils/noteSizing.ts src/components/FretboardSVG/FretboardNoteLayer.test.tsx
git commit -m "refactor(fretboard): render circle/diamond only, drop root concentric ring"
```

---

## Task 3: Diamonds in all voicing modes

**Files:**
- Modify: `src/components/FretboardSVG/hooks/buildStaticFretboardTopology.ts` (~lines 245-252)
- Test: `src/components/FretboardSVG/FretboardSVG.test.tsx`

- [ ] **Step 1: Write the failing integration test**

Add to `src/components/FretboardSVG/FretboardSVG.test.tsx` (reuse the file's existing `BASE_PROPS` and full-chord-mode props pattern; the full-chord vertices are supplied via `fullChordPositions`/`fullChordShape` props — match the prop names already used by the file's other full-chord tests):
```ts
it("outside-scale chord tone renders a diamond even in full-voicing mode", () => {
  // C major scale; chord adds A# (outside the scale) as a full-chord vertex.
  const { container } = render(
    <FretboardSVG
      {...BASE_PROPS}
      rootNote="C"
      highlightNotes={["C", "E", "G"]}
      chordTones={["C", "E", "G", "A#"]}
      chordRoot="C"
      /* full-voicing props per the existing full-chord tests in this file */
    />
  );
  expect(
    container.querySelectorAll('.chord-tone-outside-scale[data-note-shape="diamond"]').length
  ).toBeGreaterThan(0);
});
```
*(Match the exact full-voicing prop names used by the existing `data-full-chord-mode` tests in this file; if a helper like `renderFullChord(...)` exists, use it.)*

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: FAIL — the A# vertex renders as a `chord-tone-in-scale` squircle/circle, not a diamond.

- [ ] **Step 3: Remove the non-root override**

In `src/components/FretboardSVG/hooks/buildStaticFretboardTopology.ts`, the block (~lines 245-252) currently forces voicing vertices to `chord-tone-in-scale`:
```ts
      const isVoicingVertex =
        hasFullChordPositionFilter && fullChordPositionKeys.has(positionKey);
      const finalNoteClass =
        isVoicingVertex &&
        noteClass !== "chord-root" &&
        noteClass !== "chord-root-outside"
          ? "chord-tone-in-scale"
          : noteClass;
```
Replace with: voicing vertices keep their natural classification (so an outside-scale vertex stays `chord-tone-outside-scale` → diamond). The voicing-membership flag is no longer needed for reclassification:
```ts
      const finalNoteClass = noteClass;
```
If `isVoicingVertex` / `hasFullChordPositionFilter` / `fullChordPositionKeys` become unused after this, leave them only if still referenced elsewhere in the function; otherwise remove the now-dead local. Verify with `tsc -b`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx && pnpm exec tsc -b`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/FretboardSVG/hooks/buildStaticFretboardTopology.ts src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "fix(fretboard): outside-scale chord tones render as diamonds in full voicing"
```

---

## Task 4: Blue/color notes diamond under a chord overlay

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts` (`classifyNoteFromSemantics`, ~lines 137-158)
- Test: `src/components/FretboardSVG/utils/semantics.test.ts`, `src/components/FretboardSVG/FretboardSVG.test.tsx`

**Decision (resolves spec §3.6 detection signal):** reuse `sem.isColorTone` — the app's existing designated color/blue-note signal, which the no-overlay path already maps to `note-blue` (diamond). Under an overlay, a color note that is **not** a chord tone → `note-blue` (diamond); chord-tone branches come first so a chord tone wins.

- [ ] **Step 1: Write the failing unit test**

Add to `src/components/FretboardSVG/utils/semantics.test.ts`:
```ts
it("classifies a non-chord color tone under an overlay as note-blue (diamond)", () => {
  const sem = {
    isScaleRoot: false, isChordRoot: false, isChordTone: false,
    isInScale: true, isColorTone: true, isGuideTone: false, isTension: false,
    isDiatonicChord: false,
  } as NoteSemantics;
  expect(classifyNoteFromSemantics(sem, /*isInActiveShape*/ true, /*hasChordOverlay*/ true, /*isHighlighted*/ true))
    .toBe("note-blue");
});
it("a color tone that is also a chord tone stays a chord tone (chord wins)", () => {
  const sem = {
    isScaleRoot: false, isChordRoot: false, isChordTone: true,
    isInScale: true, isColorTone: true, isGuideTone: false, isTension: false,
    isDiatonicChord: false,
  } as NoteSemantics;
  expect(classifyNoteFromSemantics(sem, true, true, true)).toBe("chord-tone-in-scale");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: FAIL — the first case currently returns `"color-tone"` (no `note-blue` branch under overlay).

- [ ] **Step 3: Add the `note-blue` branch**

In `classifyNoteFromSemantics`, in the `hasChordOverlay` path, add a `note-blue` branch **after** the chord-tone branches and **before** the `color-tone`/`scale-only` branches:
```ts
  if (sem.isChordRoot && sem.isChordTone && isInActiveShape)
    return sem.isInScale ? "chord-root" : "chord-root-outside";
  if (sem.isDiatonicChord && sem.isChordTone && isInActiveShape) return "note-diatonic-chord";
  if (sem.isInScale && sem.isChordTone && isInActiveShape) return "chord-tone-in-scale";
  if (sem.isColorTone && isInActiveShape && isHighlighted) return "note-blue";   // ← added: chromatic color/blue note (chord-tone branches already returned)
  if (sem.isInScale && isInActiveShape && isHighlighted) return "scale-only";
  if (sem.isChordTone && isInActiveShape) return "chord-tone-outside-scale";
  return "note-inactive";
```
This replaces the old `color-tone` line. (The `color-tone` role is now superseded for color notes under an overlay — matching the no-overlay behavior, per spec §3.6.) `getNoteVisuals("note-blue")` already returns `diamond`.

- [ ] **Step 4: Run unit + add an integration check**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS.

Add an integration test to `FretboardSVG.test.tsx` (Dorian/blues scale, chord overlay on, a color note that isn't a chord tone) asserting `.note-blue[data-note-shape="diamond"]` count > 0. Run that file:
Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/utils/semantics.test.ts src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "fix(fretboard): chromatic color/blue notes render as diamonds under a chord overlay"
```

---

## Task 5: Drop the static guide-tone glow

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts` (`applyTonesBase`, ~lines 63-74)
- Test: `src/components/FretboardSVG/utils/semantics.test.ts`

- [ ] **Step 1: Update the failing test**

`applyTonesBase`/`getEmphasis` currently returns a `glowColor` for guide tones. Add/adjust a test asserting guide tones get **no** static glow (teal hue carries identity; the transition ring is separate and is driven by `leadContext`, not the base):
```ts
it("guide tones get no static glow in the base emphasis (hue carries identity)", () => {
  const e = getEmphasis("chord-tone-in-scale", /*isGuideTone*/ true);
  expect(e.glowColor).toBeUndefined();
  expect(e.radiusBoost).toBe(1);
});
```
Keep any existing test that asserts the *lead-in* transition behavior (that path is unchanged).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: FAIL — guide tones currently return `glowColor: "var(--note-glow-hold)"`, `radiusBoost: 1.15`.

- [ ] **Step 3: Remove the guide-tone glow from the base**

In `applyTonesBase`, drop the guide-tone glow/boost branch so guide tones use the neutral base (their teal hue is applied via CSS `[data-note-guide-tone]`, not emphasis):
```ts
function applyTonesBase(noteClass: string, _isGuideTone: boolean): LensEmphasis {
  if (noteClass === "scale-only" || noteClass === "color-tone") {
    return { radiusBoost: 0.85, opacityBoost: 0.7 };
  }
  return { radiusBoost: 1, opacityBoost: 1 };
}
```
Note: the `resting` branch in `getEmphasis` that references `commonWithNext` for held common tones (the progression lead-lens) is unchanged — that is voice-leading, not the static guide-tone glow. Only the no-context guide-tone glow is removed.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/utils/semantics.test.ts
git commit -m "refactor(fretboard): guide tones read via teal hue, drop the static glow"
```

---

## Task 6: Figure-relative salience — present no-overlay scale tones

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts` (`getNoteVisuals` `note-active` size, ~line 180)
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css` (split `note-active` out of the hollow group, ~lines 113-118)
- Test: `src/components/FretboardSVG/utils/semantics.test.ts`, `src/components/FretboardSVG/FretboardSVG.test.tsx`

Background: with no chord overlay, an in-scale highlighted note classifies as `note-active` (see `classifyNote`). Today `note-active` → `RADIUS_SCALE` (0.66, small) + hollow (shares the `.scale-only, .note-active, .color-tone` rule). Make it present: medium size + filled.

- [ ] **Step 1: Write the failing unit test (size)**

Add to `semantics.test.ts`:
```ts
it("note-active (no-overlay scale tone) is medium-sized, not the small ground size", () => {
  expect(getNoteVisuals("note-active").radiusScale).toBe(0.8); // RADIUS_OUTSIDE = present/medium
  expect(getNoteVisuals("scale-only").radiusScale).toBe(0.66); // ground stays small
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: FAIL — `note-active` returns `0.66`.

- [ ] **Step 3: Bump `note-active` size; split CSS fill**

In `getNoteVisuals`, give `note-active` the medium radius (separate it from `scale-only`):
```ts
    case "scale-only":
      return { radiusScale: RADIUS_SCALE, noteShape: "circle" };
    case "note-active":
      return { radiusScale: RADIUS_OUTSIDE, noteShape: "circle" };
```
In `FretboardSVG.module.css`, remove `.note-active` from the hollow group and add a filled rule. Change the hollow group (~line 114) to:
```css
/* Scale CONTEXT under a chord overlay — neutral HOLLOW (recede as ground). */
.fretboard-note:is(.scale-only, .color-tone) :is(circle, path, polygon) {
  fill: none;
  stroke: var(--fb-neutral-stroke);
  stroke-width: 1.7;
}
/* No-overlay scale tone — the scale IS the figure: neutral FILLED, present. */
.fretboard-note.note-active :is(circle, path, polygon) {
  fill: var(--fb-neutral-fill);
  stroke: var(--fb-neutral-stroke);
  stroke-width: 1.7;
}
```

- [ ] **Step 4: Run unit + integration**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS.

Add an integration test to `FretboardSVG.test.tsx`: with no chord overlay (no `chordTones`/`chordRoot`), a highlighted non-root scale note renders as `.note-active` and its `<circle>` has a non-`none` fill. Because jsdom doesn't compute the CSS-module rule, assert structurally instead — the note has class `note-active` and `data-note-shape="circle"`:
```ts
it("with no chord overlay, scale tones are note-active circles (present)", () => {
  const { container } = render(
    <FretboardSVG {...BASE_PROPS} rootNote="C" highlightNotes={["C","D","E","F","G","A","B"]} />
  );
  expect(container.querySelectorAll('.note-active[data-note-shape="circle"]').length).toBeGreaterThan(0);
});
```
Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: PASS. (The filled-vs-hollow appearance is covered by visual regression in Task 11-equivalent below / the final visual pass.)

- [ ] **Step 5: Commit**
```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/FretboardSVG.module.css src/components/FretboardSVG/FretboardSVG.test.tsx src/components/FretboardSVG/utils/semantics.test.ts
git commit -m "feat(fretboard): present scale tones when no chord overlay (figure-relative salience)"
```

---

## Task 7: Lighten the light-mode scale stroke

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css` (~lines 183-189)

- [ ] **Step 1: Scope the heavy light-mode stroke to filled roles**

The rule at ~line 183 forces `stroke-width: 3.6` on **all** light-mode shapes. Scope it so the **hollow** roles keep their thin 1.7 stroke. Replace:
```css
:global([data-theme="modern-light"]) .fretboard-note :is(circle, path, polygon) {
  stroke-width: 3.6;
}
:global([data-theme="modern-light"]) .fretboard-note circle {
  r: calc(var(--note-r) * 1px - 0.4px);
}
```
with a version that excludes the hollow context roles:
```css
/* Light-mode heavy stroke for FILLED markers only. Hollow context roles keep
   their thin 1.7 stroke (see base rules) so they read as recessive ground. */
:global([data-theme="modern-light"]) .fretboard-note:not(.scale-only):not(.color-tone):not(.note-inactive) :is(circle, path, polygon) {
  stroke-width: 3.6;
}
:global([data-theme="modern-light"]) .fretboard-note:not(.scale-only):not(.color-tone):not(.note-inactive) circle {
  r: calc(var(--note-r) * 1px - 0.4px);
}
```
(`note-active` is filled now, so it correctly keeps the heavier stroke — it's a figure, not ground. Only the hollow `scale-only`/`color-tone`/`note-inactive` are excluded.)

- [ ] **Step 2: Verify build + lint**

Run: `pnpm run lint && pnpm run build`
Expected: stylelint passes; build succeeds. (Visual confirmation deferred to the final visual pass.)

- [ ] **Step 3: Commit**
```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "style(fretboard): keep hollow context strokes thin in light mode"
```

---

## Task 8: Legible chromatic-diamond labels

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css` (~lines 151-163)
- Test: `src/styles/__tests__/fbColorTokens.test.ts` (extend the glyph-on-fill APCA gate)

- [ ] **Step 1: Extend the APCA gate (failing if the dim/halo is wrong)**

In `src/styles/__tests__/fbColorTokens.test.ts`, the glyph-on-fill `describe` checks `|Lc| ≥ 45` for filled markers. Add the chromatic diamond (neutral fill) to the gate for both themes — light glyph color is `--note-label-on-color` (`#2a251d`) on `--fb-neutral-fill`; dark glyph is white on `--fb-neutral-fill`:
```ts
// chromatic diamond label on the neutral fill
it("modern-light chromatic-diamond glyph vs --fb-neutral-fill |Lc|≥45", () => {
  const b = readThemeBlock("modern-light");
  const fill = hexOf(resolveVar(b["--fb-neutral-fill"], b));
  const glyph = hexOf(resolveVar(b["--note-label-on-color"], b));
  expect(Math.abs(contrastAPCA(glyph, fill))).toBeGreaterThanOrEqual(45);
});
it("modern-dark chromatic-diamond glyph (white) vs --fb-neutral-fill |Lc|≥45", () => {
  const b = readThemeBlock("modern-dark");
  const fill = hexOf(resolveVar(b["--fb-neutral-fill"], b));
  expect(Math.abs(contrastAPCA("#ffffff", fill))).toBeGreaterThanOrEqual(45);
});
```
(Reuse the `hexOf`/`resolveVar`/`contrastAPCA` helpers already imported in that file.)

- [ ] **Step 2: Run to confirm current state**

Run: `pnpm exec vitest run src/styles/__tests__/fbColorTokens.test.ts`
Expected: these likely PASS already at the contrast level (the fill is light cream/dark navy) — the real defect is the **0.9 opacity dim + faint halo**, which is a *visual* concern, not contrast. If they pass, that's fine; they lock the contrast. If a pair fails, it confirms a real legibility bug to fix in Step 3.

- [ ] **Step 3: Make the diamond label crisp**

In `FretboardSVG.module.css`, remove the opacity dim and strengthen the halo for the chromatic-diamond roles. Replace the rule at ~line 161:
```css
.fretboard-note.chord-tone-outside-scale text {
  opacity: 0.9;
}
```
with full opacity for both chromatic-diamond roles (and ensure `note-blue` shares the legible treatment):
```css
/* Chromatic-diamond labels read crisply — salience comes from SIZE, not a dim glyph. */
.fretboard-note:is(.chord-tone-outside-scale, .note-blue) text {
  opacity: 1;
}
```
Ensure both roles get the light/dark label fill+halo. Extend the existing light rule (~line 156) and dark rule (~line 151) selectors to include `.note-blue`:
```css
:global([data-theme="modern-light"]) .fretboard-note:is(.chord-tone-outside-scale, .note-blue) text {
  stroke: var(--note-label-on-color-stroke);
  fill: var(--note-label-on-color);
}
:global([data-theme="modern-dark"]) .fretboard-note:is(.chord-tone-outside-scale, .note-blue) text {
  fill: #ffffff;
  stroke: rgb(0 0 0 / 0.45);
}
```
The base text rule already sets `paint-order: stroke`, so the halo paints under the fill.

- [ ] **Step 4: Run the gate + build**

Run: `pnpm exec vitest run src/styles/__tests__/fbColorTokens.test.ts && pnpm run build`
Expected: PASS; build succeeds. (Visual crispness confirmed in the final visual pass.)

- [ ] **Step 5: Commit**
```bash
git add src/components/FretboardSVG/FretboardSVG.module.css src/styles/__tests__/fbColorTokens.test.ts
git commit -m "fix(fretboard): legible chromatic-diamond labels (full opacity + halo)"
```

---

## Task 9: Remove leftover violet/cyan role glow filters

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css` (~lines 199-206)
- Modify: `src/components/FretboardSVG/FretboardDefs.tsx`, `src/components/FretboardSVG/FretboardSVG.tsx` (orphaned glow defs, grep-guarded)

- [ ] **Step 1: Remove the role→glow-filter rules**

In `FretboardSVG.module.css`, delete both rules (~lines 199-206):
```css
.fretboard-note[data-note-role="note-active"],
.fretboard-note[data-note-role="scale-only"] {
  filter: var(--fretboard-svg-glow-cyan-url);
}
.fretboard-note[data-note-role="note-blue"],
.fretboard-note[data-note-role="color-tone"] {
  filter: var(--fretboard-svg-glow-violet-url);
}
```

- [ ] **Step 2: Grep-guard the filter defs**

Run:
```bash
git grep -n "glow-violet\|glow-cyan\|fretboard-svg-glow-violet-url\|fretboard-svg-glow-cyan-url" src
```
For each of `glow-violet` / `glow-cyan`: if it now has **no** consumer outside its own definition (`FretboardDefs.tsx` `<filter>` + the `glowFilterUrls` map + the `--fretboard-svg-glow-*-url` style var in `FretboardSVG.tsx`), remove the definition, the map entry, and the style-var wiring. If a glow is still used elsewhere (e.g. `glow-orange` is used by `chord-tone-*` roles at module.css:196 — leave that one), keep it. Report which were removed vs kept.

- [ ] **Step 3: Verify lint + build + typecheck**

Run: `pnpm run lint && pnpm exec tsc -b && pnpm run build`
Expected: all pass (catches any dangling `var(--…)` or unused import).

- [ ] **Step 4: Commit**
```bash
git add src/components/FretboardSVG/FretboardSVG.module.css src/components/FretboardSVG/FretboardDefs.tsx src/components/FretboardSVG/FretboardSVG.tsx
git commit -m "fix(fretboard): remove leftover violet/cyan role glow filters"
```

---

## Task 10: Fix the marker jitter on chord transition

**Files:**
- Investigate + Modify: `src/components/FretboardSVG/FretboardNoteLayer.tsx` and/or the animated view (`useAnimatedFretboardView` / `usePlaybackTransportModel`)
- Test: `src/components/FretboardSVG/FretboardNoteLayer.test.tsx`

This is the one genuine **bug** (cause unknown). REQUIRED SUB-SKILL: use **superpowers:systematic-debugging** before changing code.

- [ ] **Step 1: Reproduce + write a characterization test**

Reproduce per the spec: A-minor-blues scale, progression F → Dm; the F marker (a diamond — `chord-root-outside` under F, `chord-tone-outside-scale` under Dm) shifts position on the transition though its fret is fixed. Write a failing test asserting the marker's **center** (`cx`/`cy`) is identical across the two chord states while only its radius/shape changes:
```ts
it("a marker at a fixed fret keeps its center across a chord change", () => {
  // render the F state, capture the F note's cx/cy
  // re-render the Dm state with the same fretboard, capture the F note's cx/cy
  // expect cx/cy unchanged (allow 0 px tolerance); radius MAY differ
});
```
Use the existing `FretboardNoteLayer` render harness in this test file; key the note lookup by its `data-*` position attributes.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNoteLayer.test.tsx`
Expected: FAIL — `cx`/`cy` differ across the transition (or the assertion exposes a transform-origin shift).

- [ ] **Step 3: Diagnose with systematic-debugging, then apply the minimal fix**

Follow superpowers:systematic-debugging to find the root cause. Prime suspects (from the spec): a motion `transform`/`scale` whose `transform-origin` is not the marker center (so resizing translates it), or a per-chord layout recompute nudging `cx`/`cy`. Apply the minimal fix at the identified source — e.g. set `transform-origin` to the marker center / `transform-box: fill-box`, or stabilize the center computation. Do **not** broaden scope beyond the jitter.

- [ ] **Step 4: Run to verify it passes + no transition regression**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNoteLayer.test.tsx`
Expected: PASS. Also run the connector/transition tests to confirm no regression:
Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardConnectorLayer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/FretboardSVG/
git commit -m "fix(fretboard): keep marker centered across chord transitions (no jitter)"
```

---

## Task 11: Full verification + visual-regression refresh

**Files:** `e2e/` snapshots (regenerated)

- [ ] **Step 1: Mandatory gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all pass. Investigate any unit/integration failure caused by the squircle→circle change (a test asserting `"squircle"` that Task 1/2 missed) and fix it.

- [ ] **Step 2: Visual regression — review diffs**

Run: `pnpm run test:visual`
Expected: **intentional** diffs — chord tones now circles (was squircle), no root concentric ring, no violet/cyan glow, present no-overlay scale tones, crisper diamond labels, lighter light-mode scale strokes. Review each diff image and confirm it matches an intended change from this plan. If a diff appears that no task explains, STOP and investigate.

- [ ] **Step 3: Update snapshots**

Run: `pnpm run test:visual:update`
Expected: darwin snapshots refreshed. (Linux regenerate in CI per CLAUDE.md.)

- [ ] **Step 4: Re-run the gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all pass.

- [ ] **Step 5: Commit**
```bash
git add e2e
git commit -m "test(visual): refresh snapshots for marker vocabulary v2"
```

- [ ] **Step 6: Hand off for visual review**

Surface to the user for a light/dark eyeball: chord tones as circles, present no-overlay scale, diamond legibility, no glow/ring. (Visual sign-off is the user's.)

---

## Self-Review

**1. Spec coverage (§3.1–3.9, 3.11):**
- §3.1 squircle→circle → Task 1 (classify) + Task 2 (render). ✔
- §3.2 figure-relative salience → Task 6. ✔
- §3.3 drop guide-tone glow → Task 5. ✔
- §3.4 drop root/key-tonic ring → Task 2. ✔
- §3.5 diamonds in all voicings → Task 3. ✔
- §3.6 blue notes under overlay (key-relative via `isColorTone`) → Task 4. ✔
- §3.7 legible diamond labels → Task 8. ✔
- §3.8 light-mode scale stroke → Task 7. ✔
- §3.9 remove glow filters → Task 9. ✔
- §3.11 jitter fix → Task 10. ✔
- §3.10 degree lens → **separate plan** (out of scope, stated). ✔
- Verification/snapshots → Task 11. ✔

**2. Placeholder scan:** Code blocks are concrete. The two investigative spots are honestly bounded: Task 10 is a genuine bug → systematic-debugging with a concrete characterization test and acceptance (center stable); Task 2 Step 4 and Task 9 Step 2 are grep-guarded deletions (the grep IS the instruction, with explicit keep/remove criteria). Task 3 Step 1 and Task 4 Step 4 say "match the existing full-chord/Dorian test props in this file" — the file already has those patterns (FretboardSVG.test.tsx:320-362); the engineer reuses them rather than inventing.

**3. Type/name consistency:** `noteShape` values are `"circle" | "diamond"` after Task 1 (type narrowed); Task 2 renders exactly those. `note-active` size `RADIUS_OUTSIDE` (0.8) in Task 6 matches the constant used by `chord-tone-outside-scale`. `getNoteVisuals`, `classifyNoteFromSemantics`, `getEmphasis`, `applyTonesBase` signatures match their current definitions. `note-blue` produced in Task 4 maps to the existing diamond case in `getNoteVisuals`. CSS class/role names (`scale-only`, `color-tone`, `note-active`, `note-inactive`, `chord-tone-outside-scale`, `note-blue`) match the module.

**Known risk:** Task 1/2 (squircle→circle) will fail any test elsewhere that asserts `"squircle"` — Task 11 Step 1 catches stragglers. The glow-filter and squircle-helper removals are guarded by `tsc -b` + lint + grep so a missed consumer fails loudly rather than silently.
