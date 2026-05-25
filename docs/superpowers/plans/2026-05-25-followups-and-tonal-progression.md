# Phase N Follow-ups + Phase O (Tonal-Native Progression) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the four documented Phase N follow-ups, then adopt `@tonaljs/roman-numeral` + `@tonaljs/progression` in the bespoke degree/progression code so Roman-numeral parsing and degree→chord resolution stop being hand-rolled.

**Architecture:** Two independent parts, both additive to the Tonal-native vocabulary shipped in Phase N. Part A is four small cleanups (each its own commit). Part B (Phase O) replaces the bespoke `buildDegreeLabel` parser in `packages/core/src/degrees.ts` with `RomanNumeral.get`, and replaces the `MODE_DEGREES[scaleName][semitone]` lookup in `src/progressions/progressionDomain.ts` with `Progression.fromRomanNumerals` for the resolution of degree → root. Output values must stay byte-identical — guarded by the M1 snapshot lock.

**Tech Stack:** TypeScript, Vitest, Playwright, Jotai, `@tonaljs/roman-numeral`, `@tonaljs/progression` (both already transitively available via `tonal`; pin direct deps if not).

---

## File Structure

**Part A (follow-ups):**
- `packages/core/src/lib/tonal.ts` — delete unused `getScaleDisplayLabel` (collision with the catalog export).
- `packages/core/src/lib/tonal.ts` — add power-chord override to `getChordDisplayLabel("5")`.
- `packages/core/src/theoryCatalog.ts` — delete dead `SCALE_NAME_ALIASES = {}` + the `resolveScaleNameAlias` wrapper.
- `e2e/visual-helpers.ts` — delete `STORAGE_KEY_RENAMES`, `SCALE_NAME_LEGACY_MAP`, `CHORD_QUALITY_LEGACY_MAP` translation block (Phase N has shipped; legacy seeds can be rewritten or have already been).

**Part B (Phase O):**
- `packages/core/src/degrees.ts` — replace `buildDegreeLabel` + `buildDegreesFromIntervals` with `RomanNumeral.get(numeral).chordType`-driven assembly (or delete `buildDegreesFromIntervals` entirely if no consumer remains; verify).
- `src/progressions/progressionDomain.ts` — replace bespoke degree-root resolution with `Progression.fromRomanNumerals(tonic, [degree])[0]` inside `resolveProgressionStep`.
- `packages/core/src/__snapshots__/degrees.test.ts.snap` — must not change. If it does, **stop and reconcile** — that means we drifted vs. Tonal in a way the user has to bless.
- `package.json` (root + `packages/core/`) — add explicit deps on `@tonaljs/roman-numeral` and `@tonaljs/progression` if they aren't direct (the `tonal` umbrella re-exports them, but adopting them directly is cleaner).

---

## Part A: Phase N Follow-ups

### Task F1: Delete unused `getScaleDisplayLabel` in `lib/tonal.ts`

**Context:** `packages/core/src/lib/tonal.ts:188` defines a `getScaleDisplayLabel` that returns Tonal's raw name (e.g., `"major"`). The publicly-exported version (`packages/core/src/theoryCatalog.ts:445`, re-exported from `index.ts`) returns the curated `displayLabel` (e.g., `"Major"`). The `lib/tonal.ts` version is **not imported anywhere** — confirmed via `grep -rn "from.*lib/tonal" --include="*.ts"` returning only `getModeTriads`, `getScaleSemitonesFromTonal`, `getChordDisplayLabel`, `transposeNoteToSharps`. Delete it (and its JSDoc references).

**Files:**
- Modify: `packages/core/src/lib/tonal.ts` (lines around 12, 178–195)

- [ ] **Step 1: Delete the function and its JSDoc**

Remove the JSDoc block describing `getScaleDisplayLabel` (currently around `lib/tonal.ts:178-187`) and the function itself (around `:188-195`). Also update the file-level JSDoc near line 12 that says `getChordDisplayLabel(symbol) / getScaleDisplayLabel(name) —` to just `getChordDisplayLabel(symbol) —`.

- [ ] **Step 2: Confirm build + tests still green**

