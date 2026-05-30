# Pattern Catalog — Targeted Idiomatic Pass (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make four weak backing-track patterns musically authentic (funk/pedal bass, jazz-ride drums, jazz-comp chords), add bass articulation + a `flat-seventh` role to support them, and re-tune the genre wiring, mix levels, and sound patches they touch.

**Architecture:** Pure data + pure-function changes in `src/progressions/audio/` (pattern catalog, layer builder, bass role resolver) plus two small threading edits (the `BassEvent` duration field and the playback call). No UI changes — every pattern is already exposed. Verification is unit-test-first for the data/logic layers; timbre is confirmed by a manual audition checklist.

**Tech Stack:** TypeScript, Vitest, Tone.js (Web Audio), Jotai (untouched here).

**Spec:** `docs/superpowers/specs/2026-05-29-pattern-catalog-targeted-pass-design.md`

---

## Conventions for this plan

- Run a single test file with: `pnpm vitest run <path>` (e.g. `pnpm vitest run src/progressions/progressionAudio.test.ts`).
- Run one test by name: `pnpm vitest run <path> -t "<test name>"`.
- `NOTES` stores pitch classes as **sharps** (`A#`, not `Bb`). All note assertions use sharps.
- Bass notes resolve into the **E1–E3** register, so assert pitch class (strip the octave digit) unless an existing test pins the exact octave.
- Commit after each task with a Conventional Commit (`type(scope): subject`).
- Final gate before any PR: `pnpm run lint && pnpm run test && pnpm run build`.

---

## Task 1: Add the `flat-seventh` bass note role

**Files:**
- Modify: `src/progressions/audio/patterns.ts:21` (the `BassNoteRole` union)
- Modify: `src/progressions/progressionAudio.ts:97-126` (the `switch (role)` in `resolveBassNoteForRole`)
- Test: `src/progressions/progressionAudio.test.ts` (existing `describe("resolveBassNoteForRole")` block near line 64)

- [ ] **Step 1: Write the failing tests**

Add these to the existing `describe("resolveBassNoteForRole", ...)` block in `src/progressions/progressionAudio.test.ts`:

```ts
it("resolves a flat-seventh on a major triad via the root+10 fallback", () => {
  // C major has no 7th chord member, so b7 = root + 10 semitones = A# (Bb).
  const note = resolveBassNoteForRole("C", "M", "flat-seventh");
  expect(note.replace(/[0-9]/g, "")).toBe("A#");
});

it("prefers the chord's own 7th member when present", () => {
  // Cmaj7's "7" member is +11 semitones = B (distinct from the +10 fallback).
  const note = resolveBassNoteForRole("C", "maj7", "flat-seventh");
  expect(note.replace(/[0-9]/g, "")).toBe("B");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/progressions/progressionAudio.test.ts -t "flat-seventh"`
