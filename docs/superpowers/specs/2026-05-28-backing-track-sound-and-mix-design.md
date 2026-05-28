# Backing-Track Sound Design & Mix Overhaul (Slice A+B)

**Status:** Design — approved, ready for implementation plan.
**Date:** 2026-05-28
**Predecessor:** `2026-05-21-backing-track-tonal-audit.md` (research/audit).
**Scope:** `src/progressions/audio/` (voices, bus, scheduler integration), `src/core/audio.ts` (reference), new `src/progressions/audio/sound/` modules, `src/store/audioAtoms.ts` (quality setting), settings UI.
**Out of scope (separate specs):** musical composition / voice-leading / humanization (slice C), real drum samples (slice D). Drafts for both are committed alongside this spec.

---

## 1. Goal

Raise backing-track quality far enough to stand in for a YouTube backing-track video, a looper-pedal loop, or an Ableton Live Lite jam. The Tone.js/Tonal migrations were runtime swaps that left timbre and signal processing untouched; the genre/pattern/swing work was a strong first compositional pass. This slice tackles the **sound** half: per-instrument timbre and the signal-processing/mix chain. The companion compositional half (slice C) and drum samples (slice D) follow.

Reference quality bar: the GuitarSynth (`src/core/audio.ts:106`) — a 6-partial custom additive oscillator `[1, 0.8, 0.45, 0.22, 0.12, 0.05]` + tuned ADSR + lowpass filter + master volume node. Every backing-track instrument should reach at least this bar; bass is the explicit priority because it is currently a bare sawtooth `Tone.MonoSynth` with a dead filter envelope (`octaves: 0`).

---

## 2. Approach (chosen)

**Declarative patch + preset catalog with a quality-tiered signal-graph builder.** Sound design is expressed as plain data (patch params, per-genre mix, quality-tier definitions). A builder materializes the Tone node graph for the active quality tier; pooled voices read patch config instead of hardcoded params.

Rejected alternatives:
- *Imperative per-voice rewrite* — params scattered across voice files; per-genre × per-tier config combinatorially explodes inside each file.
- *Sample-based pitched instruments* — contradicts the synth-based scope chosen for this slice and adds an asset bundle; samples are reserved for drums in slice D.

No new dependencies — all Tone.js built-ins.

---

## 3. New modules

All under `src/progressions/audio/sound/`:

### 3.1 `instrumentPatches.ts` — patch catalog (pure data)

A patch is a named, reusable tone preset. Genres reference patches by ID, so a small library covers all 7 genres without a unique one-off patch per genre.

```ts
type InstrumentFamily = "bass" | "chord" | "drumKit";

interface SynthVoiceSpec {
  oscillator: { type: "custom" | "sawtooth" | "sine" | "triangle" | "square"; partials?: number[] };
  envelope: { attack: number; decay: number; sustain: number; release: number };
  filter?: { type: "lowpass" | "highpass" | "bandpass"; frequency: number; Q: number };
  filterEnvelope?: { attack: number; decay: number; sustain: number; release: number; baseFrequency: number; octaves: number };
}

interface InsertSpec {                 // applied only on standard+ tiers
  eq3?: { low: number; mid: number; high: number };   // dB
  saturation?: { kind: "chebyshev" | "distortion"; amount: number };
  postFilter?: { type: "lowpass" | "highpass"; frequency: number; Q: number };
}

interface InstrumentPatch {
  id: string;
  family: InstrumentFamily;
  label: string;
  voice: SynthVoiceSpec;               // chord/bass synth params; for drumKit, see §3.1.3
  insert?: InsertSpec;
  volumeDb: number;                    // per-patch trim
}
```

#### 3.1.1 Bass patches (priority)

| id | genres | character | key params |
|----|--------|-----------|------------|
| `bass-upright` | jazz, ballad | woody acoustic | triangle+sine partials, attack ~15 ms, fast body decay, gentle LP, tiny pitch-decay transient |
| `bass-finger` | funk, pop | round electric finger | saw+square, **live filter envelope** (baseFreq ~250 Hz, octaves 2.5), light drive |
| `bass-pick` | rock | bright pick | brighter partials, attack ~4 ms, more upper harmonics, more cutoff |
| `bass-synth` | bossa, pop (alt) | smooth synth + sub | sine+saw with sub octave, smooth envelope |

