# Bossa-Nova Comp — LH Bass + RH Chords (Slice 2 §3.5, pass 3)

**Status:** Design — approved in brainstorming 2026-06-01.
**Date:** 2026-06-01
**Parent:** `2026-06-01-bossa-nova-clave-comp-refinement-design.md` (pass 2).
**Builds on:** the `bossa-comp` pattern, `buildBossaColorVoicing`, and the
`ChordPattern.voicing: "rootless-jazz"` wiring landed in pass 2.

A third listening pass found the comp still off: the rootless voicings sit **too
high**, and the piano needs to **carry its own bass note** (it sounds thin/
disembodied with the root only in the separate upright). Research (§2) confirms
both: bossa piano is **LH root/fifth + RH rootless chords**, with the RH top note
kept between middle C (C4) and C5. This pass turns the single-voicing comp into a
real two-hand piano part and lowers the chord register.

---

## 1. Goal

1. Lower and fill out the RH comp voicing: a 4-note **Type-B rootless** voicing
   (7-9-3-5) in the C3–C5 register, register-normalized so the top note never
   exceeds C5 (fixes the "too high" complaint for all roots, including high ones
   like A/B that previously floated into octave 5).
2. Give the piano a **left hand**: root on beat 1, fifth on beat 3 (octave 3),
   played as single low notes, while the RH plays the rootless chords on the
   syncopated off-beats.

The separate upright-bass layer is **unchanged** (root/fifth, octave 2) — it sits
an octave below the new piano LH, the standard bossa-trio doubling.

## 2. Research findings (what was missing)

