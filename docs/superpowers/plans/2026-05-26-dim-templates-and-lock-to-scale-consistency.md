# Diminished Templates Cleanup + Lock-to-Scale Consistency

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue the diminished-family template audit (drop unplayable / cosmetic-redundant voicings) and fix the Lock-to-scale inconsistencies that leave (a) inside-polygon chord tones unhighlighted when Lock is OFF, and (b) connector-vertex chord tones unhighlighted when those vertices fall outside the polygon under Lock ON.

**Architecture:**
- Tasks T1-T4 are pure template edits in `packages/core/src/shapes/templates.ts` + matching test updates.
- T5-T6 align the highlight-position pipeline with the connector pipeline. Today, connectors run through `selectFullChordMatchesForCagedPosition` (which filters voicings to those scoring well against the active polygon, tolerating ≤2 outside notes), while highlight positions go through `chordHighlightPositionsAtom` (which uses *all* voicing matches and then position-by-position polygon-clips them when Lock is on). T5 introduces a `visibleVoicingMatchesAtom` that mirrors the connector selection in atom land; T6 rewires `chordHighlightPositionsAtom` to use it and to always include `addChordTonesWithinPolygon` regardless of Lock-to-scale.

**Tech stack:** Jotai atoms, Vitest, no new deps.

**Out of scope — deferred to brainstorming:** The user also raised "verify which 'full' chords match exactly a close chord voicing" and "generate close chord for positions that don't have a clearly defined full position or that is impossible to play." That's a substantial new subsystem (selection policy, dedup vs. close voicings, UI signaling of "this is close because full isn't available", interaction with `closeCandidatesAtom`). It belongs in a `superpowers:brainstorming` session, not bolted onto this plan. Flagged at the bottom under **Future Work**.

---

## File map

- **`packages/core/src/shapes/templates.ts`** — delete dim G-shape entry, delete m7b5 G-shape entry, edit dim7 A-shape `fretsHighToLow`, edit dim7 G-shape `fretsHighToLow`.
- **`packages/core/src/shapes/fullChordShapes.test.ts`** — update test fixtures for the four changes.
- **`src/store/chordOverlayAtoms.ts`** — add `visibleVoicingMatchesAtom` that wraps the existing pure selector functions; rewire `chordHighlightPositionsAtom` to derive from it for `voicing === "full"` and always include `addChordTonesWithinPolygon`.
- **`src/store/chordOverlayAtoms.test.ts`** — update Group J / similar tests to reflect new behavior.
- **`src/hooks/useFretboardState.ts`** — replace inline `visibleFullChordMatches` computation with `useAtomValue(visibleVoicingMatchesAtom)`. The two pure selector functions (`selectFullChordMatchesForCagedPosition`, `selectFullChordMatchesForThreeNpsPosition`) move from here to a new module the atom can import; the file keeps its public hook signature.
- **`src/hooks/voicingSelection.ts`** (new) — small module holding the two extracted pure selectors plus their scoring helpers (`scoreFullChordForCagedPosition`, `scoreFullChordForThreeNpsPosition`, `compareFullChordCandidateScores`, `getPositionKey`, the `FullChordCandidateScore` type). Single responsibility: "pick the voicing(s) that fit a given active pattern position."
- **`src/hooks/useFretboardState.test.ts` / wiring tests** — update imports if any reference the moved functions.
- Visual baselines — refresh after the above.

---

## Task T1: Delete dim G-shape template

**Files:**
- Modify: `packages/core/src/shapes/templates.ts` (delete one entry)
- Modify: `packages/core/src/shapes/fullChordShapes.test.ts`

**Why:** Current entry `{ shape: "G", quality: "dim", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, null, 3, 5, 4, 3] }` is the round-1 hand-tuned dedup-breaker. The high-E note at template fret 3 (and low-E at template fret 3) were added to differentiate from E-shape dim; both are cosmetic. User confirmed it's the same situation as C-shape dim — drop the template entirely. E-shape dim already covers the upper-neck dim voicing in its own physical fingering.

- [ ] **Step 1: Update the test fixture first**

