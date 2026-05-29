# Backing-Track Drum Realism / Samples (Slice D)

**Status:** Design — ready for implementation plan.
**Date:** 2026-05-29
**Predecessors:** audit `2026-05-21-backing-track-tonal-audit.md`; sound/mix slice `2026-05-28-backing-track-sound-and-mix-design.md`.
**Theme:** Drum samples drive ~80% of perceived production value in a backing track. Slice A+B refines the *synthesized* kit per genre; this slice moves to real samples for the biggest single perceptual jump, hooked into the `qualityTiers` system.

---

## 1. Goal

Replace the synthesized `MembraneSynth`/`NoiseSynth`/`MetalSynth` kit with real drum samples for a convincingly produced groove when running on standard or high quality tiers. Provide a robust offline/eco fallback.

## 2. Approach

- **Sample playback via `Tone.Players`:** Load a compact kit (kick, snare, closed-hat, open-hat, ride). Use Velocity → `volume` (and a tiny bit of `playbackRate` variation) to mimic natural hits.
- **Per-genre kits:** Mirror the A+B `kit-*` patch IDs with sample sets (acoustic-rock, funk, jazz-brush, blues, ballad, bossa).
- **Quality-tier integration:**
  - `eco`: Synthesized kit (Slice A+B). Zero network payload.
  - `standard`: Single-sample kits (one `.mp3`/`.ogg` per drum piece).
  - `high`: Velocity-layered or round-robin samples (multiple files per piece, e.g., soft/med/hard snare hits).
- **Lazy loading:** Samples are loaded on demand when a genre and tier are active, not at app boot.

## 3. Asset Strategy

- **Format:** Highly compressed `.ogg` (with `.mp3` fallback) for rapid network delivery. Web Audio API decodes these instantly.
- **Hosting:** Bundled in `public/audio/samples/` (served via GitHub Pages). To respect the bundle budget, we limit `standard` kits to ~500KB total and `high` kits to ~2MB total.
- **Licensing:** All samples must be CC0 or strictly royalty-free.

## 4. Architecture

### 4.1 Drum Sampler Node (`src/progressions/audio/instruments/drumSampler.ts`)
Creates and manages the `Tone.Players` instance.
- Exposes `loadKit(kitId, tier): Promise<void>`.
- Exposes `triggerHit(drumPiece, time, velocity)`.
- Handles round-robin selection internally if the `high` tier kit definition provides arrays of urls.

### 4.2 Scheduler Integration (`src/progressions/audio/drumKit.ts`)
Update the `schedule*` helpers:
- Check if the `drumSampler` is loaded for the current kit.
- If loaded and tier > `eco`, call `drumSampler.triggerHit()`.
- If loading fails, loading is pending, or tier is `eco`, fall back immediately to the existing Tone synth kick/snare/hats logic.

### 4.3 UI Feedback
- While samples are loading, playback can begin using the synth fallback.
- Once loaded, crossfade or switch seamlessly on the next measure/hit.
- Add an optional "loading" toast or indicator near the quality selector.

## 5. Testing
- Mock `Tone.Players` to test round-robin logic and velocity thresholding.
- Verify fallback: if `loadKit` rejects, the scheduler correctly routes calls to `MembraneSynth/NoiseSynth`.
- Verify tier changes trigger appropriate loading states.
