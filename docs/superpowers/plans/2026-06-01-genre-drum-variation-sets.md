# Genre Default Drum Variation Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire genre-appropriate drum turnaround fills/accents to pop, rock, funk, jazz, and blues, authoring three new genre-tailored variations so each genre's 4-bar phrase develops idiomatically.

**Architecture:** Two pure-data changes. (1) Add three `DRUM_VARIATIONS` entries (`funk-fill-4`, `jazz-turnaround-4`, `blues-fill-4`), each `barInterval: 4, barPhase: 3` so they fire on the turnaround bar (absolute bars 3, 7, 11…) via the already-shipped `variationFiresOnBar` gate. (2) Update `GENRE_STYLES.drumVariations`. The scheduler engine (`buildAllLayers.ts`) is unchanged — it already resolves and gates variations. No new drum voices.

**Tech Stack:** TypeScript, Vitest. Spec: `docs/superpowers/specs/2026-06-01-genre-drum-variation-sets-design.md`.

**Run all commands from the worktree root:** `/Users/isaaccocar/repos/fretboard-app/.claude/worktrees/silly-heyrovsky-52b42f`

**Engine conventions (must obey):** beats are 0-indexed quarter positions `0,1,2,3`; `.5` = eighth, `.25`/`.75` = sixteenths; **no triplet positions** — shuffle feel comes from the genre `swing` param. Beat in range `[0, 4)`.

---

### Task 1: Author the three new drum variations

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (append to `DRUM_VARIATIONS`, currently ends at line 465)
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Update the catalog-count test and add gating/truthfulness tests**

In `src/progressions/audio/patterns.test.ts`, the existing "pattern catalog" block asserts there are 3 variations. Change it to 6:

```ts
  it("has 6 drum variations with unique IDs", () => {
    expect(DRUM_VARIATIONS).toHaveLength(6);
    const ids = DRUM_VARIATIONS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
```

Then, inside the existing `describe("DRUM_VARIATIONS definitions are truthful", ...)` block (it already defines a `byId` helper), add three tests before its closing `});`:

```ts
  it("funk-fill-4 fires on the turnaround bar with ghost-snare hits", () => {
    const fill = byId("funk-fill-4");
    expect(fill.barInterval).toBe(4);
    expect(fill.barPhase).toBe(3);
    expect(variationFiresOnBar(fill, 3)).toBe(true);
    expect(variationFiresOnBar(fill, 0)).toBe(false);
    expect(fill.pattern.snares?.length ?? 0).toBeGreaterThan(0);
  });

  it("jazz-turnaround-4 fires on the turnaround bar with a ride accent", () => {
    const turn = byId("jazz-turnaround-4");
    expect(turn.barInterval).toBe(4);
    expect(turn.barPhase).toBe(3);
    expect(variationFiresOnBar(turn, 3)).toBe(true);
    expect(variationFiresOnBar(turn, 0)).toBe(false);
    expect(turn.pattern.ride?.length ?? 0).toBeGreaterThan(0);
  });

  it("blues-fill-4 fires on the turnaround bar with a snare buildup", () => {
    const fill = byId("blues-fill-4");
    expect(fill.barInterval).toBe(4);
    expect(fill.barPhase).toBe(3);
    expect(variationFiresOnBar(fill, 3)).toBe(true);
    expect(variationFiresOnBar(fill, 7)).toBe(true);
    expect(fill.pattern.snares?.length ?? 0).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts`
Expected: FAIL — the count test fails with "expected length 3 to be 6", and the three new tests throw `missing variation funk-fill-4` / `jazz-turnaround-4` / `blues-fill-4`.

- [ ] **Step 3: Append the three variations to `DRUM_VARIATIONS`**

In `src/progressions/audio/patterns.ts`, inside the `DRUM_VARIATIONS` array (after the `crash-bar-1` entry that ends at line 464, before the closing `];`), add:

