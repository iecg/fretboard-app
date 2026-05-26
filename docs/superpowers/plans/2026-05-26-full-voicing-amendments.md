# Full-Voicing Plan — Amendments After Round 1 Review

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement these task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the three issues left by the original full-voicing plan (`2026-05-26-full-voicing-out-of-pattern-and-root-emphasis.md`).

**Root cause (verified):** `chordHighlightPositionsAtom` in `src/store/chordOverlayAtoms.ts:567-586` filters `fullChordPositionKeys` against `isInAnyPolygon` when **Lock-to-scale** is on. This deletes voicing vertices outside the active CAGED polygon **before they reach `useNoteData`** — every downstream fix (FV-T1, FV-T2) was operating on a position set that had already lost the missing notes. The connector polyline keeps arcing through the deleted vertices because it's built from `voicingMatchesAtom` upstream of the filter.

**User-confirmed policy (revised after Round 2 question):**
1. **Leave the polygon filter in place.** Dropping it would expose every CAGED voicing across the entire neck because `fullVoicingsAtom` returns matches up to fret 24 with no fret-window filter. User accepts the rare case where a voicing extends past the polygon and gets clipped as an "edge case."
2. **Fix the problem upstream by removing the bad voicing.** The C-shape dim template was always a dedup-breaker that added a hard-to-fret high-E F note. Without that note the C-shape collapses below the 4-note threshold and never registers. A-shape dim already provides the lower-neck B° voicing (with vertices all inside the typical polygon), so the user's screenshot issue disappears.
3. Revert FV-T1's `applyDimOpacity` change — it was the wrong layer, and with the polygon filter staying in place, it has no opportunity to fire usefully.