In `packages/core/src/shapes/fullChordShapes.test.ts`, locate the parameterized `dim` block (the same loop the C-shape entry was removed from in commit `42eda5cc`). Remove the G-shape row. Add a standalone assertion mirroring the C-shape pattern:

```typescript
it("G-shape dim is omitted — E-shape covers the upper-neck dim voicing", () => {
  const matches = getFullChordShapeMatches({
    chordRoot: "B",
    chordType: "dim",
    tuning: ["E","B","G","D","A","E"],
    maxFret: 12,
  });
  expect(matches.find((m) => m.shape === "G")).toBeUndefined();
  expect(matches.find((m) => m.shape === "E")).toBeDefined();
});
```

Verify it fails: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "G-shape dim is omitted"`. Expected: FAIL — G-shape match still exists.

- [ ] **Step 2: Delete the template entry**

In `packages/core/src/shapes/templates.ts`, locate the dim G-shape line:

```typescript
{ shape: "G", quality: "dim", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, null, 3, 5, 4, 3] },
```

Delete that entire line. Update the adjacent comment (the one added in commit `42eda5cc` explaining the C-shape omission) to also reference G-shape, e.g.:

```typescript
// dim: C-shape and G-shape templates intentionally omitted. Both were
// round-1 dedup-breaker hacks (high-E note added solely to differentiate
// from A-shape / E-shape respectively). Without the cosmetic notes they
// collapse below the 4-note threshold and never register; A-shape and
// E-shape cover the lower-neck and upper-neck dim voicings respectively.
```

- [ ] **Step 3: Run, expect PASS**

```bash
pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "G-shape dim is omitted"
```

- [ ] **Step 4: Run the whole shapes suite**

```bash
pnpm vitest run packages/core/src/shapes/
```
Expected: all green.

- [ ] **Step 5: Commit (stage only the two files)**

```bash
git commit -m "fix(shapes): drop redundant G-shape dim template"
```

---

## Task T2: Drop the A-string duplicate root from dim7 A-shape

**Files:**
- Modify: `packages/core/src/shapes/templates.ts` (edit one entry)
- Modify: `packages/core/src/shapes/fullChordShapes.test.ts`

**Why:** Current entry `{ shape: "A", quality: "dim7", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [2, 1, 2, 1, 0, null] }` produces 5 fretted notes. For Bdim7 (anchorFret 2): high-E fret 4 (Ab = bb7), B-string fret 3 (D = b3), G-string fret 4 (B = root), D-string fret 3 (F = b5), A-string fret 2 (B = root). User reports they cannot fret all 5 simultaneously — index can't barre fret 3 across B-string and D-string while ring/pinky cover fret 4 on G-string AND high-E *and* the A-string root is held by the thumb-or-low finger. Drop the A-string root (a duplicate of the G-string root) to bring it to 4 notes. Remaining: high-E (bb7), B-string (b3), G-string (root), D-string (b5) — all four chord tones still present on four adjacent strings at frets 3-4. Two-fret-span barre is comfortable.

- [ ] **Step 1: Write / update the failing test**

In `packages/core/src/shapes/fullChordShapes.test.ts`, find the dim7 A-shape test (the parameterized fixture row). Update the expected `positionKeys` to drop `"4-2"` (A-string fret 2 for Bdim7). Also confirm chord-tone coverage:

```typescript
it("A-shape dim7 — Bdim7 voicing (post-trim, no duplicate root)", () => {
  const matches = getFullChordShapeMatches({
    chordRoot: "B",
    chordType: "dim7",
    tuning: ["E","B","G","D","A","E"],
    maxFret: 12,
  });
  const aShape = matches.find((m) => m.shape === "A");
  expect(aShape).toBeDefined();
  // 4 notes after trimming A-string duplicate root: high-E Ab (bb7),
  // B-string D (b3), G-string B (root), D-string F (b5).
  expect(aShape!.positionKeys.sort()).toEqual(["0-4","1-3","2-4","3-3"].sort());
  const pcs = new Set(aShape!.notes.map((n) => n.noteName));
  expect(pcs).toEqual(new Set(["B","D","F","G#"])); // G# is the sharp-form of Ab in the project's NOTES convention
});
```

If the project's `NOTES` array uses sharps exclusively (it does per `CLAUDE.md`: "Notes stored as sharps internally"), then `Ab` is stored as `G#`. Verify against the existing test conventions in the file — they should match. Adjust the `pcs` expectation accordingly.