```ts
  {
    id: "funk-fill-4",
    label: "Funk Turnaround Fill",
    barInterval: 4,
    barPhase: 3,
    pattern: {
      id: "funk-fill-4-pattern",
      label: "Funk Fill",
      kicks: [{ beat: 0, velocity: 0.9 }],
      snares: [
        { beat: 2, velocity: 0.4 },
        { beat: 2.5, velocity: 0.5 },
        { beat: 2.75, velocity: 0.4 },
        { beat: 3, velocity: 0.6 },
        { beat: 3.25, velocity: 0.6 },
        { beat: 3.5, velocity: 0.8 },
        { beat: 3.75, velocity: 0.9 },
      ],
      hats: [],
    },
  },
  {
    id: "jazz-turnaround-4",
    label: "Jazz Turnaround",
    barInterval: 4,
    barPhase: 3,
    pattern: {
      id: "jazz-turnaround-4-pattern",
      label: "Jazz Turnaround",
      kicks: [],
      snares: [
        { beat: 2, velocity: 0.35 },
        { beat: 2.5, velocity: 0.4 },
        { beat: 3, velocity: 0.45 },
        { beat: 3.5, velocity: 0.55 },
      ],
      hats: [],
      ride: [{ beat: 3, velocity: 0.6 }],
    },
  },
  {
    id: "blues-fill-4",
    label: "Blues Shuffle Fill",
    barInterval: 4,
    barPhase: 3,
    pattern: {
      id: "blues-fill-4-pattern",
      label: "Blues Fill",
      kicks: [{ beat: 0, velocity: 0.9 }],
      snares: [
        { beat: 2, velocity: 0.5 },
        { beat: 2.5, velocity: 0.6 },
        { beat: 3, velocity: 0.7 },
        { beat: 3.5, velocity: 0.9 },
      ],
      hats: [],
    },
  },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts`