The single most important fix: give bass a **moving filter envelope** (current `octaves: 0` is inert) and replace the naked saw with patch-driven oscillator content + per-patch insert EQ.

#### 3.1.2 Chord patches

| id | genres | character |
|----|--------|-----------|
| `chord-grand-piano` | pop, ballad, bossa | richer partials + longer release than current piano |
| `chord-epiano` | jazz (alt), funk | Rhodes-ish bell partials, bandpass insert |
| `chord-jazz-organ` | blues, jazz | drawbar-ish additive, gentle |
| `chord-rock-organ` | rock | organ + saturation insert |
| `chord-nylon-strum` / `chord-steel-strum` | rock/funk strum genres | refined pluck partials + strum lag (existing) |

Improve current piano/organ partials + envelopes; add filter motion where it adds life.

#### 3.1.3 Drum-kit patches

Drum patches refine the **synthesized** kit params per genre (kept synth-based this slice — samples are slice D). A `DrumKitPatch` carries per-voice param overrides for kick/snare/hat/openHat/ride:

| id | genres | character |
|----|--------|-----------|
| `kit-acoustic-rock` | rock, pop | boomy kick, bright snare |
| `kit-funk` | funk | tight punchy kick, crisp snare, tight hats |
| `kit-jazz-brush` | jazz | softer snare (brush-ish noise shaping), prominent ride |
| `kit-blues-shuffle` | blues | round kick, loose ride |
| `kit-ballad` / `kit-bossa` | ballad, bossa | soft dynamics, rim-ish snare, light kit |

### 3.2 `genreMixPresets.ts` — per-genre mix (pure data)

```ts
interface GenreMix {
  genre: GenreId;
  patches: { bass: string; chord: string; drumKit: string };  // patch IDs
  perInstrument: Record<"chord" | "bass" | "drums" | "metronome", {
    volumeDb: number; pan: number; reverbSend: number; delaySend?: number;
  }>;
  master: { compressor: { threshold: number; ratio: number; attack: number; release: number };
            reverb: { decay: number; wet: number }; limiterThreshold: number };
}
```

Examples of intent: ballad = wetter reverb + softer compression; funk = dry + punchy fast compression; jazz = moderate room, ride panned slightly. Pan defaults: bass/kick centered, hats/ride slightly off-center, chords lightly spread.

### 3.3 `qualityTiers.ts` — adaptive quality (pure data + detect fn)

```ts
type QualityTier = "eco" | "standard" | "high";

interface TierProfile {
  reverbEngine: "freeverb" | "jcreverb" | "convolution";
  perInstrumentInserts: boolean;
  delaySends: boolean;             // high only
  maxPolyphony: number;            // chord voice cap
  oversample: "none" | "2x";
}

function detectDefaultTier(): QualityTier;   // see §4
```

| tier | reverb | inserts | sends | polyphony |
|------|--------|---------|-------|-----------|
| eco | freeverb (light) | off | reverb only, low | capped |
| standard | freeverb/jcreverb | on (light EQ/sat) | reverb | mid |
| high | convolution | on (full) | reverb + delay | full |

### 3.4 `buildSignalGraph.ts` — node-graph builder

`buildSignalGraph(tier: TierProfile, mix: GenreMix): SignalGraph` constructs and wires the Tone node graph for the active tier and returns handles (layer channels, reverb send bus, master bus) for the scheduler/voices to connect into. Rebuilt only when tier or genre changes — never mid-step. Disposes the prior graph on rebuild.

---

## 4. Quality-tier selection

- **Default (auto):** `detectDefaultTier()` combines, conservatively:
  - `navigator.hardwareConcurrency` (cores),
  - `navigator.deviceMemory` (GB, where available),
  - the existing layout tier from `data-layout-tier` (mobile → eco, tablet → standard, desktop → high) as a fallback signal.
  Pick the lower of the hardware-derived and layout-derived results so weak devices never default high.
