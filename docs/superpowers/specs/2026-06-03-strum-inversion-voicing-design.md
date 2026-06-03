# Strum Inversion Voicing — Design

**Date:** 2026-06-03
**Status:** Approved, pending implementation plan
**Supersedes:** the placement core (Steps 2–4) of [`2026-06-01-audio-voicing-engine-design.md`](2026-06-01-audio-voicing-engine-design.md). Step 1 (tone selection / `DROP_PRIORITY`), the `VoicingPreset`/`STRUM_PRESET` shape, and the single `buildAllLayers` integration point are retained.

## Problem

The shipped voicing engine (`src/progressions/voicingEngine.ts`) places chord tones in **ascending pitch-class order** anchored from a floor, then octave-bumps any tone that forms a low cluster. For a major/minor 6th chord this is structurally wrong:

- The 6th is the **highest chord tone** in root position (`C E G A`), so an ascending stack always puts it on top.
- The cluster in `C E G A` is the `G–A` major 2nd (5th vs 6th). The engine resolves it by bumping the **6th** (`A3 → A4`), stranding the 6th as the lone melody voice: `C3 E3 G3 A4`.

Audible result: the 6th rings as the most prominent voice. A real guitarist voices C6 with the 6th **internal** (e.g. the drop-2 first inversion `E A C G` = `3-6-R-5`). The engine cannot reach that voicing because it never inverts.

## Research basis