Verify the test fails: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "A-shape dim7"`.

- [ ] **Step 2: Edit the template**

In `packages/core/src/shapes/templates.ts`, change:

```typescript
{ shape: "A", quality: "dim7", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [2, 1, 2, 1, 0, null] },
```

to:

```typescript
{ shape: "A", quality: "dim7", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [2, 1, 2, 1, null, null] },
```

(Only the A-string position changes from `0` to `null`.)

Add a one-line comment above the entry, e.g.:

```typescript
// A-string root dropped (was duplicate of G-string root); 5-note voicing
// was unfrettable due to the cross-string 2-fret barre.
```

- [ ] **Step 3: Run, expect PASS**

```bash
pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "A-shape dim7"
```

- [ ] **Step 4: Run the whole shapes suite**

```bash
pnpm vitest run packages/core/src/shapes/
```

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(shapes): drop duplicate root from dim7 A-shape (was unfrettable at 5 notes)"
```

---

## Task T3: Drop the low-E note from dim7 G-shape

**Files:**
- Modify: `packages/core/src/shapes/templates.ts`
- Modify: `packages/core/src/shapes/fullChordShapes.test.ts`

**Why:** Current entry `{ shape: "G", quality: "dim7", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 2, 3, 2, null, 3] }` has 5 fretted notes including a low-E note that user reports they cannot fret in this configuration. The low-E note is the root (duplicate of the high-E root). Dropping it leaves 4 notes: high-E (root), B-string (b5), G-string (b3), D-string (bb7) — all four chord tones present on four adjacent upper strings.

- [ ] **Step 1: Write / update the failing test**

```typescript
it("G-shape dim7 — Bdim7 voicing (post-trim, no low-E root)", () => {
  const matches = getFullChordShapeMatches({
    chordRoot: "B",
    chordType: "dim7",
    tuning: ["E","B","G","D","A","E"],
    maxFret: 12,
  });
  const gShape = matches.find((m) => m.shape === "G");
  expect(gShape).toBeDefined();
  // Bdim7 G-shape with anchorFret=7, anchorFretOffset=3 → absolute frets:
  //   high-E: 3+7-3=7 (B root), B-string: 2+7-3=6 (F b5),
  //   G-string: 3+7-3=7 (D b3), D-string: 2+7-3=6 (Ab bb7).
  expect(gShape!.positionKeys.sort()).toEqual(["0-7","1-6","2-7","3-6"].sort());
  const pcs = new Set(gShape!.notes.map((n) => n.noteName));
  expect(pcs).toEqual(new Set(["B","D","F","G#"])); // adjust if NOTES uses Ab form
});
```

Verify fail.

- [ ] **Step 2: Edit the template**

```typescript
// Before:
{ shape: "G", quality: "dim7", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 2, 3, 2, null, 3] },
// After:
{ shape: "G", quality: "dim7", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 2, 3, 2, null, null] },
```

Add a comment: `// Low-E root dropped (duplicate of high-E root); unplayable with thumb-over.`

- [ ] **Step 3: Run, expect PASS**, then **Step 4: full suite**, **Step 5: Commit**

```bash
git commit -m "fix(shapes): drop low-E root from dim7 G-shape (was unplayable)"
```

---

## Task T4: Delete m7b5 G-shape template entirely

**Files:**
- Modify: `packages/core/src/shapes/templates.ts`
- Modify: `packages/core/src/shapes/fullChordShapes.test.ts`

**Why:** Current entry `{ shape: "G", quality: "m7b5", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [1, null, 3, null, 4, 3] }` has 4 fretted notes spread across non-adjacent strings (high-E + G-string + A-string + low-E with B-string and D-string muted in between). User reports it can't be played. Drop the template entirely. The other 3 m7b5 shapes (A, E, D) plus C-shape cover the remaining fret-range needs.

- [ ] **Step 1: Update the test**