- **Setting:** new `audioQualityAtom` via `atomWithStorage` (`storage.ts` prefix), values `auto | eco | standard | high`, default `auto`. Exposed in the existing settings UI as a "Sound quality" select. `auto` resolves through `detectDefaultTier()`.
- **Apply:** changing the setting (or genre) triggers a graph rebuild on the next idle boundary, not mid-step. The audio-clock binding (`toneBus.ts` `Tone.setContext`) is load-bearing — do not disturb it.

---

## 5. Signal flow

```
genre ─→ genreMixPresets ─→ { patchIds, perInstrument mix, master }
audioQualityAtom ─→ qualityTiers.detect/resolve ─→ TierProfile
                                   │
                                   ▼
                       buildSignalGraph(tier, mix)
                                   │
 instrumentPatches ─→ pooled voices (bass / chord / drum / metronome)
                                   │  (per-instrument insert FX on standard+)
                                   ▼
              layer channels (volume + pan)  ──reverbSend──▶ shared reverb bus ┐
                                   │                                           │
                                   ▼                                           ▼
                      master glue: Compressor ─→ (reverb return mix) ─→ Limiter ─→ destination
```

Voice pooling lifecycle (`createReusableVoicePool`, `createReusableChordVoice`) is unchanged — pools now read a patch spec at lease time and connect into the insert/layer node provided by the graph instead of straight to a layer gain node.

---

## 6. Affected existing files

- `bus.ts` / `layerBuses.ts` — replace bare master `GainNode` + plain layer gains with channels carrying volume + pan, wired through the built graph.
- `bass.ts`, `instruments/pianoVoice.ts`, `instruments/organVoice.ts`, `instruments/strumVoice.ts`, `string.ts`, `metronome.ts`, `drumKit.ts` — params come from the active patch instead of inline constants; connect into provided insert/layer node.
- `genres.ts` — genre presets reference `genreMixPresets` (patch IDs + mix), keeping tempo/swing/pattern fields.
- `progressionAudioEngine.ts` — own the graph lifecycle (build/rebuild/dispose) keyed by `(tier, genre)`.
- `src/store/audioAtoms.ts` — add `audioQualityAtom`; settings UI gains the select.

---

## 7. Testing

Audio output itself is not asserted; structure is.

- **Catalog tests:** every patch has valid params and ranges; every genre maps to existing patch IDs across all families; every genre has a complete mix preset.
- **Tier tests:** `detectDefaultTier` returns conservative tier for given hardware/layout inputs (mocked); each `TierProfile` gates the documented features.
- **Graph builder tests:** correct node types present per tier (e.g. convolution reverb only on high; inserts absent on eco), chain wired source→insert→channel→send/master→destination, prior graph disposed on rebuild.
- **Integration:** existing `buildAllLayers.test.ts` and scheduler tests still pass; voices still pool/reuse (no per-hit construct/dispose regressions).
- Manual verification via dev server preview after implementation (listen per genre at each tier).

---

## 8. Risks & notes

- **Mobile CPU:** the eco tier exists precisely to protect low-power devices; the conservative auto-detect must err toward eco. Convolution reverb (high only) carries an init cost — generate lazily and cache.
- **Graph rebuild glitches:** rebuild only at idle/step boundaries with a short gain ramp (reuse existing `silence/restoreProgressionBus` 20/40 ms ramps) to avoid clicks.
- **Scope discipline:** no humanization, no voice-leading, no samples here — those are C/D. Resist bleed.
- **Backwards compatibility:** default `auto` should land at or below current perceived CPU on a given device; the bare-gain path is fully replaced, so verify no double-gain/clipping (limiter guards the ceiling).

---

## 9. Sequencing within the slice

1. Patch catalog + genre mix + quality-tier data modules (pure, fully unit-tested).
2. `buildSignalGraph` + master glue bus + layer channels (volume/pan) — wire eco tier first (no inserts).
3. Migrate voices to read patches; redo bass tone first (priority), then chords, then drum-kit patches.
4. Add per-instrument inserts + reverb send (standard tier), then convolution reverb + delay (high tier).
5. `audioQualityAtom` + settings select + auto-detect.
6. Verify per genre at each tier; tune mix presets by ear.
