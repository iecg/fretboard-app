# End-of-Phrase Bass Walk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the last bar of a step that precedes a chord change, let opted-in bass patterns play a single chromatic approach note into the next chord's root — a turnaround tail — even when the active pattern is not "walking".

**Architecture:** Slice 2 §3.4, the last remaining objective (§3.1/§3.2/§3.3/§3.5 already landed). The mechanism reuses signals already present in `buildAllLayers.ts`: the per-bar `isLast` flag, the step root, and the `chromatic-approach` bass role in `resolveBassNoteForRole`. Two additions: (1) an opt-in `turnaround?: boolean` flag on `CatalogBassPattern`, set on the four patterns where a leading-tone turnaround is idiomatic (`root-fifth`, `arpeggiated`, `shuffle`, `bossa`); (2) a pure `nextResolvableRoot(steps, fromIndex, loop)` helper that finds the next non-rest chord root, loop-wrapping when the progression loops. On a turnaround bar, the bass block swaps the pattern's tail (any hit on or after the bar's last beat) for one synthetic `chromatic-approach` hit on the last beat, resolved against that next root. Patterns without the flag are byte-identical to today.

**Why this design (research-backed):** The canonical, genre-neutral turnaround device is a single chromatic approach note — a half-step from the target root — played as the last beat before the chord change, resolving onto the next downbeat ([jazzguitar.be walking bass lines](https://www.jazzguitar.be/blog/walking-bass-lines/), [learnjazzstandards.com turnarounds](https://www.learnjazzstandards.com/blog/jazz-turnarounds/)). A fuller two-beat walk is idiomatic only for walking bass and muddies static grooves (pedal, funk-one, surdo), so the figure is deliberately a single note. `walking` already emits a `chromatic-approach` hit every bar, so it is intentionally **not** flagged (no double approach, stays byte-identical).

**Tech Stack:** TypeScript, Vitest. Branch `slice2-end-of-phrase-bass-walk` off `main`. Spec: `docs/superpowers/specs/2026-05-29-phrase-aware-multibar-variation-design.md` §3.4.

**Key files (already read during planning):**
- `src/progressions/audio/patterns.ts` — `CatalogBassPattern` interface (~70-76), `BASS_PATTERNS` (~247-328).
- `src/progressions/audio/buildAllLayers.ts` — duration constants (~83-94), pre-loop state (~163-166), per-step setup (~192-195), bass block (~300-333).
- `src/progressions/progressionAudio.ts` — `resolveBassNoteForRole`, `chromatic-approach` branch (~221-231). `PROGRESSION_BASS_ROOT_OCTAVE = 2`. `NOTES` is the 12-tone sharps array, so approach pitch classes render as sharps (e.g. `F#`, `B`).
- `src/progressions/audio/buildAllLayers.test.ts` — `step(...)` factory (~16-34) and `baseInput` (~37-46): `tempoBpm: 60` (1 beat = 1s, 1 bar = 4s), `beatsPerBar: 4`, `swing: 0`, `bassPatternId: "root-fifth"`, `loop: true`. `applyJitter` is mocked to a pass-through, so event times are exact.

**Note math used by the tests (verify once, reuse):** `resolveBassNoteForRole("C","M","chromatic-approach","G")` targets `NOTES[(indexOf("G")-1+12)%12]` = `F#` (half-step below G). `resolveBassNoteForRole("G","M","chromatic-approach","C")` targets `NOTES[(indexOf("C")-1+12)%12]` = `B`. `resolveBassNoteInRange` only places the octave; it preserves the pitch class, so asserting `note.startsWith("F#")` / `note.startsWith("B")` is exact and octave-independent.

---

### Task 1: `turnaround` flag on `CatalogBassPattern` + opt-in the four patterns

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (`CatalogBassPattern` interface ~70-76; `BASS_PATTERNS` entries ~248-327)
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/progressions/audio/patterns.test.ts`. Ensure `BASS_PATTERNS` is in the existing `./patterns` import (add it if missing). Then:

```ts
describe("BASS_PATTERNS turnaround opt-in", () => {
  const byId = (id: string) => {
    const found = BASS_PATTERNS.find((p) => p.id === id);
    if (!found) throw new Error(`missing bass pattern ${id}`);
    return found;
  };

  it("enables turnaround on the four idiomatic patterns", () => {
    for (const id of ["root-fifth", "arpeggiated", "shuffle", "bossa"]) {
      expect(byId(id).turnaround).toBe(true);
    }
  });

  it("leaves turnaround unset on walking (already approaches), pedal, and funk-syncopated", () => {
    for (const id of ["walking", "pedal", "funk-syncopated"]) {
      expect(byId(id).turnaround).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts -t "turnaround opt-in"`
Expected: FAIL — `turnaround` is not yet a field, so all `.turnaround` reads are `undefined` (the first `it` fails on `root-fifth`).

- [ ] **Step 3: Add the `turnaround` field to the interface**

In `src/progressions/audio/patterns.ts`, change the `CatalogBassPattern` interface (currently ~70-76) to:

```ts
export interface CatalogBassPattern {
  id: string;
  label: string;
  hits: readonly CatalogBassHit[];
  /** Cell length in bars (default 1). See ChordPattern.bars. */
  bars?: number;
  /** When true, on the last bar of a step that precedes a chord change the
   *  scheduler replaces this pattern's tail with a single chromatic-approach
   *  note on the bar's last beat, leading into the next chord's root (Slice 2
   *  §3.4). Omitted = the pattern plays unchanged on every bar. */
  turnaround?: boolean;
}
```

- [ ] **Step 4: Set the flag on the four opted-in patterns**

In `src/progressions/audio/patterns.ts`, add `turnaround: true,` to exactly four `BASS_PATTERNS` entries. Add it as the last property of each object, after its `hits` array's closing `],`.

In `root-fifth` (~248-255):

```ts
  {
    id: "root-fifth",
    label: "Root-Fifth",
    hits: [
      { beat: 0, velocity: 1, note: "root" },
      { beat: 2, velocity: 0.85, note: "fifth" },
    ],
    turnaround: true,
  },
```

In `arpeggiated` (~266-275):

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
    turnaround: true,
  },
```

In `shuffle` (~276-288), add `turnaround: true,` after the `hits` array's closing `],` (keep the existing in-array comment untouched):

```ts
      { beat: 0, velocity: 1, note: "root", articulation: "legato" },
      { beat: 2, velocity: 0.85, note: "fifth", articulation: "legato" },
      { beat: 3.5, velocity: 0.6, note: "root", articulation: "legato" },
    ],
    turnaround: true,
  },
```

In `bossa` (~318-327):

```ts
  {
    id: "bossa",
    label: "Bossa Nova",
    // Root–fifth surdo (tonic–dominant alternation) — the recognizable bossa
    // pulse. The clave lock comes from the drums + comp; this stays 1-bar.
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "legato" },
      { beat: 2, velocity: 0.8, note: "fifth", articulation: "legato" },
    ],
    turnaround: true,
  },
```

Do **not** add the flag to `walking`, `pedal`, or `funk-syncopated`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts -t "turnaround opt-in"`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): add opt-in turnaround flag to bass patterns

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `nextResolvableRoot` pure helper

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts` (add exported helper near the top-level functions, after `articulationToDurationSec` ~118)
- Test: `src/progressions/audio/buildAllLayers.test.ts`

This helper finds the root the turnaround should lead into: the next step (forward, skipping rests/unavailable) with a real chord, loop-wrapping when the progression loops. It is the target the synthetic approach note resolves against.

- [ ] **Step 1: Write the failing tests**

Append to `src/progressions/audio/buildAllLayers.test.ts`, inside the existing top-level `describe("buildAllLayers", ...)` block (so the `step` factory is in scope). First add `nextResolvableRoot` to the existing import from `./buildAllLayers`. Then:

```ts
  describe("nextResolvableRoot", () => {
    it("returns the immediate next root", () => {
      const steps = [step({ root: "C" }), step({ id: "g", index: 1, root: "G" })];
      expect(nextResolvableRoot(steps, 0, false)).toBe("G");
    });

    it("skips an unavailable/rest step to the next real chord", () => {
      const steps = [
        step({ root: "C" }),
        step({ id: "r", index: 1, unavailable: true, root: null, quality: null }),
        step({ id: "g", index: 2, root: "G" }),
      ];
      expect(nextResolvableRoot(steps, 0, false)).toBe("G");
    });

    it("loop-wraps to the first root from the last step", () => {
      const steps = [step({ root: "C" }), step({ id: "g", index: 1, root: "G" })];
      expect(nextResolvableRoot(steps, 1, true)).toBe("C");
    });

    it("returns undefined at the end when not looping", () => {
      const steps = [step({ root: "C" }), step({ id: "g", index: 1, root: "G" })];
      expect(nextResolvableRoot(steps, 1, false)).toBeUndefined();
    });

    it("returns undefined when no later step is resolvable", () => {
      const steps = [
        step({ root: "C" }),
        step({ id: "r", index: 1, unavailable: true, root: null, quality: null }),
      ];
      expect(nextResolvableRoot(steps, 0, false)).toBeUndefined();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "nextResolvableRoot"`
Expected: FAIL — `nextResolvableRoot` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/progressions/audio/buildAllLayers.ts`, add immediately after the `articulationToDurationSec` function (~118), before the `VoicedDrumHit` interface:

```ts
/**
 * Find the root the next chord change leads into, scanning forward from
 * `fromIndex` and skipping rests / unavailable steps. Wraps to the start of
 * the progression when `loop` is true. Returns undefined when nothing
 * resolvable follows (end of a non-looping progression, or all-rest tail).
 * Pure — used to target the §3.4 end-of-phrase chromatic approach note.
 */
export function nextResolvableRoot(
  steps: readonly ResolvedProgressionStep[],
  fromIndex: number,
  loop: boolean,
): string | undefined {
  const n = steps.length;
  for (let offset = 1; offset <= n; offset++) {
    const rawIdx = fromIndex + offset;
    if (rawIdx >= n && !loop) return undefined;
    const candidate = steps[rawIdx % n];
    if (
      !candidate.unavailable &&
      candidate.root !== null &&
      candidate.quality !== null
    ) {
      return candidate.root;
    }
  }
  return undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "nextResolvableRoot"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): add nextResolvableRoot helper for turnaround target

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire the turnaround tail into the bass block

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts` (duration constants ~83-94; per-step setup ~192-195; bass block ~300-333)
- Test: `src/progressions/audio/buildAllLayers.test.ts`

At `tempoBpm: 60, beatsPerBar: 4, swing: 0`: bar 0 = `[0,4)`s, bar 1 = `[4,8)`s; a hit on beat `b` lands at `barStart + b` seconds. The bar's last beat is `beatsPerBar - 1 = 3`.

- [ ] **Step 1: Write the failing tests**

Append to `src/progressions/audio/buildAllLayers.test.ts`, inside the top-level `describe("buildAllLayers", ...)` block (so `step` and `baseInput` are in scope):

```ts
  describe("end-of-phrase bass walk (§3.4)", () => {
    const cToG = [
      step({ root: "C" }),
      step({ id: "g", index: 1, root: "G" }),
    ];
    const bassAt = (out: Awaited<ReturnType<typeof buildAllLayersAsync>>, time: number) =>
      out.bass.find((e) => Math.abs(e.time - time) < 1e-6);

    it("adds a chromatic approach on beat 3 of the turnaround bar (root-fifth, into G → F#)", async () => {
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToG, loop: false, bassPatternId: "root-fifth",
      });
      // Bar 0 (C) precedes the change to G → approach on beat 3 (= 3s).
      const approach = bassAt(out, 3);
      expect(approach).toBeDefined();
      expect(approach!.value.note.startsWith("F#")).toBe(true);
      // The pre-turnaround tail is preserved: the fifth on beat 2 still sounds.
      expect(bassAt(out, 2)).toBeDefined();
      // Nothing rings after the approach within bar 0 ([0,4)s).
      expect(out.bass.filter((e) => e.time > 3 && e.time < 4)).toHaveLength(0);
    });

    it("does not fire on the final bar of a non-looping progression (no next chord)", async () => {
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToG, loop: false, bassPatternId: "root-fifth",
      });
      // Bar 1 (G) is last and loop=false → target undefined → no beat-3 approach.
      // root-fifth has no native beat-3 hit, so bar 1 ([4,8)s) has none at 7s.
      expect(bassAt(out, 7)).toBeUndefined();
    });

    it("loop-wraps the target on the last bar (G → C approach = B) when looping", async () => {
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToG, loop: true, bassPatternId: "root-fifth",
      });
      // Bar 1 (G), loop=true → target wraps to C → approach pitch class B at 7s.
      const approach = bassAt(out, 7);
      expect(approach).toBeDefined();
      expect(approach!.value.note.startsWith("B")).toBe(true);
    });

    it("does not fire when the next chord shares the current root (no real change)", async () => {
      const cToC = [step({ root: "C" }), step({ id: "c2", index: 1, root: "C" })];
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToC, loop: false, bassPatternId: "root-fifth",
      });
      // target === root → guarded off; root-fifth keeps only beats 0 & 2.
      expect(bassAt(out, 3)).toBeUndefined();
    });

    it("leaves a non-flagged pattern unchanged (pedal keeps its own root on beat 3)", async () => {
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToG, loop: false, bassPatternId: "pedal",
      });
      // pedal is not turnaround-flagged; its beat-3 hit stays the root (C), not F#.
      const beat3 = bassAt(out, 3);
      expect(beat3).toBeDefined();
      expect(beat3!.value.note.startsWith("C")).toBe(true);
    });

    it("applies to bossa too (into G → F# on beat 3)", async () => {
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToG, loop: false, bassPatternId: "bossa",
      });
      const approach = bassAt(out, 3);
      expect(approach).toBeDefined();
      expect(approach!.value.note.startsWith("F#")).toBe(true);
    });

    it("is deterministic for the same input", async () => {
      const a = await buildAllLayersAsync({ ...baseInput, steps: cToG, loop: true, bassPatternId: "root-fifth" });
      const b = await buildAllLayersAsync({ ...baseInput, steps: cToG, loop: true, bassPatternId: "root-fifth" });
      expect(a.bass).toEqual(b.bass);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "end-of-phrase bass walk"`
Expected: FAIL — turnaround is not wired yet, so `root-fifth` has no beat-3 event (`bassAt(out, 3)` is `undefined`); the bossa and loop-wrap assertions fail too.

- [ ] **Step 3: Add the approach-velocity constant**

In `src/progressions/audio/buildAllLayers.ts`, add after the `ROOT_STRUM_DURATION_SEC` constant block (~92, before `BOSSA_LH_OCTAVE`):

```ts
/** Velocity for the §3.4 end-of-phrase chromatic approach note — slightly under
 *  a downbeat so the leading tone leans into the next chord rather than
 *  competing with it. */
const TURNAROUND_APPROACH_VELOCITY = 0.75;
```

- [ ] **Step 4: Compute the turnaround target per step**

In `src/progressions/audio/buildAllLayers.ts`, the per-step setup currently has (~194-195):

```ts
    const nextStep = input.steps[stepIndex + 1];
    const nextRoot = nextStep?.root ?? undefined;
```

Add the turnaround target immediately after those two lines:

```ts
    const nextStep = input.steps[stepIndex + 1];
    const nextRoot = nextStep?.root ?? undefined;
    // §3.4: the chord the next change leads into (loop-aware, skips rests).
    const turnaroundTarget = nextResolvableRoot(input.steps, stepIndex, input.loop);
```

- [ ] **Step 5: Replace the bass block's hit construction + role resolution**

In `src/progressions/audio/buildAllLayers.ts`, the bass block currently reads (~300-313):

```ts
      if (bassPattern && bassLineNotes.length > 0) {
        const bassCellBars = bassPattern.bars ?? 1;
        const hits = isBarUnit && bassCellBars > 1
          ? sliceCellToBar(bassPattern.hits, absoluteBar % bassCellBars, input.beatsPerBar)
          : repeatPatternToBeats(bassPattern.hits, eventBeats, input.beatsPerBar);
        for (const hit of hits) {
          const note = resolveBassNoteForRole(
            root,
            quality,
            hit.note,
            isLast ? nextRoot : root,
            undefined,
            lastBassNote,
          );
```

Replace exactly that span (from `const bassCellBars` through the closing `)` of the `resolveBassNoteForRole(...)` call) with:

```ts
        const bassCellBars = bassPattern.bars ?? 1;
        const patternHits = isBarUnit && bassCellBars > 1
          ? sliceCellToBar(bassPattern.hits, absoluteBar % bassCellBars, input.beatsPerBar)
          : repeatPatternToBeats(bassPattern.hits, eventBeats, input.beatsPerBar);
        // §3.4 end-of-phrase walk: on a step's last bar that precedes a real
        // chord change, opted-in patterns drop their tail (any hit on/after the
        // bar's last beat) and lead into the next root with one chromatic
        // approach note. Patterns without the flag are untouched.
        const isTurnaroundBar =
          isBarUnit &&
          isLast &&
          bassPattern.turnaround === true &&
          turnaroundTarget !== undefined &&
          turnaroundTarget !== root;
        const lastBeat = input.beatsPerBar - 1;
        const hits = isTurnaroundBar
          ? [
              ...patternHits.filter((h) => h.beat < lastBeat),
              {
                beat: lastBeat,
                velocity: TURNAROUND_APPROACH_VELOCITY,
                note: "chromatic-approach" as const,
                articulation: "legato" as const,
              },
            ]
          : patternHits;
        for (const hit of hits) {
          // The synthetic approach note targets the next chord (loop-aware);
          // every other hit keeps today's behavior exactly.
          const approachTarget =
            isTurnaroundBar && hit.note === "chromatic-approach"
              ? turnaroundTarget
              : isLast
                ? nextRoot
                : root;
          const note = resolveBassNoteForRole(
            root,
            quality,
            hit.note,
            approachTarget,
            undefined,
            lastBassNote,
          );
```

Leave the rest of the bass block (the `lastBassNote = note;`, `applyJitter`, and `bass.push` below) unchanged. Note: only opted-in patterns reach `isTurnaroundBar === true`, and those patterns have no native `chromatic-approach` hits, so `walking` and every other pattern keep the exact `isLast ? nextRoot : root` argument they pass today — byte-identical.

- [ ] **Step 6: Run the new tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "end-of-phrase bass walk"`
Expected: PASS (7 tests).

- [ ] **Step 7: Run the full bass + scheduler suites for regressions**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts src/progressions/audio/patterns.test.ts src/progressions/audio/genres.test.ts`
Expected: PASS. Pre-existing `buildAllLayers` tests stay green — non-flagged patterns are unchanged, and flagged patterns only differ on turnaround bars, which the existing tests do not assert against.

- [ ] **Step 8: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): end-of-phrase bass walk into the next chord (Slice 2 §3.4)

On a step's last bar before a chord change, opted-in bass patterns (root-fifth,
arpeggiated, shuffle, bossa) replace their tail with a single chromatic approach
note on the bar's last beat, leading into the next chord's root. Loop-aware
target via nextResolvableRoot; walking and static grooves stay byte-identical.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Full verification gate + branch

**Files:** none (verification only)

- [ ] **Step 1: Lint + full test suite + build**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all green. (`tsc -b` exit 0 is ground truth — ignore stale IDE diagnostics.)

- [ ] **Step 2: Audition the turnaround in the running app (manual, optional but recommended)**

The turnaround is audible. Start the dev server, load a multi-chord progression, select a flagged bass pattern (e.g. Root-Fifth or Bossa), and confirm a chromatic approach note leads into each chord change on the bar before it, with no approach when the same chord repeats.

Run: `pnpm run dev`

- [ ] **Step 3: Push the branch**

```bash
git push -u origin slice2-end-of-phrase-bass-walk
```

- [ ] **Step 4: (Optional) open a PR**

```bash
gh pr create --base main --head slice2-end-of-phrase-bass-walk \
  --title "feat(progressions): end-of-phrase bass walk (Slice 2 §3.4)" \
  --body "Implements Slice 2 §3.4 — the last remaining objective. On a step's last bar before a chord change, opted-in bass patterns (root-fifth, arpeggiated, shuffle, bossa) play a single chromatic approach note on the bar's last beat into the next chord's root. Opt-in per pattern (turnaround flag); walking already approaches and static grooves (pedal, funk-syncopated) stay byte-identical. Loop-aware target via nextResolvableRoot. Spec: docs/superpowers/specs/2026-05-29-phrase-aware-multibar-variation-design.md §3.4"
```

---

## Self-Review Notes

- **Spec coverage (§3.4):** "When a phrase's last bar precedes a chord change, let the bass play a walking/approach figure into the next root even if the active bass pattern isn't walking" → Task 3 (`isTurnaroundBar` gate + synthetic `chromatic-approach` hit). "Reuse the existing `chromatic-approach` role and the `isLastBar` signal already present" → reuses `resolveBassNoteForRole`'s `chromatic-approach` branch and the loop's `isLast`. Loop-seam correctness (the case `walking` misses today) → Task 2 `nextResolvableRoot` + Task 3 `approachTarget`.
- **Scope decision (was the user's call → opt-in per pattern):** `turnaround?: boolean` on four patterns; non-flagged patterns byte-identical. Documented in Task 1 and the architecture note.
- **Figure decision (researched):** single chromatic approach note on the bar's last beat — the canonical genre-neutral turnaround; a two-beat walk was rejected as too invasive for static grooves.
- **Trigger decision (researched + my call):** step's last bar before a real chord change; not gated on phrase position (the §3.1 `bars`-cell design dropped a global phrase length, and "into the next chord" is the musically meaningful boundary).
- **Type consistency:** `turnaround` (Task 1) read in Task 3 as `bassPattern.turnaround === true`. `nextResolvableRoot(steps, fromIndex, loop)` (Task 2) called as `nextResolvableRoot(input.steps, stepIndex, input.loop)` (Task 3). `turnaroundTarget`, `isTurnaroundBar`, `lastBeat`, `approachTarget`, `TURNAROUND_APPROACH_VELOCITY` used consistently within Task 3. The synthetic hit's shape (`beat`/`velocity`/`note`/`articulation`) matches `CatalogBassHit`; `as const` on the two string literals keeps `note`/`articulation` assignable to `BassNoteRole`/`BassArticulation` without needing to export the internal `CatalogBassHit` type.
- **No placeholders:** every code and test block is complete and copy-pasteable; commands include expected output.
- **Out of scope (correctly):** the minor §3.3 chord-change-relative comp anticipation noted during verification is a separate concern (chord rhythm, not bass) and is not part of §3.4.
```
