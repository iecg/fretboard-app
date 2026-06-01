# Bossa-Nova Comp LH/RH Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the bossa comp into a real two-hand piano part — LH root/fifth bass + RH rootless chords — and lower the chord register so the top note never exceeds C5.

**Architecture:** `buildBossaColorVoicing` becomes a 4-note Type-B rootless voicing (7-9-3-5) based at octave 3, register-normalized so its top note ≤ C5. A new optional `ChordHit.voiceRole` lets the `bossa-comp` pattern mark bass-note hits (root@1, fifth@3) vs chord hits (off-beats); `buildAllLayersAsync` resolves bass roles to single octave-3 notes via the existing `resolveBassLineNotes`. The separate upright bass (octave 2) is unchanged.

**Tech Stack:** TypeScript, Tone.js, Vitest. Package manager **pnpm**. Co-located tests.

**Spec:** `docs/superpowers/specs/2026-06-01-bossa-comp-lh-rh-split-design.md`

**Builds on:** pass-1 + pass-2 bossa work already on this branch.

---

## File-by-file map

- `src/progressions/progressionAudio.ts` — rewrite `BOSSA_COLOR_TONES` (Type-B), `BOSSA_COMP_ROOT_OCTAVE` (4→3), add `BOSSA_COMP_TOP_CEILING`, rewrite `buildBossaColorVoicing` (Type-B + octave normalization).
- `src/progressions/audio/patterns.ts` — add `ChordHit.voiceRole`; rewrite the `bossa-comp` hits (LH bass + RH chords).
- `src/progressions/audio/buildAllLayers.ts` — add `BOSSA_LH_OCTAVE`, resolve `bassRootVoicing`/`bassFifthVoicing`, add the `voiceRole` branch to the chord-strum voicing selection.
- Tests: `progressionAudio.test.ts`, `patterns.test.ts`, `buildAllLayers.test.ts`.

**Encoding note (used throughout):** a note string's absolute semitone is `octave*12 + pitchIndex` (e.g. `"C3"` → 36, `"C5"` → 60). The test helper `midi(n) = pitchClass + (octave+1)*12`, i.e. `midi = absolute + 12`, so `C5` is midi 72.

---

## Task 1: Type-B rootless voicing + register normalization

**Files:**
- Modify: `src/progressions/progressionAudio.ts`
- Test: `src/progressions/progressionAudio.test.ts`, `src/progressions/audio/buildAllLayers.test.ts`

- [ ] **Step 1: Replace the `buildBossaColorVoicing` unit tests**

In `src/progressions/progressionAudio.test.ts`, replace the entire `describe("buildBossaColorVoicing", ...)` block with:

```ts
describe("buildBossaColorVoicing", () => {
  const PC: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  const pcSet = (notes: readonly string[]) => new Set(notes.map((n) => n.replace(/-?\d+$/, "")));
  const midi = (n: string) => { const m = n.match(/^([A-G]#?)(-?\d+)$/)!; return PC[m[1]] + (parseInt(m[2], 10) + 1) * 12; };

  it("voices a major chord as a 4-note Type-B rootless (7-9-3-5) in octave 3", () => {
    // C maj9 Type-B: B (7) / D (9) / E (3) / G (5).
    expect(buildBossaColorVoicing("C", "maj7")).toEqual(["B3", "D4", "E4", "G4"]);
    expect(buildBossaColorVoicing("C", "M")).toEqual(["B3", "D4", "E4", "G4"]);
  });

  it("normalizes a high-rooted voicing down an octave so it never floats above C5", () => {
    // A m9 Type-B would top out at E5; the normalization drops the whole voicing.
    expect(buildBossaColorVoicing("A", "m7")).toEqual(["G3", "B3", "C4", "E4"]);
  });

  it("keeps every defined voicing 4-note, rootless, and topped at or below C5 for all roots", () => {
    const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    for (const root of ROOTS) {
      for (const quality of ["maj7", "M", "m7", "m", "7"]) {
        const v = buildBossaColorVoicing(root, quality);
        expect(v, `${root}${quality} length`).toHaveLength(4);
        expect(pcSet(v).has(root), `${root}${quality} rootless`).toBe(false);
        const ms = v.map(midi);
        expect(Math.max(...ms), `${root}${quality} top <= C5`).toBeLessThanOrEqual(72); // C5
        expect(Math.min(...ms), `${root}${quality} bottom >= C3`).toBeGreaterThanOrEqual(48); // C3
      }
    }
  });

  it("falls back to the plain voice-led triad for a quality without a grip; [] for unknown root", () => {
    expect(buildBossaColorVoicing("C", "dim")).toEqual(resolveChordVoicing("C", "dim", undefined, undefined));
    expect(buildBossaColorVoicing("H", "maj7")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/progressionAudio.test.ts -t buildBossaColorVoicing`
