# Pattern Catalog Audit Fixes (A1 + B1 + B2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the three low-risk audit fixes — wire per-bar-safe drum variations into genres (A1), add articulation to two bass patterns (B1), and add 16th-note ghost snares to the funk drum pattern (B2).

**Architecture:** Pure data edits to `src/progressions/audio/patterns.ts` (bass + drum catalogs) and `src/progressions/audio/genres.ts` (genre→variation wiring). No engine change: `buildAllLayers.ts` already folds `drumVariations` into the drum stream and already honors `BassArticulation` via `articulationToDurationSec`. Verification is unit-test-first against the data, plus a manual audition.

**Tech Stack:** TypeScript, Vitest. Package manager is **pnpm**.

**Spec:** `docs/superpowers/specs/2026-05-29-pattern-catalog-audit.md`

---

## Conventions for this plan

- Run a single test file: `pnpm vitest run <path>` (e.g. `pnpm vitest run src/progressions/audio/patterns.test.ts`).
- Run one test by name: `pnpm vitest run <path> -t "<test name>"`.
- Commit after each task with a Conventional Commit (`type(scope): subject`).
- Final gate before any PR: `pnpm run lint && pnpm run test && pnpm run build`.

## Key existing facts the tasks rely on

- `BassArticulation = "staccato" | "legato" | "normal"` and `CatalogBassHit.articulation?` already exist (`patterns.ts:29`, `:45–51`). `articulationToDurationSec` in `buildAllLayers.ts:89` maps `staccato`→0.3·beat, `legato`→0.9·beat, else `undefined` (patch default). No engine change needed to honor a new articulation.
- `buildAllLayers.ts:132–138` folds every selected `DrumVariation`'s hits into the drum stream. The selected set comes from `progressionDrumVariationsAtom`, sourced from `genre.drumVariations` (`progressionAtoms.ts:284`). So assigning a variation id to a genre makes it audible.
- **`DrumVariation.barInterval` is NOT read by the engine** — variation hits fold into *every* bar. Therefore only per-bar-safe variations may be wired here: `open-hat-and-of-4` (an open hat on the "and" of 4, `patterns.ts:366–378`) and `crash-bar-1` (a ride accent on beat 1, `patterns.ts:379–391`). **`fill-every-4` must NOT be assigned** — it would fill every bar; it is deferred to Slice 2.
- `getDrumVariation(id)` (`patterns.ts:406`) returns the variation or `undefined`.
- `GENRE_STYLES` live in `genres.ts:16–59`: `pop` (17–22), `rock` (23–28), `funk` (47–52). Each currently has `drumVariations: []`.
- Bass patterns: `arpeggiated` (`patterns.ts:173–182`, ballad genre), `shuffle` (`patterns.ts:183–191`, blues genre). Neither carries `articulation` today.
- Funk drum pattern: `patterns.ts:314–345`. Current snares: `{1, 1.0}`, `{1.5, 0.3}`, `{3, 1.0}`.
- `genres.test.ts` imports `{ GENRE_STYLES, getGenreStyle }` from `./genres` and `{ getBassPattern, getDrumPattern, getChordPattern }` from `./patterns`. `patterns.test.ts` imports `getBassPattern`/`getDrumPattern`/`getDrumVariation` from `./patterns`.

---

## Task 1: Wire per-bar-safe drum variations into genres (A1)

**Files:**
- Modify: `src/progressions/audio/genres.ts` (the `pop`, `rock`, `funk` entries)
- Test: `src/progressions/audio/genres.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/progressions/audio/genres.test.ts`. Extend the top import to add `getDrumVariation`:

```ts
import { getBassPattern, getDrumPattern, getChordPattern, getDrumVariation } from "./patterns";
```

Then add at the end of the file:

```ts
describe("genre drum variations", () => {
  it("wires per-bar-safe variations to funk, pop, and rock", () => {
    expect(getGenreStyle("funk")!.drumVariations).toContain("open-hat-and-of-4");
    expect(getGenreStyle("pop")!.drumVariations).toContain("open-hat-and-of-4");
    expect(getGenreStyle("rock")!.drumVariations).toContain("crash-bar-1");
  });

  it("does NOT assign fill-every-4 to any genre (barInterval not yet honored)", () => {
    for (const g of GENRE_STYLES) {
      expect(g.drumVariations, `genre ${g.id}`).not.toContain("fill-every-4");
    }
  });

  it("keeps every referenced variation id resolvable", () => {
    for (const g of GENRE_STYLES) {
      for (const id of g.drumVariations) {
        expect(getDrumVariation(id), `genre ${g.id} variation ${id}`).toBeDefined();
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/genres.test.ts -t "genre drum variations"`
Expected: FAIL — the first test fails because all `drumVariations` are `[]`.

- [ ] **Step 3: Assign the variations**

In `src/progressions/audio/genres.ts`, change three entries:

`pop` (lines 17–22): set `drumVariations: ["open-hat-and-of-4"]`:

```ts
  {
    id: "pop", label: "Pop", chordInstrument: "piano",
    chordPattern: "straight-quarters", bassPattern: "root-fifth",
    drumPattern: "pop", drumVariations: ["open-hat-and-of-4"],
    tempoRange: [100, 130], suggestedTempo: 115, swing: 0,
  },
```

`rock` (lines 23–28): set `drumVariations: ["crash-bar-1"]`:

```ts
  {
    id: "rock", label: "Rock", chordInstrument: "strum",
    chordPattern: "pop-8ths", bassPattern: "pedal",
    drumPattern: "rock", drumVariations: ["crash-bar-1"],
    tempoRange: [110, 140], suggestedTempo: 120, swing: 0,
  },
```

`funk` (lines 47–52): set `drumVariations: ["open-hat-and-of-4"]`:

```ts
  {
    id: "funk", label: "Funk", chordInstrument: "strum",
    chordPattern: "offbeat-skank", bassPattern: "funk-syncopated",
    drumPattern: "funk", drumVariations: ["open-hat-and-of-4"],
    tempoRange: [90, 120], suggestedTempo: 100, swing: 0,
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/genres.test.ts`
Expected: PASS (new block + existing genre tests).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/genres.ts src/progressions/audio/genres.test.ts
git commit -m "feat(progressions): wire per-bar-safe drum variations into pop/rock/funk genres"
```

---

## Task 2: Add articulation to arpeggiated + shuffle bass (B1)

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (the `arpeggiated` entry ~173–182, the `shuffle` entry ~183–191)
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/patterns.test.ts`:

```ts
describe("bass articulation polish", () => {
  it("plays the arpeggiated (ballad) bass legato so notes connect", () => {
    const arp = getBassPattern("arpeggiated")!;
    expect(arp.hits.every((h) => h.articulation === "legato")).toBe(true);
  });

  it("gives the shuffle (blues) bass a staccato bounce", () => {
    const shuffle = getBassPattern("shuffle")!;
    expect(shuffle.hits.every((h) => h.articulation === "staccato")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "bass articulation polish"`
Expected: FAIL — neither pattern's hits carry `articulation`.

- [ ] **Step 3: Add `articulation: "legato"` to arpeggiated**

In `src/progressions/audio/patterns.ts`, replace the `arpeggiated` object (currently ~173–182) with:

```ts
  {
    id: "arpeggiated",
    label: "Arpeggiated",
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "legato" },
      { beat: 1, velocity: 0.8, note: "third", articulation: "legato" },
      { beat: 2, velocity: 0.85, note: "fifth", articulation: "legato" },
      { beat: 3, velocity: 0.7, note: "octave", articulation: "legato" },
    ],
  },
```

- [ ] **Step 4: Add `articulation: "staccato"` to shuffle**

In `src/progressions/audio/patterns.ts`, replace the `shuffle` object (currently ~183–191) with:

```ts
  {
    id: "shuffle",
    label: "Shuffle Bass",
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "staccato" },
      { beat: 2, velocity: 0.85, note: "fifth", articulation: "staccato" },
      { beat: 3.5, velocity: 0.6, note: "root", articulation: "staccato" },
    ],
  },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "bass articulation polish"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): add legato arpeggiated + staccato shuffle bass articulation"
```

---