**FV-T2 (`finalNoteClass` override) and FV-T3 (chord-root halo) stay** — both remain correct guarantees for in-polygon voicing positions that the scale-aware classifier would otherwise leave as `chord-tone-outside-scale` (e.g. a chord tone the parent scale doesn't include).

**Tech stack:** Same — Jotai atoms, Vitest, no new deps.

---

## File map

- **`src/components/FretboardSVG/hooks/useNoteData.ts`** — revert the FV-T1 dim-suppression clause inside the `applyDimOpacity` predicate. Restore the original predicate. Leave the `isVoicingVertex` / `finalNoteClass` machinery from FV-T2 in place.
- **`src/components/FretboardSVG/hooks/useNoteData.test.ts`** — drop the FV-T1 test that asserts `applyDimOpacity === false` for a voicing vertex outside the polygon. Keep the FV-T2 classification test.
- **`packages/core/src/shapes/templates.ts`** — delete one entry from the `FULL_CHORD_TEMPLATES` array: the C-shape `dim` template. After deletion, the diminished family has 4 shape entries (A, G, E, D) instead of 5.
- **`packages/core/src/shapes/fullChordShapes.test.ts`** — update / remove the C-shape dim test to assert that no C-shape match is returned for diminished chords.
- Visual baselines — refresh after the above.

**Not modified (intentionally):** `src/store/chordOverlayAtoms.ts`. The `isInAnyPolygon` filter on the `voicing === "full"` branch stays. Dropping it would expose every neck-wide CAGED voicing because `fullVoicingsAtom` has no fret-window filter.

---

## Task A1: Revert FV-T1 dim suppression

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useNoteData.ts`
- Modify: `src/components/FretboardSVG/hooks/useNoteData.test.ts`

- [ ] **Step 1: Inspect FV-T1's commit to recall the exact change**

```bash
git show 1acca7f1 -- src/components/FretboardSVG/hooks/useNoteData.ts
```
Expect a single-line insertion of either `!(hasFullChordPositionFilter && fullChordPositionKeys.has(positionKey)) &&` OR (post-FV-T2 DRY) `!isVoicingVertex &&` inside the `applyDimOpacity` predicate.

- [ ] **Step 2: Remove that clause**

Edit `useNoteData.ts`. Locate the `applyDimOpacity` block:

```typescript
const applyDimOpacity =
  (shapePolygons.length > 0 &&
    !isInsideAnyPolygon &&
    !isVoicingVertex &&                 // ← DELETE THIS LINE
    (finalNoteClass === "note-blue" ||
      finalNoteClass === "chord-tone-outside-scale" ||
      finalNoteClass === "chord-tone-in-scale" ||
      finalNoteClass === "note-diatonic-chord" ||
      finalNoteClass === "chord-root" ||
      finalNoteClass === "key-tonic")) ||
  (isWrapped && isHighlighted);
```

Leave the rest of the block untouched. `isVoicingVertex` and `finalNoteClass` declarations stay (FV-T2 uses them).

- [ ] **Step 3: Drop the FV-T1 test**

In `useNoteData.test.ts`, locate the describe block `"useNoteData — full-voicing positions outside polygon"` (added by FV-T1, around lines 335-394) and delete it whole. Leave the FV-T2 describe `"useNoteData — full-voicing classifies vertices as in-scale chord tones"` in place.

- [ ] **Step 4: Run the file to confirm green**

```bash
pnpm vitest run src/components/FretboardSVG/hooks/useNoteData.test.ts
```
Expected: all tests pass; one fewer test than before.

- [ ] **Step 5: Commit**

Stage only the two files. Commit:

```bash
git commit -m "revert(fretboard): drop applyDimOpacity voicing-vertex clause"
```

Body (optional): "Layer was wrong — polygon filter lives in chordOverlayAtoms.ts and gets fixed there instead."

---

## Task A2: Delete the redundant C-shape dim template

**Files:**
- Modify: `packages/core/src/shapes/templates.ts` (remove one entry from `FULL_CHORD_TEMPLATES`)
- Modify: `packages/core/src/shapes/fullChordShapes.test.ts`

**Why:** The current C-shape dim entry `{ shape: "C", quality: "dim", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [2, 4, 5, null, 3, null] }` was hand-tuned in the round-1 CAGED expansion specifically to break a collision with A-shape dim — by adding a high-E F note. Without that high-E F, C-shape dim collapses to 3 fretted notes (D, B, B for B°) which fails the `≥4 notes` requirement in `getFullChordShapeMatches` → never registers. Since both C-shape dim and A-shape dim use the same `anchorString: 4`, A-shape's voicing (`[null,1,2,1,0,null]` → D@B3, B@G4, F@D3, B@A2 for B°) already covers the physical voicing the user wants. The high-E F was always cosmetic — a label-only differentiation, not a meaningful new fingering. User confirmed shapes sharing the same pattern is acceptable for the diminished family.

Result: C-shape dim disappears from voicing matches for every diminished root; A-shape dim becomes the sole canonical voicing in its fret range.

- [ ] **Step 1: Update the test fixture first**

In `packages/core/src/shapes/fullChordShapes.test.ts`, locate the C-shape `dim` test (search for `"C-shape dim"` or `shape === "C"` near a `"dim"` block — the original CAGED-templates round-1 plan added one test per shape-quality combination).

Update it to assert **no C-shape match** for diminished, instead of the prior position-set assertion:

```typescript
it("C-shape dim is omitted — A-shape covers the same physical voicing", () => {
  const matches = getFullChordShapeMatches({
    chordRoot: "B",
    chordType: "dim",
    tuning: ["E","B","G","D","A","E"],
    maxFret: 12,
  });
  // C-shape dim is intentionally not in FULL_CHORD_TEMPLATES — the high-E F
  // that would have made it distinct from A-shape was a cosmetic dedup-breaker
  // with no real fingering benefit. A-shape covers the lower-neck dim voicing.
  expect(matches.find((m) => m.shape === "C")).toBeUndefined();
  expect(matches.find((m) => m.shape === "A")).toBeDefined();
});
```

If the existing test asserts a non-empty C-shape match, this new assertion will fail until Step 2 lands.

Verify the test FAILS now:
```bash
pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "C-shape dim"
```

- [ ] **Step 2: Delete the C-shape dim template**

In `packages/core/src/shapes/templates.ts`, locate:

```typescript
{ shape: "C", quality: "dim", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [2, 4, 5, null, 3, null] },
```

**Delete the entire line.** The `FULL_CHORD_TEMPLATES` array now has 4 dim entries (A, G, E, D shapes) instead of 5.

- [ ] **Step 3: Run, expect PASS**

```bash
pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "C-shape dim"
```
Expected: PASS.

- [ ] **Step 4: Run the whole shapes suite**

```bash
pnpm vitest run packages/core/src/shapes/
```
Expected: all green. If other dim tests fail (e.g. one that asserted a specific shape count for diminished matches), update the count by -1 and add a one-line comment referencing this task.

- [ ] **Step 5: Audit (no edits) — note for user**

While you have the templates file open, scan the other dim-family entries (`dim7`, `m7b5`) for high-E notes that might be similarly cosmetic. **Do not modify them in this task** — the user only sanctioned removing the C-shape dim duplicate. If you find a high-E note that looks load-bearing (covers a chord tone no other string covers in that voicing), say so in your report. If you find one that looks like another dedup-breaker, also flag it — the user may want a follow-up sweep.

- [ ] **Step 6: Commit**

Stage only the two files. Commit:

```bash
git commit -m "fix(shapes): drop redundant C-shape dim template"
```

Body: "C-shape dim and A-shape dim share anchorString=4 and produce the same physical voicing once the high-E F dedup-breaker is removed. Drop the duplicate."

---

## Task A3: Visual baseline refresh

**Files:**
- Modify: relevant darwin snapshots under `e2e/__screenshots__/` / `e2e/*.spec.ts-snapshots/`

- [ ] **Step 1: Run visuals**

```bash
pnpm test:visual
```
Expect new diffs concentrated on:
- Fretboard renders with B° (or any diminished) chord overlay — extra vertex visible at G-string fret 4 in the relevant fret window.
- Fretboard renders with Lock-to-scale ON and a full voicing extending past the polygon.

- [ ] **Step 2: Inspect 2-3 diff PNGs**

Open `test-results/<suite>/*-diff.png` for a representative sample. Confirm the diffs match the expected categories above. Reject and investigate if any diff falls outside.

- [ ] **Step 3: Refresh darwin baselines**

```bash
pnpm test:visual:update
```

- [ ] **Step 4: Re-run to confirm clean**

```bash
pnpm test:visual
```
Expected: 0 failures.

- [ ] **Step 5: Commit**

Stage only `e2e/`. Commit:

```bash
git commit -m "test(visual): refresh darwin baselines after voicing filter rework"
```

---

## Task A4: Full verification

- [ ] **Step 1: lint + test + build in parallel**

```bash
pnpm lint && pnpm test && pnpm build
```
Expected: all green.

- [ ] **Step 2: e2e production**

```bash
pnpm test:e2e:production
```
Expected: all green.

- [ ] **Step 3: Manual smoke (user)**

In `pnpm dev`: load C major + B° chord with full-chord voicing.
- Confirm all 4 voicing vertices render: D@B-string fret 3, B@G-string fret 4, F@D-string fret 3, B@A-string fret 2 (high-E should be muted = no bubble).
- Toggle Lock-to-scale ON/OFF — full voicing stays complete in both states.
- Confirm chord-root halo (FV-T3) still distinguishes the two B roots.
- Confirm no "phantom dim" on voicing notes outside the active polygon — they render at full opacity (FV-T1 removed; the upstream fix means out-of-polygon voicing-vertex notes now flow through the normal in-polygon code path).

---

## Files NOT touched (intentionally)

- **`packages/core/src/shapes/templates.ts`** for any other quality / shape — only the one entry the user called out. If other voicings prove awkward in real use, queue them in a follow-up.
- **FV-T2 (`finalNoteClass` override)** — still correct and needed.
- **FV-T3 (chord-root halo CSS)** — still correct and needed.
- **`addChordTonesWithinPolygon`** — kept for `voicing === "off"` branch.
- **`voicing === "close"` path** — untouched.
- **`isInPlayableContext` in `useNoteData.ts`** — its existing `fullChordPositionKeys.has(positionKey)` override stays correct; once A2 lands, the set includes the previously-stripped positions so this override now fires for them.
