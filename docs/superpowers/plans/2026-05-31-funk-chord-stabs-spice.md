# Funk Chord Stabs & Spicy Voicing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the funk guitar comp read as funk — a ringing accented stab on the one plus two syncopated ring-stabs, muted ghost scratches between, and auto-extended (spicy) chord voicings on the stabs only.

**Architecture:** Three thin layers, all already plumbed by PR #486. (1) Rhythm: rename the `ChordArticulation` enum to `"muted" | "stab"` and rewrite the `funk-scratch` comp. (2) Timbre: give the `chord-funk-scratch` patch a small `sustain` so held duration governs ring, and map `stab` hits to a longer `durationSec`. (3) Harmony: a pure `extendFunkVoicing` helper adds color tones per chord quality, applied in `buildAllLayers` to `stab` hits only.

**Tech Stack:** TypeScript, Vitest, Tone.js (no new deps). Pure music-theory math reuses `NOTES` from `@fretflow/core`.

**Spec:** `docs/superpowers/specs/2026-05-31-funk-chord-stabs-spice-design.md`

---

## File Structure

- `src/progressions/audio/patterns.ts` — `ChordArticulation` type + `funk-scratch` comp (Task 1).
- `src/progressions/audio/patterns.test.ts` — funk-scratch comp guards (Task 1).
- `src/progressions/audio/buildAllLayers.ts` — `STAB_STRUM_DURATION_SEC`, stab duration branch (Task 2), spicy voicing selection (Task 4).
- `src/progressions/audio/buildAllLayers.test.ts` — stab ring + voicing-selection guards (Tasks 2, 4).
- `src/progressions/progressionAudio.ts` — new pure `extendFunkVoicing` helper (Task 3).
- `src/progressions/progressionAudio.test.ts` — per-quality extension unit tests (Task 3).
- `src/progressions/audio/sound/instrumentPatches.ts` — `chord-funk-scratch` envelope (Task 5).
- `src/progressions/audio/sound/instrumentPatches.test.ts` — envelope root-cause guard (Task 5).

---

## Task 1: Rename articulation enum to `"muted" | "stab"` and rewrite the funk-scratch comp

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (type at line 16, comment ~39-41, `funk-scratch` comp ~158-173)
- Test: `src/progressions/audio/patterns.test.ts` (`describe("funk-scratch chord comp")` ~319-337)

**Context:** `"accent"` never rang (it just used the patch default); `stab` replaces its intent. `buildAllLayers` only branches on `=== "muted"`, so renaming the other variant is safe there until Task 2.

- [ ] **Step 1: Update the failing tests**

