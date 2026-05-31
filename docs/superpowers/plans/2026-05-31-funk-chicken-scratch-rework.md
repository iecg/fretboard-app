# Funk Chicken-Scratch Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the funk genre into an authentic James Brown chicken-scratch groove — sparse, on-the-one, with a tight muted single-coil guitar — and fix the dead `suggestedTempo` config so genre selection applies tempo.

**Architecture:** One additive engine change (per-stroke note length threaded through the strum voice via an articulation enum, mirroring the existing bass-articulation pattern), plus funk-only data: a new short/bright guitar patch, a new sparse comp pattern, retuned funk bass/drums, and a tempo auto-apply in the genre-apply atom. Every new interface field is optional and defaults to today's behavior, so no other genre's sound changes (except the intended cross-genre tempo auto-apply).

**Tech Stack:** TypeScript, Vitest, Tone.js (Web Audio), Jotai.

**Spec:** `docs/superpowers/specs/2026-05-31-funk-chicken-scratch-rework-design.md`

---

## Conventions for this plan

- Run a single test file: `pnpm vitest run <path>`. Run one test by name: `pnpm vitest run <path> -t "<name>"`.
- Commit after each task with a Conventional Commit (`type(scope): subject`).
- Final gate before any PR: `pnpm run lint && pnpm run test && pnpm run build`.
- Audio timbre/feel is verified by ear in the final task — unit tests assert data + wiring only.

## Key existing facts the tasks rely on

- `ChordHit` (`patterns.ts:31-37`) has `beat`, `velocity`, `style?`, `direction?`. We ADD `articulation?`.
- `ChordStrumEvent` (`buildAllLayers.ts:32-37`) has `voicing`, `velocity`, `style?`, `direction?`. We ADD `durationSec?`. (Note: the `durationSec?` at `buildAllLayers.ts:42` is on `BassEvent`, a different interface.)
- The chord-strum loop pushes events at `buildAllLayers.ts:212-220` (`style: hit.style, direction: hit.direction`). The bass loop already maps articulation→duration at `:247` via `articulationToDurationSec` (`:89-101`).
- `ChordVoiceOptions` (`instruments/types.ts:7-12`) has `velocity`, `style?`, `direction?`. We ADD `durationSec?`.
- `strumVoice.ts:15` calls `pluckString(dest, freq, time, { velocity, spec })`. `pluckString` (`string.ts:40-65`) reads `noteDuration = spec?.noteDurationSec ?? DEFAULT_NOTE_DURATION` (1.8). `PluckStringOptions` is `{ velocity?, spec? }` (`string.ts:14`).
- `useProgressionAudioPlayback.ts:395-396` calls `voice.scheduleChord(..., { velocity, style, direction })`.
- `CHORD_PATTERNS` and `CHORD_PATCHES` live in `patterns.ts` and `sound/instrumentPatches.ts`. `CHORD_PATCHES` strum entries: `chord-nylon-strum`, `chord-steel-strum`.
- Funk genre: `genres.ts` `id: "funk"` entry. Funk mix preset: `genreMixPresets.ts` `genre: "funk"` (chord patch currently `chord-steel-strum`).
- `applyGenreStyleAtom` (`store/progressionAtoms.ts`) sets instrument/patterns/drumVariations/swing but NOT `progressionTempoBpmAtom`. The tempo atom is `progressionTempoBpmAtom` (`progressionAtoms.ts:120`).
- The chord-patterns catalog count test is in `patterns.test.ts` (`describe("pattern catalog")`, asserts `CHORD_PATTERNS` length). Adding a pattern requires bumping it.

---

## Task 1: Add `articulation` to ChordHit + the strum-duration mapper

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (`ChordHit` interface ~31-37)
- Modify: `src/progressions/audio/buildAllLayers.ts` (add `articulationToStrumDurationSec` near `articulationToDurationSec` ~89-101)
- Test: `src/progressions/audio/buildAllLayers.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/buildAllLayers.test.ts`:

```ts
import { articulationToStrumDurationSec } from "./buildAllLayers";

describe("articulationToStrumDurationSec", () => {
  it("chokes a muted scratch stroke to a short fixed length", () => {
    expect(articulationToStrumDurationSec("muted", 1.8)).toBeCloseTo(0.06, 5);
  });
  it("lets an accent ring for the full patch note duration", () => {
    expect(articulationToStrumDurationSec("accent", 1.8)).toBeCloseTo(1.8, 5);
  });
  it("defaults (undefined) to the patch note duration — no behavior change", () => {
    expect(articulationToStrumDurationSec(undefined, 0.42)).toBeCloseTo(0.42, 5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts -t "articulationToStrumDurationSec"`
Expected: FAIL — `articulationToStrumDurationSec` is not exported.

- [ ] **Step 3: Add the `ChordArticulation` type + `articulation` field**

In `src/progressions/audio/patterns.ts`, add the type near the other strum types (after the `StrumDirection` type ~line 14) :

```ts
export type ChordArticulation = "muted" | "accent";
```

Extend the `ChordHit` interface (~31-37) to:

```ts
interface ChordHit {
  beat: number;
  velocity: number;
  style?: "staccato" | "sustained";
  /** Strum direction; up-strokes reverse the voicing order. Defaults to down. */
  direction?: StrumDirection;
  /** Note-length intent for the strum voice. "muted" chokes the stroke short
   *  (chicken-scratch), "accent"/omitted rings for the patch's note duration. */
  articulation?: ChordArticulation;
}
```

- [ ] **Step 4: Add the mapper to `buildAllLayers.ts`**

In `src/progressions/audio/buildAllLayers.ts`, extend the import from `./patterns` to include the new type, and add the function right after `articulationToDurationSec` (after line ~101):

```ts
/**
 * Translate a chord hit's articulation into a strum note length in seconds.
 * "muted" chokes the stroke to a short fixed length (the chicken-scratch);
 * "accent" or omitted rings for the patch's natural note duration.
 */
export function articulationToStrumDurationSec(
  articulation: ChordArticulation | undefined,
  patchNoteDurationSec: number,
): number {
  return articulation === "muted" ? 0.06 : patchNoteDurationSec;
}
```

Add `ChordArticulation` to the existing `import { ... } from "./patterns"` block (alongside `BassArticulation`).

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts -t "articulationToStrumDurationSec"`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): add chord articulation type + strum-duration mapper"
```

---

## Task 2: Thread `durationSec` through the strum voice to pluckString

**Files:**
- Modify: `src/progressions/audio/string.ts` (`PluckStringOptions` ~14, `pluckString` ~50)
- Modify: `src/progressions/audio/instruments/types.ts` (`ChordVoiceOptions` ~7-12)
- Modify: `src/progressions/audio/instruments/strumVoice.ts` (`pluckString` call ~15)
- Test: `src/progressions/audio/instruments/strumVoice.test.ts`, `src/progressions/audio/string.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/progressions/audio/instruments/strumVoice.test.ts` (inside the `describe("strumVoice", ...)` block):

```ts
it("forwards durationSec to pluckString when provided", () => {
  strumVoice.scheduleChord(
    {} as AudioNode,
    ["C3", "E3", "G3"],
    0,
    { velocity: 0.8, durationSec: 0.06 },
  );
  // pluckString(dest, freq, time, options) — options is arg[3].
  for (const call of pluckStringSpy.mock.calls) {
    expect((call[3] as { durationSec?: number }).durationSec).toBe(0.06);
  }
});

it("omits durationSec when not provided (defaults preserved)", () => {
  strumVoice.scheduleChord({} as AudioNode, ["C3"], 0, { velocity: 0.8 });
  expect((pluckStringSpy.mock.calls[0]![3] as { durationSec?: number }).durationSec).toBeUndefined();
});
```

Append to `src/progressions/audio/string.test.ts` (inside `describe("pluckString — Tone.Synth backend", ...)`):

```ts
it("overrides the patch note duration with durationSec when provided", async () => {
  const t = await tone;
  pluckString({} as AudioNode, 220, 0, { velocity: 0.8, durationSec: 0.06 });
  const [, duration] = t.spies.triggerAttackRelease.mock.calls[0]!;
  expect(duration).toBeCloseTo(0.06, 3);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/progressions/audio/instruments/strumVoice.test.ts src/progressions/audio/string.test.ts -t "durationSec"`
Expected: FAIL — `durationSec` is neither accepted nor forwarded.