- **6 chords are voiced with the 6th internal, "like a 7th."** Standard comping uses drop-2/drop-3 inversions; in three of the four drop-2 major-6 inversions (`R-5-6-3`, `3-6-R-5`, `5-R-3-6`, `6-3-5-R`) the 6th is an interior voice. ([jazz-guitar-licks – Major 6th voicings](https://www.jazz-guitar-licks.com/pages/chords/major-6th-guitar-chords.html), [jazzguitar.be – Drop 2 Chords](https://www.jazzguitar.be/blog/drop-2-chords/))
- **The 6th on top, or in the bass, collapses toward the Am7 reading.** C6 and Am7 are the same notes; "move that A to the bass and you have an Am7." So the 6th (and color tones generally) belong **strictly internal** — neither the top nor the bottom voice. ([Wikipedia – Sixth chord](https://en.wikipedia.org/wiki/Sixth_chord), [Hear and Play – Major 6th vs Minor 7th](https://hearandplay.com/main/major-sixth-vs-minor-seventh-chords/))
- **De-clustering raises an *inner* voice (open/spread voicing).** Lifting the 5th (the most expendable tone — consistent with the engine's own `DROP_PRIORITY = ["5","root"]`) above the cluster keeps the color tone in place. ([Applied Guitar Theory – Spread Triads](https://appliedguitartheory.com/lessons/spread-triads/), [Sweetwater – Open/Spread Voicing](https://www.sweetwater.com/insync/open-voicing-spread-voicing/))
- **Inversion-based voice leading already exists in the codebase.** `getNearestInversion` (`src/progressions/voiceLeading.ts`) enumerates inversions and picks the nearest to the previous chord — but with no spacing/register/color constraints, which is why it produced mud and was bypassed. This design re-adopts inversion enumeration *with* those constraints.

## The rule

**Color tones (6, 9, 13) are placed strictly internal — never the highest or lowest voice — and the engine chooses among real inversions (plus a spread-the-5th variant) rather than a single root-position stack.** Selection is voice-led to the previous chord while every candidate already satisfies the spacing and color-placement invariants.

For C6 with no previous chord this yields `E3 A3 C4 G4` (the drop-2 first inversion the user identified): 3rd in bass, 6th internal, 5th on top.

## Design

`buildVoicing(root, quality, prevVoicing, preset)` keeps its signature and Step 1 (tone selection). Steps 2–4 are replaced by **generate → filter → score**.

### Tone roles

Classify each selected member (`ChordMemberName`) once:

```ts
type ToneRole = "root" | "guide" | "fifth" | "color" | "other";
// root            → "root"
// 3, b3, 7, b7, bb7 → "guide"
// 5, b5, #5       → "fifth"
// 6, 9, 13        → "color"
// 2, 4 (sus)      → "other"
```

### Step 2 — Generate candidates

From the selected tones (each `{pc, role}` where `pc = (rootIndex + semitone) % 12`):

1. **Inversions.** For each tone as the bass, stack the remaining tones ascending, wrapping octaves, anchored so the bass is the lowest pitch `≥ floorAbs`. (N tones → N inversions.)
2. **Spread-the-5th variant.** For each inversion that contains a `fifth` not already on top, additionally emit a variant with the 5th raised to just above the current top voice. This is the open-voicing move that de-clusters `5↔color` pairs.
3. **Octave anchors.** Generate each of the above at the floor anchor and one octave up (`floorAbs`, `floorAbs + 12`) to widen the voice-leading search.

Bound: ≤ 5 tones × ≤ 2 (closed/spread) × 2 anchors ≈ 20 candidates per chord. Each candidate is register-normalized (while top `> ceilAbs`, transpose the whole voicing down 12).

### Step 3 — Filter (hard invariants)

Reject any candidate that fails:

- **Spacing:** for adjacent voices both below `lilThresholdAbs` (C4), the interval `≥ minLowIntervalSemitones` (3). (Same anti-mud invariant as today.)
- **Color internal:** the highest voice's role ≠ `color` **and** the lowest voice's role ≠ `color`, whenever the chord has any non-color tone (always true for real chords). This is the new constraint that fixes the 6-on-top *and* the 6-in-bass (Am7) readings.

If filtering removes everything (degenerate chord), fall back to the floor-anchored ascending stack (today's Step 2 output) so there is always audible sound.

### Step 4 — Score and select

Among survivors, minimize:

```
cost =  W_LEAD       * (prevVoicing ? calculateDistance(prevVoicing, notes) : 0)
      + W_CENTER     * Σ |abs - REGISTER_CENTER|
      + W_SPAN       * (maxAbs - minAbs)
      + W_BASS_FIFTH * (bass role === "fifth" ? 1 : 0)
```

with **named, documented, adjustable constants** (`STRUM_VOICING_SCORE_WEIGHTS`), initial defaults:

| Constant | Value | Rationale |
|---|---|---|
| `W_LEAD` | `2` | Once a previous chord exists, smooth voice leading dominates. |
| `W_CENTER` | `1` | Keep the grip in a guitar-real register around C4. |
| `W_SPAN` | `0.3` | Mild preference for compact grips. |
| `W_BASS_FIFTH` | `5` | Mild discouragement of 5th-in-bass (2nd-inversion) grips when a root/3rd bass is available. |
| `REGISTER_CENTER` | `45` (A3) | The register the whole progression gravitates toward — the single register dial; tuned by ear. |

**Deterministic tie-break:** lower bass pitch, then lexicographic note-string order. Guarantees stable, repeatable selection (same contract as the close-voicing scorer).

These are starting values, eyeballed against real output and tuned. Golden tests pin the intended results so retuning is caught.

### Worked example — C6, no previous chord

Tones `{C:root, E:guide, G:fifth, A:color}`. Candidates that pass both filters: `C3 E3 A3 G4` (root bass) and `E3 A3 C4 G4` (3rd bass). Scores (`W_CENTER=1, W_SPAN=0.3`, no lead term): `C3 E3 A3 G4` → center 30, span 19 → 35.7; `E3 A3 C4 G4` → center 18, span 15 → 22.5. Winner: **`E3 A3 C4 G4`** — the drop-2 first inversion. The `A` (6th) is internal; the `G` (5th) is on top.

### Integration

Unchanged: the single call at `buildAllLayers.ts:231` (`buildVoicing(root, quality, lastVoicing, STRUM_PRESET)`). `getNearestInversion` is **not modified** — it remains the funk/bossa fallback for qualities without a hand-tuned grip.

## Blast radius (from call-graph analysis)

The chord-hit router (`buildAllLayers.ts:308`) sends only the "everything else" bucket through `buildVoicing`:

- **Changed (intended):** all default strum genres; Funk 16ths (entirely); the plain "stab"/"muted" hits inside Funk Scratch.
- **Unchanged:** Funk Scratch's root anchor + color stabs (own builders); Bossa comp + its LH bass (own builders); all bass patterns; drums; the entire fretboard overlay / visual close-voicing domain (`packages/core/shapes`).
- **`getNearestInversion`:** code unchanged. Only its *input* (`lastVoicing`) shifts, affecting funk/bossa fallback voicings for exotic qualities. A future consolidation could retire it once `buildVoicing` is the single inversion+voice-leading authority; out of scope here.

*Free win:* inverted grips (3rd in bass) stop doubling the bassline's low root, de-mudding the low end.

## Testing

- **Invariants over exact grips.** The exact C6 grip is **not** pinned — `REGISTER_CENTER` is a tunable register dial decided by ear (the `E3 A3 C4 G4` figure above is illustrative of the mechanism, not a fixed target). Assert that C6 contains all four tones with the 6th internal; let the register emerge from tuning. Replace the old `C3 E3 G3 A4` golden (it encoded the bug).
- **Invariants (all qualities × several roots, incl. a flat-key root):** no sub-minor-third interval below C4; top voice `≤ ceil`; **color tone is never the highest or lowest voice** when a non-color tone exists; guide tone present.
- **Voice leading:** given a `prevVoicing`, the result minimizes total semitone distance among the filtered candidates *and* still passes the color/spacing invariants.
- **Downstream (`buildAllLayers.test.ts`):** update the few assertions that pin specific default-path notes (e.g. the "C3 present" check) to the new inversions.
- **Funk/Bossa regression:** the existing `buildFunkColorVoicing`/`buildBossaColorVoicing` snapshots must remain unchanged (proves the builders are untouched).
- **Manual:** play C–G–Am–F with C6 in Rock; confirm the 6th no longer dominates and the grip sounds like a real comp voicing. Spot-check plain triads and 7ths.

## Scope & boundaries

- **In scope:** `buildVoicing` Steps 2–4 (roles, candidate generation, filters, scoring), the weight constants, tests.
- **Out of scope:** `generateVoicings`/fretboard grips (rejected — unnecessary dependency); funk/bossa builders; bass/drums; the close-voicing-fallback scorer (no amendment needed since audio does not consume it); retiring `getNearestInversion`.

## Risks

- **Weight tuning.** First-chord (no-prev) inversion choice is taste-sensitive; defaults are golden-pinned and adjustable. The voice-leading term governs all subsequent chords.
- **9th/13th placement.** The color-internal rule generalizes (9 and 13 also stay off the top/bottom), but their clusters are root↔9, not 5↔6; the generate-filter-score handles them by construction, and property tests assert the invariants across all qualities rather than asserting exact grips.
- **Behavior change is broad** (every default-genre strum re-voices). Mitigated by: the invariants hold for all qualities, plain triads/7ths stay compact and centered, and the change is confined per the blast-radius analysis.