In `src/progressions/audio/patterns.test.ts`, replace the body of `describe("funk-scratch chord comp", ...)` (the two `it(...)` blocks) with:

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

  it("marks the one as a ringing down-stab and includes muted ghost scratches", () => {
    const byBeat = new Map(funk.hits.map((h) => [h.beat, h]));
    const one = byBeat.get(0)!;
    expect(one.articulation).toBe("stab");
    expect(one.direction).toBe("down");
    expect(funk.hits.some((h) => h.articulation === "muted")).toBe(true);
    expect(funk.hits.some((h) => h.articulation === "stab")).toBe(true);
  });

  it("adds two syncopated ring-stabs on the and-of-2 and and-of-3", () => {
    const byBeat = new Map(funk.hits.map((h) => [h.beat, h]));
    expect(byBeat.get(1.5)!.articulation).toBe("stab");
    expect(byBeat.get(2.75)!.articulation).toBe("stab");
    expect(funk.hits.filter((h) => h.articulation === "stab")).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "funk-scratch chord comp"`
Expected: FAIL — `byBeat.get(0)!.articulation` is `"accent"`, not `"stab"`; beat 1.5/2.75 are currently `"muted"`.

- [ ] **Step 3: Rename the type and its doc comment**

In `src/progressions/audio/patterns.ts`, change line 16:

```ts
export type ChordArticulation = "muted" | "stab";
```

And update the `ChordHit.articulation` doc comment (~lines 39-41) to:

```ts
  /** Note-length intent for the strum voice. "muted" chokes the stroke short
   *  (chicken-scratch ghost); "stab" rings clearly (and carries spicy voicing);
   *  omitted rings for the patch's default note duration. */
  articulation?: ChordArticulation;
```

- [ ] **Step 4: Rewrite the `funk-scratch` comp**

Replace the entire `funk-scratch` object (~lines 158-173) with:

```ts
  {
    id: "funk-scratch",
    label: "Funk Scratch",
    // James Brown "one + syncopated stabs": a hard ringing chord stab on the
    // one, plus two syncopated ring-stabs (the "and of 2" and "and of 3"), with
    // muted ghost scratches weaving between. "stab" hits ring (and carry spicy
    // extensions, added in buildAllLayers); "muted" hits choke short via the
    // strum voice. Alternating down/up strokes emulate the funk wrist motion.
    hits: [
      { beat: 0, velocity: 0.98, direction: "down", articulation: "stab" },
      { beat: 0.5, velocity: 0.25, direction: "up", articulation: "muted" },
      { beat: 0.75, velocity: 0.3, direction: "up", articulation: "muted" },
      { beat: 1.25, velocity: 0.22, direction: "down", articulation: "muted" },
      { beat: 1.5, velocity: 0.8, direction: "up", articulation: "stab" },
      { beat: 1.75, velocity: 0.25, direction: "up", articulation: "muted" },
      { beat: 2.5, velocity: 0.28, direction: "up", articulation: "muted" },
      { beat: 2.75, velocity: 0.82, direction: "up", articulation: "stab" },
      { beat: 3.5, velocity: 0.3, direction: "up", articulation: "muted" },
      { beat: 3.75, velocity: 0.26, direction: "up", articulation: "muted" },
    ],
  },
```

- [ ] **Step 5: Run the full pattern + genre test files to verify green**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts src/progressions/audio/genres.test.ts`
Expected: PASS (no remaining `"accent"` references in these files; `genres.test.ts` only checks the pattern id, unchanged).

- [ ] **Step 6: Typecheck (catches any stray `"accent"` reference)**

Run: `pnpm exec tsc -b`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): funk comp = one + two syncopated ring-stabs

Rename ChordArticulation accent->stab and rewrite funk-scratch: a ringing
down-stab on the one plus syncopated ring-stabs on the and-of-2 and and-of-3,
muted ghost scratches between."
```

---

## Task 2: Add `STAB_STRUM_DURATION_SEC` and map stab hits to a longer ring

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts` (const ~81, chord-strum emission ~224, export both consts)
- Test: `src/progressions/audio/buildAllLayers.test.ts` (new cases in `describe("chord strum durationSec emission")` ~181)

**Context:** Today the emission maps `muted → 0.06`, everything else → `undefined`. We add a `stab → ~0.4` branch so stabs ring longer than the patch default, and export both consts so the recurrence-margin guard can assert on them.

- [ ] **Step 1: Write the failing tests**

In `src/progressions/audio/buildAllLayers.test.ts`, update the import on line 2 to:

```ts
import {
  buildAllLayersAsync,
  articulationToDurationSec,
  MUTED_STRUM_DURATION_SEC,
  STAB_STRUM_DURATION_SEC,
} from "./buildAllLayers";
```

Then add these cases inside `describe("chord strum durationSec emission", ...)` (after the existing `it(...)` at ~line 191):

```ts
    it("emits stab strums that ring, and ghost strums that choke (funk-scratch)", async () => {
      const layers = await buildAllLayersAsync({
        ...baseInput,
        chordPatternId: "funk-scratch",
        steps: [step({ duration: { value: 1, unit: "bar" } })],
      });
      const durs = layers.chordStrums.map((s) => s.value.durationSec);
      expect(durs.length).toBeGreaterThan(0);
      expect(durs.every((d) => typeof d === "number")).toBe(true);
      const min = Math.min(...(durs as number[]));
      const max = Math.max(...(durs as number[]));
      expect(min).toBeCloseTo(MUTED_STRUM_DURATION_SEC);
      expect(max).toBe(STAB_STRUM_DURATION_SEC);
    });

    it("rings the stab well above the muted choke (recurrence guard)", () => {
      // Root-cause guard: the prior pass had no ring/choke separation, so the
      // accent never read as a strummed chord. Keep a real margin.
      expect(STAB_STRUM_DURATION_SEC).toBeGreaterThan(MUTED_STRUM_DURATION_SEC * 4);
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts -t "durationSec emission"`
Expected: FAIL — `STAB_STRUM_DURATION_SEC` is not exported (import error), and stab hits currently emit `undefined`.

- [ ] **Step 3: Add and export the constant**

In `src/progressions/audio/buildAllLayers.ts`, change the `MUTED_STRUM_DURATION_SEC` declaration (~line 81) to export both:

```ts
/** Note length (seconds) for a muted chicken-scratch strum stroke — choked
 *  short so it reads as percussion, not a ringing chord. */
export const MUTED_STRUM_DURATION_SEC = 0.06;
/** Note length (seconds) for an accented funk "stab" — long enough to read as a
 *  ringing strummed chord (the patch sustain lets it ring), unlike the choke. */
export const STAB_STRUM_DURATION_SEC = 0.4;
```

- [ ] **Step 4: Map stab hits in the chord-strum emission**

In the same file, replace the `durationSec` line in the `chordStrums.push({ ... })` block (~line 224):

```ts
              durationSec:
                hit.articulation === "muted"
                  ? MUTED_STRUM_DURATION_SEC
                  : hit.articulation === "stab"
                    ? STAB_STRUM_DURATION_SEC
                    : undefined,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts -t "durationSec emission"`
Expected: PASS. (The existing "leaves durationSec undefined for a pattern with no muted hits" test uses `straight-quarters`, which has no `muted`/`stab` hits, so it still passes.)

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): ring funk stabs via STAB_STRUM_DURATION_SEC