In `fullChordShapes.test.ts`, remove the G-shape row from the m7b5 parameterized loop and add:

```typescript
it("G-shape m7b5 is omitted — voicing was unplayable across non-adjacent strings", () => {
  const matches = getFullChordShapeMatches({
    chordRoot: "B",
    chordType: "m7b5",
    tuning: ["E","B","G","D","A","E"],
    maxFret: 12,
  });
  expect(matches.find((m) => m.shape === "G")).toBeUndefined();
});
```

Verify fail.

- [ ] **Step 2: Delete the template entry**

```typescript
// Delete this entire line from FULL_CHORD_TEMPLATES:
{ shape: "G", quality: "m7b5", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [1, null, 3, null, 4, 3] },
```

Add a comment near the m7b5 cluster:

```typescript
// m7b5: G-shape omitted — the only viable fingering spans non-adjacent
// strings (high-E + G-string + A-string + low-E with B-string and D-string
// muted in between), which is impractical to fret cleanly.
```

- [ ] **Step 3: Run, expect PASS** → **Step 4: full suite** → **Step 5: Commit**

```bash
git commit -m "fix(shapes): drop unplayable m7b5 G-shape template"
```

---

## Task T5: Extract voicing selectors and add `visibleVoicingMatchesAtom`

**Files:**
- Create: `src/hooks/voicingSelection.ts`
- Modify: `src/hooks/useFretboardState.ts` (re-export from new module; replace inline computation with atom)
- Modify: `src/store/chordOverlayAtoms.ts` (add `visibleVoicingMatchesAtom`)
- Modify: `src/hooks/useFretboardState.test.tsx` (if it imports the moved functions directly)
- Create: `src/store/chordOverlayAtoms.visibleVoicingMatches.test.ts` (new test file, or add to existing)

**Why:** Today the connector source (`fullChordVoicings`) goes through `selectFullChordMatchesForCagedPosition` in `useFretboardState.ts:231-259`, but the highlight-position source (`chordHighlightPositionsAtom`) skips that selection and uses raw `voicingMatchesAtom`. The two get further reconciled by a polygon-position filter applied to the raw output when Lock-to-scale is on — which is what strips out-of-polygon vertices that the connector still tries to draw through. Moving the selection into atom land lets `chordHighlightPositionsAtom` consume the same selection the connector uses, eliminating the asymmetry without producing the "sea of voicings" failure mode.

- [ ] **Step 1: Move the pure selectors into a new module**

Create `src/hooks/voicingSelection.ts` and move from `useFretboardState.ts` (lines ~81-180, exact ranges to be confirmed):
- `FullChordCandidateScore` type
- `scoreFullChordForCagedPosition`
- `compareFullChordCandidateScores`
- `getPositionKey`
- `selectFullChordMatchesForCagedPosition`
- `scoreFullChordForThreeNpsPosition`
- `selectFullChordMatchesForThreeNpsPosition`

Re-export from `useFretboardState.ts` if anything outside the hook imports them (audit with `grep -rn "selectFullChordMatchesForCagedPosition\|selectFullChordMatchesForThreeNpsPosition" src/ packages/core/src/ --include="*.ts" --include="*.tsx"`).

Adjust imports inside `useFretboardState.ts` to pull from `./voicingSelection`.

Run `pnpm vitest run` for any file that touches these (especially `Fretboard.performance.test.tsx`) to confirm no regression.

- [ ] **Step 2: Add `visibleVoicingMatchesAtom`**

In `src/store/chordOverlayAtoms.ts`, add (positioned just after `voicingMatchesAtom` around line 533):