Expected: FAIL — the function still returns the pass-2 3-note octave-4 voicing (`["E4","B4","D5"]`), not the new Type-B values.

- [ ] **Step 3: Rewrite `buildBossaColorVoicing`**

In `src/progressions/progressionAudio.ts`, replace the `BOSSA_COLOR_TONES` table, the `BOSSA_COMP_ROOT_OCTAVE` constant, and the `buildBossaColorVoicing` function with:

```ts
/**
 * Rootless Type-B (7-9-3-5) jazz comp tones per chord quality, as semitone
 * offsets above the chord root. The root is omitted — the piano LH and upright
 * bass cover it. 7th is the lowest tone, so the shape sits low for its register.
 *   +3 = b3, +4 = 3, +10 = b7, +11 = maj7, +14 = 9, +15 = b3+8ve, +16 = 3+8ve, +19 = 5+8ve
 */
const BOSSA_COLOR_TONES: Record<string, readonly number[]> = {
  maj7: [11, 14, 16, 19], // 7 / 9 / 3 / 5 — maj9
  M: [11, 14, 16, 19], // plain major voiced as maj9
  m7: [10, 14, 15, 19], // b7 / 9 / b3 / 5 — m9
  m: [10, 14, 15, 19], // m9
  "7": [10, 14, 16, 19], // b7 / 9 / 3 / 5 — dom9
};

/** Comp voicing base octave (the 7th, the lowest tone, starts here). */
const BOSSA_COMP_ROOT_OCTAVE = 3;
/** Register ceiling — the voicing's top note must not exceed C5 (absolute 60,
 *  i.e. octave*12 + pitchIndex). Higher-rooted voicings are dropped an octave
 *  at a time until they fit, keeping the comp in the C3–C5 register. */
const BOSSA_COMP_TOP_CEILING = 60;

/**
 * Build a rootless Type-B (7-9-3-5) jazz comp voicing for a chord, normalized
 * into the C3–C5 register. Pure. Builds the four colour tones at octave 3, then
 * transposes the whole voicing down by octaves until its top note is ≤ C5 —
 * so even high-rooted chords (A/B) stay in the comp register rather than
 * floating into octave 5. Falls back to the plain voice-led triad when the
 * quality has no defined grip (dim/aug/sus/6). Returns [] for an unknown root.
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
  let absolutes = offsets.map((o) => base + o);
  while (Math.max(...absolutes) > BOSSA_COMP_TOP_CEILING) {
    absolutes = absolutes.map((a) => a - 12);
  }
  return absolutes.map((a) => {
    const note = NOTES[((a % 12) + 12) % 12];
    return `${note}${Math.floor(a / 12)}`;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/progressionAudio.test.ts -t buildBossaColorVoicing`
Expected: PASS (4 tests).

- [ ] **Step 5: Update the dependent buildAllLayers test's expected voicing**

The pass-2 test `"voices the bossa comp as rootless jazz chords (no root note)"` in `src/progressions/audio/buildAllLayers.test.ts` asserts the old voicing on `chordStrums[0]`. At this point the `bossa-comp` pattern still has a chord hit on beat 0, so `chordStrums[0]` now resolves to the new Type-B voicing. Update its first assertion:

- Change `expect(out.chordStrums[0].value.voicing).toEqual(["E4", "B4", "D5"]);` to:
  ```ts
    expect(out.chordStrums[0].value.voicing).toEqual(["B3", "D4", "E4", "G4"]);
  ```

(The other two assertions in that test — no-C and all-sustained — still hold, because `["B3","D4","E4","G4"]` has no C. This test is reworked fully in Task 2.)

- [ ] **Step 6: Run the affected files to verify green**

Run: `pnpm exec vitest run src/progressions/progressionAudio.test.ts src/progressions/audio/buildAllLayers.test.ts`
Expected: PASS — both files green.

- [ ] **Step 7: Commit**

```bash
git add src/progressions/progressionAudio.ts src/progressions/progressionAudio.test.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): Type-B rootless bossa voicing, lowered + register-normalized (Slice 2 §3.5 pass 3)"
```

---

## Task 2: LH bass + RH chords (voiceRole field, pattern, engine)

**Files:**
- Modify: `src/progressions/audio/patterns.ts`, `src/progressions/audio/buildAllLayers.ts`
- Test: `src/progressions/audio/patterns.test.ts`, `src/progressions/audio/buildAllLayers.test.ts`

This task adds the `voiceRole` field, rewrites the `bossa-comp` pattern into LH bass + RH chord hits, and wires the engine to resolve bass roles to single octave-3 notes. It updates three existing assertions that hardcode the pass-2 comp shape.

- [ ] **Step 1: Write/Update the failing tests**

(a) In `src/progressions/audio/patterns.test.ts`, replace the `bossa-comp` test (titled `"adds a 2-bar syncopated bossa comp with rootless-jazz voicing and ringing chords"`) with:

```ts
  it("adds a 2-bar bossa comp as LH bass + RH rootless chords (all sustained)", () => {
    const comp = getChordPattern("bossa-comp")!;
    expect(comp.bars).toBe(2);
    expect(comp.voicing).toBe("rootless-jazz");
    expect(comp.hits.map((h) => h.beat)).toEqual([0, 1.5, 2, 3.5, 4, 4.5, 6, 7.5]);
    expect(comp.hits.map((h) => h.voiceRole)).toEqual([
      "bass-root", "chord", "bass-fifth", "chord",
      "bass-root", "chord", "bass-fifth", "chord",
    ]);
    expect(comp.hits.every((h) => h.style === "sustained")).toBe(true);
  });
```

(b) In `src/progressions/audio/buildAllLayers.test.ts`, update the comp-times test (titled `"plays the bossa comp's bar-2 syncopations on the second bar"`) — its assertion becomes the full 8-hit cell:

```ts
    expect(out.chordStrums.map((s) => s.time)).toEqual([0, 1.5, 2, 3.5, 4, 4.5, 6, 7.5]);
```

(c) In `src/progressions/audio/buildAllLayers.test.ts`, replace the test titled `"voices the bossa comp as rootless jazz chords (no root note)"` (the one updated in Task 1 Step 5) with the role-based version:

```ts
  it("voices the bossa comp as LH bass (single notes) + RH rootless chords", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "bossa-comp",
      drumPatternId: "bossa",
      bassPatternId: "bossa",
      steps: [step({ duration: { value: 2, unit: "bar" } })], // C major
    });
    const at = (t: number) => out.chordStrums.find((s) => s.time === t)!;
    expect(at(0).value.voicing).toEqual(["C3"]); // bass-root (LH, octave 3)
    expect(at(2).value.voicing).toEqual(["G3"]); // bass-fifth (LH, octave 3)
    expect(at(1.5).value.voicing).toEqual(["B3", "D4", "E4", "G4"]); // RH rootless chord
    expect(out.chordStrums.every((s) => s.value.style === "sustained")).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts src/progressions/audio/buildAllLayers.test.ts -t "bossa comp"`
Expected: FAIL — `voiceRole` is undefined on the hits, the comp beats are still the pass-2 6-hit set, and the bass roles don't resolve to single notes yet.

- [ ] **Step 3: Add the `voiceRole` field to `ChordHit`**

