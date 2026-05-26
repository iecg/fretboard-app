# Audit-Driven Template Deletions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete 9 `FULL_CHORD_TEMPLATES` entries that the overlap audit identified as pitch-and-position identical to generated close voicings.

**Architecture:** Each deletion is a surgical removal from `packages/core/src/shapes/templates.ts` plus a regression test in `packages/core/src/shapes/fullChordShapes.test.ts` asserting the shape is omitted. The close-voicing fallback feature already on this branch (`claude/elated-nobel-dd4e76`) will fill the now-empty positions at runtime via `fallbackVoicingMatchesAtom`, so no user-visible regression.

**Tech Stack:** TypeScript, vitest, playwright (visual).

**Branch:** stay on the current `claude/elated-nobel-dd4e76` branch — these deletions ship together with the close-voicing fallback already implemented here.

**Audit source:** `docs/superpowers/research/2026-05-26-full-close-voicing-overlap.md`

---

## File Structure

**Modified:**
- `packages/core/src/shapes/templates.ts` — 9 entry removals plus an updated comment explaining the audit-driven omissions.
- `packages/core/src/shapes/fullChordShapes.test.ts` — 9 new tests, one per deletion, asserting the shape is absent for an example root.
- Visual snapshots under `e2e/*.visual.spec.ts-snapshots/` (darwin) — refreshed if any test exercises a deleted shape.

---

## Deletion list

| # | Quality | Shape | Template `fretsHighToLow` | Example root |
|---|---|---|---|---|
| 1 | `7`    | D | `[2,1,2,0,null,null]` | `D` |
| 2 | `dim7` | C | `[null,4,2,4,3,null]` | `B` |
| 3 | `dim7` | A | `[2,1,2,1,null,null]` | `B` |
| 4 | `dim7` | G | `[3,2,3,2,null,null]` | `B` |
| 5 | `dim7` | D | `[1,0,1,0,null,null]` | `B` |
| 6 | `m7`   | D | `[1,1,2,0,null,null]` | `D` |
| 7 | `m7b5` | A | `[null,1,0,1,0,null]` | `B` |
| 8 | `m7b5` | D | `[1,1,1,0,null,null]` | `B` |
| 9 | `maj7` | D | `[2,2,2,0,null,null]` | `D` |

The example root for each is chosen so the deleted template *would have* produced a non-empty match at a reasonable fret (verified by the audit report having marked these as "yes" with a populated `String set` column).

---

### Task DEL-A: Delete all 9 templates with per-deletion commits

**Files (per deletion):**
- Modify: `packages/core/src/shapes/templates.ts`
- Modify: `packages/core/src/shapes/fullChordShapes.test.ts`

**Pattern (apply 9 times — one commit per deletion):**

- [ ] **Step 1: Locate the template entry**

Open `packages/core/src/shapes/templates.ts`. Find the entry matching `{ shape: "<SHAPE>", quality: "<QUALITY>", … fretsHighToLow: <FRETS_HIGH_TO_LOW> }`. Note the surrounding context — there's typically a comment block above each quality grouping explaining which shapes are omitted and why; extend that comment to mention the new audit-driven omission, citing `docs/superpowers/research/2026-05-26-full-close-voicing-overlap.md`.

If multiple deletions share the same quality (`dim7` has 4 — C, A, G, D; `m7b5` has 2 — A, D), you can fold them into a single quality-block comment update once and then remove entries one at a time; the test additions are still per-shape.

- [ ] **Step 2: Write the failing test FIRST**

Append to `packages/core/src/shapes/fullChordShapes.test.ts`:

```typescript
it("<SHAPE>-shape <QUALITY> is omitted — identical to a close voicing (audit-driven)", () => {
  const matches = getFullChordShapeMatches({
    chordRoot: "<EXAMPLE_ROOT>",
    chordType: "<QUALITY>",
    tuning: STANDARD_TUNING,
    maxFret: 24,
  });
  expect(matches.find((m) => m.shape === "<SHAPE>")).toBeUndefined();
});
```

Substituting the specific deletion's values. The `STANDARD_TUNING` import is already in the file (or already imported from `@fretflow/core`); use whichever pattern the existing tests use.

- [ ] **Step 3: Run the test to verify it FAILS**