## Task 3: Add 16th-note ghost snares to the funk drum pattern (B2)

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (the `funk` drum entry ~314–345, `snares` array only)
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/patterns.test.ts`:

```ts
describe("funk drum ghost snares", () => {
  const funk = getDrumPattern("funk")!;

  it("preserves the backbeat at full velocity", () => {
    const byBeat = new Map(funk.snares.map((h) => [h.beat, h.velocity]));
    expect(byBeat.get(1)).toBe(1);
    expect(byBeat.get(3)).toBe(1);
  });

  it("adds at least three low-velocity (<=0.2) ghost snares", () => {
    const ghosts = funk.snares.filter((h) => h.velocity <= 0.2);
    expect(ghosts.length).toBeGreaterThanOrEqual(3);
  });

  it("places snares on the expected 16th-subdivision grid", () => {
    expect(funk.snares.map((h) => h.beat)).toEqual([0.75, 1, 1.5, 2.25, 3, 3.5]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "funk drum ghost snares"`
Expected: FAIL — current funk snares are `[{1, 1}, {1.5, 0.3}, {3, 1}]`; no ghosts on 0.75/2.25/3.5.

- [ ] **Step 3: Replace the funk snare array**

In `src/progressions/audio/patterns.ts`, in the `funk` drum entry (~314–345), replace only the `snares` array:

```ts
    snares: [
      { beat: 0.75, velocity: 0.15 },
      { beat: 1, velocity: 1 },
      { beat: 1.5, velocity: 0.3 },
      { beat: 2.25, velocity: 0.18 },
      { beat: 3, velocity: 1 },
      { beat: 3.5, velocity: 0.15 },
    ],
```

Leave the funk `kicks` and `hats` arrays unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "funk drum ghost snares"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): add 16th-note ghost snares to the funk drum pattern"
```

---

## Task 4: Full verification + manual audition

**Files:** none (verification only)

- [ ] **Step 1: Run lint**

Run: `pnpm run lint`
Expected: PASS (no eslint/stylelint errors).

- [ ] **Step 2: Run the full test suite**

Run: `pnpm run test`
Expected: PASS — all unit/component tests green.

- [ ] **Step 3: Run the production build**

Run: `pnpm run build`
Expected: PASS (`tsc -b && vite build` succeeds).

- [ ] **Step 4: Manual audition checklist (by ear)**

Run `pnpm run dev`, open the app, load a progression, and confirm each genre. Check each box only after listening:

- [ ] **Pop:** an open hi-hat now sizzles on the "and" of beat 4 each bar.
- [ ] **Rock:** a ride/crash accent lands on beat 1 of each bar.
- [ ] **Funk:** an open hat sits on the "and" of 4; the snare now has soft 16th ghost notes around the backbeat that interlock with the hats (backbeat on 2 & 4 still dominant).
- [ ] **Ballad:** the arpeggiated bass notes ring/connect (legato) rather than clipping.
- [ ] **Blues:** the shuffle bass has a tighter staccato bounce.
- [ ] No clicks/pops on the new staccato shuffle bass at slow tempos.

- [ ] **Step 5: Finalize**

If all audition boxes pass, the slice is complete. Use the superpowers:finishing-a-development-branch skill to decide on merge/PR.

---

## Self-Review notes

- **Spec coverage:** A1 → Task 1 (per-bar-safe variations only; `fill-every-4` explicitly excluded + asserted). B1 → Task 2 (arpeggiated legato, shuffle staccato). B2 → Task 3 (funk ghost snares). A2/C/D are out of scope (deferred to Slice 2 per the audit) and not part of this plan.
- **No engine change:** Task 1 relies on the existing `buildAllLayers.ts:132–138` variation fold; Task 2 relies on the existing `articulationToDurationSec`; Task 3 is pure data. Verified against source, no new wiring required.
- **Type consistency:** `articulation` values (`"legato"`, `"staccato"`) match `BassArticulation`; `getDrumVariation`, `getGenreStyle`, `getBassPattern`, `getDrumPattern` all match real exports; variation ids (`open-hat-and-of-4`, `crash-bar-1`) match `DRUM_VARIATIONS` entries.
- **Ordering:** Tasks 1–3 are independent and may run in any order; Task 4 runs last.
