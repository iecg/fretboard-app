# Accompaniment Quality & Genre System

Design spec for improving accompaniment quality across all instruments, introducing genre-based presets, expanding progression presets, and fixing several UX issues.

## Goals

1. Replace the single-instrument-per-role model with selectable chord instruments (strum, Rhodes piano, Hammond organ)
2. Introduce genre presets (Pop, Rock, Blues, Jazz, Ballad, Funk, Bossa Nova) that configure all instruments as a starting point, with per-instrument overrides
3. Add rhythm and note variety to bass patterns (walking, arpeggiated, shuffle, pedal, funk)
4. Add drum pattern + variation system (base patterns with fills and variations per genre)
5. Expand progression presets to 25+ curated entries across categories, plus scale-aware dynamic generation
6. Fix the 12-bar blues preset (collapse 12 x 1-bar steps into 7 multi-bar steps)
7. Change bar label display from abbreviated "2B" to spelled-out "2 bars"

## Non-Goals

- Real audio sample playback (stays Web Audio synthesis)
- User-editable custom patterns (patterns are predefined; user picks from the catalog)
- MIDI export
- Per-step genre or instrument changes (genre/instrument applies globally to the progression)

## Architecture

### Instrument Interface

Each chord instrument implements a common `ChordVoice` interface so the scheduler is instrument-agnostic:

```typescript
interface VoiceHandle {
  cancel(): void;
}

interface ChordVoice {
  scheduleChord(
    ctx: AudioContext,
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: { velocity: number },
  ): VoiceHandle;
}
```

Three chord instruments:

| Instrument | Synthesis | Character |
|---|---|---|
| **Guitar Strum** (existing) | Custom periodic wave, 18ms strum lag per note | Plucked, rhythmic |
| **Electric Piano** (new) | FM synthesis: modulator + carrier sine waves, bell-like attack with soft decay | Warm Rhodes tone |
| **Organ** (new) | Additive synthesis: stacked sine harmonics (drawbar model), sustained envelope | Hammond-like, sustained |

The strum instrument wraps existing `pluckString` with strum-lag spread. Piano and organ schedule all notes simultaneously with their respective synthesis.

Bass stays as a single synth engine (sawtooth oscillator + lowpass filter) but gains richer note selection. The `BassNoteRole` type expands:

```typescript
type BassNoteRole = "root" | "third" | "fifth" | "octave" | "chromatic-approach";
```

`chromatic-approach` resolves at schedule time to a semitone below the next chord's root. The scheduler receives the next chord's root note to enable this resolution. For the last step of a looping progression, the "next chord" wraps to the first step. For non-looping playback or when the next chord is unavailable, it falls back to a semitone below the current chord's root.

Drums gain a **ride cymbal** voice (filtered noise with longer decay) for jazz patterns, alongside the existing kick, snare, closed hi-hat, and open hi-hat.

### Pattern Data Model

All patterns use beat fractions within a single bar, same as the current system. Patterns become named and catalogued.

```typescript
interface ChordHit {
  beat: number;
  velocity: number;
  style?: "staccato" | "sustained";
  // "staccato" = short envelope (quick decay), used for rhythmic comping patterns
  // "sustained" = long envelope (slow release), used for ballad/pad-style voicings
  // Default (undefined) = instrument's natural envelope
}

interface ChordPattern {
  id: string;
  label: string;
  hits: readonly ChordHit[];
}

interface BassHit {
  beat: number;
  velocity: number;
  note: BassNoteRole;
}

interface BassPattern {
  id: string;
  label: string;
  hits: readonly BassHit[];
}

interface DrumHit {
  beat: number;
  velocity: number;
}

interface DrumPattern {
  id: string;
  label: string;
  kicks: readonly DrumHit[];
  snares: readonly DrumHit[];
  hats: readonly DrumHit[];
  openHats?: readonly DrumHit[];
  ride?: readonly DrumHit[];
}

interface DrumVariation {
  id: string;
  label: string;
  barInterval: number;      // e.g. 4 = triggers every 4th bar
  pattern: DrumPattern;     // replaces the base pattern for that bar
}
```

### Pattern Catalog

#### Chord Patterns

| ID | Label | Description |
|---|---|---|
| `pop-8ths` | Pop 8ths | Existing D-D-U-U-D-U strum pattern (default for strum instrument) |
| `ballad-whole` | Ballad Whole Notes | Single chord hit on beat 1, sustained |
| `offbeat-skank` | Offbeat Skank | Hits on the "and" of each beat (reggae/funk style) |
| `shuffle-comp` | Shuffle Comp | Swung comping pattern, hits on 1 and the "and" of 2 |
| `jazz-comp` | Jazz Comping | Syncopated hits — beat 1, "and" of 2, beat 4 |
| `straight-quarters` | Straight Quarters | One hit per beat, even velocity |

