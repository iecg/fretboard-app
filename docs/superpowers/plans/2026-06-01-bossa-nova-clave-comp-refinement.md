# Bossa-Nova Clave & Comp Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the bossa-nova clave (son → bossa) and rework the comp into ringing, rootless jazz 7th/9th voicings over a syncopated 2-bar figure with anticipations.

**Architecture:** A new pure `buildBossaColorVoicing` (rootless maj9/m9/dom9, middle register) mirrors the existing `buildFunkColorVoicing`. An opt-in `ChordPattern.voicing: "rootless-jazz"` field routes the `bossa-comp` chords through it in `buildAllLayersAsync`. The clave fix and comp rhythm/articulation are data changes to existing patterns. Non-bossa patterns are byte-identical (the `voicing` field defaults to undefined).

**Tech Stack:** TypeScript, Tone.js, Vitest. Package manager **pnpm**. Co-located tests.

**Spec:** `docs/superpowers/specs/2026-06-01-bossa-nova-clave-comp-refinement-design.md`

**Builds on:** the pass-1 bossa work already on this branch (2-bar cell mechanism, cross-stick voice, `bossa`/`bossa-comp` patterns).

---

## File-by-file map

- `src/progressions/progressionAudio.ts` — add `BOSSA_COLOR_TONES`, `BOSSA_COMP_ROOT_OCTAVE`, `buildBossaColorVoicing`.
- `src/progressions/audio/patterns.ts` — add `ChordPattern.voicing`; fix `bossa` drum `crossStick` last hit `6 → 6.5`; rewrite `bossa-comp` hits (rhythm + `style:"sustained"` + `voicing`).
- `src/progressions/audio/buildAllLayers.ts` — import `buildBossaColorVoicing`; compute `compVoicing`; use it as the comp hits' base voicing.
- Tests: `progressionAudio.test.ts`, `patterns.test.ts`, `buildAllLayers.test.ts`.

---

## Task 1: Rootless jazz comp voicing (`buildBossaColorVoicing`)

**Files:**
- Modify: `src/progressions/progressionAudio.ts`
- Test: `src/progressions/progressionAudio.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/progressions/progressionAudio.test.ts`. First add `buildBossaColorVoicing` to the existing import on line 2 (it currently imports `resolveBassLineNotes, resolveChordVoicing, resolveBassNoteForRole, buildFunkColorVoicing`). Then add this `describe`:

```ts
describe("buildBossaColorVoicing", () => {
  const PC: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  const pcSet = (notes: readonly string[]) => new Set(notes.map((n) => n.replace(/-?\d+$/, "")));
  const midi = (n: string) => { const m = n.match(/^([A-G]#?)(-?\d+)$/)!; return PC[m[1]] + (parseInt(m[2], 10) + 1) * 12; };

  it("voices a major chord as a rootless maj9 (3 / 7 / 9) in the middle register", () => {
    // C maj9 rootless: E (3), B (maj7), D (9), starting in octave 4.
    expect(buildBossaColorVoicing("C", "maj7")).toEqual(["E4", "B4", "D5"]);
    // plain major M shares the maj9 offsets [4,11,14].
    expect(buildBossaColorVoicing("C", "M")).toEqual(["E4", "B4", "D5"]);
  });

  it("voices a minor 7 chord as a rootless m9 (b3 / b7 / 9)", () => {
    // A m9 rootless: C (b3), G (b7), B (9).
    expect(buildBossaColorVoicing("A", "m7")).toEqual(["C5", "G5", "B5"]);
    expect(pcSet(buildBossaColorVoicing("A", "m7")).has("A")).toBe(false); // rootless
  });

  it("voices a dominant 7 chord as a rootless dom9 (3 / b7 / 9)", () => {
    const v = buildBossaColorVoicing("G", "7");
    expect(pcSet(v)).toEqual(new Set(["B", "F", "A"])); // 3=B, b7=F, 9=A
    expect(pcSet(v).has("G")).toBe(false); // rootless — the bass covers the root
  });

  it("keeps every defined voicing rootless and in the middle register (C4..C#6)", () => {
    for (const [root, quality] of [["C", "maj7"], ["D", "M"], ["E", "m7"], ["G", "7"], ["B", "maj7"]] as const) {
      const v = buildBossaColorVoicing(root, quality);
      expect(pcSet(v).has(root), `${root}${quality} rootless`).toBe(false);
      for (const n of v) {
        const m = midi(n);
        expect(m, `${root}${quality} ${n} low`).toBeGreaterThanOrEqual(60); // >= C4 (not the funk octave-3 grip)
        expect(m, `${root}${quality} ${n} high`).toBeLessThanOrEqual(86);   // <= ~C#6
      }
    }
  });

  it("falls back to the plain voice-led triad for a quality without a grip", () => {
    expect(buildBossaColorVoicing("C", "dim")).toEqual(resolveChordVoicing("C", "dim", undefined, undefined));
  });

  it("returns [] for an unknown root", () => {
    expect(buildBossaColorVoicing("H", "maj7")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/progressionAudio.test.ts -t buildBossaColorVoicing`
