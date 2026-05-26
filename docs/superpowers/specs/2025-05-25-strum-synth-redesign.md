# Strum Synth Redesign

> **For agentic workers:** This spec describes the design. Use the implementation plan (`writing-plans`) to build it task by task.

**Goal:** Replace the Karplus-Strong (`Tone.PluckSynth`) strum with a tone-based synth voice that sounds warm and guitar-like, consistent with the fretboard synth and the piano/organ instruments.

**Architecture:** The strum voice (`strumVoice.ts`) currently delegates to `pluckString()` in `string.ts`, which uses a pooled `Tone.PluckSynth` (Karplus-Strong). We replace the synthesis engine inside `string.ts` — the `PluckSynth` → a `Tone.Synth` with custom oscillator partials, shaped envelope, and a lowpass filter. The `strumVoice.ts` staggering logic, pooling pattern, and `pluckString()` function signature remain unchanged.

**Tech Stack:** Tone.js (`Tone.Synth`, `Tone.Filter`), `createReusableVoicePool`, `createReusableChordVoice`

---

## Design

### Synthesis Parameters

The fretboard synth (`src/core/audio.ts`) already has good guitar tone. We use a similar approach:

- **Oscillator:** Custom partials `[1, 0.6, 0.4, 0.3, 0.2, 0.1, 0.06]` (lower dB for high harmonics → warm guitar body)
- **Envelope:** `attack: 0.005` (instant pluck), `decay: 0.3` (quick bloom to silence), `sustain: 0` (no sustain — plucked strings ring down fully), `release: 0.8` (natural ring-out)
- **Filter:** Lowpass at ~2400 Hz, Q 0.8 (same as fretboard synth — rolls off harsh highs)
- **Volume:** ~-6 dB gain (same as fretboard synth)

### Files Changed

| File | Change |
|------|--------|
| `src/progressions/audio/string.ts` | Replace `Tone.PluckSynth` pool with synth-based pooled voice using `Tone.Synth` + `Tone.Filter`. Keep `pluckString` export signature. |
| `src/progressions/audio/string.test.ts` | Update test expectations from `PluckSynth` to `Synth` + `Filter` construction. |
| `src/progressions/audio/strumVoice.ts` | No changes needed (depends on `pluckString` interface which stays the same). |

### What stays the same

- `pluckString(dest, frequency, startTime, options)` — same signature, same return type
- Voice pooling via `createReusableVoicePool` — only the voice factory changes
- `strumVoice.scheduleChord()` — same staggering, direction, velocity logic
- All progression pipeline callers (`progressionPart.ts`, `buildAllLayers.ts`, etc.)
- Guitar-specific note frequencies via `@fretflow/core`

### Test Strategy

- `string.test.ts`: Replace PluckSynth constructor assertions with Synth + Filter assertions; verify partials, envelope, filter frequency
- `strumVoice.test.ts`: Should pass unchanged (behavioral tests, not constructor-specific)

## Spec Self-Review

- ✅ Spec coverage: All requirements mapped (replace synthesis engine, keep interface, update tests)
- ✅ No placeholders
- ✅ Type consistency: `pluckString` return type unchanged
- ✅ No contradictions