Expected: PASS — all tests green, including the `[0, 4)` beat-range check (every new beat is ≤ 3.75).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): add funk/jazz/blues turnaround drum variations"
```

---

### Task 2: Wire the genre variation assignments

**Files:**
- Modify: `src/progressions/audio/genres.ts:16-59` (`GENRE_STYLES`)
- Test: `src/progressions/audio/genres.test.ts`

- [ ] **Step 1: Replace the deferral test and add positive assignment tests**

In `src/progressions/audio/genres.test.ts`, the `describe("genre drum variations", ...)` block has a test titled `"does NOT assign fill-every-4 to any genre (genre default sets deferred)"`. Its premise is now invalid (we assign `fill-every-4` to pop and rock). **Delete that entire `it(...)` block** and replace it with these tests (keep the existing "wires per-bar-safe variations…" and "keeps every referenced variation id resolvable" tests as-is):

```ts
  it("gives pop and rock a turnaround fill, and rock a phrase-start crash", () => {
    expect(getGenreStyle("pop")!.drumVariations).toContain("fill-every-4");
    expect(getGenreStyle("rock")!.drumVariations).toContain("fill-every-4");
    expect(getGenreStyle("rock")!.drumVariations).toContain("crash-bar-1");
  });

  it("gives funk, jazz, and blues their genre-tailored turnaround", () => {
    expect(getGenreStyle("funk")!.drumVariations).toContain("funk-fill-4");
    expect(getGenreStyle("jazz")!.drumVariations).toContain("jazz-turnaround-4");
    expect(getGenreStyle("blues")!.drumVariations).toContain("blues-fill-4");
  });

  it("leaves ballad and bossa-nova without drum variations", () => {
    expect(getGenreStyle("ballad")!.drumVariations).toEqual([]);
    expect(getGenreStyle("bossa-nova")!.drumVariations).toEqual([]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/audio/genres.test.ts`
Expected: FAIL — the two new "gives …" tests fail because pop/rock/funk/jazz/blues do not yet carry the new ids. (The "leaves ballad and bossa-nova…" test already passes; the "resolvable" test still passes.)

- [ ] **Step 3: Update the genre assignments**

In `src/progressions/audio/genres.ts`, edit the `drumVariations` field of five genres. Apply each replacement:

pop (line ~20):
```ts
    drumPattern: "pop", drumVariations: ["open-hat-and-of-4", "fill-every-4"],
```

rock (line ~26):
```ts
    drumPattern: "rock", drumVariations: ["open-hat-and-of-4", "crash-bar-1", "fill-every-4"],
```

blues (line ~32):
```ts
    drumPattern: "blues-shuffle", drumVariations: ["blues-fill-4"],
```

jazz (line ~38):
```ts
    drumPattern: "jazz-ride", drumVariations: ["jazz-turnaround-4"],
```

funk (line ~50):
```ts
    drumPattern: "funk", drumVariations: ["open-hat-and-of-4", "funk-fill-4"],
```

Leave `ballad` and `bossa-nova` with `drumVariations: []` unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/audio/genres.test.ts`
Expected: PASS — all genre tests green, including the existing "keeps every referenced variation id resolvable" test (proves no dangling ids: the new `funk-fill-4`/`jazz-turnaround-4`/`blues-fill-4` all resolve via `getDrumVariation`).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/genres.ts src/progressions/audio/genres.test.ts
git commit -m "feat(progressions): wire genre default drum variation sets"
```

---

### Task 3: Full verification + ear audition

The drum-variation engine path (gating on `absoluteBar`, merge with base pattern, cross-run determinism) is already covered by `buildAllLayers.test.ts` → `describe("drum variation gating (absolute bar)")` using `fill-every-4`, which shares the identical `barInterval: 4, barPhase: 3` path as the new variations. No new engine test is needed (DRY) — the new variations are pure data exercised through that proven path.

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `pnpm run test`
Expected: PASS — entire suite green. Watch specifically that `buildAllLayers.test.ts` still passes (the new genre assignments do not change `baseInput`, which uses explicit `drumVariations`).

- [ ] **Step 2: Run lint and build**

Run: `pnpm run lint && pnpm run build`
Expected: both succeed with no errors.

- [ ] **Step 3: Ear audition (manual — required by spec §3.2 / §9)**

Run: `pnpm run dev`
For each of **pop, rock, funk, jazz, blues**: select the genre, load a progression of at least 4 bars, play it, and listen to the 4th bar of each phrase.

Confirm:
- pop / rock: the turnaround bar has an audible snare fill; rock's phrase-start (bar 1, 5, 9…) has a crash accent.
- funk: the turnaround bar adds a syncopated ghost-snare flurry without muddying the 16th groove.
- jazz: the turnaround is a soft brush buildup with a ride accent — not a loud rock fill.
- blues: the turnaround is a swung shuffle fill (the genre swing should make it feel triplet-y).

If any fill clashes or feels wrong, tune the beat tables in `patterns.ts` (§6 of the spec lists the starting values) and apply as a small follow-up commit. Note any by-ear adjustments made.

- [ ] **Step 4: Finish the branch**

Use the superpowers:finishing-a-development-branch skill to decide on merge/PR.

---

## Self-Review

**Spec coverage:**
- §6.1 `funk-fill-4` → Task 1. §6.2 `jazz-turnaround-4` → Task 1. §6.3 `blues-fill-4` → Task 1.
- §7 genre assignments (pop, rock, funk, jazz, blues; ballad/bossa empty) → Task 2.
- §9 unit tests (gating bars 3/7/11, resolution, ballad/bossa empty, no dangling ids) → Tasks 1–2. §9 determinism → already covered by existing `buildAllLayers.test.ts` (noted in Task 3). §9 ear audition → Task 3 Step 3.
- §8 backwards-compat (pop/rock/funk keep `open-hat-and-of-4`; ballad/bossa byte-identical) → enforced by Task 2 assignments + the "leaves ballad and bossa-nova…" test.

**Placeholder scan:** none — every code step shows complete code and exact commands.

**Type consistency:** new variations are `DrumVariation` objects with `id`/`label`/`barInterval`/`barPhase`/`pattern` (a `CatalogDrumPattern` using `kicks`/`snares`/`hats`/`ride`), matching the existing entries and the `DrumVariation` interface at `patterns.ts:76-83`. Genre `drumVariations` are `string[]` of ids that all resolve via `getDrumVariation`. Test imports (`DRUM_VARIATIONS`, `variationFiresOnBar`, `getDrumVariation`, `getGenreStyle`) already exist in the respective test files.
