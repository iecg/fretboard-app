# Audio Voicing Engine — Design

**Date:** 2026-06-01
**Status:** Approved, pending implementation plan

## Summary

The progression playback path produces muddy chord voicings for any chord with a low step-cluster — most visibly sixth chords. Picking C6 in the Rock genre on a C–G–Am–F progression voices the chord as a naive close stack `C3 E3 G3 A3`, putting the 6th (A3) a whole step above the 5th (G3) down at ~196–220 Hz. That low major-2nd cluster is the mud.

This design adds a single, rule-based **audio voicing engine** that replaces the naive stack on the default/strum chord path (Rock, Pop, Blues, Ballad). The engine applies four musical rules — tone selection, a low-interval limit, register normalization, and spacing-safe voice leading — so it produces clean, well-spaced voicings automatically for every chord quality, including the extended qualities (9ths, 6/9, 13ths) being added in the separate Extended Chord Qualities work.

Funk and Bossa keep their existing hand-tuned color voicings untouched. The engine is preset-driven so they can migrate onto it later without rework.

## Background — current system

The progression audio layer builds three kinds of chord voicings, all in `src/progressions/progressionAudio.ts`:

- **`resolveChordVoicing(root, quality, rootOctave?, prevNotes?)`** — the default path. Stacks `CHORD_DEFINITIONS[quality].members` upward from octave 3. With `prevNotes`, it delegates to `getNearestInversion` (`src/progressions/voiceLeading.ts`) for voice leading. This is the muddy path.
- **`buildFunkColorVoicing`** — rootless funk grips from the hand-authored `FUNK_COLOR_TONES` table.
- **`buildBossaColorVoicing`** — rootless Type-B jazz comp grips from `BOSSA_COLOR_TONES`, normalized into a C3–C5 register.

`buildAllLayers.ts` orchestrates these. The default strummed chord is computed once at `src/progressions/audio/buildAllLayers.ts:197`:

```ts
const voicing = resolveChordVoicing(root, quality, undefined, lastVoicing);
```

`lastVoicing` threads voice-leading context between steps. The Funk color stab (line 208) and Bossa comp (line 216) opt into their own builders; everything else — including all four default genres — uses this `voicing`.

### Why the current path is muddy

1. **No spacing rule.** `resolveChordVoicing` stacks members monotonically with no minimum interval. Any quality whose members include an adjacent step (6 next to 5, 9 next to root/3, b7 next to root) produces a low cluster.
2. **No tone selection.** Dense chords are not thinned, so extended qualities pile up even more low tones.
3. **Voice leading can crunch.** `getNearestInversion` minimizes total semitone motion across freely-generated inversions with no spacing constraint, so it can choose — or create — an even tighter low cluster than the root-position stack.

### Why the Extended Chord Qualities spec does not fix this

The `2026-06-01-extended-chord-qualities-design.md` spec adds new qualities and a `VOICING_OMISSIONS` table, but:

- It operates in `closeVoicings` (`packages/core/src/shapes/voicings.ts`) — the **fretboard overlay**, not the audio path.
- It solves tone **count** (fit six notes into a 3–5-note grip), not tone **spacing** or **register**.
- It would not change C6 at all: C6 is four notes, under the cap, so no omission applies.

This engine is complementary: it owns audio voicing quality across all qualities and the four default genres.

## Scope

### In scope

- A new pure module `src/progressions/voicingEngine.ts` exporting `buildVoicing(...)`, a `VoicingPreset` type, and a `STRUM_PRESET` constant.
- Replacing the single default-voicing call at `buildAllLayers.ts:197` with the engine.
- Unit, property, voice-leading, and regression tests.

### Out of scope

- Funk and Bossa color builders — left byte-for-byte unchanged. (The preset shape is designed so they could migrate later, but that migration is not part of this work.)
- The fretboard overlay / close-voicing path (`packages/core/src/shapes/`).
- Bass and drum voicing logic (`resolveBassLineNotes`, `resolveBassNoteForRole`) — unchanged.
- Adding new chord qualities — owned by the Extended Chord Qualities spec.

## Design

### 1. Module: `src/progressions/voicingEngine.ts`

Pure functions, no Tone.js or atom dependencies. Pitches are represented as absolute integers `octave * 12 + chroma`, matching the existing convention in `progressionAudio.ts` (C3 = 36, C4 = 48, C5 = 60). The module reuses `CHORD_DEFINITIONS` from `@fretflow/core`; each member already carries `{ name, semitone }` (e.g. `"5"`, `"6"`, `"9"`, `"b7"`).

```ts
interface VoicingPreset {
  includeRoot: boolean;            // strum: true; rootless presets (future): false
  maxNotes: number;                // 5
  floorAbs: number;                // C3 = 36 — the lowest voice sits near here
  ceilAbs: number;                 // C5 = 60 — the top voice must not exceed this
  lilThresholdAbs: number;         // C4 = 48 — below this pitch, the spacing rule applies
  minLowIntervalSemitones: number; // 3 (minor third)
}

function buildVoicing(
  root: string,
  quality: string,
  prevVoicing: string[] | undefined,
  preset: VoicingPreset,
): string[];
```