Expected: FAIL — `buildBossaColorVoicing is not a function` (plus an import error on the missing export).

- [ ] **Step 3: Implement `buildBossaColorVoicing`**

In `src/progressions/progressionAudio.ts`, add this directly below the existing `buildFunkColorVoicing` function (it reuses the file-level `NOTES`, `resolveChordVoicing`, and `PROGRESSION_CHORD_ROOT_OCTAVE` already in scope):

```ts
/**
 * Rootless jazz comp tones per chord quality, as semitone offsets above the
 * chord root. The root (offset 0) is omitted — the bossa bass covers it.
 * 7ths + 9ths, the bossa comp idiom. Qualities not listed get the plain triad.
 *   +3 = b3, +4 = 3, +10 = b7, +11 = maj7, +14 = 9
 */
const BOSSA_COLOR_TONES: Record<string, readonly number[]> = {
  maj7: [4, 11, 14], // 3 / 7 / 9 — maj9
  M: [4, 11, 14], // plain major voiced as maj9 (bossa idiom)
  m7: [3, 10, 14], // b3 / b7 / 9 — m9
  m: [3, 10, 14], // m9
  "7": [4, 10, 14], // 3 / b7 / 9 — dom9
};

/** Middle-register piano comp octave — true comp register, an octave above the
 *  guitar-ish octave-3 funk grip. */
const BOSSA_COMP_ROOT_OCTAVE = 4;

/**
 * Build a rootless jazz comp voicing (7th + 9th colour) for a chord, in the
 * middle piano register. Pure. Mirrors `buildFunkColorVoicing`'s open-ascending
 * shape: each colour tone is an absolute pitch (comp octave + offset). Falls
 * back to the plain voice-led triad when the quality has no defined grip
 * (dim/aug/sus/6). Returns [] for an unknown root. `prevVoicing` is accepted for
 * the triad fallback; the colour tones use a fixed open shape (voice-leading the
 * rootless grips is a future refinement).
 */
export function buildBossaColorVoicing(
  root: string,
  quality: string,
  prevVoicing?: string[],
): string[] {
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return [];
  const offsets = BOSSA_COLOR_TONES[quality];
  if (!offsets) {
    return resolveChordVoicing(root, quality, undefined, prevVoicing);
  }
  const base = BOSSA_COMP_ROOT_OCTAVE * 12 + rootIndex;
  return offsets.map((o) => {
    const absolute = base + o;
    const note = NOTES[((absolute % 12) + 12) % 12];
    return `${note}${Math.floor(absolute / 12)}`;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/progressionAudio.test.ts -t buildBossaColorVoicing`