In `src/progressions/audio/patterns.ts`, extend the `ChordHit` interface — add `voiceRole` after `articulation`:

```ts
interface ChordHit {
  beat: number;
  velocity: number;
  style?: "staccato" | "sustained";
  /** Strum direction; up-strokes reverse the voicing order. Defaults to down. */
  direction?: StrumDirection;
  /** Note-length + voicing intent for the strum voice.
   *  "root" plays a single root note (anchor); "stab" rings a plain chord;
   *  "color-stab" rings a chord with funk extensions; "muted" chokes a plain
   *  chord short (chicken-scratch ghost). Omitted rings the patch default. */
  articulation?: ChordArticulation;
  /** Bossa LH/RH split (used when the pattern's voicing is "rootless-jazz"):
   *  "bass-root"/"bass-fifth" play a single low note (LH); "chord" plays the
   *  rootless RH voicing. Omitted behaves as "chord". */
  voiceRole?: "bass-root" | "bass-fifth" | "chord";
}
```

- [ ] **Step 4: Rewrite the `bossa-comp` pattern**

In `src/progressions/audio/patterns.ts`, replace the entire `bossa-comp` entry in `CHORD_PATTERNS` with:

```ts
  {
    id: "bossa-comp",
    label: "Bossa Comp",
    bars: 2,
    voicing: "rootless-jazz",
    // LH bass (root on beat 1, fifth on beat 3) + RH rootless chords on the
    // syncopated off-beats, with two cross-barline anticipations (3.5, 7.5).
    // Soft, ringing (sustained).
    hits: [
      { beat: 0, velocity: 0.6, voiceRole: "bass-root", style: "sustained" },
      { beat: 1.5, velocity: 0.5, voiceRole: "chord", style: "sustained" },
      { beat: 2, velocity: 0.55, voiceRole: "bass-fifth", style: "sustained" },
      { beat: 3.5, velocity: 0.55, voiceRole: "chord", style: "sustained" },
      { beat: 4, velocity: 0.6, voiceRole: "bass-root", style: "sustained" },
      { beat: 4.5, velocity: 0.5, voiceRole: "chord", style: "sustained" },
      { beat: 6, velocity: 0.55, voiceRole: "bass-fifth", style: "sustained" },
      { beat: 7.5, velocity: 0.55, voiceRole: "chord", style: "sustained" },
    ],
  },
```

- [ ] **Step 5: Resolve the LH bass notes in `buildAllLayersAsync`**

In `src/progressions/audio/buildAllLayers.ts`, add a module-level constant near the top (after the existing duration constants, e.g. below `ROOT_STRUM_DURATION_SEC`):

```ts
/** Piano LH bass octave for the bossa comp — an octave above the upright bass. */
const BOSSA_LH_OCTAVE = 3;
```

Then, in the per-step voicing-intent block, immediately after the `compVoicing` computation (added in pass 2), add:

```ts
    // Bossa LH bass notes (root on beat 1, fifth on beat 3), octave 3 — single
    // notes played by the piano under the RH rootless chords.
    const bossaLhNotes =
      chordPattern?.voicing === "rootless-jazz"
        ? resolveBassLineNotes(root, quality, BOSSA_LH_OCTAVE)
        : [];
    const bassRootVoicing = bossaLhNotes.length > 0 ? [bossaLhNotes[0]] : voicing;
    const bassFifthVoicing =
      bossaLhNotes.length > 1 ? [bossaLhNotes[1]] : bassRootVoicing;
```

(`resolveBassLineNotes` is already imported in this file and returns `[root, fifth]` — or `[root]` — at the requested octave.)

- [ ] **Step 6: Honour `voiceRole` in the chord-strum voicing selection**

In `src/progressions/audio/buildAllLayers.ts`, the chord-strum push currently selects voicing as:

```ts
              voicing:
                hit.articulation === "color-stab"
                  ? colorVoicing
                  : hit.articulation === "root"
                    ? rootNoteVoicing
                    : compVoicing,
```