- [ ] **Step 3: Add `durationSec` to `PluckStringOptions` and honor it**

In `src/progressions/audio/string.ts`, change line 14:

```ts
export interface PluckStringOptions { velocity?: number; spec?: StrumSpec; durationSec?: number; }
```

Change the `noteDuration` line (~50) to prefer the override:

```ts
  const noteDuration = options.durationSec ?? spec?.noteDurationSec ?? DEFAULT_NOTE_DURATION;
```

- [ ] **Step 4: Add `durationSec` to `ChordVoiceOptions`**

In `src/progressions/audio/instruments/types.ts`, extend `ChordVoiceOptions` (~7-12):

```ts
export interface ChordVoiceOptions {
  velocity: number;
  style?: "staccato" | "sustained";
  /** Strum direction; up-strokes reverse the voicing order. Defaults to down. */
  direction?: "up" | "down";
  /** Per-stroke note length override (seconds). Used by the strum voice for
   *  muted chicken-scratch strokes; ignored by piano/organ voices. */
  durationSec?: number;
}
```

- [ ] **Step 5: Forward it in the strum voice**

In `src/progressions/audio/instruments/strumVoice.ts`, change the `pluckString` call (line 15) to pass `durationSec`:

```ts
        return pluckString(dest, freq, time + i * STRUM_LAG_SECONDS, { velocity: options.velocity, spec, durationSec: options.durationSec });
```