Expected: PASS (6 tests). Then run the full file `pnpm exec vitest run src/progressions/progressionAudio.test.ts` — expect all pass.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/progressionAudio.ts src/progressions/progressionAudio.test.ts
git commit -m "feat(progressions): rootless jazz bossa comp voicing (Slice 2 §3.5 pass 2)"
```

---

## Task 2: Clave fix + comp rewrite (data)

**Files:**
- Modify: `src/progressions/audio/patterns.ts`
- Test: `src/progressions/audio/patterns.test.ts`, `src/progressions/audio/buildAllLayers.test.ts`

This task changes pattern data, which breaks three pass-1 assertions that hardcode the old beats. Update those assertions to the new values **and** add the new ones, then change the data.

- [ ] **Step 1: Update + add the failing test assertions**

(a) In `src/progressions/audio/patterns.test.ts`, find the `describe("bossa patterns")` block. Replace the crossStick assertion and the comp assertion with the new values, and add the new `voicing` / `style` checks. The block's three `it`s become:

```ts
  it("rewrites the bossa drum pattern as a 2-bar cell with a son-clave cross-stick", () => {
    const bossa = getDrumPattern("bossa")!;
    expect(bossa.bars).toBe(2);
    expect(bossa.snares).toEqual([]); // cross-stick carries the rhythm
    // Authentic 3-2 bossa clave: 2-side's last note on "3&" (6.5), not son's "3" (6).
    expect(bossa.crossStick?.map((h) => h.beat)).toEqual([0, 1.5, 3, 5, 6.5]);
  });

  it("adds a 1-bar root-fifth bossa bass pattern", () => {
    const bass = getBassPattern("bossa")!;
    expect(bass.bars ?? 1).toBe(1);
    expect(bass.hits.map((h) => h.note)).toEqual(["root", "fifth"]);
  });

  it("adds a 2-bar syncopated bossa comp with rootless-jazz voicing and ringing chords", () => {
    const comp = getChordPattern("bossa-comp")!;
    expect(comp.bars).toBe(2);
    expect(comp.voicing).toBe("rootless-jazz");
    expect(comp.hits.map((h) => h.beat)).toEqual([0, 1.5, 3.5, 4.5, 6, 7.5]);
    expect(comp.hits.every((h) => h.style === "sustained")).toBe(true);
  });
```

(b) In `src/progressions/audio/buildAllLayers.test.ts`, two pass-1 tests hardcode the old beats. Update them:

- The test titled `"plays the bar-2 clave hits on the second bar of a 2-bar cell"` asserts `expect(crossSticks).toEqual([0, 1.5, 3, 5, 6]);` — change it to:
  ```ts
    expect(crossSticks).toEqual([0, 1.5, 3, 5, 6.5]);
  ```
- The test titled `"plays the bossa comp's bar-2 syncopations on the second bar"` asserts `expect(out.chordStrums.map((s) => s.time)).toEqual([0, 1.5, 3, 4.5, 6, 7.5]);` — change it to:
  ```ts
    expect(out.chordStrums.map((s) => s.time)).toEqual([0, 1.5, 3.5, 4.5, 6, 7.5]);
  ```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts -t "bossa patterns"`
Expected: FAIL — crossStick is still `[…,6]`, comp beats are still `[…,3,…]`, and `comp.voicing` is `undefined`.

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "bar-2"`
Expected: FAIL — old hardcoded beats.

- [ ] **Step 3: Add the `voicing` field to `ChordPattern`**

In `src/progressions/audio/patterns.ts`, extend the `ChordPattern` interface:

```ts
export interface ChordPattern {
  id: string;
  label: string;
  hits: readonly ChordHit[];
  /** Cell length in bars (default 1). When > 1, `hits` span 0..bars*beatsPerBar
   *  and the scheduler selects one bar per `absoluteBar % bars`. */
  bars?: number;
  /** Voicing strategy for this comp. Omitted = the default chord voicing.
   *  "rootless-jazz" = buildBossaColorVoicing (rootless 7th/9th, mid register). */
  voicing?: "rootless-jazz";
}
```

- [ ] **Step 4: Fix the clave**

In `src/progressions/audio/patterns.ts`, in the `bossa` entry of `DRUM_PATTERNS`, change the final `crossStick` hit from `beat: 6` to `beat: 6.5`:

```ts
    crossStick: [
      { beat: 0, velocity: 0.8 },
      { beat: 1.5, velocity: 0.7 },
      { beat: 3, velocity: 0.75 },
      { beat: 5, velocity: 0.7 },
      { beat: 6.5, velocity: 0.8 },
    ],