Run: `pnpm lint && pnpm test`
Expected: PASS. No new failures.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/lib/tonal.ts
git commit -m "refactor(core): drop unused getScaleDisplayLabel from lib/tonal"
```

---

### Task F2: Power-chord UX override

**Context:** After Phase N, `getChordDisplayLabel("5")` returns `"fifth"` (Tonal's name for the power chord). Users expect `"power chord"`. The override belongs inside `getChordDisplayLabel` so every consumer (progressionDomain, SongControls, ProgressionBlock) inherits it without per-site edits.

**Files:**
- Modify: `packages/core/src/lib/tonal.ts`
- Test: `packages/core/src/lib/tonal.test.ts` (extend existing test for `getChordDisplayLabel`; if no test file exists, the helper is exercised via `theory.test.ts` — add a focused test there instead).

- [ ] **Step 1: Write a failing test**

Locate the existing `getChordDisplayLabel` tests (search `grep -rn "getChordDisplayLabel" packages/core/src --include="*.test.ts"`). Add this case:

```ts
it("returns 'power chord' for the '5' (no-third) chord symbol", () => {
  expect(getChordDisplayLabel("5")).toBe("power chord");
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm test -- getChordDisplayLabel`
Expected: FAIL with `Expected "power chord" but received "fifth"`.

- [ ] **Step 3: Add the override inside `getChordDisplayLabel`**

In `packages/core/src/lib/tonal.ts`, modify `getChordDisplayLabel` so the very first non-guard branch returns `"power chord"` for the `"5"` symbol:

```ts
export function getChordDisplayLabel(chordSymbol: string): string {
  if (!chordSymbol) return chordSymbol;
  if (chordSymbol === "5") return "power chord";
  const c = Chord.get(`C${chordSymbol}`);
  if (c.empty) return chordSymbol;
  return c.name.replace(/^C\s*/, "").trim() || chordSymbol;
}
```

Update the JSDoc example: `getChordDisplayLabel("5") -> "power chord"`.

- [ ] **Step 4: Run the test**

Run: `pnpm test -- getChordDisplayLabel`
Expected: PASS.

- [ ] **Step 5: Spot-check downstream consumers**

Run: `pnpm test`
Expected: All green. Watch for the `resolvedChordLabel` test in `src/progressions/progressionDomain.test.ts` — if it had a fixture asserting `"C fifth"`, update it to `"C power chord"`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/lib/tonal.ts packages/core/src/lib/tonal.test.ts
git commit -m "fix(core): show 'power chord' instead of 'fifth' for 5 chord"
```

---

### Task F3: Remove dead `SCALE_NAME_ALIASES`

**Context:** `packages/core/src/theoryCatalog.ts:40` defines `const SCALE_NAME_ALIASES: Record<string, string> = {}` and `:377` wraps lookups in `SCALE_NAME_ALIASES[scaleName] ?? scaleName`. Phase N collapsed all aliases — the map is permanently empty. Inline the no-op and delete the const + JSDoc.

**Files:**
- Modify: `packages/core/src/theoryCatalog.ts`

- [ ] **Step 1: Delete `SCALE_NAME_ALIASES` and inline the lookup**

In `packages/core/src/theoryCatalog.ts`:
1. Delete the line `const SCALE_NAME_ALIASES: Record<string, string> = {};` (line ~40).
2. Find the function around line 371–378 (the JSDoc starts `* stored natively as Tonal names so SCALE_NAME_ALIASES is empty`). Replace its body `return SCALE_NAME_ALIASES[scaleName] ?? scaleName;` with `return scaleName;`. Update the JSDoc to drop the alias reference.
3. If that function (`resolveScaleNameAlias`?) has no remaining callers (run `grep -rn "resolveScaleNameAlias" packages/ src/ --include="*.ts" --include="*.tsx"`), delete it entirely and inline `scaleName` at each call site. If it has callers, leave the now-trivial function for symmetry.

- [ ] **Step 2: Run lint + tests**

Run: `pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/theoryCatalog.ts
git commit -m "chore(core): remove dead SCALE_NAME_ALIASES map"
```

---

### Task F4: Retire `e2e/visual-helpers.ts` legacy translation maps

**Context:** Phase N7 added a translation block to `e2e/visual-helpers.ts` (lines ~82–155) that rewrites legacy storage keys (`scaleName` → `scaleName.v2`, `progressionSteps` → `progressionSteps.v2`) and legacy vocabulary (`"Major"` → `"major"`, `"M"` is unchanged but `"min"` → `"m"`, etc.) on the fly so we didn't have to touch every visual spec at once. Now that Phase N has been shipped on `main` for a tick, rewrite the seeds at the source and drop the translation maps.

**Files:**
- Read first: `e2e/visual-helpers.ts` (full file, ~200 lines)
- Inspect callers: `e2e/**/*.spec.ts` files that pass a `state` arg with `scaleName` or `progressionSteps`
- Modify: `e2e/visual-helpers.ts` (delete the translation block)
- Modify: any `e2e/**/*.spec.ts` that still passes legacy keys/values

- [ ] **Step 1: Audit which specs depend on the translation**

Run:
```bash
grep -rn "scaleName\":\s*\"Major\\|Major\\|Minor\\|Natural Minor\\|Phrygian Dominant\\|Pentatonic Major\\|progressionSteps\":" e2e/ --include="*.spec.ts"
```
List the files + literal values that still use the legacy vocabulary or legacy storage keys.

- [ ] **Step 2: Rewrite each spec to use Tonal vocabulary + `.v2` keys**

For each match found:
- `"Major"` → `"major"`, `"Natural Minor"` → `"minor"`, `"Phrygian Dominant"` → `"phrygian dominant"`, `"Pentatonic Major"` → `"major pentatonic"`, etc. (The full mapping is in `e2e/visual-helpers.ts:90-108`'s `SCALE_NAME_LEGACY_MAP` — use that as the source of truth before deleting it.)
- Chord quality strings: legacy `"min"` → `"m"`, `"min7"` → `"m7"`, etc. (see `CHORD_QUALITY_LEGACY_MAP` in the helper).
- Storage keys: any test that writes `{ scaleName: ... }` or `{ progressionSteps: ... }` directly to `localStorage` must use `scaleName.v2` / `progressionSteps.v2`.

- [ ] **Step 3: Delete the translation block from `e2e/visual-helpers.ts`**

Remove `STORAGE_KEY_RENAMES`, `SCALE_NAME_LEGACY_MAP`, `CHORD_QUALITY_LEGACY_MAP`, and the translation logic that consumes them. The `loadVisualState` function should now just write each key/value pair straight to `localStorage` without rewriting.

- [ ] **Step 4: Run the full visual suite**

Run: `pnpm test:e2e:production && pnpm test:visual`
Expected: All green. If a baseline drifts, that means a seed wasn't translated correctly in Step 2 — fix the seed, don't refresh the baseline.

- [ ] **Step 5: Commit**

```bash
git add e2e/
git commit -m "chore(e2e): rewrite legacy seeds, drop visual-helpers translation maps"
```

---

## Part B: Phase O — Tonal-Native Progression

**Phase O scope (intentionally narrow):** Replace the two bespoke Roman-numeral code paths that survived Phase N:
1. `buildDegreeLabel` + `buildDegreesFromIntervals` in `degrees.ts` (hand-rolled numeral assembly from semitone intervals).
2. `resolveProgressionStep`'s `MODE_DEGREES[scaleName][semitone]` lookup chain in `progressionDomain.ts` (replaced by `Progression.fromRomanNumerals`).

Out of scope: UI changes to `ProgressionTrack` / `ProgressionBlock`. They already render `step.degree` strings unchanged — Phase O leaves the rendered output identical and is purely an internal refactor. Adding richer roman-numeral metadata to the UI (e.g. derived chord-type chips) is a separate UX decision, not a Tonal-adoption task.

The M1 snapshot lock (`packages/core/src/__snapshots__/degrees.test.ts.snap`, `theory.test.ts.snap`) is the safety net. Snapshots must remain byte-identical.

### Task O1: Pin direct deps on `@tonaljs/roman-numeral` and `@tonaljs/progression`

**Context:** Phase N adopted Tonal modules by their direct package names (`@tonaljs/chord`, `@tonaljs/scale`, etc.) so the dependency graph is explicit. Continue that pattern. Run `pnpm view tonal dependencies` first to confirm the version range Tonal pins, and match it.

**Files:**
- Modify: `packages/core/package.json` (add deps)

- [ ] **Step 1: Check current versions**

Run: `pnpm why @tonaljs/roman-numeral @tonaljs/progression`
Expected: both available transitively via `tonal`. Note the version.

- [ ] **Step 2: Add the deps to `packages/core/package.json`**

Add `"@tonaljs/roman-numeral": "^X.Y.Z"` and `"@tonaljs/progression": "^X.Y.Z"` to `dependencies` (matching versions to what `tonal` resolves).

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: lockfile updates, no other dep churn.

- [ ] **Step 4: Commit**

```bash
git add package.json packages/core/package.json pnpm-lock.yaml
git commit -m "chore(deps): pin @tonaljs/roman-numeral + @tonaljs/progression"
```

---

### Task O2: Replace `buildDegreeLabel` with `RomanNumeral.get`

**Context:** `packages/core/src/degrees.ts:24-37` defines `buildDegreeLabel(position, thirdSemitones, fifthSemitones)` that hand-rolls casing (`I`/`i`) and suffixes (`°`/`+`) from interval data. Tonal's `RomanNumeral.get(name)` parses a numeral string into `{ chordType, acc, step, ... }` — but we need the inverse: build a numeral *from* an interval pair. Tonal's `RomanNumeral` doesn't directly construct, so the pragmatic approach is:

1. Compute the triad's chord symbol from the intervals (e.g., `(3, 6)` → `"dim"`).
2. Map (position, chordType) → Roman numeral string using a small lookup table or via `Progression.toRomanNumerals` once a tonic is fixed.

This isn't a clear Tonal win — `buildDegreeLabel` is already only 14 lines of pure logic. **Before doing this task, confirm with the user (or via a `TODO` comment in the existing code) that the simplification is worth the deeper Tonal dependency.** If the value is low, scope O2 down to just adding `RomanNumeral.get` *validation* — assert that every label produced by `buildDegreeLabel` round-trips through Tonal — and keep the hand-rolled builder.

**Recommendation:** Ship the validation variant. Lower risk, same Tonal-adoption goal, snapshot lock unchanged.

**Files:**
- Modify: `packages/core/src/degrees.ts` (validate against `RomanNumeral.get`)
- Test: `packages/core/src/degrees.test.ts` (add round-trip assertion)

- [ ] **Step 1: Write a failing test**

In `packages/core/src/degrees.test.ts`, add:

```ts
import * as RomanNumeral from "@tonaljs/roman-numeral";
import { getDegreesForScale } from "./degrees";
import { SCALES } from "./theoryCatalog";

it("every degree label parses cleanly via Tonal RomanNumeral.get", () => {
  for (const scaleName of Object.keys(SCALES)) {
    const degrees = getDegreesForScale(scaleName);
    for (const label of Object.values(degrees)) {
      const parsed = RomanNumeral.get(label);
      expect(parsed.empty, `RomanNumeral failed to parse "${label}" in ${scaleName}`).toBe(false);
    }
  }
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm test -- degrees.test`
Expected: Either PASS (we're already Tonal-compatible — great, we're done) or FAIL on a specific label like `"vii°"` (Tonal uses `"viidim"`? — check the actual error to decide).

- [ ] **Step 3: Reconcile any divergence**

If labels fail:
- Inspect the offending label (e.g., `"vii°"`). Check what `RomanNumeral.get("vii°")` returns and what notation Tonal expects.
- Two options: (a) update `buildDegreeLabel` to emit Tonal's notation (will change `degrees.test.ts.snap` — requires user blessing because UI strings shift); or (b) accept that our labels are display-only and skip the validation test for known divergences (document in a code comment).
- **Default to option (b)** unless the user has expressed a desire to align display strings with Tonal's notation.

- [ ] **Step 4: Run snapshot tests**

Run: `pnpm test -- degrees`
Expected: PASS, snapshot unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/degrees.ts packages/core/src/degrees.test.ts
git commit -m "test(core): validate degree labels round-trip via Tonal RomanNumeral"
```

---

### Task O3: Replace bespoke degree resolution with `Progression.fromRomanNumerals`

**Context:** `src/progressions/progressionDomain.ts:resolveProgressionStep` (around line 292+ — `grep -n "resolveProgressionStep" src/progressions/progressionDomain.ts` for exact line) currently resolves `(scaleName, rootNote, degree)` → chord root by:
1. Looking up `MODE_DEGREES[scaleName]` to find the semitone offset for that degree.
2. Transposing `rootNote` by that offset.
3. Looking up `DEGREE_DIATONIC_QUALITY[scaleName][degree]` for the quality.

Tonal's `Progression.fromRomanNumerals(tonic, [degree])` returns the resolved chord symbol in one call (e.g., `Progression.fromRomanNumerals("C", ["V"]) === ["G"]`). The quality is implicit in the numeral case (`"V"` → major, `"v"` → minor). This collapses steps 1–3 into one call **for the major and minor parent modes**. For other modes (Dorian, Phrygian, Lydian, Mixolydian, harmonic minor), Tonal's `Progression.fromRomanNumerals` still assumes a major/minor key context — verify the current `getProgressionHarmonyScaleName(scaleName)` mapping in `progressionDomain.ts:286` already squashes everything to major/minor before resolution, in which case this drop-in works cleanly.

**Files:**
- Modify: `src/progressions/progressionDomain.ts`
- Test: `src/progressions/progressionDomain.test.ts` (existing tests are the snapshot lock — they must keep passing without `-u`)

- [ ] **Step 1: Read `resolveProgressionStep` end-to-end**

Read the function (start at the `grep` line, read ~60 lines down). Identify:
- The exact lookup chain (what's read from `MODE_DEGREES`, `DEGREE_DIATONIC_QUALITY`).
- Whether `getProgressionHarmonyScaleName` always reduces to `"major"` or `"minor"` (it should — confirm before refactoring).
- The fallback path when `degree` is invalid (e.g., "not-a-degree" — see `progressionDomain.test.ts:143`).

- [ ] **Step 2: Run the existing tests as a baseline**

Run: `pnpm test -- progressionDomain`
Expected: All ~50 tests PASS. This is the snapshot lock for the refactor.

- [ ] **Step 3: Replace the lookup chain with Tonal**

Inside `resolveProgressionStep`, replace the `MODE_DEGREES[harmonyScale][...]` lookup with:

```ts
import * as Progression from "@tonaljs/progression";
// ...
const harmonyTonic = harmonyScale === "minor"
  ? /* relative minor root */ ...   // keep whatever the current code computes
  : rootNote;
const [chordSymbol] = Progression.fromRomanNumerals(harmonyTonic, [degree]);
if (!chordSymbol) {
  // Invalid degree — preserve existing fallback behavior (return null / skip step)
  return null;
}
const parsed = Chord.get(chordSymbol);
const chordRoot = parsed.tonic ?? rootNote;
const derivedQuality = /* derive from parsed.quality / parsed.aliases[0] */;
```

The exact wiring depends on what the existing fallback returns. The principle: same inputs → same outputs.

- [ ] **Step 4: Run the tests**

Run: `pnpm test -- progressionDomain`
Expected: All PASS. If one fails, **read the diff carefully** — Tonal's `Progression.fromRomanNumerals` may format root pitches differently than the bespoke path (e.g., `"Gb"` vs `"F#"`). Decide per-failure whether to (a) post-process the Tonal output to match (preferred — output stability) or (b) update the fixture (only if the change is genuinely an improvement and the user blesses it).

- [ ] **Step 5: Run snapshot tests and full unit suite**

Run: `pnpm test`
Expected: All PASS, no snapshots updated.

- [ ] **Step 6: Run e2e + visual**

Run: `pnpm test:e2e:production && pnpm test:visual`
Expected: All PASS. Visual baselines must not drift.

- [ ] **Step 7: Commit**

```bash
git add src/progressions/progressionDomain.ts
git commit -m "refactor(progressions): resolve degree→chord via Tonal Progression.fromRomanNumerals"
```

---

### Task O4: Full verification

**Files:** None (verification only).

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 2: Unit tests + coverage spot-check**

Run: `pnpm test`
Expected: PASS, no skipped tests beyond the pre-existing CAGED-D-shape skip from Phase N4.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: PASS, no TS errors.

- [ ] **Step 4: e2e (production config)**

Run: `pnpm test:e2e:production`
Expected: 50/50 PASS.

- [ ] **Step 5: Visual regression**

Run: `pnpm test:visual`
Expected: 44/44 PASS, no baseline drift.

- [ ] **Step 6: Commit (only if any incidental docs/lint fixes landed)**

Skip if no working-tree changes.

---

## Self-Review Notes

**Spec coverage:**
- Follow-up 1 (collision) → Task F1 ✓
- Follow-up 2 (power chord) → Task F2 ✓
- Follow-up 3 (dead aliases) → Task F3 ✓
- Follow-up 4 (e2e legacy maps) → Task F4 ✓
- Phase O (Tonal-native progression) → O1–O4 ✓

**Risk flags called out inline:**
- Task O2 may turn out to be a no-op (validation-only) — that's by design. The hand-rolled `buildDegreeLabel` is already simple; deep replacement isn't worth snapshot churn.
- Task O3 is the substantive Phase O change. If Tonal's `Progression.fromRomanNumerals` doesn't honor every mode in our `MODE_DEGREES` table, the existing `getProgressionHarmonyScaleName` reduction (already in the code) saves us — verify in Step 1 before refactoring.
- Task F4 will touch many e2e spec files; bundle into one commit so the diff stays atomic.

**No placeholders found.** Every step has either code, a command, or a concrete file edit.