- **Register.** The top note of a bossa/jazz comp voicing should sit between
  middle C (C4) and the C above it (C5); rootless voicings live ~C3–A4
  ([pianowithjonny](https://pianowithjonny.com/piano-lessons/jazz-piano-comping-with-two-hand-voicings/),
  [pianogroove](https://www.pianogroove.com/jazz-piano-lessons/rootless-chord-voicings/)).
  Pass 2's voicing was based at octave 4 and topped out at D5 (C maj) / B5 (A m7) —
  too high.
- **Two hands.** Standard bossa/jazz piano is **LH root (beat 1) + fifth (beat 3)**
  with **RH rootless A/B voicings** ([TJPS](https://www.thejazzpianosite.com/jazz-piano-lessons/jazz-genres/how-to-play-bossa-nova/)).
  Type A = 3-5-7-9 (3rd lowest); **Type B = 7-9-3-5 (7th lowest)** — the latter
  sits lower for the same chord and is the better fit for the C3–C5 target.
- **Confirmed unchanged:** the clave, the kick/hats, the syncopated off-beat
  feel with anticipations, and the upright bass.

## 3. Architecture

Two units change: the voicing function (`progressionAudio.ts`) and the comp's
per-hit voicing resolution (`buildAllLayers.ts`). The pattern data
(`patterns.ts`) is rewritten. No new engine concept beyond one optional
`ChordHit` field.

### 3.1 RH voicing: Type-B rootless, octave 3, register-normalized

Rewrite `buildBossaColorVoicing` (`progressionAudio.ts`). Replace the 3-note
open shape with a 4-note **Type-B (7-9-3-5)** rootless voicing based at octave 3,
then normalize the whole voicing down by octaves until its top note is ≤ C5.

```ts
/** Rootless Type-B (7-9-3-5) comp tones per quality, as semitone offsets above
 *  the chord root. The root is omitted — the piano LH / upright bass cover it. */
const BOSSA_COLOR_TONES: Record<string, readonly number[]> = {
  maj7: [11, 14, 16, 19], // 7 / 9 / 3 / 5 — maj9
  M: [11, 14, 16, 19], // plain major voiced as maj9
  m7: [10, 14, 15, 19], // b7 / 9 / b3 / 5 — m9
  m: [10, 14, 15, 19], // m9
  "7": [10, 14, 16, 19], // b7 / 9 / 3 / 5 — dom9
};

/** Comp voicing base octave (the 7th, lowest note, starts here). */
const BOSSA_COMP_ROOT_OCTAVE = 3;
/** Register ceiling: the voicing's top note must not exceed this absolute
 *  semitone (C5). `absolute = octave*12 + pitchIndex`, matching the note-string
 *  encoding used throughout this file. C5 → 5*12 + 0 = 60. */
const BOSSA_COMP_TOP_CEILING = 60;
```

`buildBossaColorVoicing(root, quality, prevVoicing?)`:

1. `rootIndex = NOTES.indexOf(root)`; return `[]` if `< 0`.
2. `offsets = BOSSA_COLOR_TONES[quality]`; if absent, return
   `resolveChordVoicing(root, quality, undefined, prevVoicing)` (the
   dim/aug/sus/6 fallback, unchanged behaviour).
3. `base = BOSSA_COMP_ROOT_OCTAVE * 12 + rootIndex`; build
   `absolutes = offsets.map((o) => base + o)`.
4. **Normalize:** while `Math.max(...absolutes) > BOSSA_COMP_TOP_CEILING`,
   subtract `12` from every entry.
5. Map each absolute to a note string:
   `NOTES[((a % 12) + 12) % 12] + Math.floor(a / 12)`.

Worked examples (codebase absolute = note-string octave × 12 + pitch index):
- `C maj7` → base 36, `[47,50,52,55]` (top 55 ≤ 60) → `["B3","D4","E4","G4"]`.
- `A m7` → base 45, `[55,59,60,64]`, top 64 > 60 → −12 → `[43,47,48,52]` →
  `["G3","B3","C4","E4"]` (was `["C5","G5","B5"]` in pass 2).
- `B maj7` → base 47, `[58,61,63,66]`, top 66 > 60 → −12 → `[46,49,51,54]` →
  `["A#3","C#4","D#4","F#4"]`.

### 3.2 The `voiceRole` field on `ChordHit`

Add an optional role to `ChordHit` (`patterns.ts`):

```ts
interface ChordHit {
  beat: number;
  velocity: number;
  style?: "staccato" | "sustained";
  direction?: StrumDirection;
  articulation?: ChordArticulation;
  /** Bossa LH/RH split (used when the pattern's voicing is "rootless-jazz"):
   *  "bass-root"/"bass-fifth" play a single low note (LH); "chord" plays the
   *  rootless RH voicing. Omitted behaves as "chord". */
  voiceRole?: "bass-root" | "bass-fifth" | "chord";
}
```

### 3.3 Per-hit voicing resolution (`buildAllLayers.ts`)

Per step, when the chord pattern opts into rootless-jazz, resolve the LH bass
notes once (octave 3) alongside the existing `compVoicing`:

```ts
const BOSSA_LH_OCTAVE = 3; // module constant near the other layer constants
// inside the per-step voicing block, after compVoicing:
const bossaLhNotes =
  chordPattern?.voicing === "rootless-jazz"
    ? resolveBassLineNotes(root, quality, BOSSA_LH_OCTAVE) // [root, fifth] @ oct 3
    : [];
const bassRootVoicing = bossaLhNotes.length > 0 ? [bossaLhNotes[0]] : voicing;
const bassFifthVoicing =
  bossaLhNotes.length > 1 ? [bossaLhNotes[1]] : bassRootVoicing;
```

`resolveBassLineNotes` is already imported in `buildAllLayers.ts`. It returns
`[root, fifth]` (or `[root]` when the quality has no fifth) at the requested
octave.

Extend the chord-strum push's voicing selection to honour `voiceRole` first
(bass roles win over articulation; `chord`/unset falls through to the existing
chain):

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

The funk `color-stab` / `root` branches are untouched. Every non-bossa pattern
has no `voiceRole`, so the chain behaves exactly as before. All bossa hits carry
`style: "sustained"`, so both the single LH bass notes and the RH chords ring via
the poly patch's `sustainedDurationSec` (no `durationSec` override needed).

### 3.4 The new `bossa-comp` pattern (`patterns.ts`)

```ts
{
  id: "bossa-comp",
  label: "Bossa Comp",
  bars: 2,
  voicing: "rootless-jazz",
  // LH bass (root on 1, fifth on 3) + RH rootless chords on the syncopated
  // off-beats, with two cross-barline anticipations (3.5, 7.5). Soft, ringing.
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
}
```

Beats/velocities are eye-tuned starting points, nudged by ear in §6.

### 3.5 Notes

- Determinism preserved: voicing selection is a pure function of root/quality/
  role; the normalization loop is deterministic; no `Date.now`/`Math.random`.
- The upright bass (octave 2, root/fifth on 1/3) is unchanged and sits an octave
  below the piano LH (octave 3).
- Voice-leading the rootless grips between chords remains a future refinement
  (the shapes are fixed per chord, normalized by register only).

## 4. Backwards-compatibility

- `buildBossaColorVoicing` is only called for `voicing: "rootless-jazz"` patterns
  (i.e. `bossa-comp`). Its internal change does not affect any other genre.
- `voiceRole` is optional and only set on `bossa-comp`; every other comp omits it,
  so the voicing-selection chain is unchanged for them.
- The upright bass layer, the clave, the kick, and the hats are untouched.

## 5. Files touched

- `src/progressions/progressionAudio.ts` — rewrite `BOSSA_COLOR_TONES`,
  `BOSSA_COMP_ROOT_OCTAVE`, add `BOSSA_COMP_TOP_CEILING`, rewrite
  `buildBossaColorVoicing` (Type-B + normalization).
- `src/progressions/audio/patterns.ts` — add `ChordHit.voiceRole`; rewrite the
  `bossa-comp` hits.
- `src/progressions/audio/buildAllLayers.ts` — add `BOSSA_LH_OCTAVE`, the
  `bossaLhNotes` / `bassRootVoicing` / `bassFifthVoicing` resolution, and the
  `voiceRole` branch in the chord-strum voicing selection.
- Co-located tests: `progressionAudio.test.ts`, `patterns.test.ts`,
  `buildAllLayers.test.ts`.

## 6. Testing strategy

**Unit (`progressionAudio.test.ts`) — rewrite the `buildBossaColorVoicing` block:**

1. `buildBossaColorVoicing("C", "maj7")` → `["B3", "D4", "E4", "G4"]` (Type-B
   7-9-3-5, rootless, top G4).
2. `buildBossaColorVoicing("A", "m7")` → `["G3", "B3", "C4", "E4"]` (normalized
   down from octave 5 — the regression that fixes "too high").
3. Every defined voicing has 4 notes, is rootless (no root pitch class), and its
   **top note ≤ C5** for all 12 roots × {maj7, M, m7, m, "7"} (the register
   guarantee, including high roots A/B).
4. A quality with no grip (e.g. `"dim"`) falls back to
   `resolveChordVoicing("C","dim",undefined,undefined)`; an unknown root → `[]`.

**Unit (`patterns.test.ts`):**

5. The `bossa-comp` pattern has `bars: 2`, `voicing: "rootless-jazz"`, beats
   `[0, 1.5, 2, 3.5, 4, 4.5, 6, 7.5]`, every hit `style: "sustained"`, and the
   `voiceRole` sequence
   `["bass-root","chord","bass-fifth","chord","bass-root","chord","bass-fifth","chord"]`.

**Unit (`buildAllLayers.test.ts`):**

6. For a C-major bossa-comp step: the strum at the `bass-root` beat (0) resolves
   to a single note `["C3"]`; the `bass-fifth` beat (2) resolves to `["G3"]`; a
   `chord` beat (1.5) resolves to the Type-B voicing `["B3","D4","E4","G4"]`.
7. Every bossa-comp strum carries `style: "sustained"`.
8. Backwards-compat: a default-voicing comp (jazz, `jazz-comp`) still resolves the
   standard rooted voicing (contains `C3`) — the `voiceRole`/`compVoicing` path is
   inert without the `voicing` field.

**Manual ear audition (required):** play a ≥4-bar bossa progression; confirm the
piano now reads as a two-hand bossa part (walking-ish root/fifth bass under
ringing rootless chords), the chords are no longer too high, and it locks with
the clave and upright bass. Tune the §3.1/§3.4 tables and the piano
`sustainedDurationSec` by ear via small follow-up commits.