#### Bass Patterns

| ID | Label | Notes Used |
|---|---|---|
| `root-fifth` | Root-Fifth | Root on 1, fifth on 3 (existing) |
| `walking` | Walking Bass | Root, third, fifth, chromatic-approach per bar |
| `arpeggiated` | Arpeggiated | Root, third, fifth, octave in sequence |
| `shuffle` | Shuffle Bass | Swung root-fifth with 8th-note pickup |
| `pedal` | Pedal Tone | Root repeated as 8th notes |
| `funk-syncopated` | Funk Syncopated | Syncopated root/fifth/octave pattern |

#### Drum Patterns

| ID | Label | Key Features |
|---|---|---|
| `rock` | Rock | Existing kick 1/3, snare 2/4, 8th hats |
| `pop` | Pop | Lighter kick (beat 1 + "and" of 2), snare 2/4, 8th hats |
| `blues-shuffle` | Blues Shuffle | Swung hats, kick on 1/3, snare backbeat |
| `jazz-ride` | Jazz Ride | Ride cymbal pattern, kick comping, cross-stick on 4 |
| `bossa` | Bossa Nova | Cross-stick pattern, syncopated kick, no hats |
| `ballad` | Ballad | Half-time feel, kick on 1, snare on 3, sparse hats |
| `funk` | Funk | Syncopated kick, ghost snares, tight 16th hats |

#### Drum Variations

| ID | Description |
|---|---|
| `fill-every-4` | 1-bar fill replacing the base pattern every 4th bar |
| `open-hat-and-of-4` | Open hi-hat on the "and" of beat 4 each bar |
| `crash-bar-1` | Crash cymbal on beat 1 of bar 1 (loop start) |

### Genre Presets

A `GenreStyle` object bundles instrument and pattern defaults:

```typescript
interface GenreStyle {
  id: string;
  label: string;
  chordInstrument: "strum" | "piano" | "organ";
  chordPattern: string;
  bassPattern: string;
  drumPattern: string;
  drumVariations: string[];
  tempoRange: [number, number];
  suggestedTempo: number;
  swing: number;  // 0 = straight, 0.33 = triplet swing, up to 0.5
}
```

| Genre | Chord Instrument | Chord Pattern | Bass | Drums | Tempo | Swing |
|---|---|---|---|---|---|---|
| **Pop** | Piano | Straight Quarters | Root-Fifth | Pop | 100-130, default 115 | 0 |
| **Rock** | Strum | Pop 8ths | Root-Fifth | Rock | 110-140, default 120 | 0 |
| **Blues** | Organ | Shuffle Comp | Shuffle | Blues Shuffle | 70-110, default 85 | 0.33 |
| **Jazz** | Piano | Jazz Comping | Walking | Jazz Ride | 100-160, default 130 | 0.33 |
| **Ballad** | Piano | Ballad Whole Notes | Arpeggiated | Ballad | 60-80, default 70 | 0 |
| **Funk** | Strum | Offbeat Skank | Funk Syncopated | Funk | 90-120, default 100 | 0 |
| **Bossa Nova** | Piano | Straight Quarters | Arpeggiated | Bossa | 120-140, default 130 | 0 |

### Swing Implementation

The scheduler applies a swing factor when tiling patterns. Off-beat hits (at beat positions 0.5, 1.5, 2.5, 3.5) get time-shifted by `swing * (1/3) * secondsPerBeat` toward the next beat. This turns straight 8th notes into a triplet feel without requiring separate swung pattern data. The `swing` value ranges from 0 (straight) to 0.5 (maximum shuffle).

The swing transformation happens inside `repeatPatternToBeats` (or a new wrapper), so individual patterns remain in straight time and swing is applied uniformly.

## Progression Presets

### Expanded Curated Presets (~25 total)

Organized by category, each tagged with scale compatibility:

**Pop/Rock:**
- I-V-vi-IV (existing)
- I-vi-IV-V (existing)
- vi-IV-I-V
- I-IV-vi-V
- I-V-vi-iii-IV-I-IV-V (canon progression, 8-bar)

**Blues:**
- 12-bar blues (fixed: 6 steps — I 4bar, IV 2bar, I 2bar, V 1bar, IV 1bar, I 1bar, V 1bar, all Dom7)
- 8-bar blues (I 2bar, IV 2bar, I 1bar, V 1bar, I 1bar, V 1bar, all Dom7)
- Minor blues (i 4bar, iv 2bar, i 2bar, V 1bar, iv 1bar, i 1bar, V 1bar)

