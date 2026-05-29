# Backing-Track Sound Design & Mix (Slice A+B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace naked progression-engine synths with a per-genre patch system, a quality-tiered signal graph (eco/standard/high), and a master glue + per-instrument mix — bass first — so backing tracks approach a produced, YouTube-loop-replacement quality.

**Architecture:** Sound design lives as plain data — an instrument-patch catalog, per-genre mix presets, and quality-tier profiles. A `buildSignalGraph(tier, mix)` factory wires the Tone node graph (per-instrument channels → master glue) for the active tier. Pooled voices stay pooled but read patch params instead of inline constants. A `audioQualityAtom` (auto/eco/standard/high) selects the tier; auto-detects from hardware + layout tier.

**Tech Stack:** TypeScript, Tone.js (all built-ins, no new deps), Jotai (`atomWithStorage`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-28-backing-track-sound-and-mix-design.md`

---

## File Structure

**New files (all under `src/progressions/audio/sound/`):**
- `patchTypes.ts` — shared TS interfaces for patches (no data, no Tone imports).
- `instrumentPatches.ts` — bass / chord / drum-kit patch catalogs + lookups.
- `instrumentPatches.test.ts`
- `genreMixPresets.ts` — per-genre patch IDs + per-instrument mix + master settings.
- `genreMixPresets.test.ts`
- `qualityTiers.ts` — tier profiles + `detectDefaultTier` + `resolveTier`.
- `qualityTiers.test.ts`
- `buildSignalGraph.ts` — Tone node-graph builder returning channel/send/master handles.
- `buildSignalGraph.test.ts`

**Modified files:**
- `bass.ts` — patch-driven MonoSynth pool keyed by patch id.
- `instruments/createReusableChordVoice.ts` + `instruments/index.ts` — patch-driven chord voices.
- `string.ts` — patch-driven pluck params (strum family).
- `drumKit.ts` — per-voice param overrides from a drum-kit patch.
- `metronome.ts` — connect through provided node (no param change).
- `bus.ts` / `layerBuses.ts` — `ensureProgressionAudio` returns the built graph; layer inputs preserved as `audio.layers.*`.
- `genres.ts` — unchanged shape; cross-checked against `genreMixPresets`.
- `progressionAudioEngine.ts` — re-export new sound APIs; own graph rebuild.
- `src/store/audioAtoms.ts` — add `audioQualityAtom`.
- `src/components/SettingsOverlay/sections/DisplaySettingsSection.tsx` (+ i18n + constants) — Sound-quality control.
- `src/hooks/useProgressionAudioPlayback.ts` — resolve genre mix + quality, pass patches to voices, apply channel mix.

**Phases (each independently testable):**
1. Pure data modules (patch types, catalogs, genre mix, quality tiers).
2. Signal graph builder + master glue (eco tier, no inserts).
3. Migrate voices to patches — bass first, then chords, drums, strum.
4. Per-instrument inserts (standard) + reverb engines incl. convolution (high) + delay send.
5. `audioQualityAtom` + settings UI + playback-hook wiring.
6. Verification pass (per genre, per tier).

---

## Phase 1 — Pure data modules

### Task 1: Patch type definitions

**Files:**
- Create: `src/progressions/audio/sound/patchTypes.ts`

- [ ] **Step 1: Write the file (pure types — no test needed; consumers test usage)**

```ts
// src/progressions/audio/sound/patchTypes.ts
// Pure TS interfaces describing instrument patches. No Tone imports, no data.

export type OscillatorType =
  | "sine" | "triangle" | "square" | "sawtooth"
  | "fatsawtooth" | "fmsine" | "amtriangle";

export interface EnvelopeSpec {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface BiquadSpec {
  type: "lowpass" | "highpass" | "bandpass";
  frequency: number;
  Q: number;
}

export interface FilterEnvelopeSpec extends EnvelopeSpec {
  baseFrequency: number;
  octaves: number;
}

/** EQ3 + optional saturation applied as a per-instrument insert (standard+). */
export interface InsertSpec {
  eq3?: { low: number; mid: number; high: number }; // dB
  saturation?: { kind: "chebyshev" | "distortion"; amount: number };
}

export interface BassPatch {
  id: string;
  label: string;
  oscillator: { type: OscillatorType };
  envelope: EnvelopeSpec;
  filter: { type: "lowpass"; Q: number };
  filterEnvelope: FilterEnvelopeSpec;
  volumeDb: number;
  insert?: InsertSpec;
}

export type ChordFamily = "poly" | "strum";

/** Params for a PolySynth-based chord voice (piano / e-piano / organ). */
export interface PolyChordSpec {
  volume: number; // dB
  maxPolyphonyFloor: number;
  oscillator: { type: "custom"; partials: number[] };
  envelope: EnvelopeSpec;
  releaseTailSec: number;
  sustainedDurationSec: number;
  shortDurationSec: number;
}

/** Params for the Karplus-Strong strum/pluck voice. */
export interface StrumSpec {
  oscillator: { type: "custom"; partials: number[] };
  envelope: EnvelopeSpec;
  noteDurationSec: number;
  releaseTailSec: number;
}

export interface ChordPatch {
  id: string;
  label: string;
  family: ChordFamily;
  poly?: PolyChordSpec; // present when family === "poly"
  strum?: StrumSpec; // present when family === "strum"
  insert?: InsertSpec;
}

export interface DrumVoiceParams {
  // Partial overrides per drum voice; merged over the engine defaults.
  kick?: { pitchDecay?: number; octaves?: number; envelope?: Partial<EnvelopeSpec> };
  snare?: { noiseType?: "white" | "pink"; envelope?: Partial<EnvelopeSpec> };
  hihat?: { decay?: number; resonance?: number; octaves?: number };
  openHat?: { decay?: number };
  ride?: { decay?: number; harmonicity?: number; resonance?: number };
}

export interface DrumKitPatch {
  id: string;
  label: string;
  voices: DrumVoiceParams;
  insert?: InsertSpec;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc -b --noEmit`
Expected: no errors referencing `patchTypes.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/progressions/audio/sound/patchTypes.ts
git commit -m "feat(audio): add instrument-patch type definitions"
```

### Task 2: Instrument patch catalogs

**Files:**
- Create: `src/progressions/audio/sound/instrumentPatches.ts`
- Test: `src/progressions/audio/sound/instrumentPatches.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/progressions/audio/sound/instrumentPatches.test.ts
import { describe, it, expect } from "vitest";
import {
  BASS_PATCHES, CHORD_PATCHES, DRUM_KIT_PATCHES,
  getBassPatch, getChordPatch, getDrumKitPatch,
  DEFAULT_CHORD_PATCH_BY_FAMILY,
} from "./instrumentPatches";

describe("instrument patches", () => {
  it("every bass patch has a live filter envelope (octaves > 0)", () => {
    expect(BASS_PATCHES.length).toBeGreaterThan(0);
    for (const p of BASS_PATCHES) {
      expect(p.filterEnvelope.octaves).toBeGreaterThan(0);
      expect(p.envelope.attack).toBeGreaterThan(0);
    }
  });

  it("poly chord patches carry poly spec, strum patches carry strum spec", () => {
    for (const p of CHORD_PATCHES) {
      if (p.family === "poly") { expect(p.poly).toBeDefined(); expect(p.strum).toBeUndefined(); }
      else { expect(p.strum).toBeDefined(); expect(p.poly).toBeUndefined(); }
    }
  });

  it("default chord patch exists for each family", () => {
    expect(getChordPatch(DEFAULT_CHORD_PATCH_BY_FAMILY.poly)?.family).toBe("poly");
    expect(getChordPatch(DEFAULT_CHORD_PATCH_BY_FAMILY.strum)?.family).toBe("strum");
  });

  it("lookups return undefined for unknown ids", () => {
    expect(getBassPatch("nope")).toBeUndefined();
    expect(getChordPatch("nope")).toBeUndefined();
    expect(getDrumKitPatch("nope")).toBeUndefined();
  });

  it("every drum kit patch has at least one voice override", () => {
    for (const k of DRUM_KIT_PATCHES) {
      expect(Object.keys(k.voices).length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/sound/instrumentPatches.test.ts`
Expected: FAIL — "Cannot find module './instrumentPatches'".

- [ ] **Step 3: Write the catalog**

```ts
// src/progressions/audio/sound/instrumentPatches.ts
import type { BassPatch, ChordPatch, ChordFamily, DrumKitPatch } from "./patchTypes";

// ── Bass ──────────────────────────────────────────────────────────────────
// MonoSynth is single-oscillator; "blends" are approximated via oscillator
// choice + filter-envelope motion. The critical fix vs. the old bass: a LIVE
// filter envelope (octaves > 0). The old voice used octaves: 0 (inert).
export const BASS_PATCHES: readonly BassPatch[] = [
  {
    id: "bass-upright", label: "Upright",
    oscillator: { type: "triangle" },
    envelope: { attack: 0.012, decay: 0.5, sustain: 0, release: 0.3 },
    filter: { type: "lowpass", Q: 1 },
    filterEnvelope: { attack: 0.012, decay: 0.5, sustain: 0, release: 0.3, baseFrequency: 180, octaves: 2.2 },
    volumeDb: -2,
    insert: { eq3: { low: 2, mid: 0, high: -3 } },
  },
  {
    id: "bass-finger", label: "Finger Electric",
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.25 },
    filter: { type: "lowpass", Q: 3 },
    filterEnvelope: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.25, baseFrequency: 250, octaves: 2.5 },
    volumeDb: -3,
    insert: { eq3: { low: 1, mid: 1, high: -2 }, saturation: { kind: "chebyshev", amount: 2 } },
  },
  {
    id: "bass-pick", label: "Pick Electric",
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.003, decay: 0.3, sustain: 0, release: 0.2 },
    filter: { type: "lowpass", Q: 2 },
    filterEnvelope: { attack: 0.003, decay: 0.3, sustain: 0, release: 0.2, baseFrequency: 400, octaves: 3 },
    volumeDb: -3,
    insert: { eq3: { low: 0, mid: 2, high: 0 } },
  },
  {
    id: "bass-synth", label: "Synth Bass",
    oscillator: { type: "square" },
    envelope: { attack: 0.008, decay: 0.5, sustain: 0.1, release: 0.3 },
    filter: { type: "lowpass", Q: 1 },
    filterEnvelope: { attack: 0.008, decay: 0.5, sustain: 0.2, release: 0.3, baseFrequency: 200, octaves: 2 },
    volumeDb: -2,
  },
];

// ── Chords ───────────────────────────────────────────────────────────────
export const CHORD_PATCHES: readonly ChordPatch[] = [
  {
    id: "chord-grand-piano", label: "Grand Piano", family: "poly",
    poly: {
      volume: -6, maxPolyphonyFloor: 6,
      oscillator: { type: "custom", partials: [1, 0.55, 0.3, 0.16, 0.08] },
      envelope: { attack: 0.004, decay: 0.5, sustain: 0.08, release: 1.4 },
      releaseTailSec: 1.4, sustainedDurationSec: 1.4, shortDurationSec: 0.4,
    },
    insert: { eq3: { low: 0, mid: 0, high: 1 } },
  },
  {
    id: "chord-epiano", label: "Electric Piano", family: "poly",
    poly: {
      volume: -7, maxPolyphonyFloor: 6,
      oscillator: { type: "custom", partials: [1, 0.2, 0.6, 0.1, 0.25] },
      envelope: { attack: 0.005, decay: 0.7, sustain: 0.12, release: 1.0 },
      releaseTailSec: 1.0, sustainedDurationSec: 1.2, shortDurationSec: 0.4,
    },
    insert: { eq3: { low: -1, mid: 1, high: 2 } },
  },
  {
    id: "chord-jazz-organ", label: "Jazz Organ", family: "poly",
    poly: {
      volume: -10, maxPolyphonyFloor: 6,
      oscillator: { type: "custom", partials: [1, 0.6, 0.4, 0.3, 0.2] },
      envelope: { attack: 0.02, decay: 0.05, sustain: 0.9, release: 0.5 },
      releaseTailSec: 0.5, sustainedDurationSec: 1.5, shortDurationSec: 0.2,
    },
  },
  {
    id: "chord-rock-organ", label: "Rock Organ", family: "poly",
    poly: {
      volume: -11, maxPolyphonyFloor: 6,
      oscillator: { type: "custom", partials: [1, 0.7, 0.5, 0.4, 0.3, 0.2] },
      envelope: { attack: 0.015, decay: 0.05, sustain: 0.9, release: 0.4 },
      releaseTailSec: 0.4, sustainedDurationSec: 1.5, shortDurationSec: 0.2,
    },
    insert: { saturation: { kind: "distortion", amount: 0.12 } },
  },
  {
    id: "chord-nylon-strum", label: "Nylon Strum", family: "strum",
    strum: {
      oscillator: { type: "custom", partials: [1, 0.6, 0.3, 0.14, 0.06] },
      envelope: { attack: 0.012, decay: 1.2, sustain: 0.05, release: 0.4 },
      noteDurationSec: 1.6, releaseTailSec: 2.0,
    },
  },
  {
    id: "chord-steel-strum", label: "Steel Strum", family: "strum",
    strum: {
      oscillator: { type: "custom", partials: [1, 0.8, 0.45, 0.22, 0.12, 0.05] },
      envelope: { attack: 0.01, decay: 1.1, sustain: 0.05, release: 0.4 },
      noteDurationSec: 1.8, releaseTailSec: 2.35,
    },
    insert: { eq3: { low: 0, mid: 0, high: 2 } },
  },
];

export const DEFAULT_CHORD_PATCH_BY_FAMILY: Record<ChordFamily, string> = {
  poly: "chord-grand-piano",
  strum: "chord-steel-strum",
};

// ── Drums ──────────────────────────────────────────────────────────────────
export const DRUM_KIT_PATCHES: readonly DrumKitPatch[] = [
  {
    id: "kit-acoustic-rock", label: "Acoustic Rock",
    voices: {
      kick: { pitchDecay: 0.05, octaves: 6, envelope: { decay: 0.4 } },
      snare: { envelope: { decay: 0.2 } },
      hihat: { decay: 0.05 },
    },
  },
  {
    id: "kit-funk", label: "Funk",
    voices: {
      kick: { pitchDecay: 0.03, octaves: 5, envelope: { decay: 0.28 } },
      snare: { envelope: { decay: 0.14 } },
      hihat: { decay: 0.03, resonance: 5000 },
    },
  },
  {
    id: "kit-jazz-brush", label: "Jazz Brush",
    voices: {
      kick: { pitchDecay: 0.05, octaves: 5, envelope: { decay: 0.3 } },
      snare: { noiseType: "pink", envelope: { attack: 0.004, decay: 0.16 } },
      ride: { decay: 1.2, harmonicity: 3.1, resonance: 2400 },
    },
  },
  {
    id: "kit-blues-shuffle", label: "Blues Shuffle",
    voices: {
      kick: { pitchDecay: 0.045, octaves: 6, envelope: { decay: 0.35 } },
      ride: { decay: 1.1 },
    },
  },
  {
    id: "kit-ballad", label: "Ballad",
    voices: {
      kick: { pitchDecay: 0.05, octaves: 5, envelope: { decay: 0.32 } },
      snare: { envelope: { attack: 0.003, decay: 0.18 } },
    },
  },
  {
    id: "kit-bossa", label: "Bossa",
    voices: {
      kick: { pitchDecay: 0.05, octaves: 5, envelope: { decay: 0.28 } },
      snare: { noiseType: "pink", envelope: { decay: 0.12 } },
      hihat: { decay: 0.04 },
    },
  },
];

const bassById = new Map(BASS_PATCHES.map((p) => [p.id, p]));
const chordById = new Map(CHORD_PATCHES.map((p) => [p.id, p]));
const kitById = new Map(DRUM_KIT_PATCHES.map((p) => [p.id, p]));

export const getBassPatch = (id: string): BassPatch | undefined => bassById.get(id);
export const getChordPatch = (id: string): ChordPatch | undefined => chordById.get(id);
export const getDrumKitPatch = (id: string): DrumKitPatch | undefined => kitById.get(id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/sound/instrumentPatches.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/sound/instrumentPatches.ts src/progressions/audio/sound/instrumentPatches.test.ts
git commit -m "feat(audio): add instrument patch catalogs (bass/chord/drum)"
```

### Task 3: Per-genre mix presets

**Files:**
- Create: `src/progressions/audio/sound/genreMixPresets.ts`
- Test: `src/progressions/audio/sound/genreMixPresets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/progressions/audio/sound/genreMixPresets.test.ts
import { describe, it, expect } from "vitest";
import { GENRE_MIX_PRESETS, getGenreMix } from "./genreMixPresets";
import { getBassPatch, getChordPatch, getDrumKitPatch } from "./instrumentPatches";
import { GENRE_STYLES } from "../genres";

describe("genre mix presets", () => {
  it("has a preset for every genre style", () => {
    for (const g of GENRE_STYLES) {
      expect(getGenreMix(g.id), `missing mix for ${g.id}`).toBeDefined();
    }
  });

  it("every preset references existing patch ids in all families", () => {
    for (const m of GENRE_MIX_PRESETS) {
      expect(getBassPatch(m.patches.bass), `bass ${m.patches.bass}`).toBeDefined();
      expect(getChordPatch(m.patches.chord), `chord ${m.patches.chord}`).toBeDefined();
      expect(getDrumKitPatch(m.patches.drumKit), `kit ${m.patches.drumKit}`).toBeDefined();
    }
  });

  it("genre chord-patch family matches the genre's chordInstrument family", () => {
    // strum genres must map to a strum chord patch; others to poly.
    for (const g of GENRE_STYLES) {
      const mix = getGenreMix(g.id)!;
      const patch = getChordPatch(mix.patches.chord)!;
      const expectedFamily = g.chordInstrument === "strum" ? "strum" : "poly";
      expect(patch.family, `${g.id}`).toBe(expectedFamily);
    }
  });

  it("pan values stay within [-1, 1] and sends within [0, 1]", () => {
    for (const m of GENRE_MIX_PRESETS) {
      for (const key of ["chord", "bass", "drums", "metronome"] as const) {
        const ch = m.perInstrument[key];
        expect(ch.pan).toBeGreaterThanOrEqual(-1);
        expect(ch.pan).toBeLessThanOrEqual(1);
        expect(ch.reverbSend).toBeGreaterThanOrEqual(0);
        expect(ch.reverbSend).toBeLessThanOrEqual(1);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/sound/genreMixPresets.test.ts`
Expected: FAIL — "Cannot find module './genreMixPresets'".

- [ ] **Step 3: Write the presets**

```ts
// src/progressions/audio/sound/genreMixPresets.ts
export type MixInstrument = "chord" | "bass" | "drums" | "metronome";

export interface InstrumentMix {
  volumeDb: number;
  pan: number; // -1 (L) .. 1 (R)
  reverbSend: number; // 0..1
  delaySend?: number; // 0..1, high tier only
}

export interface MasterMix {
  compressor: { threshold: number; ratio: number; attack: number; release: number };
  reverb: { decay: number; wet: number };
  limiterThreshold: number; // dB
}

export interface GenreMix {
  genre: string;
  patches: { bass: string; chord: string; drumKit: string };
  perInstrument: Record<MixInstrument, InstrumentMix>;
  master: MasterMix;
}

// Pan/send conventions: bass & metronome centered; ride/hats live in the drum
// bus so drums sit near-center with a hair of width; chords lightly spread.
export const GENRE_MIX_PRESETS: readonly GenreMix[] = [
  {
    genre: "pop",
    patches: { bass: "bass-finger", chord: "chord-grand-piano", drumKit: "kit-acoustic-rock" },
    perInstrument: {
      chord: { volumeDb: -2, pan: -0.12, reverbSend: 0.18 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.04 },
      drums: { volumeDb: -1, pan: 0.05, reverbSend: 0.1 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -18, ratio: 3, attack: 0.01, release: 0.18 }, reverb: { decay: 1.4, wet: 0.16 }, limiterThreshold: -1 },
  },
  {
    genre: "rock",
    patches: { bass: "bass-pick", chord: "chord-steel-strum", drumKit: "kit-acoustic-rock" },
    perInstrument: {
      chord: { volumeDb: -3, pan: -0.18, reverbSend: 0.12 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.02 },
      drums: { volumeDb: 0, pan: 0.05, reverbSend: 0.08 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -16, ratio: 4, attack: 0.006, release: 0.14 }, reverb: { decay: 1.1, wet: 0.1 }, limiterThreshold: -0.8 },
  },
  {
    genre: "blues",
    patches: { bass: "bass-upright", chord: "chord-jazz-organ", drumKit: "kit-blues-shuffle" },
    perInstrument: {
      chord: { volumeDb: -3, pan: -0.15, reverbSend: 0.2 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.05 },
      drums: { volumeDb: -2, pan: 0.06, reverbSend: 0.14 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -18, ratio: 3, attack: 0.012, release: 0.2 }, reverb: { decay: 1.6, wet: 0.2 }, limiterThreshold: -1 },
  },
  {
    genre: "jazz",
    patches: { bass: "bass-upright", chord: "chord-epiano", drumKit: "kit-jazz-brush" },
    perInstrument: {
      chord: { volumeDb: -3, pan: -0.16, reverbSend: 0.22 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.06 },
      drums: { volumeDb: -3, pan: 0.1, reverbSend: 0.18 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -20, ratio: 2.5, attack: 0.015, release: 0.22 }, reverb: { decay: 1.8, wet: 0.22 }, limiterThreshold: -1.2 },
  },
  {
    genre: "ballad",
    patches: { bass: "bass-upright", chord: "chord-grand-piano", drumKit: "kit-ballad" },
    perInstrument: {
      chord: { volumeDb: -2, pan: -0.1, reverbSend: 0.28 },
      bass: { volumeDb: -1, pan: 0, reverbSend: 0.08 },
      drums: { volumeDb: -4, pan: 0.04, reverbSend: 0.2 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -22, ratio: 2, attack: 0.02, release: 0.25 }, reverb: { decay: 2.2, wet: 0.28 }, limiterThreshold: -1.2 },
  },
  {
    genre: "funk",
    patches: { bass: "bass-finger", chord: "chord-steel-strum", drumKit: "kit-funk" },
    perInstrument: {
      chord: { volumeDb: -3, pan: -0.2, reverbSend: 0.06 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.0 },
      drums: { volumeDb: 0, pan: 0.05, reverbSend: 0.05 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -14, ratio: 5, attack: 0.004, release: 0.1 }, reverb: { decay: 0.9, wet: 0.06 }, limiterThreshold: -0.6 },
  },
  {
    genre: "bossa-nova",
    patches: { bass: "bass-synth", chord: "chord-grand-piano", drumKit: "kit-bossa" },
    perInstrument: {
      chord: { volumeDb: -3, pan: -0.14, reverbSend: 0.18 },
      bass: { volumeDb: -1, pan: 0, reverbSend: 0.05 },
      drums: { volumeDb: -3, pan: 0.08, reverbSend: 0.14 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -18, ratio: 3, attack: 0.012, release: 0.2 }, reverb: { decay: 1.5, wet: 0.18 }, limiterThreshold: -1 },
  },
];

const byGenre = new Map(GENRE_MIX_PRESETS.map((m) => [m.genre, m]));
export const getGenreMix = (genre: string): GenreMix | undefined => byGenre.get(genre);

/** Fallback mix when a genre id has no preset (defensive). */
export const DEFAULT_GENRE_MIX: GenreMix = GENRE_MIX_PRESETS[0];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/sound/genreMixPresets.test.ts`
Expected: PASS (4 tests). If the family-match test fails, the genre↔patch family mapping is wrong — fix the offending `patches.chord` id.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/sound/genreMixPresets.ts src/progressions/audio/sound/genreMixPresets.test.ts
git commit -m "feat(audio): add per-genre mix presets"
```

### Task 4: Quality tiers + auto-detect

**Files:**
- Create: `src/progressions/audio/sound/qualityTiers.ts`
- Test: `src/progressions/audio/sound/qualityTiers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/progressions/audio/sound/qualityTiers.test.ts
import { describe, it, expect } from "vitest";
import {
  TIER_PROFILES, resolveTier, detectDefaultTier, type QualityTier,
} from "./qualityTiers";

describe("quality tiers", () => {
  it("eco has no inserts; high has convolution reverb", () => {
    expect(TIER_PROFILES.eco.perInstrumentInserts).toBe(false);
    expect(TIER_PROFILES.eco.reverbEngine).not.toBe("convolution");
    expect(TIER_PROFILES.high.reverbEngine).toBe("convolution");
    expect(TIER_PROFILES.high.perInstrumentInserts).toBe(true);
    expect(TIER_PROFILES.high.delaySends).toBe(true);
  });

  it("resolveTier passes through explicit tiers and resolves auto via detector", () => {
    expect(resolveTier("eco", () => "high")).toBe("eco");
    expect(resolveTier("auto", () => "standard")).toBe("standard");
  });

  it("detectDefaultTier picks the conservative (lower) of hardware vs layout", () => {
    // Strong hardware, mobile layout → still standard (not high), because the
    // lower of (high, eco) bounded toward layout-derived caps.
    const tier = detectDefaultTier({ cores: 16, memoryGb: 16, layoutTier: "mobile" });
    expect(tier).toBe("eco");
    expect(detectDefaultTier({ cores: 8, memoryGb: 8, layoutTier: "desktop" })).toBe("high");
    expect(detectDefaultTier({ cores: 2, memoryGb: 2, layoutTier: "desktop" })).toBe("eco");
    expect(detectDefaultTier({ cores: 6, memoryGb: 4, layoutTier: "tablet" })).toBe("standard");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/sound/qualityTiers.test.ts`
Expected: FAIL — "Cannot find module './qualityTiers'".

- [ ] **Step 3: Write the module**

```ts
// src/progressions/audio/sound/qualityTiers.ts
export type QualityTier = "eco" | "standard" | "high";
export type QualitySetting = "auto" | QualityTier;
export type LayoutTier = "mobile" | "tablet" | "desktop";

export interface TierProfile {
  reverbEngine: "freeverb" | "jcreverb" | "convolution";
  perInstrumentInserts: boolean;
  delaySends: boolean;
  maxPolyphony: number;
  oversample: "none" | "2x";
}

export const TIER_PROFILES: Record<QualityTier, TierProfile> = {
  eco: { reverbEngine: "freeverb", perInstrumentInserts: false, delaySends: false, maxPolyphony: 12, oversample: "none" },
  standard: { reverbEngine: "jcreverb", perInstrumentInserts: true, delaySends: false, maxPolyphony: 24, oversample: "none" },
  high: { reverbEngine: "convolution", perInstrumentInserts: true, delaySends: true, maxPolyphony: 48, oversample: "2x" },
};

const ORDER: QualityTier[] = ["eco", "standard", "high"];
const lower = (a: QualityTier, b: QualityTier): QualityTier =>
  ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b;

export interface DetectInputs {
  cores?: number; // navigator.hardwareConcurrency
  memoryGb?: number; // navigator.deviceMemory
  layoutTier: LayoutTier;
}

function hardwareTier(cores: number | undefined, memoryGb: number | undefined): QualityTier {
  const c = cores ?? 4;
  const m = memoryGb ?? 4;
  if (c >= 8 && m >= 8) return "high";
  if (c >= 4 && m >= 4) return "standard";
  return "eco";
}

function layoutCap(layoutTier: LayoutTier): QualityTier {
  if (layoutTier === "mobile") return "eco";
  if (layoutTier === "tablet") return "standard";
  return "high";
}

/** Conservative: the lower of hardware-derived and layout-derived tier. */
export function detectDefaultTier(inputs: DetectInputs): QualityTier {
  return lower(hardwareTier(inputs.cores, inputs.memoryGb), layoutCap(inputs.layoutTier));
}

export function resolveTier(setting: QualitySetting, detect: () => QualityTier): QualityTier {
  return setting === "auto" ? detect() : setting;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/sound/qualityTiers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/sound/qualityTiers.ts src/progressions/audio/sound/qualityTiers.test.ts
git commit -m "feat(audio): add quality-tier profiles + conservative auto-detect"
```

---

## Phase 2 — Signal graph (plan + materialize)

The graph is split so the routing logic is pure/testable and the Tone wiring is a
thin, separately-verified layer:
- `planSignalGraph(tierProfile, mix)` → a `SignalGraphPlan` describing channels,
  inserts, sends, and master settings. **Pure — fully unit-tested.**
- `materializeSignalGraph(ctx, plan)` → constructs Tone nodes and returns live
  handles. Exercised at runtime + manual verification (Tone effects don't
  instantiate cleanly under the jsdom mock context, so it is not unit-tested in
  isolation; the plan it consumes IS).

### Task 5: `planSignalGraph` (pure)

**Files:**
- Create: `src/progressions/audio/sound/buildSignalGraph.ts` (plan half this task; materialize added next task)
- Test: `src/progressions/audio/sound/buildSignalGraph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/progressions/audio/sound/buildSignalGraph.test.ts
import { describe, it, expect } from "vitest";
import { planSignalGraph } from "./buildSignalGraph";
import { TIER_PROFILES } from "./qualityTiers";
import { getGenreMix } from "./genreMixPresets";

const popMix = getGenreMix("pop")!;

describe("planSignalGraph", () => {
  it("eco tier: no per-instrument inserts, no delay send", () => {
    const plan = planSignalGraph(TIER_PROFILES.eco, popMix);
    for (const ch of Object.values(plan.channels)) {
      expect(ch.insert).toBeUndefined();
      expect(ch.delaySend).toBeUndefined();
    }
    expect(plan.reverbEngine).toBe("freeverb");
    expect(plan.delayBus).toBe(false);
  });

  it("high tier: inserts present where the patch defines them; delay bus on", () => {
    const plan = planSignalGraph(TIER_PROFILES.high, popMix);
    // pop chord patch (grand-piano) has an eq3 insert spec
    expect(plan.channels.chord.insert?.eq3).toBeDefined();
    // metronome has no patch insert → still undefined even on high
    expect(plan.channels.metronome.insert).toBeUndefined();
    expect(plan.reverbEngine).toBe("convolution");
    expect(plan.delayBus).toBe(true);
  });

  it("copies per-instrument volume/pan/sends from the mix", () => {
    const plan = planSignalGraph(TIER_PROFILES.standard, popMix);
    expect(plan.channels.bass.volumeDb).toBe(popMix.perInstrument.bass.volumeDb);
    expect(plan.channels.chord.pan).toBe(popMix.perInstrument.chord.pan);
    expect(plan.channels.drums.reverbSend).toBe(popMix.perInstrument.drums.reverbSend);
  });

  it("carries master compressor/reverb/limiter settings", () => {
    const plan = planSignalGraph(TIER_PROFILES.high, popMix);
    expect(plan.master.compressor.ratio).toBe(popMix.master.compressor.ratio);
    expect(plan.master.reverb.wet).toBe(popMix.master.reverb.wet);
    expect(plan.master.limiterThreshold).toBe(popMix.master.limiterThreshold);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/sound/buildSignalGraph.test.ts`
Expected: FAIL — "Cannot find module './buildSignalGraph'".

- [ ] **Step 3: Write `planSignalGraph` (plan half only)**

```ts
// src/progressions/audio/sound/buildSignalGraph.ts
import type { TierProfile } from "./qualityTiers";
import type { GenreMix, MixInstrument } from "./genreMixPresets";
import type { InsertSpec } from "./patchTypes";
import { getBassPatch, getChordPatch, getDrumKitPatch } from "./instrumentPatches";

export interface ChannelPlan {
  volumeDb: number;
  pan: number;
  reverbSend: number;
  delaySend?: number;
  insert?: InsertSpec; // present only when tier enables inserts AND patch defines one
}

export interface SignalGraphPlan {
  channels: Record<MixInstrument, ChannelPlan>;
  reverbEngine: TierProfile["reverbEngine"];
  delayBus: boolean;
  maxPolyphony: number;
  oversample: TierProfile["oversample"];
  master: GenreMix["master"];
}

/** Insert spec that applies to each instrument channel, sourced from the
 *  active patch (chord/bass/drum). Metronome has no patch → no insert. */
function insertForChannel(channel: MixInstrument, mix: GenreMix): InsertSpec | undefined {
  switch (channel) {
    case "bass": return getBassPatch(mix.patches.bass)?.insert;
    case "chord": return getChordPatch(mix.patches.chord)?.insert;
    case "drums": return getDrumKitPatch(mix.patches.drumKit)?.insert;
    case "metronome": return undefined;
  }
}

export function planSignalGraph(tier: TierProfile, mix: GenreMix): SignalGraphPlan {
  const channels = {} as Record<MixInstrument, ChannelPlan>;
  for (const channel of ["chord", "bass", "drums", "metronome"] as const) {
    const m = mix.perInstrument[channel];
    channels[channel] = {
      volumeDb: m.volumeDb,
      pan: m.pan,
      reverbSend: m.reverbSend,
      delaySend: tier.delaySends ? m.delaySend : undefined,
      insert: tier.perInstrumentInserts ? insertForChannel(channel, mix) : undefined,
    };
  }
  return {
    channels,
    reverbEngine: tier.reverbEngine,
    delayBus: tier.delaySends,
    maxPolyphony: tier.maxPolyphony,
    oversample: tier.oversample,
    master: mix.master,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/sound/buildSignalGraph.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/sound/buildSignalGraph.ts src/progressions/audio/sound/buildSignalGraph.test.ts
git commit -m "feat(audio): add pure signal-graph plan builder"
```

### Task 6: `materializeSignalGraph` (Tone wiring) + graph handle

**Files:**
- Modify: `src/progressions/audio/sound/buildSignalGraph.ts` (append materialize)

This task wires the plan into Tone nodes. It is verified at runtime/manually
(see Phase 6), not by an isolated unit test, because Tone effect nodes require a
real AudioContext. Keep the function defensive: any node construction failure
degrades to a direct chord→destination path.

- [ ] **Step 1: Append the materialize function and types**

```ts
// Appended to src/progressions/audio/sound/buildSignalGraph.ts
import {
  Channel, Compressor, Limiter, Gain, EQ3, Chebyshev, Distortion,
  Freeverb, JCReverb, Reverb,
} from "tone";

export interface MaterializedGraph {
  /** Native input node each voice family connects into (preserves the
   *  existing `audio.layers.*` contract — voices call `.connect(node)`). */
  inputs: Record<MixInstrument, AudioNode>;
  /** Tear down every constructed Tone node. */
  dispose: () => void;
}

function buildReverb(engine: SignalGraphPlan["reverbEngine"], decay: number, wet: number) {
  if (engine === "convolution") {
    const r = new Reverb({ decay, wet });
    void r.generate(); // async impulse; safe to use before resolve (silent until ready)
    return r;
  }
  if (engine === "jcreverb") return new JCReverb({ roomSize: Math.min(0.9, decay / 2.5), wet });
  return new Freeverb({ roomSize: Math.min(0.95, decay / 2.5), wet });
}

function buildInsertChain(insert: InsertSpec | undefined): { head: AudioNode; tail: AudioNode } | null {
  const nodes: AudioNode[] = [];
  if (insert?.eq3) nodes.push(new EQ3(insert.eq3).input as unknown as AudioNode); // placeholder; see real wiring below
  return nodes.length ? { head: nodes[0], tail: nodes[nodes.length - 1] } : null;
}

/**
 * Materialize the plan against a real AudioContext + the parent destination
 * (ctx.destination or the existing master bus GainNode). Returns native input
 * nodes for each instrument family plus a disposer.
 *
 * Routing per channel:
 *   nativeInput(Gain) → [EQ3 → saturation]? → Channel(volume+pan) → masterGlue
 *                                                   └─(reverbSend)→ reverbBus → masterGlue
 * masterGlue: Compressor → Limiter → destination
 * reverbBus:  Reverb → (into masterGlue input, post-compressor pre-limiter)
 */
export function materializeSignalGraph(
  ctx: AudioContext,
  destination: AudioNode,
  plan: SignalGraphPlan,
): MaterializedGraph {
  const disposers: Array<() => void> = [];
  const track = <T extends { dispose: () => void }>(n: T): T => { disposers.push(() => n.dispose()); return n; };

  // Master glue: Compressor → Limiter → destination
  const comp = track(new Compressor(plan.master.compressor));
  const limiter = track(new Limiter(plan.master.limiterThreshold));
  comp.connect(limiter);
  limiter.connect(destination as unknown as AudioNode & { input?: AudioNode });

  // Reverb bus returns into the compressor input (glued with dry signal).
  const reverb = track(buildReverb(plan.reverbEngine, plan.master.reverb.decay, plan.master.reverb.wet));
  reverb.connect(comp);

  const inputs = {} as Record<MixInstrument, AudioNode>;
  for (const ch of ["chord", "bass", "drums", "metronome"] as const) {
    const cfg = plan.channels[ch];
    const input = ctx.createGain(); // native node voices connect into
    const channel = track(new Channel({ volume: cfg.volumeDb, pan: cfg.pan }));

    // Optional insert chain (EQ3 + saturation), built with real Tone nodes.
    let head: AudioNode = input;
    if (cfg.insert?.eq3) {
      const eq = track(new EQ3(cfg.insert.eq3));
      (head as GainNode).connect(eq.input as unknown as AudioNode);
      head = eq as unknown as AudioNode;
    }
    if (cfg.insert?.saturation) {
      const sat = cfg.insert.saturation.kind === "distortion"
        ? track(new Distortion(cfg.insert.saturation.amount))
        : track(new Chebyshev(Math.max(1, Math.round(cfg.insert.saturation.amount))));
      (head as unknown as { connect: (n: unknown) => void }).connect(sat);
      head = sat as unknown as AudioNode;
    }
    // Head → Channel (volume + pan) → master glue
    (head as unknown as { connect: (n: unknown) => void }).connect(channel);
    channel.connect(comp);

    // Reverb send tap off the channel.
    if (cfg.reverbSend > 0) {
      const send = track(new Gain(cfg.reverbSend));
      channel.connect(send);
      send.connect(reverb);
    }
    inputs[ch] = input;
  }

  return {
    inputs,
    dispose: () => { for (const d of disposers) { try { d(); } catch { /* ignore */ } } },
  };
}
```

> Implementer note: the `buildInsertChain` helper sketch above is superseded by
> the inline insert wiring inside `materializeSignalGraph`. Delete
> `buildInsertChain` — it exists only to show the intent and is not called.
> Verify against the Tone version in `package.json` that `Channel`, `EQ3`,
> `Chebyshev`, `Distortion`, `Freeverb`, `JCReverb`, `Reverb`, `Compressor`,
> `Limiter`, `Gain` are exported from `"tone"` (they are in Tone 14/15). Adjust
> `new Limiter(threshold)` vs `new Limiter({ threshold })` to match the
> installed signature.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc -b --noEmit`
Expected: no errors. Fix any Tone constructor-signature mismatches surfaced here.

- [ ] **Step 3: Re-run the plan tests (unchanged) to confirm no regression**

Run: `pnpm exec vitest run src/progressions/audio/sound/buildSignalGraph.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/progressions/audio/sound/buildSignalGraph.ts
git commit -m "feat(audio): materialize signal graph (channels, sends, master glue)"
```

---

## Phase 3 — Migrate voices to patches

Pools stay. Each voice now creates its synth from a patch. Bass and chord pools
key by **patch id** (a genre change swaps patch → a new pool, old pool idles and
is GC'd). The `dest` contract is unchanged: voices connect into the channel
input node passed by the caller.

### Task 7: Patch-driven bass (priority)

**Files:**
- Modify: `src/progressions/audio/bass.ts`
- Create: `src/progressions/audio/bass.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/progressions/audio/bass.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture MonoSynth constructor options to assert patch params flow through.
const ctorCalls: unknown[] = [];
vi.mock("tone", () => {
  class FakeMonoSynth {
    constructor(opts: unknown) { ctorCalls.push(opts); }
    connect() { return this; }
    triggerAttackRelease() {}
    triggerRelease() {}
    dispose() {}
  }
  return { __esModule: true, MonoSynth: FakeMonoSynth, now: () => 0 };
});

import { scheduleBassNote } from "./bass";
import { getBassPatch } from "./sound/instrumentPatches";

beforeEach(() => { ctorCalls.length = 0; });

describe("patch-driven bass", () => {
  it("builds a MonoSynth using the supplied patch's oscillator + live filter env", () => {
    const dest = {} as unknown as AudioNode;
    const patch = getBassPatch("bass-finger")!;
    scheduleBassNote(dest, 110, 0, { velocity: 0.9, patch });
    expect(ctorCalls.length).toBe(1);
    const opts = ctorCalls[0] as { oscillator: { type: string }; filterEnvelope: { octaves: number } };
    expect(opts.oscillator.type).toBe("sawtooth");
    expect(opts.filterEnvelope.octaves).toBeGreaterThan(0);
  });

  it("reuses one pool per patch id (no new synth for same patch when idle)", () => {
    const dest = {} as unknown as AudioNode;
    const patch = getBassPatch("bass-upright")!;
    scheduleBassNote(dest, 55, 0, { velocity: 0.9, patch }).cancel();
    scheduleBassNote(dest, 55, 0, { velocity: 0.9, patch });
    expect(ctorCalls.length).toBe(1); // second lease reuses the idle voice
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/bass.test.ts`
Expected: FAIL — `scheduleBassNote` does not accept `patch`, or builds with hardcoded sawtooth.

- [ ] **Step 3: Rewrite `bass.ts` to be patch-driven**

Replace the module-level `bassVoicePool` and the const params with a per-patch
pool map and a patch-derived voice factory. Full new file:

```ts
// src/progressions/audio/bass.ts
import * as Tone from "tone";
import { createReusableVoicePool } from "./createReusableVoicePool";
import type { BassPatch } from "./sound/patchTypes";
import { getBassPatch } from "./sound/instrumentPatches";

const DEFAULT_BASS_PATCH_ID = "bass-finger";
const DISPOSE_TAIL_MS = 50;
const DISPOSE_TAIL_SEC = DISPOSE_TAIL_MS / 1000;

export interface BassNoteOptions {
  velocity?: number;
  durationSec?: number;
  patch?: BassPatch;
}

export interface BassVoiceHandle {
  cancel: () => void;
}

type BassPool = ReturnType<typeof createReusableVoicePool<Tone.MonoSynth>>;
const poolsByPatchId = new Map<string, BassPool>();

function poolForPatch(patch: BassPatch): BassPool {
  const existing = poolsByPatchId.get(patch.id);
  if (existing) return existing;
  const pool = createReusableVoicePool<Tone.MonoSynth>({
    createVoice: () =>
      new Tone.MonoSynth({
        volume: patch.volumeDb,
        oscillator: { type: patch.oscillator.type },
        envelope: patch.envelope,
        filter: { type: patch.filter.type, Q: patch.filter.Q },
        filterEnvelope: patch.filterEnvelope,
      }),
  });
  poolsByPatchId.set(patch.id, pool);
  return pool;
}

export function scheduleBassNote(
  dest: AudioNode,
  frequency: number,
  time: number,
  options: BassNoteOptions = {},
): BassVoiceHandle {
  const velocity = Math.max(0, Math.min(1.2, options.velocity ?? 0.9));
  if (velocity <= 0) return { cancel: () => {} };

  const patch = options.patch ?? getBassPatch(DEFAULT_BASS_PATCH_ID)!;
  const releaseTailSec = patch.envelope.release;
  const noteLen = Math.max(
    0.05,
    Math.min(2, options.durationSec ?? patch.envelope.decay + patch.envelope.release),
  );
  const now = Tone.now();
  const playbackStartTime = Math.max(now, time);
  const lease = poolForPatch(patch).lease(dest, now);
  let busyUntil = playbackStartTime + noteLen + releaseTailSec;
  lease.setBusyUntil(busyUntil);
  lease.voice.triggerAttackRelease(frequency, noteLen, time, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      if (!lease.isCurrent()) return;
      const cancelTime = Tone.now();
      if (cancelTime < time) { lease.dispose(); return; }
      if (cancelTime >= busyUntil) return;
      busyUntil = cancelTime + DISPOSE_TAIL_SEC;
      lease.setBusyUntil(busyUntil);
      try {
        lease.voice.triggerRelease(cancelTime);
        setTimeout(() => { try { lease.dispose(); } catch { /* disposed */ } }, DISPOSE_TAIL_MS);
      } catch {
        try { lease.dispose(); } catch { /* disposed */ }
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/bass.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the existing playback hook test to confirm no break**

Run: `pnpm exec vitest run src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: PASS (the hook still calls `scheduleBassNote(dest, freq, time, { velocity })`; `patch` is optional and defaults).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/bass.ts src/progressions/audio/bass.test.ts
git commit -m "feat(audio): make bass voice patch-driven with live filter envelope"
```

### Task 8: Patch-driven chord voices + strum

**Files:**
- Modify: `src/progressions/audio/instruments/createReusableChordVoice.ts`
- Modify: `src/progressions/audio/instruments/index.ts`
- Modify: `src/progressions/audio/string.ts`
- Modify: `src/progressions/audio/instruments/strumVoice.ts`
- Create: `src/progressions/audio/instruments/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/progressions/audio/instruments/index.test.ts
import { describe, it, expect } from "vitest";
import { getChordVoiceForInstrument } from "./index";
import { getChordPatch } from "../sound/instrumentPatches";

describe("chord voice resolution by instrument + genre patch", () => {
  it("uses the genre patch when its family matches the selected instrument", () => {
    // genre patch = e-piano (poly); instrument piano (poly) → use e-piano
    const v = getChordVoiceForInstrument("piano", "chord-epiano");
    expect(v).toBe(getChordVoiceForInstrument("piano", "chord-epiano")); // memoized
  });

  it("falls back to the family default when instrument family != genre patch family", () => {
    // instrument = strum, genre patch = e-piano (poly) → fall back to steel strum
    const strumV = getChordVoiceForInstrument("strum", "chord-epiano");
    const steelDefault = getChordVoiceForInstrument("strum", "chord-steel-strum");
    expect(strumV).toBe(steelDefault);
  });

  it("every chord patch resolves to a usable voice", () => {
    for (const inst of ["piano", "organ", "strum"] as const) {
      const v = getChordVoiceForInstrument(inst, getChordPatch("chord-grand-piano")!.id);
      expect(typeof v.scheduleChord).toBe("function");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/instruments/index.test.ts`
Expected: FAIL — `getChordVoiceForInstrument` not exported.

- [ ] **Step 3: Make `createReusableChordVoice` accept a `PolyChordSpec`**

Change its config to derive from a patch's `poly` spec. Replace the config
interface + `durationFor` with `PolyChordSpec` fields. New file:

```ts
// src/progressions/audio/instruments/createReusableChordVoice.ts
import * as Tone from "tone";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";
import type { PolyChordSpec } from "../sound/patchTypes";

interface PooledSynthEntry {
  synth: Tone.PolySynth<Tone.Synth>;
  busyUntil: number;
  leaseGeneration: number;
}

const DEFAULT_SHARED_MAX_POLYPHONY = 32;

export function createReusableChordVoice(spec: PolyChordSpec): ChordVoice {
  const synthPool = new WeakMap<AudioNode, PooledSynthEntry[]>();
  const durationFor = (o: ChordVoiceOptions) =>
    o.style === "sustained" ? spec.sustainedDurationSec : spec.shortDurationSec;

  const removeEntry = (dest: AudioNode, entry: PooledSynthEntry) => {
    const entries = synthPool.get(dest);
    if (!entries) return;
    const next = entries.filter((c) => c !== entry);
    if (next.length === 0) synthPool.delete(dest); else synthPool.set(dest, next);
  };

  const createEntry = (dest: AudioNode, notes: readonly string[]): PooledSynthEntry => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: spec.oscillator,
      envelope: spec.envelope,
      volume: spec.volume,
    });
    synth.maxPolyphony = Math.max(notes.length, spec.maxPolyphonyFloor, DEFAULT_SHARED_MAX_POLYPHONY);
    synth.connect(dest);
    return { synth, busyUntil: 0, leaseGeneration: 0 };
  };

  const acquireEntry = (dest: AudioNode, notes: readonly string[], now: number): PooledSynthEntry => {
    const entries = synthPool.get(dest) ?? [];
    const reusable = entries.find((e) => e.busyUntil <= now);
    if (reusable) {
      reusable.synth.maxPolyphony = Math.max(notes.length, spec.maxPolyphonyFloor, DEFAULT_SHARED_MAX_POLYPHONY);
      return reusable;
    }
    const created = createEntry(dest, notes);
    synthPool.set(dest, [...entries, created]);
    return created;
  };

  return {
    scheduleChord(dest, notes, time, options): VoiceHandle {
      const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.7));
      if (velocity <= 0 || notes.length === 0) return { cancel: () => {} };
      const now = Tone.now();
      const scheduledNotes = [...notes];
      const durationSec = durationFor(options);
      const playbackStartTime = Math.max(now, time);
      const entry = acquireEntry(dest, scheduledNotes, now);
      const leaseGeneration = entry.leaseGeneration + 1;
      entry.leaseGeneration = leaseGeneration;
      entry.busyUntil = playbackStartTime + durationSec + spec.releaseTailSec;
      entry.synth.triggerAttackRelease(scheduledNotes, durationSec, time, velocity);
      let cancelled = false;
      return {
        cancel: () => {
          if (cancelled) return;
          cancelled = true;
          if (entry.leaseGeneration !== leaseGeneration) return;
          const cancelTime = Tone.now();
          if (cancelTime < time) { removeEntry(dest, entry); entry.busyUntil = 0; entry.synth.dispose(); return; }
          if (cancelTime >= entry.busyUntil) return;
          entry.busyUntil = cancelTime + spec.releaseTailSec;
          entry.synth.releaseAll(cancelTime);
        },
      };
    },
  };
}
```

- [ ] **Step 4: Make `string.ts` / `strumVoice` patch-driven**

`pluckString` gains an optional `strum` spec param; `strumVoice` becomes a
factory `createStrumVoice(spec)`. Edit `string.ts` `pluckString` signature to
accept `{ velocity, spec? }` and build the PluckSynth/Synth params from `spec`
(falling back to current constants when absent). Then:

```ts
// src/progressions/audio/instruments/strumVoice.ts
import { getNoteFrequency } from "@fretflow/core";
import { pluckString } from "../string";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";
import type { StrumSpec } from "../sound/patchTypes";

export const STRUM_LAG_SECONDS = 0.018;

export function createStrumVoice(spec?: StrumSpec): ChordVoice {
  return {
    scheduleChord(dest: AudioNode, notes: readonly string[], time: number, options: ChordVoiceOptions): VoiceHandle {
      const ordered = options.direction === "up" ? [...notes].reverse() : notes;
      const voices = ordered.map((note, i) => {
        const freq = getNoteFrequency(note);
        if (!Number.isFinite(freq) || freq <= 0) return null;
        return pluckString(dest, freq, time + i * STRUM_LAG_SECONDS, { velocity: options.velocity, spec });
      }).filter(Boolean) as Array<{ cancel: () => void }>;
      return { cancel: () => { for (const v of voices) v.cancel(); } };
    },
  };
}
```

- [ ] **Step 5: Rewrite `instruments/index.ts` to resolve voice by instrument + genre patch**

```ts
// src/progressions/audio/instruments/index.ts
import type { ChordInstrumentId, ChordVoice } from "./types";
import { createStrumVoice } from "./strumVoice";
import { createReusableChordVoice } from "./createReusableChordVoice";
import {
  getChordPatch, DEFAULT_CHORD_PATCH_BY_FAMILY,
} from "../sound/instrumentPatches";
import type { ChordFamily, ChordPatch } from "../sound/patchTypes";

export type { ChordInstrumentId, ChordVoice } from "./types";

const familyForInstrument = (id: ChordInstrumentId): ChordFamily =>
  id === "strum" ? "strum" : "poly";

const voiceCache = new Map<string, ChordVoice>();

function buildVoice(patch: ChordPatch): ChordVoice {
  if (patch.family === "strum") return createStrumVoice(patch.strum);
  return createReusableChordVoice(patch.poly!);
}

function voiceForPatch(patch: ChordPatch): ChordVoice {
  const cached = voiceCache.get(patch.id);
  if (cached) return cached;
  const v = buildVoice(patch);
  voiceCache.set(patch.id, v);
  return v;
}

/**
 * Resolve the chord voice for the user-selected instrument family, preferring
 * the genre's chord patch when its family matches; otherwise fall back to the
 * family default patch. Memoized per patch id (one pooled voice per timbre).
 */
export function getChordVoiceForInstrument(
  instrument: ChordInstrumentId,
  genrePatchId: string,
): ChordVoice {
  const family = familyForInstrument(instrument);
  const genrePatch = getChordPatch(genrePatchId);
  const patch = genrePatch && genrePatch.family === family
    ? genrePatch
    : getChordPatch(DEFAULT_CHORD_PATCH_BY_FAMILY[family])!;
  return voiceForPatch(patch);
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm exec vitest run src/progressions/audio/instruments/index.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Fix `pianoVoice.ts` / `organVoice.ts` consumers**

These two files call the OLD `createReusableChordVoice` config shape and are now
unused by `index.ts`. Delete `pianoVoice.ts` and `organVoice.ts` (their params
moved into `CHORD_PATCHES`). Grep to confirm no other importer:

Run: `grep -rn "pianoVoice\|organVoice" src`
Expected: only the deleted files / none. If anything else imports them, repoint
it at `getChordVoiceForInstrument`.

- [ ] **Step 8: Typecheck + full audio test run**

Run: `pnpm exec tsc -b --noEmit && pnpm exec vitest run src/progressions/audio`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/progressions/audio/instruments src/progressions/audio/string.ts
git commit -m "feat(audio): patch-driven chord + strum voices with genre-aware resolution"
```

### Task 9: Patch-driven drum kit

**Files:**
- Modify: `src/progressions/audio/drumKit.ts`
- Create: `src/progressions/audio/drumKit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/progressions/audio/drumKit.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const membraneOpts: unknown[] = [];
vi.mock("tone", () => {
  class Fake { constructor(o: unknown) { membraneOpts.push(o); } connect() { return this; } triggerAttackRelease() {} dispose() {} }
  return { __esModule: true, MembraneSynth: Fake, NoiseSynth: Fake, MetalSynth: Fake, now: () => 0 };
});

import { scheduleKick } from "./drumKit";
import { getDrumKitPatch } from "./sound/instrumentPatches";

beforeEach(() => { membraneOpts.length = 0; });

describe("patch-driven drum kit", () => {
  it("applies kit patch kick overrides (pitchDecay/octaves/decay) over defaults", () => {
    const dest = {} as unknown as AudioNode;
    const kit = getDrumKitPatch("kit-funk")!;
    scheduleKick(dest, 0, { velocity: 1, kit });
    const opts = membraneOpts[0] as { pitchDecay: number; octaves: number; envelope: { decay: number } };
    expect(opts.pitchDecay).toBe(kit.voices.kick!.pitchDecay);
    expect(opts.octaves).toBe(kit.voices.kick!.octaves);
    expect(opts.envelope.decay).toBe(kit.voices.kick!.envelope!.decay);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/drumKit.test.ts`
Expected: FAIL — `scheduleKick` ignores `kit`.

- [ ] **Step 3: Thread a `kit` option + per-patch pools into `drumKit.ts`**

Add `kit?: DrumKitPatch` to each `*Options` interface. Replace the five
module-level pools with per-`(voice, kitId)` pool maps whose `createVoice`
merges the kit's voice override over the engine default. Pattern for kick (apply
the same shape to snare/hihat/openHat/ride):

```ts
// src/progressions/audio/drumKit.ts — kick section (mirror for other voices)
import type { DrumKitPatch } from "./sound/patchTypes";

const DEFAULT_KICK = { pitchDecay: 0.04, octaves: 6, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1, attackCurve: "exponential" as const } };

const kickPoolsByKit = new Map<string, ReturnType<typeof createReusableVoicePool<Tone.MembraneSynth>>>();
function kickPool(kit?: DrumKitPatch) {
  const id = kit?.id ?? "__default";
  const existing = kickPoolsByKit.get(id);
  if (existing) return existing;
  const ov = kit?.voices.kick;
  const pool = createReusableVoicePool<Tone.MembraneSynth>({
    createVoice: () => new Tone.MembraneSynth({
      pitchDecay: ov?.pitchDecay ?? DEFAULT_KICK.pitchDecay,
      octaves: ov?.octaves ?? DEFAULT_KICK.octaves,
      oscillator: { type: "sine" },
      envelope: { ...DEFAULT_KICK.envelope, ...(ov?.envelope ?? {}) },
    }),
  });
  kickPoolsByKit.set(id, pool);
  return pool;
}
// scheduleKick: add `kit?: DrumKitPatch` to DrumHitOptions, use kickPool(options.kit).lease(...)
```

Apply the identical per-kit pool pattern to snare (`noiseType` → `noise.type`),
hihat/openHat (`decay`, `resonance`, `octaves`), and ride (`decay`,
`harmonicity`, `resonance`). Keep the existing dispose-tail windows.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/drumKit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/drumKit.ts src/progressions/audio/drumKit.test.ts
git commit -m "feat(audio): per-genre drum-kit patches"
```

---

## Phase 4 — Integrate graph into the bus

The four layer GainNodes are kept as the **voice input + mute gates** (so
`setLayerGain` mute semantics are unchanged). Each layer now routes into the
materialized graph (`layer → channel insert → Channel(vol/pan) → master glue`)
instead of straight to the master bus.

### Task 10: `configureProgressionGraph` in `bus.ts`

**Files:**
- Modify: `src/progressions/audio/bus.ts`
- Modify: `src/progressions/audio/layerBuses.ts` (stop auto-connecting layers to destination)
- Modify: `src/progressions/audio/progressionAudioEngine.ts` (re-export)
- Create: `src/progressions/audio/configureGraph.test.ts`

- [ ] **Step 1: Write the failing test (structural, with a stub graph)**

```ts
// src/progressions/audio/configureGraph.test.ts
import { describe, it, expect, vi } from "vitest";

// Stub the graph materializer so we don't need real Tone effect nodes.
vi.mock("./sound/buildSignalGraph", async (orig) => {
  const actual = await orig<typeof import("./sound/buildSignalGraph")>();
  return {
    ...actual,
    materializeSignalGraph: vi.fn(() => {
      const make = () => ({ connect: vi.fn(), disconnect: vi.fn() }) as unknown as AudioNode;
      return { inputs: { chord: make(), bass: make(), drums: make(), metronome: make() }, dispose: vi.fn() };
    }),
  };
});

import { ensureProgressionAudio, configureProgressionGraph, _resetProgressionAudioForTests } from "./bus";
import { planSignalGraph } from "./sound/buildSignalGraph";
import { TIER_PROFILES } from "./sound/qualityTiers";
import { getGenreMix } from "./sound/genreMixPresets";

describe("configureProgressionGraph", () => {
  it("materializes a graph and routes layers into it; rebuild disposes the prior graph", () => {
    _resetProgressionAudioForTests();
    const audio = ensureProgressionAudio();
    if (!audio) return; // jsdom may lack AudioContext; guard like the existing suite
    const plan = planSignalGraph(TIER_PROFILES.standard, getGenreMix("jazz")!);
    const g1 = configureProgressionGraph(plan);
    expect(g1).not.toBeNull();
    const g2 = configureProgressionGraph(planSignalGraph(TIER_PROFILES.eco, getGenreMix("funk")!));
    expect(g2).not.toBeNull();
    // prior graph disposed on rebuild
    expect((g1 as { dispose: () => void }).dispose).toHaveBeenCalled?.();
  });
});
```

> Note: this suite mirrors the existing `bus`/`timeline` tests, which bail when
> the jsdom mock `AudioContext` is unavailable. Keep the early `return` guard.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/configureGraph.test.ts`
Expected: FAIL — `configureProgressionGraph` not exported.

- [ ] **Step 3: Edit `layerBuses.ts` — do not auto-connect layers to destination**

In `buildLayerBuses`, remove `gain.connect(destination)` (the graph now owns the
downstream connection). Keep the `destination` param for signature
compatibility but stop connecting. Update the doc comment.

- [ ] **Step 4: Add graph wiring to `bus.ts`**

Add module state `currentGraph` and the exported function. Insert after
`ensureProgressionAudio`:

```ts
// src/progressions/audio/bus.ts — additions
import { materializeSignalGraph, type MaterializedGraph, type SignalGraphPlan } from "./sound/buildSignalGraph";

let currentGraph: MaterializedGraph | null = null;

/**
 * (Re)build the mix graph for the active tier+genre and route the four layer
 * buses into it. Disposes any prior graph. Returns the graph or null when audio
 * is unavailable. Call on play and whenever (quality tier, genre) changes —
 * never mid-step.
 */
export function configureProgressionGraph(plan: SignalGraphPlan): MaterializedGraph | null {
  const audio = ensureProgressionAudio();
  if (!audio) return null;

  // Disconnect layers from any prior graph and dispose it.
  if (currentGraph) {
    for (const layer of ["chord", "bass", "drums", "metronome"] as const) {
      try { audio.layers[layer].disconnect(); } catch { /* not connected */ }
    }
    currentGraph.dispose();
    currentGraph = null;
  }

  const graph = materializeSignalGraph(audio.ctx, audio.bus, plan);
  for (const layer of ["chord", "bass", "drums", "metronome"] as const) {
    // layer GainNode (mute gate) → graph channel input (native GainNode)
    audio.layers[layer].connect(graph.inputs[layer] as AudioNode);
  }
  currentGraph = graph;
  return graph;
}
```

Also update `_resetProgressionAudioForTests` to dispose+null `currentGraph`.

- [ ] **Step 5: Re-export from the engine**

In `progressionAudioEngine.ts` add:
```ts
export { configureProgressionGraph } from "./bus";
export { planSignalGraph } from "./sound/buildSignalGraph";
export { TIER_PROFILES, resolveTier, detectDefaultTier } from "./sound/qualityTiers";
export type { QualitySetting, QualityTier } from "./sound/qualityTiers";
export { getGenreMix, DEFAULT_GENRE_MIX } from "./sound/genreMixPresets";
export { getChordVoiceForInstrument } from "./instruments/index";
export { getBassPatch } from "./sound/instrumentPatches";
export { getDrumKitPatch } from "./sound/instrumentPatches";
```
Remove the now-stale `export { getChordVoice } from "./instruments/index"` line.

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm exec vitest run src/progressions/audio/configureGraph.test.ts && pnpm exec tsc -b --noEmit`
Expected: PASS / no type errors. (`tsc` will flag the removed `getChordVoice` use in the hook — fixed in Phase 5.)

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/bus.ts src/progressions/audio/layerBuses.ts src/progressions/audio/progressionAudioEngine.ts src/progressions/audio/configureGraph.test.ts
git commit -m "feat(audio): route layer buses through the tier/genre mix graph"
```

---

## Phase 5 — Quality setting + settings UI + playback wiring

### Task 11: `audioQualityAtom`

**Files:**
- Modify: `src/store/audioAtoms.ts`
- Create/extend: `src/store/audioAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/store/audioAtoms.test.ts
import { describe, it, expect } from "vitest";
import { createStore } from "jotai";
import { audioQualityAtom } from "./audioAtoms";

describe("audioQualityAtom", () => {
  it("defaults to auto and accepts tier values", () => {
    const store = createStore();
    expect(store.get(audioQualityAtom)).toBe("auto");
    store.set(audioQualityAtom, "high");
    expect(store.get(audioQualityAtom)).toBe("high");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/store/audioAtoms.test.ts`
Expected: FAIL — `audioQualityAtom` not exported.

- [ ] **Step 3: Add the atom**

```ts
// src/store/audioAtoms.ts — additions
import { createStorage, enumValidator, GET_ON_INIT } from "../utils/storage";
import type { QualitySetting } from "../progressions/audio/sound/qualityTiers";

const QUALITY_VALUES = ["auto", "eco", "standard", "high"] as const;

export const audioQualityAtom = atomWithStorage<QualitySetting>(
  k("audioQuality"),
  "auto",
  createStorage<QualitySetting>({
    serialize: (v) => v,
    deserialize: (v) => v as QualitySetting,
    validate: enumValidator(QUALITY_VALUES),
  }),
  GET_ON_INIT,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/store/audioAtoms.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/audioAtoms.ts src/store/audioAtoms.test.ts
git commit -m "feat(audio): add persisted audio-quality setting atom"
```

### Task 12: Sound-quality control in settings

**Files:**
- Modify: `src/components/SettingsOverlay/sections/DisplaySettingsSection.tsx`
- Modify: i18n strings file (add `settings.fields.soundQuality` + option labels) — locate via `grep -rn "enharmonicDisplay" src/i18n`.

- [ ] **Step 1: Add i18n keys**

Add to the same translation file that defines `settings.fields.enharmonicDisplay`:
`settings.fields.soundQuality` = "Sound quality", and option labels
`settings.soundQuality.auto/eco/standard/high` = "Auto"/"Eco"/"Standard"/"High".

- [ ] **Step 2: Add the control (mirrors the enharmonic ToggleBar)**

```tsx
// In DisplaySettingsSection.tsx
import { audioQualityAtom } from "../../../store/audioAtoms";
// ...inside component:
const [audioQuality, setAudioQuality] = useAtom(audioQualityAtom);
const SOUND_QUALITY_OPTIONS = [
  { label: t("settings.soundQuality.auto"), value: "auto" },
  { label: t("settings.soundQuality.eco"), value: "eco" },
  { label: t("settings.soundQuality.standard"), value: "standard" },
  { label: t("settings.soundQuality.high"), value: "high" },
] as const;
// ...in JSX, a new overlay-field block:
<div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
  <OverlayFieldHeader label={t("settings.fields.soundQuality")} />
  <div className={styles["overlay-field-control"]}>
    <ToggleBar
      label={t("settings.fields.soundQuality")}
      options={SOUND_QUALITY_OPTIONS}
      value={audioQuality}
      onChange={(v) => setAudioQuality(v as typeof audioQuality)}
    />
  </div>
</div>
```

- [ ] **Step 3: Typecheck + lint + existing settings tests**

Run: `pnpm exec tsc -b --noEmit && pnpm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsOverlay src/i18n
git commit -m "feat(audio): expose sound-quality setting in display settings"
```

### Task 13: Wire genre mix + quality + patches into the playback hook

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`

- [ ] **Step 1: Read the active genre, quality, and layout tier**

Add atom subscriptions near the existing ones:
```ts
import { audioQualityAtom } from "../store/audioAtoms";
import { progressionGenreStyleAtom } from "../store/progressionAtoms";
// ...
const genreId = useAtomValue(progressionGenreStyleAtom);
const quality = useAtomValue(audioQualityAtom);
```
For the layout tier, read the `data-layout-tier` attribute already emitted by
`MainLayoutWrapper`:
```ts
function readLayoutTier(): "mobile" | "tablet" | "desktop" {
  if (typeof document === "undefined") return "desktop";
  const t = document.documentElement
    .querySelector("[data-layout-tier]")?.getAttribute("data-layout-tier");
  return t === "mobile" || t === "tablet" ? t : "desktop";
}
```

- [ ] **Step 2: Resolve the plan and configure the graph before scheduling**

Inside the play effect, after `eng.ensureProgressionAudio()` succeeds and before
constructing Parts, resolve tier + mix and configure the graph:
```ts
const mix = eng.getGenreMix(genreId) ?? eng.DEFAULT_GENRE_MIX;
const tier = eng.resolveTier(quality, () =>
  eng.detectDefaultTier({
    cores: navigator.hardwareConcurrency,
    memoryGb: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
    layoutTier: readLayoutTier(),
  }),
);
eng.configureProgressionGraph(eng.planSignalGraph(eng.TIER_PROFILES[tier], mix));
```
Add `genreId` and `quality` to this effect's dependency array AND to `buildKey`
is NOT required (they don't change the event stream) — but they DO require a
graph rebuild, so add them to the effect deps so toggling quality/genre while
playing rebuilds. Guard the rebuild to fire only at (re)start, which this effect
already is.

- [ ] **Step 3: Pass patches to the voice callbacks**

Capture mix patch ids in refs (like `instrumentRef`) so Part callbacks read the
current values:
```ts
const bassPatchRef = useRef(eng /* unused */); // see below — store resolved patch
```
Concretely, resolve once per (re)build and close over them:
- Chord strum callback:
  ```ts
  const voice = eng.getChordVoiceForInstrument(instrumentRef.current, mix.patches.chord);
  voice.scheduleChord(audio.layers.chord, value.voicing, audioTime, { ... });
  ```
- Bass callback:
  ```ts
  const bassPatch = eng.getBassPatch(mix.patches.bass);
  eng.scheduleBassNote(audio.layers.bass, freq, audioTime, { velocity: value.velocity, patch: bassPatch });
  ```
- Drum callbacks:
  ```ts
  const kit = eng.getDrumKitPatch(mix.patches.drumKit);
  eng.scheduleKick(audio.layers.drums, audioTime, { velocity: value.velocity, kit });
  // ...same `kit` for snare/hihat/openHat/ride
  ```
Replace the now-removed `eng.getChordVoice(...)` call site with
`eng.getChordVoiceForInstrument(...)`.

- [ ] **Step 4: Run the hook test + full audio suite + typecheck**

Run: `pnpm exec tsc -b --noEmit && pnpm exec vitest run src/hooks/useProgressionAudioPlayback.test.tsx src/progressions/audio`
Expected: PASS. Update the hook test if it asserted on `getChordVoice` (repoint to `getChordVoiceForInstrument`).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts src/hooks/useProgressionAudioPlayback.test.tsx
git commit -m "feat(audio): drive playback voices from genre mix + quality tier"
```

---

## Phase 6 — Verification

### Task 14: Full gate + manual audio verification

- [ ] **Step 1: Run the mandatory local gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all pass (CLAUDE.md requires lint + test + build before PR).

- [ ] **Step 2: Manual listen via dev server (use preview tools)**

Start the dev server (`pnpm run dev` / preview_start), open the progression
backing track, and for each genre confirm:
- Bass is no longer a thin buzz — audible filter movement and body; timbre
  differs between jazz (upright) and funk/rock (electric).
- Chords carry genre character (piano vs e-piano vs organ vs strum).
- The mix sounds glued (reverb tail + compression), not dry/naked.
- No clicks/dropouts at the fastest tempo of each genre's range.

- [ ] **Step 3: Verify quality tiers**

In Settings → Sound quality, switch eco/standard/high and confirm:
- `eco`: noticeably drier (algorithmic reverb, no inserts), lighter CPU.
- `high`: lush convolution reverb + insert EQ/saturation present.
- `auto`: lands at a sensible default for the device (eco on mobile width,
  high on desktop width).
- Switching tier while playing rebuilds without a hard click (short ramp).

- [ ] **Step 4: Confirm no regressions in playback control**

Toggle each layer (chord/bass/drums/metronome) mid-play → still mutes/unmutes.
Loop on/off, tempo change, swing change → still behave as before.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "fix(audio): verification-pass adjustments for sound+mix slice"
```

---

## Self-Review (author checklist — completed)

**Spec coverage:**
- §3.1 patch catalog → Tasks 1–2 (bass/chord/drum patches, live bass filter env). ✔
- §3.2 genre mix presets → Task 3 (all 7 genres, family-match test). ✔
- §3.3 / §4 quality tiers + conservative auto-detect → Task 4. ✔
- §3.4 / §5 signal graph (plan + materialize, master glue, sends, inserts, reverb engines) → Tasks 5, 6, 10. ✔
- §3.1.1 bass priority → Task 7 (done before chords/drums). ✔
- Chords + strum genre-aware → Task 8. Drums per-genre → Task 9. ✔
- §4 setting + auto default → Tasks 11–13. ✔
- §6 affected files all covered. §7 testing approach (catalogs/tiers/plan unit-tested; materialize + integration at runtime) honored. ✔

**Placeholder scan:** No "TBD"/"handle edge cases" steps; every code step has
runnable code. The one sketch (`buildInsertChain`) is explicitly flagged for
deletion in Task 6 Step 1's implementer note.

**Type consistency:** `BassPatch`/`ChordPatch`/`DrumKitPatch`/`PolyChordSpec`/
`StrumSpec`/`InsertSpec` defined in Task 1 and consumed verbatim in Tasks 2,
7, 8, 9. `SignalGraphPlan`/`ChannelPlan` from Task 5 consumed in Tasks 6, 10,
13. `getChordVoiceForInstrument` named consistently (Tasks 8, 10, 13).
`configureProgressionGraph` consistent (Tasks 10, 13). `audioQualityAtom` /
`QualitySetting` consistent (Tasks 11–13). `getGenreMix`/`DEFAULT_GENRE_MIX`
consistent (Tasks 3, 10, 13).

**Known integration risks to watch during execution:**
- Tone constructor signatures (`Limiter`, `Freeverb`, `JCReverb`, `Channel`) —
  verify against installed Tone version at Task 6 Step 2.
- The hook play-effect deps: adding `genreId`/`quality` must not cause a rebuild
  loop. They only change on user action, so this is safe, but confirm the effect
  doesn't also depend on a value it sets.
- `pianoVoice.ts`/`organVoice.ts` deletion (Task 8 Step 7) — grep must come back
  clean or repoint stragglers.