```typescript
import {
  selectFullChordMatchesForCagedPosition,
  selectFullChordMatchesForThreeNpsPosition,
} from "../hooks/voicingSelection";
import { fingeringPatternAtom, cagedShapesAtom, npsPositionAtom } from "./shapeAtoms"; // adjust import paths to actuals
import { activePositionAtom, chordScopeToPositionAtom } from "./uiAtoms"; // adjust

/**
 * The voicing matches actually shown on the board — filtered to the active
 * CAGED / 3NPS position via the same selectors the connector source uses.
 * When no active position exists (or in modes without a positional pattern),
 * falls back to the unfiltered matches.
 *
 * This atom lets the highlight-position pipeline scope to the same voicings
 * the connector renders, instead of every voicing match across the whole
 * neck — eliminating the asymmetry where a connector polyline arcs through
 * a position whose chord-tone bubble was independently filtered out.
 */
export const visibleVoicingMatchesAtom = atom((get): Voicing[] => {
  const matches = get(voicingMatchesAtom);
  if (matches.length === 0) return matches;

  const pattern = get(fingeringPatternAtom);
  const activePosition = get(activePositionAtom);

  if (pattern === "caged" && activePosition) {
    const { shapePolygons } = get(shapeDataAtom);
    const cagedShapes = get(cagedShapesAtom);
    return selectFullChordMatchesForCagedPosition(matches, shapePolygons, cagedShapes);
  }

  if (pattern === "3nps" && get(chordScopeToPositionAtom) && activePosition) {
    const { boxBounds } = get(shapeDataAtom);
    return selectFullChordMatchesForThreeNpsPosition(matches, boxBounds, 0);
  }

  return matches;
});
```

Notes on imports: the exact atom paths may be `../store/shapeAtoms`, `../store/uiAtoms`, etc. — verify with `grep -n "fingeringPatternAtom\s*=\|^export const fingeringPatternAtom" src/store/`. The `shapeDataAtom` may already be imported in `chordOverlayAtoms.ts`; if not, add the import.

- [ ] **Step 3: Add a regression test for the new atom**

Add to `src/store/chordOverlayAtoms.test.ts` (or a new sibling file). Build a fixture store with C major + E-shape CAGED active and a Bdim7 chord overlay. Assert `visibleVoicingMatchesAtom` returns a non-empty subset of `voicingMatchesAtom`'s output and includes the E-shape voicing.

```typescript
describe("visibleVoicingMatchesAtom", () => {
  it("filters to the CAGED-position-relevant voicings", () => {
    const store = createStoreCMajorEShapeBDim7(); // build per the file's existing helper patterns; mirror lines around the chordHighlightPositionsAtom tests
    const all = store.get(voicingMatchesAtom);
    const visible = store.get(visibleVoicingMatchesAtom);
    expect(visible.length).toBeLessThanOrEqual(all.length);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.some((v) => v.shape === "E")).toBe(true);
  });

  it("falls back to all matches when no active position", () => {
    const store = createStoreCMajorEShapeBDim7();
    store.set(activePositionAtom, null);
    const all = store.get(voicingMatchesAtom);
    const visible = store.get(visibleVoicingMatchesAtom);
    expect(visible).toEqual(all);
  });
});
```

Use the existing test-file conventions for store setup — inspect lines around the existing "Group J" describe (~line 489) for the closest helper template.

- [ ] **Step 4: Switch `useFretboardState` to consume the atom**

In `src/hooks/useFretboardState.ts`, replace the inline `visibleFullChordMatches` computation (the `useMemo` block at lines ~231-259) with:

```typescript
const visibleFullChordMatches = useAtomValue(visibleVoicingMatchesAtom);
```

Add the import. Delete the now-unused `useMemo` and the dead-code branches. `fullChordMatches` (the unfiltered) is still useful if anything else reads it (audit with grep); if not, drop that variable too.

Run `pnpm vitest run src/hooks/ src/components/Fretboard/` to confirm nothing breaks. The performance test at `Fretboard.performance.test.tsx:63` references the selection code path — confirm the test still exercises it via the atom.

- [ ] **Step 5: Commit**

Stage only the touched files:

```bash
git add src/hooks/voicingSelection.ts src/hooks/useFretboardState.ts src/store/chordOverlayAtoms.ts src/store/chordOverlayAtoms.test.ts
git commit -m "refactor(chord-overlay): extract visibleVoicingMatchesAtom from useFretboardState"
```

Body: "Pull the active-position voicing selection into an atom so the highlight-position pipeline can use the same selection the connector renderer uses."

---

