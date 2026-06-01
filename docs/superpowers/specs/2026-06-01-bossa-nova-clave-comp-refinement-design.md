# Bossa-Nova Clave & Comp Refinement (Slice 2 §3.5, pass 2)

**Status:** Design — approved in brainstorming 2026-06-01.
**Date:** 2026-06-01
**Parent:** `2026-06-01-bossa-nova-overhaul-design.md` (pass 1, shipped on this branch).
**Builds on:** the 2-bar pattern-cell mechanism, the cross-stick voice, and the
`bossa` drum / `bossa` bass / `bossa-comp` patterns already landed in pass 1.

A second listening pass found the bossa nova still doesn't read as authentic.
Research (see §2) pinned two concrete causes: the cross-stick plays the **son**
clave, not the **bossa** clave; and the comp plays generic short-stab chords
instead of **sustained, rootless jazz 7th/9th voicings**. This pass fixes both.

---

## 1. Goal

Make the bossa-nova comp and clave idiomatic:

1. Correct the cross-stick to the authentic **3-2 bossa clave** (one note moves).
2. Voice the comp as **rootless jazz 7th/9th chords in the middle register**,
   ringing/tied (sustained), softly dynamic, over a highly syncopated 2-bar
   figure with cross-barline anticipations.

The bass already satisfies the "left hand" (root/fifth on beats 1 & 3); it is
unchanged. Kick and hats are unchanged.

## 2. Research findings (what was missing)

- **Clave.** The bossa nova clave is the Cuban son clave with the **second note
  of the 2-side delayed by one eighth** (Wikipedia: *Clave (rhythm)*;
  bossanova-gitarre.de). On the eighth-note grid (3-2 orientation):

  ```
  Count:        1  1& 2  2& 3  3& 4  4&
  Son 3-side:   X  .  .  X  .  .  X  .   (bar 1)
  Son 2-side:   .  X  X  .  .  .  .  .   (bar 2)  → hits on 2, 3
  Bossa 3-side: X  .  .  X  .  .  X  .   (bar 1)  ← same as son
  Bossa 2-side: .  X  .  .  .  X  .  .   (bar 2)  → hits on 2, 3&  (3 → 3&)
  ```

  Pass 1 shipped the **son** 2-side (`…5, 6`). The bossa 2-side is `…5, 6.5`.

- **Comp.** Bossa comping is rootless jazz 7th/9th voicings in the middle
  register, highly syncopated against the clave with frequent anticipations
  across the bar lines, chords **ringing/tied** (not short stabs), played softly
  (thejazzpianosite.com; jazzguitarlessons.net). Pass 1's comp used the default
  chord voicing at the patch's short default duration — generic.

- **Confirmed already-correct (unchanged):** bass = root on beat 1, fifth on
  beat 3; straight-8th hats; soft surdo kick; swing 0.

## 3. Architecture

All changes reuse existing mechanisms; no new engine concepts beyond one
optional pattern field.

### 3.1 Clave fix (data only)

In `patterns.ts`, the `bossa` drum pattern's `crossStick` array changes its final
hit from cell beat `6` to `6.5`:

```ts
crossStick: [
  { beat: 0, velocity: 0.8 },
  { beat: 1.5, velocity: 0.7 },
  { beat: 3, velocity: 0.75 },
  { beat: 5, velocity: 0.7 },
  { beat: 6.5, velocity: 0.8 },   // was 6 (son) → 6.5 (bossa 2-side, 3&)
],
```

### 3.2 Rootless jazz comp voicing

New pure function in `src/progressions/progressionAudio.ts`, mirroring the
existing `buildFunkColorVoicing` / `FUNK_COLOR_TONES` structure:

```ts
/** Rootless jazz comp tones per quality, as semitone offsets above the chord
 *  root. Root (offset 0) omitted — the bass covers it. 7ths + 9ths, the bossa
 *  comp idiom. Qualities not listed fall back to the voice-led triad.
 *   +3 = b3, +4 = 3, +10 = b7, +11 = maj7, +14 = 9 */
const BOSSA_COLOR_TONES: Record<string, readonly number[]> = {
  maj7: [4, 11, 14], // 3 / 7 / 9  — maj9
  M:    [4, 11, 14], // plain major voiced as maj9 (bossa idiom)
  m7:   [3, 10, 14], // b3 / b7 / 9 — m9
  m:    [3, 10, 14], // m9
  "7":  [4, 10, 14], // 3 / b7 / 9 — dom9
};

/** Middle-register piano comp octave (true comp register, above the guitar-ish
 *  octave-3 funk grip). */
const BOSSA_COMP_ROOT_OCTAVE = 4;

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

Voice-leading the rootless shapes (smooth inversions between chords) is a future
refinement; like funk, this ships a fixed open shape per chord. `prevVoicing` is
accepted for signature parity / the triad fallback but does not voice-lead the
color tones.

### 3.3 Opt-in comp voicing on the pattern

Add an optional field to `ChordPattern` (`patterns.ts`):

```ts
export interface ChordPattern {
  id: string;
  label: string;
  hits: readonly ChordHit[];
  bars?: number;
  /** Voicing strategy for this comp. Omitted = the default chord voicing.
   *  "rootless-jazz" = buildBossaColorVoicing (rootless 7th/9th, mid register). */
  voicing?: "rootless-jazz";
}
```

In `buildAllLayersAsync` (`buildAllLayers.ts`), inside the chord block, compute a
comp voicing once per chord when the pattern requests it, and use it as the base
voicing for the pattern's hits:

```ts
const usesRootlessJazz = chordPattern?.voicing === "rootless-jazz";
const compVoicing = usesRootlessJazz
  ? buildBossaColorVoicing(root, quality, lastVoicing)
  : voicing;
