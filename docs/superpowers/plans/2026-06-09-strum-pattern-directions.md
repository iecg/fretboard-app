# Strum Pattern Directions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Annotate three existing chord patterns with strum `direction` so the strum voice plays idiomatic up/down strokes.

**Architecture:** Data-only change. `ChordHit.direction` already exists and the strum voice (`strumVoice.ts:12`) already reverses voicing order on `direction: "up"`. We add the field to hits in `shuffle-comp`, `offbeat-skank`, and `jazz-comp` in `patterns.ts`, following the constant-hand-motion convention (down on-beat, up on "&"), with reggae skank as all-up. `straight-quarters` is intentionally left unchanged — its all-down feel is already the default.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-09-strum-pattern-directions-design.md`

---

### Task 1: Add strum directions to the three patterns (TDD)

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (the `shuffle-comp`, `offbeat-skank`, and `jazz-comp` entries inside `CHORD_PATTERNS`)
- Test: `src/progressions/audio/patterns.test.ts`

The current hits (no `direction`) are:

```ts
// shuffle-comp
{ beat: 0, velocity: 0.9 },
{ beat: 1.5, velocity: 0.6 },

// offbeat-skank
{ beat: 0.5, velocity: 0.7 },
{ beat: 1.5, velocity: 0.7 },
{ beat: 2.5, velocity: 0.7 },
{ beat: 3.5, velocity: 0.7 },

// jazz-comp
{ beat: 0, velocity: 0.75, style: "staccato" },
{ beat: 1.5, velocity: 0.6, style: "staccato" },
{ beat: 3.5, velocity: 0.7, style: "staccato" },
```

- [ ] **Step 1: Write the failing tests**

Add this block to `src/progressions/audio/patterns.test.ts` (after the existing `jazz-comp chord pattern` describe block). It references `getChordPattern`, already imported at the top of the file.

```ts
describe("strum directions", () => {
  it("shuffle-comp anchors a downstroke on the one and an upstroke pickup", () => {
    const p = getChordPattern("shuffle-comp")!;
    const byBeat = new Map(p.hits.map((h) => [h.beat, h.direction]));
    expect(byBeat.get(0)).toBe("down");
    expect(byBeat.get(1.5)).toBe("up");
  });

  it("offbeat-skank plays every hit as a reggae upstroke", () => {
    const p = getChordPattern("offbeat-skank")!;
    expect(p.hits.every((h) => h.direction === "up")).toBe(true);
  });

  it("jazz-comp strums down on the downbeat and up on the off-beat pickups", () => {
    const p = getChordPattern("jazz-comp")!;
    const byBeat = new Map(p.hits.map((h) => [h.beat, h.direction]));
    expect(byBeat.get(0)).toBe("down");
    expect(byBeat.get(1.5)).toBe("up");
    expect(byBeat.get(3.5)).toBe("up");
  });

  it("leaves straight-quarters all-down (default) — no annotations", () => {
    const p = getChordPattern("straight-quarters")!;
    expect(p.hits.every((h) => h.direction === undefined)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm run test -- src/progressions/audio/patterns.test.ts -t "strum directions"`
Expected: FAIL — `shuffle-comp` / `offbeat-skank` / `jazz-comp` assertions fail because `direction` is `undefined` (the `straight-quarters` test already passes).

- [ ] **Step 3: Add the `direction` fields in `patterns.ts`**

Replace the `shuffle-comp` hits with:

```ts
    hits: [
      { beat: 0, velocity: 0.9, direction: "down" },
      { beat: 1.5, velocity: 0.6, direction: "up" },
    ],
```

Replace the `offbeat-skank` hits with:

```ts
    hits: [
      { beat: 0.5, velocity: 0.7, direction: "up" },
      { beat: 1.5, velocity: 0.7, direction: "up" },
      { beat: 2.5, velocity: 0.7, direction: "up" },
      { beat: 3.5, velocity: 0.7, direction: "up" },
    ],
```

Replace the `jazz-comp` hits with:

```ts
    hits: [
      { beat: 0, velocity: 0.75, style: "staccato", direction: "down" },
      { beat: 1.5, velocity: 0.6, style: "staccato", direction: "up" },
      { beat: 3.5, velocity: 0.7, style: "staccato", direction: "up" },
    ],
```

Leave `straight-quarters` untouched.

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `pnpm run test -- src/progressions/audio/patterns.test.ts -t "strum directions"`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full patterns suite to confirm no regression**

Run: `pnpm run test -- src/progressions/audio/patterns.test.ts`
Expected: PASS — the existing `jazz-comp chord pattern` block (beats, staccato, velocity) is unaffected by adding `direction`.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progression): add strum directions to shuffle/skank/jazz comps"
```

---

### Task 2: Full verification

- [ ] **Step 1: Lint, test, build**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all pass. (AGENTS.md requires lint + test + build locally before a PR.)

- [ ] **Step 2: Manual audio check (optional but recommended)**

Run: `pnpm run dev`. Select the strum instrument, load each of `shuffle-comp`, `offbeat-skank`, `jazz-comp`, and confirm the up-strokes read as reversed note order — most audible on `offbeat-skank` (all four hits become up-strokes).