## Task T6: Rewire `chordHighlightPositionsAtom` to consume the visible matches and always supplement with inside-polygon chord tones

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts:567-586` (the `voicing === "full"` branch)
- Modify: `src/store/chordOverlayAtoms.test.ts` (update / add tests)

**Why (the bug, restated):**
- **Lock-to-scale OFF**: chord-tone positions inside the active polygon that aren't part of any voicing don't get highlighted. The user expects them to (consistent with Lock ON behavior).
- **Lock-to-scale ON**: voicing-vertex positions that the connector renders but that fall outside the polygon get stripped from the highlight set, leaving a connector polyline with no bubble at the vertex.

Both stem from the atom using raw `voicingMatchesAtom` and applying a per-position polygon filter only when Lock is on. Fix: derive from `visibleVoicingMatchesAtom` (the connector-aligned selection) and ALWAYS call `addChordTonesWithinPolygon`. Drop the per-position polygon filter entirely — the voicing-level selection in T5 already keeps neck-spanning voicings from leaking in.

- [ ] **Step 1: Update / add failing tests**

In `src/store/chordOverlayAtoms.test.ts`, find the existing "Group J — chordHighlightPositionsAtom" describe (~line 489).

Add two tests at the end:

```typescript
it("includes inside-polygon chord tones even when Lock-to-scale is OFF", () => {
  const store = createStoreCMajorEShapeG7(); // C major + E-shape CAGED, G7 chord overlay
  store.set(chordSnapToScaleAtom, false);
  store.set(voicingAtom, "full");

  const highlights = store.get(chordHighlightPositionsAtom);
  // E-shape polygon (around frets 7-10 in C major) contains chord-tone
  // positions for G7 (G, B, D, F) that may not be vertices of any voicing.
  // Pick a known-inside, known-not-a-voicing-vertex position and assert it
  // shows. (Replace "X-Y" with a verified positionKey from the fixture —
  // inspect via console.log if needed when writing the test.)
  expect(highlights.has("3-9")).toBe(true); // D-string fret 9 = E (chord tone in some voicing) — adjust to a verified case
});

it("keeps connector-vertex positions outside polygon when Lock-to-scale is ON", () => {
  const store = createStoreCMajorEShapeG7();
  store.set(chordSnapToScaleAtom, true);
  store.set(voicingAtom, "full");

  // Pick a vertex of a *visible* voicing (one selected by
  // visibleVoicingMatchesAtom) that the scoring tolerated despite being
  // outside the polygon. Assert it shows.
  const visibleMatches = store.get(visibleVoicingMatchesAtom);
  const allOutsidePositions = visibleMatches.flatMap((m) =>
    m.positionKeys.filter((k) => !isInAnyPolygon(k, store.get(shapeDataAtom).shapePolygons)),
  );
  expect(allOutsidePositions.length).toBeGreaterThan(0); // ensure the fixture actually exercises the case
  for (const positionKey of allOutsidePositions) {
    const highlights = store.get(chordHighlightPositionsAtom);
    expect(highlights.has(positionKey)).toBe(true);
  }
});
```

Build `createStoreCMajorEShapeG7` if it doesn't exist — mirror the existing patterns. If a verified positionKey isn't obvious upfront, write the test, run it, log the actual visible matches, and update the assertion to a real key — then commit the corrected version. Do NOT commit `console.log` calls.

Verify the tests fail: `pnpm vitest run src/store/chordOverlayAtoms.test.ts -t "inside-polygon chord tones even when Lock-to-scale is OFF"`.

- [ ] **Step 2: Rewrite the `voicing === "full"` branch**

In `src/store/chordOverlayAtoms.ts`, replace lines 567-586 with:

```typescript
if (voicing === "full") {
  // Derive position keys from the visible voicings only — this is the same
  // selection the connector renderer uses (filtered by active CAGED/3NPS
  // position). Always supplement with addChordTonesWithinPolygon so
  // in-polygon chord tones light up regardless of Lock-to-scale state.
  // The per-position polygon filter is gone; voicing-level selection in
  // visibleVoicingMatchesAtom already keeps neck-spanning voicings from
  // leaking in, and connector-vertex positions outside the polygon now
  // survive (matching what the connector polyline draws through).
  const visibleMatches = get(visibleVoicingMatchesAtom);
  const result = new Set(visibleMatches.flatMap((v) => v.positionKeys));
  const { shapePolygons } = get(shapeDataAtom);
  if (shapePolygons.length > 0) {
    addChordTonesWithinPolygon(get, result, shapePolygons);
  }
  return memoizedHighlightSet(result);
}
```

- [ ] **Step 3: Run tests, expect PASS**

```bash
pnpm vitest run src/store/chordOverlayAtoms.test.ts
```

Some existing tests in Group J may have asserted the OLD strip-and-supplement behavior under Lock-ON. For each failure, decide: (a) the test asserted the bug — update the expectation; (b) the test asserted unrelated behavior — investigate. Don't blanket-update.

- [ ] **Step 4: Run the full store suite + integration**

```bash
pnpm vitest run src/store/ src/components/FretboardSVG/ src/components/Fretboard/
```

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(chord-overlay): align highlight positions with visible voicings + always show in-polygon chord tones"
```