Run: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "<SHAPE>-shape <QUALITY> is omitted"`
Expected: FAIL — the matcher finds a voicing with the deleted shape because the template is still present.

If the test passes without removing the template, the chosen `EXAMPLE_ROOT` doesn't produce a match for that shape at this `maxFret`. Pick a different root from the audit report's `String set` column (which proves the template produced a match for at least one root).

- [ ] **Step 4: Delete the template entry**

Remove the located entry from `packages/core/src/shapes/templates.ts`. Stage only the .ts files.

- [ ] **Step 5: Run the test to verify it PASSES**

Run: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "<SHAPE>-shape <QUALITY> is omitted"`
Expected: PASS.

- [ ] **Step 6: Run the full templates test file**

Run: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts`
Expected: ALL tests in the file pass — confirms no unintended cascade.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/shapes/templates.ts packages/core/src/shapes/fullChordShapes.test.ts
git commit -m "fix(shapes): drop redundant <QUALITY> <SHAPE>-shape template (audit)"
```

Commit body (passed via heredoc) should reference the audit report:
```bash
git commit -m "$(cat <<'EOF'
fix(shapes): drop redundant <QUALITY> <SHAPE>-shape template (audit)

Identified as pitch-and-position identical to a generated close voicing
across all 12 roots by docs/superpowers/research/2026-05-26-full-close-voicing-overlap.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Commit subject ≤ 100 chars, lowercase, conventional-commits format. Body lines ≤ 100 chars each.

**Repeat steps 1–7 for each of the 9 deletions** in the order listed in the table above.

After all 9 commits land, run `git log --oneline -10` to confirm 9 new `fix(shapes): drop redundant …` commits exist.

---

### Task DEL-B: Visual baseline refresh + full verification

**Files:** snapshots under `e2e/*.visual.spec.ts-snapshots/` (darwin); no source code changes.

- [ ] **Step 1: Refresh visual baselines**

Run: `pnpm test:visual:update`
Expected: all 40 visual tests pass; some `.png` files updated under `e2e/*.visual.spec.ts-snapshots/`.

The deleted shapes are mostly D-shape seventh chords on top-4 strings. The existing visual suite includes:
- `connector-c-major-…` and `connector-f-major-…` — major triads, unaffected.
- `connector-g7-…` — G7 dominant; the G-shape and E-shape G7 templates remain (only D-shape G7 deleted), so visuals may shift if the test scope hits the D-shape position.

Expect small or no diffs. If diffs appear in chord-overlay-controls or fretboard snapshots involving 7th chords, that's expected.

- [ ] **Step 2: Verify the suite is stable**

Run: `pnpm test:visual` (no `:update`)
Expected: 40 passing — confirms the new baselines are deterministic.

- [ ] **Step 3: Commit snapshots**

```bash
git add e2e/
git commit -m "test(visual): refresh baselines after audit-driven template deletions"
```

Only stage `e2e/`. If no `.png` files changed, skip the commit and add a note in your final report.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 5: Unit + component tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Production build**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 7: E2E production**

Run: `pnpm test:e2e:production`
Expected: PASS.

- [ ] **Step 8: Manual smoke** (deferred to human)

Cannot be executed by the implementer. The user should:
1. `pnpm dev`
2. Load D7 → in Full mode, confirm the D-shape position now renders a close-voicing fallback (because the close-voicing fallback feature is live on this branch). Verify the string-set picker appears.
3. Load Bm7b5 → same expectation for the A-shape and D-shape positions.
4. Load Cdim7 → A/G/D shapes should all fall back; E-shape (the one *not* deleted) should still render as a full template.

---

## Self-Review Notes

**Spec coverage:**
- All 9 deletions listed in the audit's "Deletion candidates" section → 9 commits in DEL-A ✓
- Per-deletion regression test → step 2 of each ✓
- Visual baseline refresh → DEL-B step 1 ✓
- Full verification (lint/test/build/e2e) → DEL-B steps 4–7 ✓
- Audit report cited in commit bodies → step 7 ✓

**Placeholder scan:** All placeholders (`<SHAPE>`, `<QUALITY>`, etc.) are substitution targets inside the per-deletion pattern, not unresolved TBDs. The deletion list table provides the exact values for each pass.

**Type consistency:** The test pattern uses `STANDARD_TUNING` consistently (avoiding the literal-array trap from prior tasks). `getFullChordShapeMatches` signature matches what already-existing tests use in the same file.

**Branch:** stays on `claude/elated-nobel-dd4e76` per user direction. Ships alongside the close-voicing fallback so the now-empty positions get filled at runtime in the same PR.