```

- [ ] **Step 5: Rewrite the comp**

In `src/progressions/audio/patterns.ts`, replace the `bossa-comp` entry in `CHORD_PATTERNS` with:

```ts
  {
    id: "bossa-comp",
    label: "Bossa Comp",
    bars: 2,
    voicing: "rootless-jazz",
    // Highly syncopated 2-bar partido-alto: clave-locked, two cross-barline
    // anticipations (3.5, 7.5), soft acoustic dynamics, chords ring (sustained).
    hits: [
      // bar 1
      { beat: 0, velocity: 0.6, style: "sustained" }, // downbeat anchor
      { beat: 1.5, velocity: 0.55, style: "sustained" }, // "& of 2" (clave)
      { beat: 3.5, velocity: 0.6, style: "sustained" }, // "& of 4" anticipates bar 2
      // bar 2
      { beat: 4.5, velocity: 0.55, style: "sustained" }, // "& of 1"
      { beat: 6, velocity: 0.5, style: "sustained" }, // beat 3 (clave)
      { beat: 7.5, velocity: 0.65, style: "sustained" }, // "& of 4" anticipates next cycle
    ],
  },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts src/progressions/audio/buildAllLayers.test.ts`
Expected: PASS — both files fully green (the updated bossa-patterns assertions, the updated bar-2 clave/comp time assertions, and the existing pass-1 suite).

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): authentic bossa clave + ringing syncopated comp (Slice 2 §3.5 pass 2)"
```

---

## Task 3: Wire the rootless comp voicing into the scheduler

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts`
- Test: `src/progressions/audio/buildAllLayers.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/progressions/audio/buildAllLayers.test.ts`, inside the top-level `describe("buildAllLayers", ...)` block:

```ts
  it("voices the bossa comp as rootless jazz chords (no root note)", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "bossa-comp",
      drumPatternId: "bossa",
      bassPatternId: "bossa",
      steps: [step({ duration: { value: 2, unit: "bar" } })], // C major
    });
    // C major → rootless maj9 in the middle register: E4 / B4 / D5, no C.
    expect(out.chordStrums[0].value.voicing).toEqual(["E4", "B4", "D5"]);
    expect(out.chordStrums.every((s) => !s.value.voicing.some((n) => n.startsWith("C") && !n.startsWith("C#")))).toBe(true);
  });

  it("leaves a default-voicing comp (jazz) using the standard rooted voicing", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "jazz-comp",
      steps: [step({ duration: { value: 1, unit: "bar" } })], // C major
    });
    // Default path: resolveChordVoicing keeps the root present (C3/E3/G3).
    expect(out.chordStrums[0].value.voicing.some((n) => n === "C3")).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "rootless jazz"`
Expected: FAIL — the comp still resolves the default voicing (`["C3","E3","G3"]`), so `chordStrums[0].value.voicing` is not `["E4","B4","D5"]`.

- [ ] **Step 3: Import `buildBossaColorVoicing`**

In `src/progressions/audio/buildAllLayers.ts`, the top imports from `"../progressionAudio"` currently read:

```ts
import {
  resolveBassNoteForRole,
  resolveChordVoicing,
  resolveBassLineNotes,
  buildFunkColorVoicing,
} from "../progressionAudio";
```

Add `buildBossaColorVoicing`:

```ts
import {
  resolveBassNoteForRole,
  resolveChordVoicing,
  resolveBassLineNotes,
  buildFunkColorVoicing,
  buildBossaColorVoicing,
} from "../progressionAudio";
```

- [ ] **Step 4: Compute the comp voicing**

In `src/progressions/audio/buildAllLayers.ts`, the per-step voicing-intent block currently ends with:

```ts
    const rootNoteVoicing =
      needsRootAnchor && plainVoicing.length > 0 ? [plainVoicing[0]] : voicing;
    const bassLineNotes = resolveBassLineNotes(root, quality);