**Jazz:**
- ii-V-I (existing)
- I-vi-ii-V (turnaround)
- iii-vi-ii-V
- ii-V-I-vi (rhythm changes A section)
- I-IV-ii-V

**Folk/Country:**
- I-IV-V (existing)
- I-IV-I-V
- I-V-I-IV-I-V-I

**Modal:**
- Dorian: i-IV
- Dorian: i-bVII-IV
- Mixolydian: I-bVII-IV
- Phrygian: i-bII
- Lydian: I-II

**Minor:**
- i-iv-v
- i-bVI-bVII
- i-bVII-bVI-V (Andalusian cadence)
- i-iv-bVII-bIII

### Preset Data Model

The `ProgressionPreset` interface gains a `category` field for UI grouping:

```typescript
interface ProgressionPreset {
  id: string;
  label: string;
  category: "pop-rock" | "blues" | "jazz" | "folk" | "modal" | "minor";
  steps: Array<Omit<ProgressionStep, "id">>;
}
```

### 12-Bar Blues Fix

The current preset has 12 steps of 1-bar each. Replace with 6 steps:

```typescript
{
  id: "twelve-bar-blues",
  label: "12-bar blues",
  category: "blues",
  steps: [
    { degree: "I",  duration: { value: 4, unit: "bar" }, qualityOverride: "Dominant 7th" },
    { degree: "IV", duration: { value: 2, unit: "bar" }, qualityOverride: "Dominant 7th" },
    { degree: "I",  duration: { value: 2, unit: "bar" }, qualityOverride: "Dominant 7th" },
    { degree: "V",  duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
    { degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
    { degree: "I",  duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
    { degree: "V",  duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
  ],
}
```

Note: This is 7 steps totaling 12 bars (4+2+2+1+1+1+1). The original request specified I(4) IV(2) I(2) V(1) IV(1) I(1) V(1) which is the standard 12-bar form.

### Scale-Aware Generation

A new function `generateCommonProgressions(scaleName, rootNote)`:

1. Gets the degree sequence for the scale via `getDegreeSequence`
2. Resolves which degrees produce which chord qualities (major, minor, diminished)
3. Applies common harmonic rules:
   - **Cadential patterns**: Finds the dominant (V or equivalent) and tonic (I), generates ii-V-I, IV-V-I, etc.
   - **Diatonic cycles**: Builds descending-fifths chains from available degrees (iii-vi-ii-V-I)
   - **Modal color**: For modes, highlights the characteristic degree (Dorian IV major, Mixolydian bVII, Lydian #IV)
4. Returns `ProgressionPreset[]` filtered to only progressions where all degrees resolve in the current scale

Generated presets appear in the UI below curated presets, labeled "Suggested for [Scale Name]".

## State Management

### New Atoms

All persisted via `atomWithStorage` in `progressionAtoms.ts`:

| Atom | Type | Default | Storage Key |
|---|---|---|---|
| `progressionGenreStyleAtom` | `string` | `"rock"` | `ff:progressionGenreStyle` |
| `progressionChordInstrumentAtom` | `"strum" \| "piano" \| "organ"` | `"strum"` | `ff:progressionChordInstrument` |
| `progressionChordPatternAtom` | `string` | `"pop-8ths"` | `ff:progressionChordPattern` |
| `progressionBassPatternAtom` | `string` | `"root-fifth"` | `ff:progressionBassPattern` |
| `progressionDrumPatternAtom` | `string` | `"rock"` | `ff:progressionDrumPattern` |
| `progressionDrumVariationsAtom` | `string[]` | `[]` | `ff:progressionDrumVariations` |
| `progressionSwingAtom` | `number` | `0` | `ff:progressionSwing` |

### Renamed Atoms

- `progressionStrumEnabledAtom` → `progressionChordEnabledAtom` (storage key migrated: reads from old key `ff:progressionStrumEnabled` if new key absent, writes to new key `ff:progressionChordEnabled`)

### Genre Selection Action

A write-only atom `applyGenreStyleAtom` that, when set with a genre ID:

1. Looks up the `GenreStyle` from the catalog
2. Sets `progressionChordInstrumentAtom`, `progressionChordPatternAtom`, `progressionBassPatternAtom`, `progressionDrumPatternAtom`, `progressionDrumVariationsAtom`, `progressionSwingAtom` to the genre's defaults
3. Sets `progressionGenreStyleAtom` to the genre ID

Changing any individual instrument/pattern atom afterward sets `progressionGenreStyleAtom` to `"custom"` via a derived write atom.

### Scheduler Input Expansion

`SchedulerStepInput` gains new fields:

```typescript
interface SchedulerStepInput {
  // ... existing fields ...
  chordInstrument: "strum" | "piano" | "organ";
  chordPatternId: string;
  bassPatternId: string;
  drumPatternId: string;
  drumVariations: string[];
  swing: number;
  nextChordRoot?: string;  // for chromatic-approach bass resolution
}
```

## UI Changes

### Bar Label Display

In `ProgressionBlock.tsx`, `formatDurationShort` changes from abbreviations to spelled-out labels. The function is removed and the raw `formatProgressionDurationLabel` output is used directly:

- `"2 bars"` (was `"2B"`)
- `"1 bar"` (was `"1B"`)
- `"3 beats"` (was `"3bt"`)
- `"1 beat"` (was `"1bt"`)

### Progression Controls

The existing instrument toggle area in the progression panel gains:

1. **Genre selector** — dropdown at the top of the instrument section. Selecting a genre applies its defaults. Shows "(customized)" suffix when user has overridden individual settings.
2. **Chord instrument picker** — segmented control or dropdown (Strum / Piano / Organ) next to the chord enable toggle.
3. **Per-instrument pattern selectors** — small dropdown next to each instrument toggle (chord, bass, drums) showing the active pattern name. Opens to the pattern catalog filtered for that instrument.
4. **Swing control** — small slider or stepper (0% to 50%) visible when the genre has swing or when manually adjusted.

### Preset Selector

The progression preset dropdown becomes a grouped list:

- **Pop/Rock** section header, then presets
- **Blues** section header, then presets
- **Jazz** section header, then presets
- ... etc for each category
- Separator
- **Suggested for [Scale Name]** section with dynamically generated presets

## File Layout

New and modified files:

```text
src/progressions/
├── audio/
│   ├── instruments/
│   │   ├── types.ts              # ChordVoice interface, VoiceHandle
│   │   ├── strumVoice.ts         # Wraps existing pluckString
│   │   ├── pianoVoice.ts         # FM synthesis Rhodes
│   │   ├── organVoice.ts         # Additive synthesis Hammond
│   │   └── index.ts              # Instrument registry/lookup
│   ├── bass.ts                   # (modified) expanded note roles
│   ├── drumKit.ts                # (modified) add ride cymbal
│   ├── patterns.ts               # (expanded) full pattern catalog
│   ├── genres.ts                 # GenreStyle definitions
│   ├── scheduler.ts              # (refactored) instrument-agnostic; swing applied inline
│   ├── bus.ts                    # (unchanged)
│   ├── metronome.ts              # (unchanged)
│   ├── string.ts                 # (unchanged, used by strumVoice)
│   └── timeline.ts               # (unchanged)
├── progressionDomain.ts          # (modified) preset expansion + category
├── progressionGeneration.ts      # Scale-aware preset generation
├── progressionAudio.ts           # (modified) expanded bass note resolution
└── ...
```

## Testing Strategy

- **Unit tests** for each new instrument (pianoVoice, organVoice): verify they return VoiceHandles, schedule at correct times, respond to cancel
- **Unit tests** for pattern catalog: verify all patterns have valid beat ranges (0 to beatsPerBar), no duplicate IDs
- **Unit tests** for genre presets: verify all referenced pattern IDs exist in the catalog, all fields are valid
- **Unit tests** for swing: verify off-beat shifts are correct at various swing values
- **Unit tests** for scale-aware generation: verify generated presets resolve in their target scales
- **Unit tests** for 12-bar blues fix: verify 7 steps, 12 total bars, all Dom7
- **Unit tests** for bar label: verify "2 bars", "1 bar", "3 beats" output
- **Component tests** for updated ProgressionBlock: verify spelled-out duration labels
- **Component tests** for genre selector, instrument picker, pattern dropdowns
- **Existing tests** must continue passing (backwards compatibility)

## Backwards Compatibility

- Existing `localStorage` keys for strum/bass/drums enabled state carry over unchanged
- `progressionStrumEnabledAtom` key migration: reads from `ff:progressionStrumEnabled` if `ff:progressionChordEnabled` absent
- New atoms default to values matching current behavior: genre = "rock", chord instrument = "strum", chord pattern = "pop-8ths", bass pattern = "root-fifth", drum pattern = "rock", swing = 0
- Users with saved progressions hear the exact same thing on first load
- The 12-bar blues preset ID stays `"twelve-bar-blues"` — users who manually edited the old 12-step version will have a `"custom"` preset ID, so their steps are preserved. Only loading the preset fresh produces the new 7-step version.