Body: "highlight pipeline now matches the connector pipeline. Lock-to-scale OFF shows in-polygon chord tones (was inconsistent — Lock ON showed them, OFF didn't). Lock-to-scale ON preserves connector-vertex positions outside polygon (was stripping them, leaving connector polylines with no bubble at the vertex)."

---

## Task T7: Visual baseline refresh

**Files:**
- Modify: snapshot dirs under `e2e/*.spec.ts-snapshots/`

- [ ] **Step 1: Run visuals**

```bash
pnpm test:visual
```
Expect diffs in:
- Any fretboard rendered with a diminished or m7b5 chord (template changes).
- Fretboards with chord overlay + active CAGED/3NPS position (more in-polygon chord tones may now show; connector-vertex positions outside polygon now show).

- [ ] **Step 2: Inspect 3-4 diff PNGs to confirm changes match expected categories.** Reject and investigate if unexpected diffs appear.

- [ ] **Step 3: Refresh darwin baselines**

```bash
pnpm test:visual:update
```

- [ ] **Step 4: Re-run to confirm clean**

```bash
pnpm test:visual
```

- [ ] **Step 5: Commit (stage only e2e/)**

```bash
git add e2e/
git commit -m "test(visual): refresh darwin baselines for dim cleanup + lock-to-scale fix"
```

---

## Task T8: Full verification

- [ ] **Step 1**: `pnpm lint && pnpm test && pnpm build`
- [ ] **Step 2**: `pnpm test:e2e:production`
- [ ] **Step 3**: Manual smoke (user-driven)

Confirm in `pnpm dev`:
- Bdim chord overlay → only A-shape and E-shape voicings render (no C-shape or G-shape leftovers).
- Bdim7 chord overlay → A-shape now renders as 4-note voicing (no A-string root); G-shape renders without low-E.
- Bm7b5 chord overlay → A, E, D shapes render (no G-shape).
- Toggle Lock-to-scale: in BOTH states, every connector polyline has a visible bubble at every vertex, AND inside-polygon chord tones not part of any voicing still highlight.

---

## Future Work (out of scope — needs brainstorming)

The user observed two related architecture questions that warrant their own design pass:

1. **"Generate close voicing when full is not available."** Today there's no fallback from `voicing === "full"` to `voicing === "close"` — when no full template matches a chord/position, the user just sees connector-less chord-tone highlights. Proposal: when no full voicing is selected for an active position, generate a close voicing in its place and present the connector. Open questions: should the UI signal "this is a close voicing because full wasn't available"? Should the fallback be eager (always considered) or only when zero full voicings selected? Does it interact with `closeCandidatesAtom`'s own scoping / dedup?

2. **"Verify which full chords match exactly a close chord voicing."** Read as a research task: catalog the overlap between full and close voicings to inform the fallback policy. Likely a small one-off script that diff-checks `getFullChordShapeMatches` vs. `closeCandidatesAtom`'s output across a chord-quality matrix.

Both should be brainstormed before being planned, since (1) involves UI/UX choices and (2) is a research deliverable that informs (1)'s scope.

Recommended next step: `/superpowers:brainstorming generate close voicing when full is unavailable`.