Map stab hits to a 0.4s ring (vs the 0.06s muted choke) so the accented funk
chord reads as a strummed chord. Export both consts for the margin guard."
```

---

## Task 3: Pure `extendFunkVoicing` helper (spicy voicing per quality)

**Files:**
- Modify: `src/progressions/progressionAudio.ts` (add helper + a quality→extension table; reuses the existing private `PROGRESSION_CHORD_ROOT_OCTAVE`)
- Test: `src/progressions/progressionAudio.test.ts` (new `describe("extendFunkVoicing")`)

**Context:** `CHORD_DEFINITIONS` has no 9/11/13, so spice is interval math layered on top of the resolved voicing. Tones are computed from the chord root at the chord's root octave; `+10`=b7, `+14`=9, `+21`=13 naturally land above the triad. Pure, no Tone.js. `NOTES` is `["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]`.

- [ ] **Step 1: Write the failing tests**

In `src/progressions/progressionAudio.test.ts`, update the import on line 2 to add `extendFunkVoicing`:

```ts
import { resolveBassLineNotes, resolveChordVoicing, resolveBassNoteForRole, extendFunkVoicing } from "./progressionAudio";
```

Add this `describe` block at the end of the file:

```ts
describe("extendFunkVoicing", () => {
  it("turns a major triad into a dominant-9 (adds b7 + 9)", () => {
    // C major C3 E3 G3  ->  + A#3 (b7) + D4 (9)
    expect(extendFunkVoicing(["C3", "E3", "G3"], "C", "M")).toEqual([
      "C3", "E3", "G3", "A#3", "D4",
    ]);
  });

  it("turns a minor triad into m9 (adds b7 + 9)", () => {
    // A minor A3 C4 E4  ->  + G4 (b7) + B4 (9)
    expect(extendFunkVoicing(["A3", "C4", "E4"], "A", "m")).toEqual([
      "A3", "C4", "E4", "G4", "B4",
    ]);
  });

  it("adds only the 9 to a m7 (b7 already present) -> m9", () => {
    const out = extendFunkVoicing(["D3", "F3", "A3", "C4"], "D", "m7");
    expect(out).toEqual(["D3", "F3", "A3", "C4", "E4"]);
  });

  it("adds 9 and 13 to a dominant 7", () => {
    // G7 G3 B3 D4 F4  ->  + A4 (9) + E5 (13)
    expect(extendFunkVoicing(["G3", "B3", "D4", "F4"], "G", "7")).toEqual([
      "G3", "B3", "D4", "F4", "A4", "E5",
    ]);
  });

  it("adds 9 to a maj7 but never a b7 (stays major) -> maj9", () => {
    const out = extendFunkVoicing(["C3", "E3", "G3", "B3"], "C", "maj7");
    expect(out).toEqual(["C3", "E3", "G3", "B3", "D4"]);
    expect(out).not.toContain("A#3"); // no dominant b7
  });

  it("leaves dim / aug / sus / 6 untouched (avoid clashes)", () => {
    for (const q of ["dim", "aug", "m7b5", "sus2", "sus4", "6", "m6", "5"]) {
      const base = ["C3", "E3", "G3"];
      expect(extendFunkVoicing(base, "C", q), q).toEqual(base);
    }
  });

  it("does not re-add a tone already in the voicing", () => {
    // Voicing already contains D4 (the 9); must not duplicate it.
    const out = extendFunkVoicing(["C3", "E3", "G3", "D4"], "C", "maj7");
    expect(out.filter((n) => n === "D4")).toHaveLength(1);
  });

  it("does not mutate its input array", () => {
    const input = ["C3", "E3", "G3"];
    extendFunkVoicing(input, "C", "M");
    expect(input).toEqual(["C3", "E3", "G3"]);
  });

  it("returns the voicing unchanged for an unknown root or empty voicing", () => {
    expect(extendFunkVoicing([], "C", "M")).toEqual([]);
    expect(extendFunkVoicing(["C3"], "H", "M")).toEqual(["C3"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/progressions/progressionAudio.test.ts -t extendFunkVoicing`
Expected: FAIL — `extendFunkVoicing` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/progressions/progressionAudio.ts`, after `resolveChordVoicing` (~line 53) add:

```ts
/**
 * Funk color tones to layer on top of a resolved voicing, as semitone offsets
 * above the chord root (computed at the chord's root octave, so +10/+14/+21
 * naturally land at/above the triad). Qualities not listed get no extensions
 * (dim/aug/sus/6 would clash). Used only on "stab" hits — see buildAllLayers.
 *   +10 = b7,  +14 = 9,  +21 = 13
 */
const FUNK_EXTENSION_SEMITONES: Record<string, readonly number[]> = {
  M: [10, 14], // -> dominant 9 (the James Brown "E9" sound)
  m: [10, 14], // -> m9
  m7: [14], // already has b7 -> m9
  "7": [14, 21], // -> 9 / 13
  maj7: [14], // -> maj9 (no b7; stays major)
};

/**
 * Layer idiomatic funk extensions onto a resolved chord voicing. Pure: returns
 * a new array, never mutates the input. Returns the input unchanged when the
 * quality has no funk extension, the root is unknown, or the voicing is empty.
 */
export function extendFunkVoicing(
  voicing: string[],
  root: string,
  quality: string,
): string[] {
  const offsets = FUNK_EXTENSION_SEMITONES[quality];
  if (!offsets || voicing.length === 0) return voicing;
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return voicing;

  const base = PROGRESSION_CHORD_ROOT_OCTAVE * 12 + rootIndex;
  const existing = new Set(voicing);
  const added: string[] = [];
  for (const semitone of offsets) {
    const absolute = base + semitone;
    const note = NOTES[((absolute % 12) + 12) % 12];
    const pitch = `${note}${Math.floor(absolute / 12)}`;
    if (!existing.has(pitch)) {
      existing.add(pitch);
      added.push(pitch);
    }
  }
  return [...voicing, ...added];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/progressions/progressionAudio.test.ts -t extendFunkVoicing`
Expected: PASS (all 9 cases).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/progressionAudio.ts src/progressions/progressionAudio.test.ts
git commit -m "feat(progressions): extendFunkVoicing adds spicy tones per quality

Pure helper layering b7/9/13 color tones onto a voicing by chord quality
(M->dom9, m->m9, 7->9/13, maj7->maj9; dim/aug/sus left alone). De-dups and
never mutates input."
```

---

## Task 4: Apply spicy voicing to stab hits in `buildAllLayers`

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts` (import `extendFunkVoicing`; compute spicy voicing per step ~178; select per hit ~220)
- Test: `src/progressions/audio/buildAllLayers.test.ts` (new case in `describe("buildAllLayers")`)

**Context:** "Not on every beat" — stab hits get the extended voicing, muted/plain hits keep `resolveChordVoicing`. Compute the spicy voicing once per chord step.

- [ ] **Step 1: Write the failing test**

In `src/progressions/audio/buildAllLayers.test.ts`, add this case inside `describe("buildAllLayers", ...)` (e.g. after the strum-emission test at ~line 87):

```ts
  it("gives funk stab hits the spicy (extended) voicing while ghosts stay plain", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "funk-scratch",
      steps: [step({ root: "C", quality: "M", duration: { value: 1, unit: "bar" } })],
    });
    const sizes = out.chordStrums.map((s) => s.value.voicing.length);
    // C major plain = 3 notes; stab (dominant-9) = 5 notes.
    expect(Math.min(...sizes)).toBe(3);
    expect(Math.max(...sizes)).toBe(5);
    // The one (beat 0, time 0) is a stab -> spicy.
    const one = out.chordStrums.find((s) => s.time === 0)!;
    expect(one.value.voicing).toEqual(["C3", "E3", "G3", "A#3", "D4"]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts -t "spicy"`
Expected: FAIL — all strums currently carry the same 3-note plain voicing.

- [ ] **Step 3: Import the helper**

In `src/progressions/audio/buildAllLayers.ts`, add `extendFunkVoicing` to the existing import from `"../progressionAudio"` (lines 1-5):

```ts
import {
  resolveBassNoteForRole,
  resolveChordVoicing,
  resolveBassLineNotes,
  extendFunkVoicing,
} from "../progressionAudio";
```

- [ ] **Step 4: Compute the spicy voicing per step**

Just after the `const voicing = resolveChordVoicing(...)` block (~line 178-181), add:

```ts
    const spicyVoicing = extendFunkVoicing(voicing, root, quality);
```

- [ ] **Step 5: Select voicing per hit in the chord-strum emission**

In the `chordStrums.push({ ... })` block, change the `voicing,` shorthand (~line 220) to:

```ts
              voicing: hit.articulation === "stab" ? spicyVoicing : voicing,
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts -t "spicy"`
Expected: PASS.

- [ ] **Step 7: Run the whole buildAllLayers suite (no regressions)**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): apply spicy voicing to funk stab hits only

Stab hits carry extendFunkVoicing output; muted ghosts keep the plain voicing,
so the color lands on the ringing chords, not the scratch."
```

---

## Task 5: Give `chord-funk-scratch` a sustain so stabs actually ring

**Files:**
- Modify: `src/progressions/audio/sound/instrumentPatches.ts` (`chord-funk-scratch` envelope ~117)
- Test: `src/progressions/audio/sound/instrumentPatches.test.ts` (extend the funk-scratch patch test ~91-98)

**Context:** This is the root cause from the spec. `sustain: 0` makes every note die in ~0.18s no matter the held duration, so the stab can't ring. A small sustain lets the 0.4s stab hold ring while the 0.06s ghost still chokes (short release). The default `noteDurationSec` stays ≤0.3 (existing guard).

- [ ] **Step 1: Update the failing test**

In `src/progressions/audio/sound/instrumentPatches.test.ts`, replace the `it("provides a short-decay funk scratch guitar patch", ...)` block (~lines 91-98) with:

```ts
  it("provides a funk scratch guitar patch that can both choke and ring", () => {
    const patch = getChordPatch("chord-funk-scratch")!;
    expect(patch).toBeDefined();
    expect(patch.family).toBe("strum");
    // Root-cause guard: sustain MUST be > 0 so a held stab rings as a strummed
    // chord (sustain:0 made every note die in ~0.18s, the prior bug)...
    expect(patch.strum!.envelope.sustain).toBeGreaterThan(0);
    // ...but the default stroke stays short so muted ghosts still scratch and
    // don't bloom like the 1.8s acoustic steel strum.
    expect(patch.strum!.noteDurationSec).toBeLessThanOrEqual(0.3);
    // A short release keeps the choked ghost tight despite the sustain.
    expect(patch.strum!.envelope.release).toBeLessThanOrEqual(0.15);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/sound/instrumentPatches.test.ts -t "funk scratch"`
Expected: FAIL — `envelope.sustain` is currently `0`.

- [ ] **Step 3: Rework the patch envelope**

In `src/progressions/audio/sound/instrumentPatches.ts`, update the `chord-funk-scratch` `strum` block (~lines 112-119). Change only the envelope (keep oscillator partials, `noteDurationSec`, `releaseTailSec`, and the insert EQ):

```ts
      // Bright single-coil chicken-scratch: upper-harmonic-weighted partials so
      // muted scratches cut on small speakers. A small sustain lets a held
      // "stab" ring as a strummed chord, while the short release keeps the
      // 0.06s muted ghost choked tight. Hold duration (durationSec) decides
      // ring vs. choke — exactly like a fretting hand muting vs. sustaining.
      oscillator: { type: "custom", partials: [1, 0.9, 0.7, 0.5, 0.35, 0.25, 0.15] },
      envelope: { attack: 0.004, decay: 0.12, sustain: 0.22, release: 0.09 },
      noteDurationSec: 0.18, releaseTailSec: 0.4,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/sound/instrumentPatches.test.ts -t "funk scratch"`
Expected: PASS.

- [ ] **Step 5: Run the patch + mix-preset suites (the genreMixPresets short-decay guard still holds)**

Run: `pnpm vitest run src/progressions/audio/sound/instrumentPatches.test.ts src/progressions/audio/sound/genreMixPresets.test.ts`
Expected: PASS (`noteDurationSec` is still 0.18 ≤ 0.3).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/sound/instrumentPatches.ts src/progressions/audio/sound/instrumentPatches.test.ts
git commit -m "fix(progressions): funk scratch patch sustain so stabs ring

Root cause of 'the one isn't strummed': sustain:0 killed every note in ~0.18s.
Add sustain:0.22 + short release so held stabs ring while ghosts still choke."
```

---

## Task 6: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: pass (eslint + stylelint).

- [ ] **Step 2: Full test suite**

Run: `pnpm run test`
Expected: pass — all suites green, no remaining `"accent"` chord-articulation references.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: `tsc -b` exit 0 + vite build success.

- [ ] **Step 4: Confirm clean tree**

Run: `git status --porcelain`
Expected: empty (all task commits already made).

---

## Self-Review

**Spec coverage:**
- §1 Articulation model (`muted | stab`) → Task 1. ✓
- §2 Patch envelope sustain + `STAB_STRUM_DURATION_SEC` + per-hit mapping → Tasks 2 (duration map) + 5 (envelope). ✓
- §3 Spicy voicing per quality, stabs only → Tasks 3 (helper) + 4 (selection). ✓
- §4 New one+syncopated-stabs rhythm → Task 1. ✓
- §5 Data flow (already plumbed) → consumed by Tasks 2 & 4; no new plumbing. ✓
- §Testing guards: ring margin (T2), envelope root-cause (T5), per-quality + dedup + no-mutation (T3), voicing-selection "not on every beat" (T4), comp shape (T1). ✓

**Placeholder scan:** none — every code step shows complete code and exact commands.

**Type consistency:** `ChordArticulation = "muted" | "stab"` (T1) used consistently in T2 (`=== "stab"`) and T4 (`=== "stab"`). `STAB_STRUM_DURATION_SEC` / `MUTED_STRUM_DURATION_SEC` exported in T2 and imported by the T2 test. `extendFunkVoicing(voicing, root, quality)` signature defined in T3 matches the call in T4. Patch fields (`envelope.sustain`, `envelope.release`, `noteDurationSec`) match `patchTypes.ts`. ✓
