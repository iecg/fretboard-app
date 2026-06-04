# Funk / Bossa Voicing Migration — Design (DRAFT)

**Date:** 2026-06-03
**Status:** Draft — not approved. Open questions in §6 must be resolved before an implementation plan.
**Depends on:** [Audio Voicing Engine](2026-06-01-audio-voicing-engine-design.md) (must ship first — this work extends its `VoicingPreset` seam).

## Summary

The [Audio Voicing Engine](2026-06-01-audio-voicing-engine-design.md) introduces a single rule-based `buildVoicing(root, quality, prevVoicing, preset)` for the default strum path and explicitly leaves the two bespoke color builders — `buildFunkColorVoicing` and `buildBossaColorVoicing` (`src/progressions/progressionAudio.ts`) — untouched, naming the `VoicingPreset` as the future migration seam.

This draft proposes migrating both color builders onto `buildVoicing` via two new presets, `FUNK_PRESET` and `BOSSA_PRESET`, so all three audio voicing paths share one octave-placement, low-interval-limit, register-normalization, and voice-leading implementation. The payoff is removing three parallel copies of "place tones, dodge mud, normalize register" logic and a single place to reason about audio voicing quality.

**This is not a pure refactor.** The bespoke builders use hand-picked *color tones* (e.g. funk major voices a 6/9 with no ♭7; bossa uses a fixed Type-B 7-9-3-5 shape) that the generic engine does not currently produce from `CHORD_DEFINITIONS` members. Reaching parity requires the engine to accept a per-preset color-tone source, and the output will likely differ from today's grips — so this is a *re-voicing with acceptance criteria*, not a byte-for-byte move. §6 lists the decisions that gate it.

## Background — what the two builders actually do

Both live in `src/progressions/progressionAudio.ts` and are **rootless** (the bass/LH covers the root):

- **`buildFunkColorVoicing`** (`progressionAudio.ts:84`) — looks up `FUNK_COLOR_TONES[quality]`, a table of *semitone offsets above the root* (not chord members):
  - `"7" → [4, 10, 14]` (3 / ♭7 / 9 — the "E9" grip)
  - `M → [4, 9, 14]` (3 / 6 / 9 — deliberately **no ♭7**, so a tonic isn't turned dominant)
  - `m`, `m7 → [3, 10, 14]`; `maj7 → [4, 11, 14]`
  - Offsets are placed as **absolute open ascending** pitches from octave 3 (so the 9th at +14 genuinely rings an octave above the 3rd). Unlisted qualities fall back to `resolveChordVoicing`.
- **`buildBossaColorVoicing`** (`progressionAudio.ts:132`) — looks up `BOSSA_COLOR_TONES[quality]`, fixed Type-B offsets (e.g. `maj7 → [11, 14, 16, 19]` = 7/9/3/5), placed from octave 3 then **transposed down by octaves until the top note ≤ C5** (`BOSSA_COMP_TOP_CEILING = 60`). Unlisted qualities fall back to `resolveChordVoicing`.

The key mismatch with the engine: these tables encode **voicing-specific tone choices and offsets**, not the chord's diatonic member set. The engine selects from `CHORD_DEFINITIONS[quality].members`. A funk major is not "root/3/5 minus the root" — it's "3/6/9". So the migration can't just flip `includeRoot: false`.

## Goal

One voicing implementation behind three presets. Concretely:

- `buildFunkColorVoicing(root, q, prev)` becomes `buildVoicing(root, q, prev, FUNK_PRESET)`.
- `buildBossaColorVoicing(root, q, prev)` becomes `buildVoicing(root, q, prev, BOSSA_PRESET)`.
- The bespoke functions become thin wrappers (kept for their existing fallback callers in `buildAllLayers.ts:241`/`:249`) or are deleted once callers migrate.
- No audible regression beyond intentional, reviewed improvements.

## Proposed design

### 1. Extend `VoicingPreset` with a color-tone source

Add an optional field so a preset can override member selection with its own offset table:

```ts
interface VoicingPreset {
  // ...existing fields (includeRoot, maxNotes, floorAbs, ceilAbs,
  //    lilThresholdAbs, minLowIntervalSemitones)...

  /**
   * Optional per-quality color grips, as semitone offsets above the root.
   * When present for a quality, these REPLACE the CHORD_DEFINITIONS member
   * selection — the preset's hand-tuned tones win. Qualities absent from the
   * map fall back to normal member selection.
   */
  colorTones?: Record<string, readonly number[]>;
}
```

`buildVoicing` Step 1 (tone selection) gains a branch: if `preset.colorTones?.[quality]` exists, build the tone set from those offsets (as pitch classes `(rootIndex + offset) % 12`) instead of from members; otherwise behave exactly as today. Steps 2–4 (placement, low-interval limit, register normalization, voice leading) run unchanged.

### 2. Define the two presets

```ts
const FUNK_PRESET: VoicingPreset = {
  includeRoot: false,
  maxNotes: 4,
  floorAbs: 36,           // C3
  ceilAbs: 60,            // C5
  lilThresholdAbs: 48,    // C4
  minLowIntervalSemitones: 3,
  colorTones: FUNK_COLOR_TONES,   // reuse the existing table verbatim
};

const BOSSA_PRESET: VoicingPreset = {
  includeRoot: false,
  maxNotes: 4,
  floorAbs: 36,
  ceilAbs: 60,            // matches BOSSA_COMP_TOP_CEILING
  lilThresholdAbs: 48,
  minLowIntervalSemitones: 3,
  colorTones: BOSSA_COLOR_TONES,
};
```

The existing `FUNK_COLOR_TONES` / `BOSSA_COLOR_TONES` tables move (or are re-exported) into the engine module or a shared constants file so both the presets and any remaining wrappers reference one copy.

### 3. Migrate call sites

In `buildAllLayers.ts`, the color/comp branches (lines 241 and 249) call `buildVoicing(root, quality, lastVoicing, FUNK_PRESET)` and `buildVoicing(root, quality, lastVoicing, BOSSA_PRESET)` respectively. The bespoke builders are kept only if some path still needs them as a fallback; otherwise removed.

## Scope

### In scope
- `colorTones` field on `VoicingPreset` and the Step-1 branch in `buildVoicing`.
- `FUNK_PRESET`, `BOSSA_PRESET`, and migration of the two call sites.
- Acceptance tests (see §5) and updated/retired regression snapshots.

### Out of scope
- The default strum path (already on the engine).
- The fretboard overlay / close-voicing path.
- Bass and drum logic.
- Adding new genres or color tables.

## §5 Testing strategy

Because output may legitimately change, the test plan is **characterize → migrate → diff → accept**:

1. **Before migration:** snapshot today's `buildFunkColorVoicing` / `buildBossaColorVoicing` outputs across all defined qualities × a root spread (including a flat-key root) — this is the baseline (the Audio Voicing Engine plan's Task 7 already seeds part of this).
2. **After migration:** run the same inputs through `buildVoicing(..., FUNK_PRESET/BOSSA_PRESET)`.
3. **Diff and classify each change** as either (a) identical, (b) an acceptable improvement (e.g. better voice leading), or (c) a regression to fix. Document the classification in the PR.
4. **Invariant tests** carry over from the engine: no sub-minor-third cluster below C4, top voice ≤ C5, rootless (no root pitch class present for `includeRoot: false`).
5. **Manual A/B:** play the same Funk and Bossa progressions before/after and confirm the pocket/character is preserved.