Expected: FAIL — `resolveBassNoteForRole` does not handle `"flat-seventh"` (TypeScript error or wrong result; the role isn't in the union yet).

- [ ] **Step 3: Extend the `BassNoteRole` union**

In `src/progressions/audio/patterns.ts`, change line 21 from:

```ts
export type BassNoteRole = "root" | "third" | "fifth" | "octave" | "chromatic-approach";
```

to:

```ts
export type BassNoteRole =
  | "root"
  | "third"
  | "fifth"
  | "octave"
  | "chromatic-approach"
  | "flat-seventh";
```

- [ ] **Step 4: Add the resolver case**

In `src/progressions/progressionAudio.ts`, add a new `case` inside the `switch (role)` block (after the `"octave"` case, before `"chromatic-approach"`):

```ts
case "flat-seventh": {
  // Prefer the chord's own 7th member (e.g. maj7 → +11); otherwise a
  // dominant b7 = root + 10 semitones (the funk default).
  const seventh = definition?.members.find((m) => m.name === "b7" || m.name === "7");
  targetNoteName = toNoteName(rootAbsolute + (seventh ? seventh.semitone : 10));
  break;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/progressions/progressionAudio.test.ts -t "flat-seventh"`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/progressionAudio.ts src/progressions/progressionAudio.test.ts
git commit -m "feat(progressions): add flat-seventh bass note role"
```

---

## Task 2: Add bass articulation, thread it to durationSec

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (add `BassArticulation` type + `articulation` field on `CatalogBassHit`, near lines 37-47)
- Modify: `src/progressions/audio/buildAllLayers.ts` (add `articulationToDurationSec`, set `BassEvent.durationSec`, extend the `BassEvent` interface at lines 38-41 and the bass loop at lines 204-227)
- Modify: `src/hooks/useProgressionAudioPlayback.ts:406` (pass `durationSec` to `scheduleBassNote`)
- Test: `src/progressions/audio/buildAllLayers.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/buildAllLayers.test.ts`. First check the file's existing imports/helpers; it already builds layers from steps. Add a focused test that a staccato bass hit yields a finite `durationSec` and a normal hit yields `undefined`. Use a minimal one-step progression and a temporary inline pattern is not possible (patterns are by id), so assert against a real pattern after Task 3/4 land. For THIS task, test the pure mapping helper directly by exporting it:

```ts
import { articulationToDurationSec } from "./buildAllLayers";

describe("articulationToDurationSec", () => {
  const spb = 0.5; // 120 bpm → 0.5 s/beat

  it("maps staccato to a short fraction of the beat", () => {
    expect(articulationToDurationSec("staccato", spb)).toBeCloseTo(0.15, 5); // 0.3 * 0.5
  });

  it("maps legato to a near-full beat", () => {
    expect(articulationToDurationSec("legato", spb)).toBeCloseTo(0.45, 5); // 0.9 * 0.5
  });

  it("returns undefined for normal/omitted articulation (patch default)", () => {
    expect(articulationToDurationSec("normal", spb)).toBeUndefined();
    expect(articulationToDurationSec(undefined, spb)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts -t "articulationToDurationSec"`
Expected: FAIL — `articulationToDurationSec` is not exported / not defined.

- [ ] **Step 3: Add the `BassArticulation` type and field**

In `src/progressions/audio/patterns.ts`, add the type next to `BassNoteRole` (after line 21):

```ts
export type BassArticulation = "staccato" | "legato" | "normal";
```

Then extend `CatalogBassHit` (the interface around line 37):

```ts
interface CatalogBassHit {
  beat: number;
  velocity: number;
  note: BassNoteRole;
  /** Note length hint. Omitted === "normal" === patch-default ring. */
  articulation?: BassArticulation;
}
```

- [ ] **Step 4: Add the mapping helper and extend `BassEvent` in buildAllLayers**

In `src/progressions/audio/buildAllLayers.ts`:

Add the import of the type (extend the existing import from `./patterns`):

```ts
import {
  getBassPattern,
  getChordPattern,
  getDrumPattern,
  getDrumVariation,
  repeatPatternToBeats,
  type CatalogDrumPattern,
  type DrumHit,
  type BassArticulation,
} from "./patterns";
```

Extend the `BassEvent` interface (lines 38-41):

```ts
export interface BassEvent {
  note: string;
  velocity: number;
  durationSec?: number;
}
```

Add the exported helper near the top-level helpers (e.g. after `swingBeat`, around line 81):

```ts
/**
 * Translate a bass hit's articulation into a concrete note length in seconds.
 * `undefined` means "use the patch's natural decay+release" (unchanged today).
 */
export function articulationToDurationSec(
  articulation: BassArticulation | undefined,
  secondsPerBeat: number,
): number | undefined {
  switch (articulation) {
    case "staccato":
      return 0.3 * secondsPerBeat;
    case "legato":
      return 0.9 * secondsPerBeat;
    default:
      return undefined;
  }
}
```

- [ ] **Step 5: Run the helper test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts -t "articulationToDurationSec"`
Expected: PASS.

- [ ] **Step 6: Set `durationSec` on emitted bass events**

In `src/progressions/audio/buildAllLayers.ts`, inside the bass loop (around lines 204-227), the `bass.push(...)` currently emits `{ note, velocity }`. Change it to include the duration. The hit object now carries `articulation` (typed via the pattern), so:

```ts
          bass.push({
            time: hitTime,
            value: {
              note,
              velocity,
              durationSec: articulationToDurationSec(hit.articulation, secondsPerBeat),
            },
          });
```

(`hit` here is the per-hit object from `repeatPatternToBeats(bassPattern.hits, ...)`; `repeatPatternToBeats` spreads all fields via `{ ...hit, beat }`, so `articulation` is preserved.)

- [ ] **Step 7: Thread `durationSec` through playback**

In `src/hooks/useProgressionAudioPlayback.ts`, line 406, change:

```ts
          eng.scheduleBassNote(audio.layers.bass, freq, audioTime, { velocity: value.velocity, patch: bassPatch });
```

to:

```ts
          eng.scheduleBassNote(audio.layers.bass, freq, audioTime, { velocity: value.velocity, durationSec: value.durationSec, patch: bassPatch });
```

(`scheduleBassNote` / `BassNoteOptions` in `src/progressions/audio/bass.ts:16` already accepts `durationSec` and clamps it to 0.05–2.0s; `undefined` falls back to the patch default. No change needed there.)

- [ ] **Step 8: Run the full layer-builder suite to confirm no regression**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts`
Expected: PASS (all existing tests still green; new helper test green).

- [ ] **Step 9: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts src/hooks/useProgressionAudioPlayback.ts
git commit -m "feat(progressions): thread bass articulation to per-note duration"
```

---

## Task 3: Overhaul the `funk-syncopated` bass pattern

**Files:**
- Modify: `src/progressions/audio/patterns.ts:196-206` (the `funk-syncopated` entry in `BASS_PATTERNS`)
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/patterns.test.ts`:

```ts
describe("funk-syncopated bass pattern", () => {
  const funk = getBassPattern("funk-syncopated")!;

  it("anchors a strong staccato root on the one", () => {
    const one = funk.hits[0];
    expect(one).toMatchObject({ beat: 0, note: "root", velocity: 1, articulation: "staccato" });
  });

  it("uses ghost notes, an octave pop, the fifth, and a b7 color note", () => {
    expect(funk.hits.map((h) => h.beat)).toEqual([0, 0.75, 1.5, 2, 2.75, 3.5]);
    expect(funk.hits.map((h) => h.note)).toEqual([
      "root", "root", "octave", "fifth", "flat-seventh", "root",
    ]);
  });

  it("plays every hit staccato", () => {
    expect(funk.hits.every((h) => h.articulation === "staccato")).toBe(true);
  });

  it("ghost notes are quieter than accents", () => {
    const byBeat = new Map(funk.hits.map((h) => [h.beat, h.velocity]));
    expect(byBeat.get(0.75)!).toBeLessThan(byBeat.get(0)!); // ghost < the one
    expect(byBeat.get(2.75)!).toBeLessThan(byBeat.get(1.5)!); // ghost < octave pop
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "funk-syncopated"`
Expected: FAIL — current pattern has beats `[0, 0.5, 1.5, 2.5, 3]`, no `flat-seventh`, no `articulation`.

- [ ] **Step 3: Replace the pattern**

In `src/progressions/audio/patterns.ts`, replace the `funk-syncopated` object (currently lines 196-206) with:

```ts
  {
    id: "funk-syncopated",
    label: "Funk Syncopated",
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "staccato" },
      { beat: 0.75, velocity: 0.45, note: "root", articulation: "staccato" },
      { beat: 1.5, velocity: 0.8, note: "octave", articulation: "staccato" },
      { beat: 2, velocity: 0.6, note: "fifth", articulation: "staccato" },
      { beat: 2.75, velocity: 0.5, note: "flat-seventh", articulation: "staccato" },
      { beat: 3.5, velocity: 0.75, note: "root", articulation: "staccato" },
    ],
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "funk-syncopated"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): rework funk-syncopated bass with ghosts, octave pop, b7"
```

---

## Task 4: Overhaul the `pedal` bass pattern

**Files:**
- Modify: `src/progressions/audio/patterns.ts:182-195` (the `pedal` entry in `BASS_PATTERNS`)
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/patterns.test.ts`:

```ts
describe("pedal bass pattern", () => {
  const pedal = getBassPattern("pedal")!;

  it("is a staccato eighth-note pulse on the root", () => {
    expect(pedal.hits.map((h) => h.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    expect(pedal.hits.every((h) => h.note === "root")).toBe(true);
    expect(pedal.hits.every((h) => h.articulation === "staccato")).toBe(true);
  });

  it("accents beat 1 hardest and the and-of-3 push softly", () => {
    const byBeat = new Map(pedal.hits.map((h) => [h.beat, h.velocity]));
    expect(byBeat.get(0)).toBe(1); // downbeat strongest
    expect(byBeat.get(2)!).toBeGreaterThan(byBeat.get(2.5)!); // beat-3 accent > its off-beat
    expect(byBeat.get(0)!).toBeGreaterThan(byBeat.get(0.5)!);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "pedal bass pattern"`
Expected: FAIL — current `pedal` hits have no `articulation` field.

- [ ] **Step 3: Replace the pattern**

In `src/progressions/audio/patterns.ts`, replace the `pedal` object (currently lines 182-195) with:

```ts
  {
    id: "pedal",
    label: "Pedal Tone",
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "staccato" },
      { beat: 0.5, velocity: 0.55, note: "root", articulation: "staccato" },
      { beat: 1, velocity: 0.75, note: "root", articulation: "staccato" },
      { beat: 1.5, velocity: 0.55, note: "root", articulation: "staccato" },
      { beat: 2, velocity: 0.85, note: "root", articulation: "staccato" },
      { beat: 2.5, velocity: 0.55, note: "root", articulation: "staccato" },
      { beat: 3, velocity: 0.75, note: "root", articulation: "staccato" },
      { beat: 3.5, velocity: 0.6, note: "root", articulation: "staccato" },
    ],
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "pedal bass pattern"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): make pedal bass a staccato accented eighth pulse"
```

---

## Task 5: Make the `walking` bass legato

**Files:**
- Modify: `src/progressions/audio/patterns.ts:153-162` (the `walking` entry in `BASS_PATTERNS`)
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/patterns.test.ts`:

```ts
describe("walking bass pattern", () => {
  const walking = getBassPattern("walking")!;

  it("keeps its root→third→fifth→approach note selection", () => {
    expect(walking.hits.map((h) => h.note)).toEqual([
      "root", "third", "fifth", "chromatic-approach",
    ]);
  });

  it("plays every note legato so the line connects", () => {
    expect(walking.hits.every((h) => h.articulation === "legato")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "walking bass pattern"`
Expected: FAIL — current `walking` hits have no `articulation`.

- [ ] **Step 3: Add `articulation: "legato"` to each hit**

In `src/progressions/audio/patterns.ts`, replace the `walking` object (currently lines 153-162) with:

```ts
  {
    id: "walking",
    label: "Walking Bass",
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "legato" },
      { beat: 1, velocity: 0.8, note: "third", articulation: "legato" },
      { beat: 2, velocity: 0.85, note: "fifth", articulation: "legato" },
      { beat: 3, velocity: 0.75, note: "chromatic-approach", articulation: "legato" },
    ],
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "walking bass pattern"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): make walking bass legato"
```

---

## Task 6: Overhaul the `jazz-ride` drum pattern

**Files:**
- Modify: `src/progressions/audio/patterns.ts:252-272` (the `jazz-ride` entry in `DRUM_PATTERNS`)
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/patterns.test.ts`:

```ts
describe("jazz-ride drum pattern", () => {
  const jazz = getDrumPattern("jazz-ride")!;
  const vAt = (hits: readonly { beat: number; velocity: number }[], beat: number) =>
    hits.find((h) => h.beat === beat)?.velocity;

  it("keeps the spang-a-lang ride rhythm", () => {
    expect(jazz.ride!.map((h) => h.beat)).toEqual([0, 1, 1.5, 2, 3, 3.5]);
  });

  it("accents the ride on musical beats 2 and 4, skip-notes softest", () => {
    expect(vAt(jazz.ride!, 1)!).toBeGreaterThan(vAt(jazz.ride!, 0)!); // beat 2 > beat 1
    expect(vAt(jazz.ride!, 3)!).toBeGreaterThan(vAt(jazz.ride!, 2)!); // beat 4 > beat 3
    expect(vAt(jazz.ride!, 1.5)!).toBeLessThan(vAt(jazz.ride!, 1)!); // skip < accent
    expect(vAt(jazz.ride!, 3.5)!).toBeLessThan(vAt(jazz.ride!, 3)!);
  });

  it("feathers a soft four-on-the-floor kick", () => {
    expect(jazz.kicks.map((h) => h.beat)).toEqual([0, 1, 2, 3]);
    expect(jazz.kicks.every((h) => h.velocity <= 0.18)).toBe(true);
  });

  it("plays foot-chick hats on 2 and 4 and a single soft ghost snare", () => {
    expect(jazz.hats.map((h) => h.beat)).toEqual([1, 3]);
    expect(jazz.snares).toEqual([{ beat: 2.5, velocity: 0.2 }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "jazz-ride drum pattern"`
Expected: FAIL — current kicks are `[0.5, 2.5]`, snare is `[{3, 0.4}]`, ride velocities are flat.

- [ ] **Step 3: Replace the pattern**

In `src/progressions/audio/patterns.ts`, replace the `jazz-ride` object (currently lines 252-272) with:

```ts
  {
    id: "jazz-ride",
    label: "Jazz Ride",
    kicks: [
      { beat: 0, velocity: 0.18 },
      { beat: 1, velocity: 0.15 },
      { beat: 2, velocity: 0.18 },
      { beat: 3, velocity: 0.15 },
    ],
    snares: [{ beat: 2.5, velocity: 0.2 }],
    hats: [
      { beat: 1, velocity: 0.5 },
      { beat: 3, velocity: 0.5 },
    ],
    ride: [
      { beat: 0, velocity: 0.55 },
      { beat: 1, velocity: 0.7 },
      { beat: 1.5, velocity: 0.4 },
      { beat: 2, velocity: 0.55 },
      { beat: 3, velocity: 0.7 },
      { beat: 3.5, velocity: 0.4 },
    ],
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "jazz-ride drum pattern"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): rework jazz-ride with accented spang-a-lang and feathered kick"
```

---

## Task 7: Overhaul the `jazz-comp` chord pattern

**Files:**
- Modify: `src/progressions/audio/patterns.ts:113-121` (the `jazz-comp` entry in `CHORD_PATTERNS`)
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/patterns.test.ts`:

```ts
describe("jazz-comp chord pattern", () => {
  const jazz = getChordPattern("jazz-comp")!;

  it("is a sparse Charleston-plus-anticipation figure", () => {
    expect(jazz.hits.map((h) => h.beat)).toEqual([0, 1.5, 3.5]);
  });

  it("plays every hit as a staccato stab", () => {
    expect(jazz.hits.every((h) => h.style === "staccato")).toBe(true);
  });

  it("accents the downbeat stab over the inner comp", () => {
    const byBeat = new Map(jazz.hits.map((h) => [h.beat, h.velocity]));
    expect(byBeat.get(0)!).toBeGreaterThan(byBeat.get(1.5)!);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "jazz-comp chord pattern"`
Expected: FAIL — current hits are beats `[0, 1.5, 3]` with no `style`.

- [ ] **Step 3: Replace the pattern**

In `src/progressions/audio/patterns.ts`, replace the `jazz-comp` object (currently lines 113-121) with:

```ts
  {
    id: "jazz-comp",
    label: "Jazz Comping",
    hits: [
      { beat: 0, velocity: 0.75, style: "staccato" },
      { beat: 1.5, velocity: 0.6, style: "staccato" },
      { beat: 3.5, velocity: 0.7, style: "staccato" },
    ],
  },
```

Note: `ChordStrumEvent.style` is already threaded through `buildAllLayers.ts:197` and honored by the chord voice (poly patches use `shortDurationSec` for staccato). No engine change needed.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "jazz-comp chord pattern"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): rework jazz-comp to staccato Charleston with anticipation"
```

---

## Task 8: Wire `pedal` into the rock genre

**Files:**
- Modify: `src/progressions/audio/genres.ts:24-28` (the `rock` entry)
- Test: `src/progressions/audio/genres.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/genres.test.ts`:

```ts
it("wires the rock genre to the driving pedal bass", () => {
  expect(getGenreStyle("rock")!.bassPattern).toBe("pedal");
});

it("keeps every genre's bassPattern pointing at a real pattern", () => {
  for (const g of GENRE_STYLES) {
    expect(getBassPattern(g.bassPattern), `genre ${g.id}`).toBeDefined();
  }
});
```

Ensure the imports at the top of the test file include `GENRE_STYLES`, `getGenreStyle` (from `./genres`) and `getBassPattern` (from `./patterns`). Add whichever is missing.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/genres.test.ts -t "pedal bass"`
Expected: FAIL — rock currently maps to `"root-fifth"`.

- [ ] **Step 3: Change the rock genre's bass pattern**

In `src/progressions/audio/genres.ts`, in the `rock` entry (lines 24-28), change `bassPattern: "root-fifth"` to `bassPattern: "pedal"`. Final entry:

```ts
  {
    id: "rock", label: "Rock", chordInstrument: "strum",
    chordPattern: "pop-8ths", bassPattern: "pedal",
    drumPattern: "rock", drumVariations: [],
    tempoRange: [110, 140], suggestedTempo: 120, swing: 0,
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/genres.test.ts`
Expected: PASS (new tests + existing genre tests).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/genres.ts src/progressions/audio/genres.test.ts
git commit -m "feat(progressions): wire pedal bass into the rock genre preset"
```

---

## Task 9: Re-tune jazz & funk mix levels

**Files:**
- Modify: `src/progressions/audio/sound/genreMixPresets.ts` (jazz entry lines 59-69, funk entry lines 81-91)
- Test: `src/progressions/audio/sound/genreMixPresets.test.ts` (create if absent)

- [ ] **Step 1: Write the failing/guard test**

Create `src/progressions/audio/sound/genreMixPresets.test.ts` (or add to it if present):

```ts
import { describe, expect, it } from "vitest";
import { GENRE_MIX_PRESETS, getGenreMix } from "./genreMixPresets";

describe("genre mix presets", () => {
  it("keep pan within [-1, 1] and reverbSend within [0, 1] for every instrument", () => {
    for (const mix of GENRE_MIX_PRESETS) {
      for (const inst of ["chord", "bass", "drums", "metronome"] as const) {
        const m = mix.perInstrument[inst];
        expect(m.pan, `${mix.genre}.${inst}.pan`).toBeGreaterThanOrEqual(-1);
        expect(m.pan, `${mix.genre}.${inst}.pan`).toBeLessThanOrEqual(1);
        expect(m.reverbSend, `${mix.genre}.${inst}.reverbSend`).toBeGreaterThanOrEqual(0);
        expect(m.reverbSend, `${mix.genre}.${inst}.reverbSend`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("seats the jazz ride behind the front line (drums quieter than chord)", () => {
    const jazz = getGenreMix("jazz")!;
    expect(jazz.perInstrument.drums.volumeDb).toBeLessThan(jazz.perInstrument.chord.volumeDb);
  });

  it("pushes funk bass to at least match its chord level", () => {
    const funk = getGenreMix("funk")!;
    expect(funk.perInstrument.bass.volumeDb).toBeGreaterThanOrEqual(funk.perInstrument.chord.volumeDb);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run src/progressions/audio/sound/genreMixPresets.test.ts`
Expected: The range test passes; the jazz test already passes (drums -3 < chord -3 is **false**, equal). The jazz and funk assertions may FAIL → that's the signal to tune.

- [ ] **Step 3: Tune jazz so the ride sits behind the front line**

In `src/progressions/audio/sound/genreMixPresets.ts`, jazz `perInstrument` (lines 62-66): lower the drums so the new, more-present ride does not dominate. Set `drums.volumeDb` from `-3` to `-5`, and lift `chord` slightly so comping reads:

```ts
    perInstrument: {
      chord: { volumeDb: -2, pan: -0.16, reverbSend: 0.22 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.06 },
      drums: { volumeDb: -5, pan: 0.1, reverbSend: 0.18 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
```

- [ ] **Step 4: Tune funk so bass drives the groove**

In the funk `perInstrument` (lines 84-88), push bass forward and trim chord:

```ts
    perInstrument: {
      chord: { volumeDb: -4, pan: -0.2, reverbSend: 0.06 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.0 },
      drums: { volumeDb: 0, pan: 0.05, reverbSend: 0.05 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
```

(bass `0` ≥ chord `-4` satisfies the guard; values are conservative and meant to be fine-tuned by ear in Task 11's audition.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/sound/genreMixPresets.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/sound/genreMixPresets.ts src/progressions/audio/sound/genreMixPresets.test.ts
git commit -m "feat(progressions): rebalance jazz ride and funk bass in genre mixes"
```

---

## Task 10: Give the jazz-brush kit a foot-chick hi-hat voice

**Files:**
- Modify: `src/progressions/audio/sound/instrumentPatches.ts:130-136` (the `kit-jazz-brush` entry)
- Test: `src/progressions/audio/drumKit.test.ts` (or `instrumentPatches.test.ts` if present — check first)

- [ ] **Step 1: Confirm the test target**

Run: `ls src/progressions/audio/sound/*.test.ts src/progressions/audio/drumKit.test.ts 2>/dev/null`
Use `src/progressions/audio/drumKit.test.ts` for the assertion (it already imports the kit machinery). If a `sound/instrumentPatches.test.ts` exists, prefer that.

- [ ] **Step 2: Write the failing test**

Add to the chosen test file:

```ts
import { getDrumKitPatch } from "./sound/instrumentPatches"; // adjust relative path if in sound/

it("gives the jazz brush kit a hi-hat voice for the foot chick", () => {
  const kit = getDrumKitPatch("kit-jazz-brush")!;
  expect(kit.voices.hihat).toBeDefined();
});
```

(If adding to `drumKit.test.ts`, the import path is `./sound/instrumentPatches`; if a test already imports `getDrumKitPatch`, reuse that import.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run <chosen test file> -t "jazz brush kit a hi-hat"`
Expected: FAIL — `kit-jazz-brush` currently defines only `kick`, `snare`, `ride`.

- [ ] **Step 4: Add the hi-hat voice**

In `src/progressions/audio/sound/instrumentPatches.ts`, the `kit-jazz-brush` entry (lines 130-136), add a soft closed `hihat` voice:

```ts
  {
    id: "kit-jazz-brush", label: "Jazz Brush",
    voices: {
      kick: { pitchDecay: 0.05, octaves: 5, envelope: { decay: 0.3 } },
      snare: { noiseType: "pink", envelope: { attack: 0.004, decay: 0.16 } },
      hihat: { decay: 0.05, resonance: 3000 },
      ride: { decay: 1.2, harmonicity: 3.1, resonance: 2400 },
    },
  },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run <chosen test file> -t "jazz brush kit a hi-hat"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/sound/instrumentPatches.ts <chosen test file>
git commit -m "feat(progressions): add foot-chick hi-hat voice to jazz brush kit"
```

---

## Task 11: Full verification + manual audition

**Files:** none (verification only)

- [ ] **Step 1: Run lint**

Run: `pnpm run lint`
Expected: PASS (no eslint/stylelint errors).

- [ ] **Step 2: Run the full test suite**

Run: `pnpm run test`
Expected: PASS — all unit/component tests green.

- [ ] **Step 3: Run the production build**

Run: `pnpm run build`
Expected: PASS (`tsc -b && vite build` succeeds; the new `flat-seventh` role and `articulation` field type-check end-to-end).

- [ ] **Step 4: Manual audition checklist (by ear)**

Run: `pnpm run dev`, open the app, load a progression, and for each affected genre confirm the groove. Check each box only after listening:

- [ ] **Jazz** (select Jazz genre): ride swings with clear accents on beats 2 & 4; kick is a soft feather, not thumpy; comping chords are short stabs that leave space; ride sits *behind* the chords, not on top.
- [ ] **Funk** (select Funk genre): bass is punchy/staccato with audible ghost notes and the b7 color; bass clearly drives the mix.
- [ ] **Rock** (select Rock genre): bass is now a driving staccato eighth-note pedal; confirm this is the desired feel (revert Task 8 to `root-fifth` if not).
- [ ] **Manual pattern picks:** with any genre, switch the Bass Pattern selector to Pedal and to Funk Syncopated and confirm both sound correct independent of genre.
- [ ] No clicks/pops on staccato bass notes at fast and slow tempos (sanity-check the bass envelope release per spec §4.6; only adjust `bass-finger`/`bass-pick` release if a click is audible).

- [ ] **Step 5: Finalize**

If all audition boxes pass, the slice is complete. Use the superpowers:finishing-a-development-branch skill to decide on merge/PR.

---

## Self-Review notes

- **Spec coverage:** §4.1 articulation → Task 2; §4.2 flat-seventh → Task 1; §4.3 pattern overhauls → Tasks 3–7 (funk, pedal, walking, jazz-ride, jazz-comp); §4.4 genre wiring → Task 8; §4.5 mix → Task 9; §4.6 patches → Task 10 (jazz kit) + Task 11 Step 4 (bass envelope audition). All covered.
- **Type consistency:** `BassArticulation` (`"staccato" | "legato" | "normal"`) defined in Task 2 and used identically in Tasks 3–5; `articulationToDurationSec` named identically in Task 2 (definition) and consumed only there; `flat-seventh` role string identical across Tasks 1 and 3; `getBassPattern`/`getDrumPattern`/`getChordPattern`/`getGenreStyle`/`getDrumKitPatch` all match real exports.
- **Ordering:** Task 1 (role) and Task 2 (articulation field) precede Task 3 (which uses both) — required. Tasks 4–10 are independent and may run in any order after Task 2.
- **No-engine-change claims verified:** jazz-comp staccato (Task 7) relies on the existing `ChordStrumEvent.style` path; `scheduleBassNote` `durationSec` (Task 2) already exists in `bass.ts`.