```

Then the per-hit voicing selection (currently
`color-stab ? colorVoicing : root ? rootNoteVoicing : voicing`) uses
`compVoicing` as the final fallback instead of `voicing`:

```ts
voicing:
  hit.articulation === "color-stab"
    ? colorVoicing
    : hit.articulation === "root"
      ? rootNoteVoicing
      : compVoicing,
```

`buildBossaColorVoicing` is imported from `../progressionAudio` alongside the
existing `buildFunkColorVoicing`. Non-bossa patterns leave `voicing` undefined,
so `compVoicing === voicing` and their output is byte-identical.

### 3.4 Comp rhythm, ring, and dynamics

Replace the `bossa-comp` pattern's `hits` (`patterns.ts`). Highly syncopated
2-bar figure with two cross-barline anticipations; every hit `sustained` so the
chords ring/tie; soft velocities (~0.5–0.65, the 60–85 acoustic range):

```ts
{
  id: "bossa-comp",
  label: "Bossa Comp",
  bars: 2,
  voicing: "rootless-jazz",
  hits: [
    // bar 1
    { beat: 0,   velocity: 0.6,  style: "sustained" }, // downbeat anchor
    { beat: 1.5, velocity: 0.55, style: "sustained" }, // "& of 2" (clave)
    { beat: 3.5, velocity: 0.6,  style: "sustained" }, // "& of 4" anticipates bar 2
    // bar 2
    { beat: 4.5, velocity: 0.55, style: "sustained" }, // "& of 1"
    { beat: 6,   velocity: 0.5,  style: "sustained" }, // beat 3 (clave)
    { beat: 7.5, velocity: 0.65, style: "sustained" }, // "& of 4" anticipates next cycle
  ],
}
```

These beats/velocities are eye-tuned starting points, nudged by ear in §6.

### 3.5 Architecture notes

- The reference describes one pianist's left + right hands; our engine splits
  that across the **bass instrument** (left hand) and the **piano comp**
  (right hand). The combined output reproduces the LH/RH split. Intended.
- `style: "sustained"` maps to the poly patch's `sustainedDurationSec`. Ringing
  chords overlapping slightly is the intended bossa sound; if the audition finds
  it muddy, tune `sustainedDurationSec` for the piano patch (do not revert to
  short stabs).
- Determinism is preserved: voicing selection is a pure function of root/quality;
  no `Date.now` / `Math.random`.

## 4. Backwards-compatibility

- Only the `bossa` drum `crossStick` array and the `bossa-comp` pattern change in
  data; only the chord block of `buildAllLayersAsync` and `progressionAudio.ts`
  change in code.
- The new `ChordPattern.voicing` field defaults to undefined; every non-bossa
  comp keeps the default voicing path and is byte-identical.
- No change to the cell mechanism, the cross-stick voice, the bass, the kick, or
  the hats.

## 5. Files touched

- `src/progressions/progressionAudio.ts` — `BOSSA_COLOR_TONES`,
  `BOSSA_COMP_ROOT_OCTAVE`, `buildBossaColorVoicing`.
- `src/progressions/audio/patterns.ts` — `ChordPattern.voicing` field; `bossa`
  drum `crossStick` last hit `6 → 6.5`; rewritten `bossa-comp` hits.
- `src/progressions/audio/buildAllLayers.ts` — import `buildBossaColorVoicing`;
  compute `compVoicing` and use it as the comp hits' base voicing.
- Co-located tests: `progressionAudio.test.ts`, `patterns.test.ts`,
  `buildAllLayers.test.ts`.

## 6. Testing strategy

**Unit (`progressionAudio.test.ts`):**

1. `buildBossaColorVoicing("C", "maj7")` returns exactly the rootless maj9 tones
   `["E4", "B4", "D5"]` (no root `C`), confirming rootless + middle register +
   correct offsets `[4, 11, 14]`.
2. `buildBossaColorVoicing("A", "m7")` returns the rootless m9 tones
   (b3/b7/9 above A in octave 4): `["C5", "G5", "B5"]`.
3. A dominant (`"7"`) returns `[3, b7, 9]` rootless; a quality with no entry
   (e.g. `"dim"`) falls back to `resolveChordVoicing` (a non-empty voiced triad).
4. An unknown root returns `[]`.

**Unit (`patterns.test.ts`):**

5. The `bossa` drum `crossStick` beats are `[0, 1.5, 3, 5, 6.5]` (bossa clave,
   not son `…6`).
6. The `bossa-comp` pattern has `bars: 2`, `voicing: "rootless-jazz"`, beats
   `[0, 1.5, 3.5, 4.5, 6, 7.5]`, and every hit has `style: "sustained"`.

**Unit (`buildAllLayers.test.ts`):**

7. A bossa-comp step's chord strums resolve to the rootless jazz voicing — for a
   C-major step (quality `"M"`, which `BOSSA_COLOR_TONES` voices as maj9) the
   strum `voicing` equals `["E4","B4","D5"]` and contains no `C` (the root),
   verifying the pattern-`voicing` path is wired. (`M` and `maj7` share the
   `[4,11,14]` offsets, so the default-major test step avoids depending on
   `maj7` being a defined chord quality.)
8. The bossa-comp chord strums carry `style: "sustained"`.
9. Backwards-compat: a default-voicing genre (e.g. jazz, `jazz-comp`) still
   resolves the standard `resolveChordVoicing` notes (the `voicing` field absent
   → `compVoicing === voicing`).

**Manual ear audition (required):** play a ≥4-bar bossa progression; confirm the
clave reads as bossa (not son), the comp rings as rootless jazz chords with the
anticipated lean, and the whole bed locks together. Tune §3.1/§3.4 tables and the
piano `sustainedDurationSec` by ear via small follow-up commits.