Replace it with (bass roles take precedence; `chord`/unset falls through unchanged):

```ts
              voicing:
                hit.voiceRole === "bass-root"
                  ? bassRootVoicing
                  : hit.voiceRole === "bass-fifth"
                    ? bassFifthVoicing
                    : hit.articulation === "color-stab"
                      ? colorVoicing
                      : hit.articulation === "root"
                        ? rootNoteVoicing
                        : compVoicing,
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts src/progressions/audio/buildAllLayers.test.ts`
Expected: PASS — both files fully green (the rewritten bossa-comp assertion, the updated comp-times assertion, the role-based voicing test, and the entire existing suite). If a different existing test fails, STOP and report.

- [ ] **Step 8: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/buildAllLayers.ts src/progressions/audio/patterns.test.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): bossa piano LH bass + RH chords via voiceRole (Slice 2 §3.5 pass 3)"
```

---

## Task 3: Full verification + ear audition

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit suite**

Run: `pnpm run test`
Expected: PASS — all suites green.

- [ ] **Step 2: Lint**

Run: `pnpm run lint`
Expected: 0 errors. (A pre-existing warning in `src/hooks/useFretboardTopologyModel.ts` is unrelated — do not touch it.)

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: `tsc -b` type-checks clean and `vite build` succeeds.

- [ ] **Step 4: Manual ear audition (required by spec §6)**

Run `pnpm run dev`, open the app, select **Bossa Nova**, load a ≥4-bar progression, play. Confirm by ear:
- the piano now reads as a two-hand part — a low root/fifth bass pulse (octave 3) under ringing rootless chords;
- the chords are no longer too high (they sit C3–C5);
- the piano LH locks with the upright bass (octave 2) and the clave;
- nothing is muddy. Tune the §3.1/§3.4 tables and the piano `sustainedDurationSec` (in `src/progressions/audio/sound/instrumentPatches.ts`) by ear.

Apply tweaks as small follow-up commits:

```bash
git add -A && git commit -m "fix(progressions): tune bossa comp LH/RH balance by ear (Slice 2 §3.5 pass 3)"
```

- [ ] **Step 5: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to integrate (all three passes share this branch).

---

## Self-review notes

- **Spec coverage:** §3.1 Type-B voicing + normalization → Task 1; §3.2 `voiceRole` field → Task 2 Step 3; §3.3 engine resolution (`bossaLhNotes`/`bassRootVoicing`/`bassFifthVoicing` + `voiceRole` branch) → Task 2 Steps 5–6; §3.4 pattern → Task 2 Step 4; §4 backwards-compat → unchanged jazz-comp test (kept) + the `voiceRole`-absent fallthrough; §6 tests 1–8 → Task 1 (voicing) + Task 2 (pattern + role resolution) + Task 3 (audition). No gaps.
- **Broken-by-change tests handled:** the pass-2 `buildBossaColorVoicing` tests are replaced in Task 1 Step 1; the pass-2 buildAllLayers voicing test is bridged in Task 1 Step 5 then reworked in Task 2 Step 1c; the patterns.test.ts bossa-comp assertion and the buildAllLayers comp-times assertion are updated in Task 2 Step 1a/1b. No test is left asserting stale values.
- **Type consistency:** `buildBossaColorVoicing` (Task 1), `ChordHit.voiceRole: "bass-root"|"bass-fifth"|"chord"` (Task 2 Step 3, read in Step 6), `BOSSA_LH_OCTAVE`/`bossaLhNotes`/`bassRootVoicing`/`bassFifthVoicing` (Task 2 Steps 5–6), `BOSSA_COMP_TOP_CEILING`/`BOSSA_COMP_ROOT_OCTAVE` (Task 1) all consistent.
- **Octave math verified:** Type-B `("C","maj7")` → base 36, `[47,50,52,55]` → `["B3","D4","E4","G4"]`; `("A","m7")` → `[55,59,60,64]` → −12 → `["G3","B3","C4","E4"]`; `resolveBassLineNotes("C","M",3)` → `["C3","G3"]`.