## §6 Open questions (must resolve before planning)

1. **Parity vs. improvement.** Is the goal *bit-identical* output (then this is a strict refactor and any diff is a bug) or *equivalent-or-better* (then we accept reviewed diffs)? The bossa builder's "transpose down until ≤ C5" is *whole-voicing* normalization; the engine normalizes per the same rule, but its ascending placement + low-interval-limit may reorder voices relative to the fixed Type-B shape. **Likely answer: equivalent-or-better, with A/B sign-off** — confirm with the audio owner.
2. **Voice ordering.** The bossa Type-B shape is a *specific inversion* (7 on the bottom). The engine sorts by pitch class ascending, which may not preserve "7 on the bottom." Do we need a preset flag to preserve a given bottom voice, or is the register-normalized engine result acceptable?
3. **Fallback behavior.** Both builders fall back to `resolveChordVoicing` for qualities absent from their tables. With `colorTones` as an override-only map, absent qualities fall through to member selection in the engine — is that the desired fallback, or should it stay `resolveChordVoicing`?
4. **Is the consolidation worth it?** Three small, working, well-commented builders vs. one engine with a branch. If §6.1 lands on "accept diffs," the migration risks re-tuning hand-crafted grips for a modest DRY win. This draft does **not** advocate for the migration — it documents how it would be done and what it costs, per the audio-engine spec's stated seam.

## Risks

- **Re-voicing hand-tuned grips.** The bespoke tables were tuned by ear (the comments call out specific anti-mud choices). The engine's generic placement may not reproduce them exactly; treat any migration as a listening exercise, not a mechanical refactor.
- **Scope creep into the strum preset.** Adding `colorTones` to `VoicingPreset` must not change the strum path — guard with the "`colorTones` undefined → identical to current engine" test.
- **Sequencing.** Cannot start until the Audio Voicing Engine has shipped and its `VoicingPreset`/`buildVoicing` API is stable.