```

Insert the comp-voicing computation between those two lines:

```ts
    const rootNoteVoicing =
      needsRootAnchor && plainVoicing.length > 0 ? [plainVoicing[0]] : voicing;
    // Rootless jazz comp voicing (bossa) — opt-in per pattern. Falls back to the
    // default voicing for every other comp.
    const compVoicing =
      chordPattern?.voicing === "rootless-jazz"
        ? buildBossaColorVoicing(root, quality, lastVoicing)
        : voicing;
    const bassLineNotes = resolveBassLineNotes(root, quality);
```

- [ ] **Step 5: Use the comp voicing as the hits' base voicing**

In `src/progressions/audio/buildAllLayers.ts`, in the chord-strum push, the `voicing` selection currently reads:

```ts
              voicing:
                hit.articulation === "color-stab"
                  ? colorVoicing
                  : hit.articulation === "root"
                    ? rootNoteVoicing
                    : voicing,
```

Change the final fallback from `voicing` to `compVoicing`:

```ts
              voicing:
                hit.articulation === "color-stab"
                  ? colorVoicing
                  : hit.articulation === "root"
                    ? rootNoteVoicing
                    : compVoicing,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts`
Expected: PASS — all tests in the file (the two new voicing tests + the full existing suite). The default-voicing genres are unaffected (`compVoicing === voicing` when no `voicing` field).

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): route bossa comp through rootless jazz voicing (Slice 2 §3.5 pass 2)"
```

---

## Task 4: Full verification + ear audition

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit suite**

Run: `pnpm run test`
Expected: PASS — all suites green.

- [ ] **Step 2: Lint**

Run: `pnpm run lint`
Expected: 0 errors. (A pre-existing warning in `src/hooks/useFretboardTopologyModel.ts` is unrelated to this work — do not touch it.)

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: `tsc -b` type-checks clean and `vite build` succeeds.

- [ ] **Step 4: Manual ear audition (required by spec §6)**

Run `pnpm run dev`, open the app, select the **Bossa Nova** genre, load a ≥4-bar progression, play the backing track. Confirm by ear:
- the cross-stick reads as the **bossa** clave (the last clave note now pushes to the "& of 3"), not the previous son pattern;
- the comp rings as **rootless jazz chords** (no thick root-position triads), soft and acoustic;
- the comp's two anticipations (the "& of 4" pushes) lean into the next bar;
- nothing is muddy. If the ringing chords blur, tune the piano patch's `sustainedDurationSec` (in `src/progressions/audio/sound/instrumentPatches.ts`) — do **not** revert to short stabs. Tune the §3.1/§3.4 beat tables in `patterns.ts` by ear.

Apply any tweaks as small follow-up commits:

```bash
git add -A && git commit -m "fix(progressions): tune bossa <clave|comp|ring> by ear (Slice 2 §3.5 pass 2)"
```

- [ ] **Step 5: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to integrate (the pass-1 and pass-2 work share this branch).

---

## Self-review notes

- **Spec coverage:** §3.1 clave fix → Task 2; §3.2 `buildBossaColorVoicing` → Task 1; §3.3 `ChordPattern.voicing` + `compVoicing` wiring → Task 2 (field) + Task 3 (wiring); §3.4 comp rhythm/ring/dynamics → Task 2; §4 backwards-compat → Task 3 default-voicing test; §6 testing → Tasks 1–3 + Task 4 audition. No gaps.
- **Type consistency:** `buildBossaColorVoicing` (defined Task 1, imported/used Task 3), `BOSSA_COLOR_TONES`/`BOSSA_COMP_ROOT_OCTAVE` (Task 1), `ChordPattern.voicing: "rootless-jazz"` (defined Task 2, read Task 3 as `chordPattern?.voicing === "rootless-jazz"`), `compVoicing` (Task 3) all match.
- **Broken-by-data-change tests:** the three pass-1 assertions that hardcode the old clave/comp beats are explicitly updated in Task 2 Step 1 (two in `buildAllLayers.test.ts`, one in `patterns.test.ts`), so no test is left asserting stale values.
- **Octave math verified:** `buildBossaColorVoicing("C","maj7")` → base `48`, offsets `[4,11,14]` → `E4/B4/D5`; `("A","m7")` → `C5/G5/B5`.