`STRUM_PRESET` values: `includeRoot: true`, `maxNotes: 5`, `floorAbs: 36`, `ceilAbs: 60`, `lilThresholdAbs: 48`, `minLowIntervalSemitones: 3`.

`buildVoicing` returns note strings (e.g. `["C3", "E3", "G3", "A4"]`), or `[]` when the root or quality is unrecognized (same contract as `resolveChordVoicing`, so callers treat empty as "no audible chord").

### 2. Algorithm

**Step 1 — Resolve and select tones.**

- Look up `CHORD_DEFINITIONS[quality]`; return `[]` if missing or the root is not a recognized note.
- If `!preset.includeRoot`, drop the root member.
- If the remaining count exceeds `preset.maxNotes`, drop members by priority `["5", root]` — drop the 5th first, then the root if still over. Guide tones (`3`/`b3`, `7`/`b7`) and color tones (`6`, `9`, `13`, sus `2`/`4`) are always kept. This is the same omission intent as the Extended Chord Qualities `VOICING_OMISSIONS` table, generalized into a rule so it covers the new 13th chords (six members → drop 5th → five-note grip).

**Step 2 — Octave placement (the anti-mud core).**

Place the selected tones in ascending pitch-class order:

- Anchor the lowest tone near `preset.floorAbs`.
- For each subsequent tone, choose the smallest octave that places it strictly above the previously placed voice.
- Then, **while** the tone's absolute pitch `< preset.lilThresholdAbs` **and** its interval to the voice directly below it `< preset.minLowIntervalSemitones`, raise it one octave and re-check.

This guarantees no interval tighter than a minor third below C4. Worked example for C6 with `STRUM_PRESET`:

- Place C3 (36), E3 (40), G3 (43).
- A would land at A3 (45): a major 2nd (2 semitones) above G3, and below C4 (48). Below threshold and under the minimum, so bump → A4 (57).
- Result: `C3 E3 G3 A4` — open, with the 6th ringing on top. The clash is gone.

**Step 3 — Register normalization.**

While the top voice exceeds `preset.ceilAbs`, transpose the entire voicing down by 12 semitones. This generalizes the ceiling-clamp `buildBossaColorVoicing` already does, keeping high-rooted chords from floating out of the comp register.

**Step 4 — Spacing-safe voice leading.**

When `prevVoicing` is provided, generate a small candidate set — the spacing-valid voicing computed at a few starting octaves (floor, floor ± 12) and the closed-position rotations that still satisfy Step 2's spacing rule after normalization. Score each candidate by total semitone distance to `prevVoicing` (reuse `calculateDistance` from `voiceLeading.ts`) and return the nearest. Because every candidate already passes the spacing invariant, voice leading can never reintroduce a low cluster — closing the latent `getNearestInversion` gap. With no `prevVoicing`, return the floor-anchored voicing from Steps 2–3.

### 3. Integration

Change the single line at `src/progressions/audio/buildAllLayers.ts:197`:

```ts
const voicing = buildVoicing(root, quality, lastVoicing, STRUM_PRESET);
```

Everything downstream of `voicing` (the `lastVoicing` threading at line 199, the funk root-anchor at line 206, the fallbacks at lines 209/217) is unchanged. `resolveChordVoicing` remains exported and is still used by the Funk and Bossa fallbacks and is unaffected.

Funk (`buildFunkColorVoicing`, line 208) and Bossa (`buildBossaColorVoicing`, line 216) builders are not modified.

### 4. Testing

**Unit — golden voicings (`src/progressions/voicingEngine.test.ts`):**

- C6 → `["C3", "E3", "G3", "A4"]`.
- Cm6, C6/9, C9, Cmaj13, Cm13 → assert the expected pitch-class set after omission and the expected register placement.

**Property — invariants over all qualities × several roots (including a flat-key root):**

- No interval smaller than `minLowIntervalSemitones` (3) below `lilThresholdAbs` (C4).
- Top voice `≤ ceilAbs` (C5).
- Guide tones present (every quality keeps its 3rd-or-b3rd and its 7th when it has one).

**Voice leading:**

- Given a `prevVoicing`, the result minimizes total semitone distance among candidates **and** still passes the spacing invariant — a regression guard against the old crunch.

**Funk / Bossa regression:**

- Snapshot the current `buildFunkColorVoicing` and `buildBossaColorVoicing` outputs for the C–G–Am–F set and assert they are unchanged, proving the engine work did not touch them.

**Manual verification:**

- Before claiming completion, play the C–G–Am–F progression with C6 in the Rock genre and confirm the mud is gone; spot-check that plain triads/7ths (C, G, Am) sound unchanged.

## Risks & boundaries

- **The default strum sound changes for all chords, not only sixths.** In practice, plain triads and sevenths have no sub-minor-third cluster below C4 and trigger no omission, so their output is unchanged; only step-cluster qualities (6, m6, 6/9, 9, 13) move. This is verified during manual checks rather than assumed.
- **Register normalization vs. voice leading ordering** — normalization runs per candidate (Step 3 before Step 4 scoring), so voice leading always chooses among already-normalized, spacing-valid voicings.
- **Preset is the migration seam** — Funk/Bossa can later become `{ includeRoot: false, ... }` presets feeding `buildVoicing`. Not done here; no rework required when it is.