(The piano and organ voices do not read `durationSec`, so they are unaffected — no change needed there.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm vitest run src/progressions/audio/instruments/strumVoice.test.ts src/progressions/audio/string.test.ts`
Expected: PASS (new tests + all existing strum/string tests still green).

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/string.ts src/progressions/audio/instruments/types.ts src/progressions/audio/instruments/strumVoice.ts src/progressions/audio/instruments/strumVoice.test.ts src/progressions/audio/string.test.ts
git commit -m "feat(progressions): thread per-stroke durationSec through the strum voice"
```

---

## Task 3: Emit `durationSec` on chord strum events + forward in playback

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts` (`ChordStrumEvent` ~32-37, chord loop ~203-221)
- Modify: `src/hooks/useProgressionAudioPlayback.ts` (scheduleChord call ~395-396)
- Test: `src/progressions/audio/buildAllLayers.test.ts`

- [ ] **Step 1: Write the failing test**

First, confirm the test file's existing layer-build helper. Add to `src/progressions/audio/buildAllLayers.test.ts` a test that a muted chord hit yields a short `durationSec` on the emitted strum event. Use the existing build helper pattern in that file (it builds layers from steps + pattern ids). Since chord patterns are referenced by id, this test lands meaningfully only after Task 4 adds `funk-scratch`; for THIS task, assert the mapping wiring directly via a focused build using the `funk-scratch` pattern is NOT yet possible — instead assert the field is populated for an existing pattern that has no articulation (so it equals the patch note duration) and is `0.06` for a muted hit by constructing through the public `buildAllLayersAsync`.

To keep this task self-contained, test the emission logic against the `pop-8ths` pattern (no articulation → durationSec equals the strum patch note duration). Add:

```ts
import { buildAllLayersAsync } from "./buildAllLayers";

describe("chord strum durationSec emission", () => {
  const baseStep = {
    id: "s1", degree: "I", root: "C", quality: "M",
    duration: { value: 1, unit: "bar" as const },
    qualityOverride: null, manualRoot: null, unavailable: false,
  };

  it("emits a durationSec on every chord strum event", async () => {
    const layers = await buildAllLayersAsync({
      steps: [baseStep],
      tempoBpm: 120, beatsPerBar: 4, swing: 0,
      chordPatternId: "pop-8ths", bassPatternId: "root-fifth",
      drumPatternId: "pop", drumVariations: [], loop: false,
    });
    expect(layers.chordStrums.length).toBeGreaterThan(0);
    for (const s of layers.chordStrums) {
      expect(typeof s.value.durationSec).toBe("number");
    }
  });
});
```

(If the `ResolvedProgressionStep` shape in the helper differs, match the existing helper in the file — the key assertion is that `value.durationSec` is a number on each strum event.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts -t "chord strum durationSec emission"`
Expected: FAIL — `durationSec` is `undefined` on strum events (field not emitted).

- [ ] **Step 3: Add `durationSec` to `ChordStrumEvent`**

In `src/progressions/audio/buildAllLayers.ts`, extend the interface (~32-37):

```ts
export interface ChordStrumEvent {
  voicing: readonly string[];
  velocity: number;
  style?: StrumStyle;
  direction?: StrumDirection;
  durationSec?: number;
}
```

- [ ] **Step 4: Populate it in the chord loop**

The chord loop needs the active strum patch's note duration to map "accent"/undefined to. The pure `buildAllLayersAsync` does not know the patch, so use a sensible constant default equal to the strum default (`1.8`) — the muted choke (`0.06`) is what matters musically, and accent/undefined falls back to the patch's own `noteDurationSec` inside `pluckString` anyway when we pass `undefined`. Therefore: emit `0.06` for muted, and `undefined` for accent/omitted (so `pluckString` uses the patch duration).

Replace the `articulationToStrumDurationSec` import-and-use approach with this minimal emission. In the chord-strum push (`buildAllLayers.ts:212-220`), change to:

```ts
          chordStrums.push({
            time: hitTime,
            value: {
              voicing,
              velocity,
              style: hit.style,
              direction: hit.direction,
              durationSec: hit.articulation === "muted" ? 0.06 : undefined,
            },
          });
```

(This keeps the muted choke deterministic and lets accent/omitted strokes ring at the patch's own note duration via the `pluckString` fallback. The `articulationToStrumDurationSec` helper from Task 1 documents the intent and is unit-tested; the inline emission uses the same `0.06` choke.)

Update the Task 3 test's expectation accordingly: for `pop-8ths` (no articulation) `durationSec` is `undefined`, so change the assertion to:

```ts
    for (const s of layers.chordStrums) {
      expect(s.value.durationSec).toBeUndefined(); // pop-8ths has no muted hits
    }
```

- [ ] **Step 5: Forward `durationSec` in playback**

In `src/hooks/useProgressionAudioPlayback.ts`, change the scheduleChord options (lines 395-396):

```ts
          voice.scheduleChord(audio.layers.chord, value.voicing, audioTime, {
            velocity: value.velocity, style: value.style, direction: value.direction, durationSec: value.durationSec,
          });
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts -t "chord strum durationSec emission"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/hooks/useProgressionAudioPlayback.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): emit + forward chord strum durationSec for muted strokes"
```

---

## Task 4: Add the `chord-funk-scratch` guitar patch

**Files:**
- Modify: `src/progressions/audio/sound/instrumentPatches.ts` (`CHORD_PATCHES`)
- Test: `src/progressions/audio/sound/instrumentPatches.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/sound/instrumentPatches.test.ts`:

```ts
it("provides a short-decay funk scratch guitar patch", () => {
  const patch = getChordPatch("chord-funk-scratch")!;
  expect(patch).toBeDefined();
  expect(patch.family).toBe("strum");
  // Must be short so it can scratch, not bloom like the acoustic steel strum (1.8s).
  expect(patch.strum!.noteDurationSec).toBeLessThanOrEqual(0.3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/sound/instrumentPatches.test.ts -t "funk scratch guitar"`
Expected: FAIL — `chord-funk-scratch` does not exist.

- [ ] **Step 3: Add the patch**

In `src/progressions/audio/sound/instrumentPatches.ts`, add to `CHORD_PATCHES` after the `chord-steel-strum` entry:

```ts
  {
    id: "chord-funk-scratch", label: "Funk Scratch", family: "strum",
    strum: {
      // Bright single-coil chicken-scratch: upper-harmonic-weighted partials so
      // muted scratches cut on small speakers, and a short note/release so even
      // voiced stabs stay tight instead of ringing like the acoustic strum.
      oscillator: { type: "custom", partials: [1, 0.9, 0.7, 0.5, 0.35, 0.25, 0.15] },
      envelope: { attack: 0.004, decay: 0.18, sustain: 0.0, release: 0.08 },
      noteDurationSec: 0.18, releaseTailSec: 0.4,
    },
    insert: { eq3: { low: -2, mid: 1, high: 3 } },
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/sound/instrumentPatches.test.ts -t "funk scratch guitar"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/sound/instrumentPatches.ts src/progressions/audio/sound/instrumentPatches.test.ts
git commit -m "feat(progressions): add chord-funk-scratch single-coil guitar patch"
```

---

## Task 5: Add the `funk-scratch` sparse on-the-one comp pattern

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (`CHORD_PATTERNS`)
- Test: `src/progressions/audio/patterns.test.ts` (new describe + bump catalog count)

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/patterns.test.ts`:

```ts
describe("funk-scratch chord comp", () => {
  const funk = getChordPattern("funk-scratch")!;

  it("exists and accents the one hardest", () => {
    expect(funk).toBeDefined();
    const byBeat = new Map(funk.hits.map((h) => [h.beat, h.velocity]));
    const one = byBeat.get(0)!;
    for (const h of funk.hits) {
      if (h.beat !== 0) expect(h.velocity).toBeLessThan(one);
    }
  });

  it("marks the one as an accent and the rest as muted scratches", () => {
    const byBeat = new Map(funk.hits.map((h) => [h.beat, h]));
    expect(byBeat.get(0)!.articulation).toBe("accent");
    const muted = funk.hits.filter((h) => h.articulation === "muted");
    expect(muted.length).toBeGreaterThanOrEqual(funk.hits.length - 1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "funk-scratch chord comp"`
Expected: FAIL — `funk-scratch` does not exist.

- [ ] **Step 3: Add the pattern**

In `src/progressions/audio/patterns.ts`, add to `CHORD_PATTERNS` after the `funk-16th` entry:

```ts
  {
    id: "funk-scratch",
    label: "Funk Scratch",
    // James Brown chicken-scratch: a hard accented chord stab on the one, then
    // muted scratch ghosts with deliberate space. The "muted" hits choke short
    // via the strum voice; the accent rings the patch's (already short) length.
    hits: [
      { beat: 0, velocity: 0.95, direction: "down", articulation: "accent" },
      { beat: 0.5, velocity: 0.28, direction: "up", articulation: "muted" },
      { beat: 0.75, velocity: 0.3, direction: "up", articulation: "muted" },
      { beat: 1.5, velocity: 0.4, direction: "up", articulation: "muted" },
      { beat: 2.5, velocity: 0.28, direction: "up", articulation: "muted" },
      { beat: 2.75, velocity: 0.3, direction: "up", articulation: "muted" },
      { beat: 3.5, velocity: 0.35, direction: "up", articulation: "muted" },
    ],
  },
```

- [ ] **Step 4: Bump the chord-pattern catalog count**

The `describe("pattern catalog")` block in `patterns.test.ts` asserts the chord-pattern count. Find the line asserting `CHORD_PATTERNS` length (currently `expect(CHORD_PATTERNS).toHaveLength(8)`) and bump it to `9`, and update the test name string from `"has 8 chord patterns with unique IDs"` to `"has 9 chord patterns with unique IDs"`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts`
Expected: PASS (new block + bumped catalog count + all existing pattern tests).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): add sparse on-the-one funk-scratch chord comp"
```

---

## Task 6: Retune funk bass + drums toward "the one"

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (`funk-syncopated` bass, `funk` drums)
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing/guard test**

Add to `src/progressions/audio/patterns.test.ts`:

```ts
describe("funk groove locks on the one", () => {
  it("funk-syncopated bass anchors beat 1 as the velocity-1 hit", () => {
    const bass = getBassPattern("funk-syncopated")!;
    const one = bass.hits.find((h) => h.beat === 0)!;
    expect(one.velocity).toBe(1);
    expect(one.note).toBe("root");
  });

  it("funk drums put the hardest kick on the one", () => {
    const funk = getDrumPattern("funk")!;
    const kickOne = funk.kicks.find((h) => h.beat === 0)!;
    expect(kickOne.velocity).toBe(1);
    for (const k of funk.kicks) {
      if (k.beat !== 0) expect(k.velocity).toBeLessThanOrEqual(kickOne.velocity);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify current state**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "funk groove locks on the one"`
Expected: PASS already for the existing patterns (beat-0 bass is velocity 1 / root; beat-0 kick is velocity 1). This test is a REGRESSION GUARD that must keep passing through the retune. If it fails now, the retune in Step 3 must preserve these invariants.

- [ ] **Step 3: Retune the funk bass + drums (keep the guarded invariants)**

In `src/progressions/audio/patterns.ts`, retune `funk-syncopated` to tighten around the one — anchor beat 1, trim one mid-bar hit for more space:

```ts
  {
    id: "funk-syncopated",
    label: "Funk Syncopated",
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "staccato" },
      { beat: 0.75, velocity: 0.4, note: "root", articulation: "staccato" },
      { beat: 1.5, velocity: 0.8, note: "octave", articulation: "staccato" },
      { beat: 2.5, velocity: 0.55, note: "fifth", articulation: "staccato" },
      { beat: 3.5, velocity: 0.7, note: "flat-seventh", articulation: "staccato" },
    ],
  },
```

Retune the `funk` drums for a harder, simpler locked groove — keep beat-0 kick at velocity 1 and the backbeat snares full:

```ts
  {
    id: "funk",
    label: "Funk",
    kicks: [
      { beat: 0, velocity: 1 },
      { beat: 0.75, velocity: 0.55 },
      { beat: 2.5, velocity: 0.8 },
    ],
    snares: [
      { beat: 1, velocity: 1 },
      { beat: 1.5, velocity: 0.2 },
      { beat: 2.25, velocity: 0.18 },
      { beat: 3, velocity: 1 },
      { beat: 3.5, velocity: 0.15 },
    ],
    hats: [
      { beat: 0, velocity: 0.55 },
      { beat: 0.25, velocity: 0.3 },
      { beat: 0.5, velocity: 0.4 },
      { beat: 0.75, velocity: 0.3 },
      { beat: 1, velocity: 0.5 },
      { beat: 1.25, velocity: 0.3 },
      { beat: 1.5, velocity: 0.4 },
      { beat: 1.75, velocity: 0.3 },
      { beat: 2, velocity: 0.5 },
      { beat: 2.25, velocity: 0.3 },
      { beat: 2.5, velocity: 0.4 },
      { beat: 2.75, velocity: 0.3 },
      { beat: 3, velocity: 0.5 },
      { beat: 3.25, velocity: 0.3 },
      { beat: 3.5, velocity: 0.4 },
      { beat: 3.75, velocity: 0.3 },
    ],
  },
```

Note: the existing `funk drum ghost snares` test asserts the snare beat grid `[0.75, 1, 1.5, 2.25, 3, 3.5]` and that backbeats (1 & 3) are velocity 1 with ≥3 ghosts ≤0.2. The retune above drops the `0.75` ghost, changing the grid to `[1, 1.5, 2.25, 3, 3.5]`. Update that existing test's grid assertion to `[1, 1.5, 2.25, 3, 3.5]` and confirm it still has ≥3 ghosts ≤0.2 (1.5→0.2, 2.25→0.18, 3.5→0.15 = three ghosts). Keep the backbeat assertions.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts`
Expected: PASS (new guard + updated ghost-snare grid + all else).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): tighten funk bass + drums onto the one"
```

---

## Task 7: Wire the funk genre + mix to the new scratch sound

**Files:**
- Modify: `src/progressions/audio/genres.ts` (`funk` entry)
- Modify: `src/progressions/audio/sound/genreMixPresets.ts` (`funk` preset chord patch)
- Test: `src/progressions/audio/genres.test.ts`, `src/progressions/audio/sound/genreMixPresets.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/progressions/audio/genres.test.ts`:

```ts
it("wires the funk genre to the chicken-scratch comp", () => {
  expect(getGenreStyle("funk")!.chordPattern).toBe("funk-scratch");
});
```

Add to `src/progressions/audio/sound/genreMixPresets.test.ts`:

```ts
it("uses the short funk-scratch guitar patch for funk", () => {
  expect(getGenreMix("funk")!.patches.chord).toBe("chord-funk-scratch");
});

it("funk's chord patch is short-decay so the guitar can actually scratch", () => {
  // Recurrence guard: two prior funk passes failed because the guitar was a
  // long-ringing acoustic strum. The funk chord patch must stay short.
  const patchId = getGenreMix("funk")!.patches.chord;
  const patch = getChordPatch(patchId)!;
  expect(patch.strum!.noteDurationSec).toBeLessThanOrEqual(0.3);
});
```

Ensure `getChordPatch` is imported in `genreMixPresets.test.ts` (it already imports from `./instrumentPatches`; add `getChordPatch` if missing).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/progressions/audio/genres.test.ts src/progressions/audio/sound/genreMixPresets.test.ts -t "funk"`
Expected: FAIL — funk still wired to `funk-16th` / `chord-steel-strum`.

- [ ] **Step 3: Update the funk genre wiring**

In `src/progressions/audio/genres.ts`, in the `funk` entry, change `chordPattern: "funk-16th"` to `chordPattern: "funk-scratch"`. Leave `bassPattern`, `drumPattern`, `drumVariations`, `swing` as-is.

- [ ] **Step 4: Update the funk mix preset chord patch**

In `src/progressions/audio/sound/genreMixPresets.ts`, in the `genre: "funk"` preset, change `patches: { bass: "bass-finger", chord: "chord-steel-strum", drumKit: "kit-funk" }` to use `chord: "chord-funk-scratch"`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/progressions/audio/genres.test.ts src/progressions/audio/sound/genreMixPresets.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/genres.ts src/progressions/audio/sound/genreMixPresets.ts src/progressions/audio/genres.test.ts src/progressions/audio/sound/genreMixPresets.test.ts
git commit -m "feat(progressions): wire funk genre + mix to the chicken-scratch guitar"
```

---

## Task 8: Auto-apply genre `suggestedTempo` + retune funk tempo

**Files:**
- Modify: `src/store/progressionAtoms.ts` (`applyGenreStyleAtom`)
- Modify: `src/progressions/audio/genres.ts` (`funk` tempo fields)
- Test: `src/store/atoms.test.ts` (or wherever `applyGenreStyleAtom` is exercised) + `src/progressions/audio/genres.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/progressions/audio/genres.test.ts`:

```ts
it("gives funk a James Brown pocket tempo", () => {
  const funk = getGenreStyle("funk")!;
  expect(funk.suggestedTempo).toBeGreaterThanOrEqual(104);
  expect(funk.suggestedTempo).toBeLessThanOrEqual(116);
  expect(funk.tempoRange[0]).toBeLessThanOrEqual(funk.suggestedTempo);
  expect(funk.tempoRange[1]).toBeGreaterThanOrEqual(funk.suggestedTempo);
});
```

Add a store test for the tempo auto-apply. Create `src/store/progressionGenreTempo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createStore } from "jotai";
import { applyGenreStyleAtom, progressionTempoBpmAtom } from "./progressionAtoms";
import { getGenreStyle } from "../progressions/audio/genres";

describe("applyGenreStyleAtom tempo", () => {
  it("applies the genre's suggestedTempo to the tempo atom", () => {
    const store = createStore();
    store.set(progressionTempoBpmAtom, 60); // a value no genre suggests
    store.set(applyGenreStyleAtom, "funk");
    expect(store.get(progressionTempoBpmAtom)).toBe(getGenreStyle("funk")!.suggestedTempo);
  });

  it("applies tempo for a different genre too", () => {
    const store = createStore();
    store.set(applyGenreStyleAtom, "jazz");
    expect(store.get(progressionTempoBpmAtom)).toBe(getGenreStyle("jazz")!.suggestedTempo);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/store/progressionGenreTempo.test.ts src/progressions/audio/genres.test.ts -t "tempo"`
Expected: FAIL — `applyGenreStyleAtom` doesn't set tempo; funk tempo not yet retuned.

- [ ] **Step 3: Add the tempo auto-apply**

In `src/store/progressionAtoms.ts`, in `applyGenreStyleAtom`, add after the `set(progressionSwingAtom, genre.swing);` line:

```ts
  set(progressionTempoBpmAtom, genre.suggestedTempo);
```

Confirm `progressionTempoBpmAtom` is in scope (it is defined in the same file ~line 120).

- [ ] **Step 4: Retune the funk tempo**

In `src/progressions/audio/genres.ts`, in the `funk` entry, change `tempoRange: [90, 120], suggestedTempo: 100` to `tempoRange: [96, 120], suggestedTempo: 110`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/store/progressionGenreTempo.test.ts src/progressions/audio/genres.test.ts`
Expected: PASS.

- [ ] **Step 6: Check for a now-stale genre-apply test**

The existing test `applyGenreStyle does NOT revert to custom` in `src/hooks/useProgressionState.test.tsx` applies a genre and asserts the genre atom stays set. Adding a tempo write does not change that behavior, but run it to confirm:

Run: `pnpm vitest run src/hooks/useProgressionState.test.tsx`
Expected: PASS (no change needed; if it asserts tempo unchanged anywhere, update that assertion to expect the suggestedTempo).

- [ ] **Step 7: Commit**

```bash
git add src/store/progressionAtoms.ts src/progressions/audio/genres.ts src/store/progressionGenreTempo.test.ts src/progressions/audio/genres.test.ts
git commit -m "feat(progressions): apply genre suggestedTempo on selection; retune funk to JB pocket"
```

---

## Task 9: Full verification + manual audition

**Files:** none (verification only)

- [ ] **Step 1: Run lint**

Run: `pnpm run lint`
Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run: `pnpm run test`
Expected: PASS — all unit/component tests green.

- [ ] **Step 3: Run the production build**

Run: `pnpm run build`
Expected: PASS (`tsc -b && vite build`).

- [ ] **Step 4: Manual audition checklist (by ear)**

Run `pnpm run dev`, open the app, select the **Funk** genre, load a progression, and play. Check each box only after listening:

- [ ] Selecting Funk snaps the tempo to ~110 (no manual change needed).
- [ ] The guitar is a tight, dry, muted chicken-scratch — short strokes, not a ringing acoustic strum.
- [ ] Beat 1 ("the one") lands with a clear accented chord stab; the rest is muted scratch with space (sparse, hypnotic).
- [ ] Bass and drums lock onto the one with the guitar; the groove feels like James Brown funk, not a generic rock/disco beat.
- [ ] No clicks/pops on the muted scratch strokes at the funk tempo.
- [ ] Switch to another genre and back — tempo + sound follow the genre.

- [ ] **Step 5: Finalize**

If all audition boxes pass, the slice is complete. Note any by-ear tuning the audition revealed (patch partials, the 0.06s choke, comp velocities, tempo) and apply as small follow-up commits. Use the superpowers:finishing-a-development-branch skill to decide on merge/PR (this branch already has PR #484 open — push the commits to it).

---

## Self-Review notes

- **Spec coverage:** §4.1 engine articulation → Tasks 1-3; §4.2 funk patch → Task 4; §4.3 funk-scratch comp → Task 5; §4.4 bass + §4.5 drums → Task 6; §4.6 tempo auto-apply + retune → Task 8; §4.7 wiring → Task 7; §4.8 keep funk-16th → satisfied (Task 5 adds, never removes); §5 tests → each task is TDD + the recurrence guard is in Task 7 Step 1; §6 audition → Task 9. All covered.
- **Type consistency:** `ChordArticulation` ("muted"|"accent") defined in Task 1, used in Tasks 1/3/5; `articulation?` added to `ChordHit` (Task 1) and read in `buildAllLayers` (Task 3) and `funk-scratch` (Task 5); `durationSec?` added to `PluckStringOptions` (Task 2), `ChordVoiceOptions` (Task 2), `ChordStrumEvent` (Task 3), forwarded in playback (Task 3); `chord-funk-scratch` id consistent across Tasks 4/7; `funk-scratch` id consistent across Tasks 5/7. `getChordPattern`/`getBassPattern`/`getDrumPattern`/`getChordPatch`/`getGenreStyle`/`getGenreMix` all match real exports.
- **Ordering:** Task 1 (type+mapper) → Task 2 (voice plumbing) → Task 3 (emission, needs the field) → Task 4 (patch) → Task 5 (comp, uses articulation) → Task 6 (bass/drums) → Task 7 (wiring, needs patch+comp) → Task 8 (tempo) → Task 9 (verify). Each task's tests pass independently after its own changes.
- **Note on Task 3 design choice:** the inline emission uses `0.06` for muted / `undefined` for accent (so accent rings the patch's own short `noteDurationSec`), rather than calling `articulationToStrumDurationSec` with a hardcoded patch duration. The helper from Task 1 documents+tests the mapping intent; the emission stays patch-agnostic. Both use the same `0.06` choke constant.
