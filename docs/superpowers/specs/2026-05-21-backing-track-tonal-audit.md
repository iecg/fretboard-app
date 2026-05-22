# Backing-Track Engine Audit — Tone.js & Tonal.js

**Status:** Research / recommendation pass. No implementation.
**Date:** 2026-05-21
**Scope:** `src/progressions/`, `src/core/audio.ts`, `src/core/toneInit.ts`, `src/store/audioAtoms.ts`, `src/store/progressionAtoms.ts`, `src/hooks/useProgressionPlaybackLoop.ts`, `packages/core/src/lib/tonal.ts`, `packages/core/src/theory.ts`.

> **Note on scope:** The original task brief referenced Tonal.js. The user clarified mid-task that the primary intent was to audit **Tone.js** usage (the audio runtime adopted in the recent migrations), with Tonal.js as a secondary lens. This document covers both.

The recent commits `feat(audio): migrate progression scheduler to tone.js`, `feat(audio): adopt Tone.js for GuitarSynth`, and `feat(scale): Scale Simplification` swapped the audio runtime to Tone.js and standardized theory on Tonal.js. The user reports that the backing-track output sounds essentially unchanged. This audit explains why and identifies concrete wins to unlock the value of both libraries.

---

## Section 1 — Data Flow Map

**Entry**: User toggles play → `progressionAtoms.ts:362–373` sets `progressionPlayingStateAtom` via `setProgressionPlayingAtom`, which also stamps `progressionStepDeadlineAtom = Date.now() + progressionStepDurationMs`.

**Audio bus init**: `useProgressionAudioPlayback` calls `ensureProgressionAudio()` (`src/progressions/audio/bus.ts:42–65`), which lazily builds a shared `AudioContext` + master `GainNode` (gain=0.55). `bindToneToProgressionContext()` (`toneBus.ts:20–24`) then calls `Tone.setContext()` so `Tone.now()` and `audio.ctx.currentTime` advance in lockstep — this single binding is the **critical correctness anchor** for the whole engine.

**Chord resolution**: For each active step, `resolveChordVoicing(root, quality)` in `progressionAudio.ts:27–68` maps `(root, quality)` → absolute pitched notes from `CHORD_DEFINITIONS` + `NOTES`. Bass-line notes are resolved separately via `resolveBassLineNotes()` and `resolveBassNoteForRole()` (root / third / fifth / octave / chromatic-approach).

**Scheduler dispatch**: `scheduleProgressionStep()` in `src/progressions/audio/scheduler.ts:110–268` is the central dispatcher. It takes `{ voicing, bassNotes, beatsAvailable, secondsPerBeat, startTime, chordPatternId, bassPatternId, drumPatternId, swing, enable flags }` and walks the pattern catalogs:
- **Chord/strum** → `getChordPattern(id)` returns `ChordHit[]` (beat, velocity, direction). For each hit, `voice.scheduleChord(bus, voicing, time, …)` on the active chord voice (strum / piano / organ).
- **Bass** → `getBassPattern(id)` → `scheduleBassNote(bus, freq, time, …)`.
- **Drums** → `getDrumPattern(id)` returns `{ kicks, snares, hats, openHats, ride }` lanes, each scheduled via the corresponding `scheduleKick / scheduleSnare / scheduleHiHat / scheduleRide` helpers.
- **Metronome** → `buildMetronomePattern(beatsPerBar)` → `scheduleClick`.
- **Swing** — applied in beat domain via `swingBeat(beat, swing)` (`scheduler.ts:99–103`) **before** seconds conversion. Off-beats slide forward by `swing * 1/3` beats. Tempo-agnostic.

**Voice scheduling**: Each `schedule*` helper constructs a **fresh** Tone synth, connects it to the passed bus, calls `triggerAttackRelease(note, dur, time, velocity)`, and returns `{ cancel() }`. Disposal is **deferred** via `setTimeout` after an explicit `triggerRelease(Tone.now())` to preserve release tails (pattern repeated identically across all voice files).

**Step advancement**: `useProgressionPlaybackLoop.ts:21–119` uses `getTransport().scheduleOnce(advance, "+remainingSec")` to advance steps on the audio clock; falls back to `window.setTimeout` if Web Audio is unavailable. The visual playhead reads from `timeline.ts` (`getTimelinePosition()`), which polls `audio.ctx.currentTime` — so React UI stays locked to audio.

**One-line summary**: A small beat-grid pattern catalog is iterated in plain JS; each hit instantiates a fresh single-shot Tone synth at an absolute `AudioContext` time, routes to a single master `GainNode`, and disposes itself after release.

---

## Section 2 — Tone.js Audit

### Currently used

| API | Where | Use |
|-----|-------|-----|
| `Tone.Synth` | `metronome.ts:35–42`, `organVoice.ts:35–43`, `pianoVoice.ts:35–45` | Metronome clicks, additive partials. |
| `Tone.PolySynth` | `organVoice.ts:35`, `pianoVoice.ts:35` | Per-chord polyphonic dispatch (max polyphony set per-call). |
| `Tone.MonoSynth` | `bass.ts:48–60` | Bass note (saw + filter envelope). |
| `Tone.PluckSynth` | `string.ts:43–48` | Strum voice (Karplus-Strong). |
| `Tone.MembraneSynth` | `drumKit.ts:85–96` | Kick. |
| `Tone.NoiseSynth` | `drumKit.ts:115–126` | Snare. |
| `Tone.MetalSynth` | `drumKit.ts:149–157, 182–190` | Hi-hat, ride. |
| `Tone.Filter`, `Tone.Volume` | `core/audio.ts:92–102` | GuitarSynth fixed-LP + master volume w/ `rampTo`. |
| `Tone.gainToDb` | `string.ts:55` | Velocity → dB for PluckSynth. |
| `Tone.now()` | All voice files | Explicit release time on cancel. |
| `Tone.Transport.start / scheduleOnce / clear` | `useProgressionPlaybackLoop.ts:3, 65, 85, 94` | **Step boundary** only — not pattern scheduling. |
| `Tone.setContext / getContext / start` | `toneBus.ts:22`, `toneInit.ts:15, 71` | Bind to shared `AudioContext`; resume on gesture. |

### Not used but should be (with file:line targets and "why no audible change yet")

1. **`Tone.Part` for chord/bass/drum patterns** — `scheduler.ts:110–268`.
   The scheduler iterates patterns in plain JS and schedules each hit by raw absolute time. `Tone.Part` is designed for this exact shape: `new Tone.Part((time, hit) => voice.scheduleChord(...), hits).start(startTime).stop(startTime + beatsAvailable)`. Eliminates manual `barStart += beatsPerBar` arithmetic, integrates with Transport, simplifies cancellation. *Why the migration didn't change sound: every hit still fires at the same absolute audio time; Part is a structural improvement, not a sonic one.*

2. **Effects chain on master bus** — `toneBus.ts:20–104`.
   The bus connects voices **directly** to destination. There is no `Tone.Reverb`, `Tone.Chorus`, `Tone.PingPongDelay`, `Tone.Compressor`, `Tone.Limiter`, or `Tone.EQ3` anywhere in the signal path. This is the single largest reason the user perceived no change after the migration: **timbre is identical whether the runtime is raw Web Audio or Tone.js if no effects are inserted**. A 1.5 s `Tone.Reverb` + bus `Tone.Compressor` would be the biggest perceptual unlock with the smallest diff.

3. **`Tone.Sampler` / `Tone.Players` for drums** — `drumKit.ts:77–192`.
   Drums are 100% synthesized (Membrane / Noise / Metal). For a backing track, drum *samples* drive ~80% of perceived production value. `Tone.Players({ kick, snare, hihat, ride, … })` with a small hosted kit would be a dramatic upgrade. (Trade-off: asset bundle / network.) *Why no audible change yet: nothing about the kit changed in the migration — same synth types as before.*

4. **`Tone.Transport.scheduleRepeat` for metronome** — `scheduler.ts:233–260`.
   Metronome clicks are enumerated per-beat through the same imperative loop as the rest. A single `scheduleRepeat("4n", cb)` on Transport would be both cheaper and more idiomatic, and would let the metronome run independently of step boundaries (useful for count-in / fill bars).

5. **`Tone.PolySynth` instance reuse + `releaseAll`** — `organVoice.ts`, `pianoVoice.ts`.
   Each chord hit **constructs a new PolySynth and disposes it after release**. This is expensive (allocates voices, builds filter graphs) and is the most likely source of any audible artifacts at fast tempos. Cache one PolySynth per voice type, set `maxPolyphony` at init, and reuse — `releaseAll(Tone.now())` on stop. Same approach for `MonoSynth` bass.

6. **Humanization via per-hit jitter** — `scheduler.ts` and pattern data in `patterns.ts:315–429`.
   No timing or velocity jitter on hits. A `±5 ms` timing nudge and `±0.05` velocity wobble (cheap to add at scheduling time, even without new Tone APIs) would shake off the "drum machine" feel. Tone helpers: `Tone.Time`, `Tone.Frequency` for unit conversion if needed.

7. **`Tone.Channel` / sub-buses for per-instrument mix** — `toneBus.ts`.
   Everything routes to one master `GainNode`. Per-instrument `Tone.Channel` (with `volume`, `pan`, `solo`, `mute`) would enable a mix UI and per-genre balance presets in `genres.ts` without rewiring scheduling.

8. **`Tone.Draw` for visual sync** — `useProgressionPlaybackLoop.ts`.
   Visual position is polled from `audio.ctx.currentTime`. `Tone.Draw.schedule(fn, time)` runs callbacks aligned to the audio clock via `requestAnimationFrame` — a cleaner path for animating chord changes in lockstep with audio. Low priority; current polling works.

9. **`Tone.Meter`** — `toneBus.ts`. Useful for a future level/clip indicator. Low priority.

---

## Section 3 — Tonal.js Audit

### Currently used

| API | Where | Use |
|-----|-------|-----|
| `@tonaljs/note` | `packages/core/src/lib/tonal.ts`, `theory.ts` | `Note.transpose`, `Note.simplify`, `Note.enharmonic`, `Note.chroma`. |
| `@tonaljs/interval` | `lib/tonal.ts`, `theory.ts` | `Interval.distance`, `Interval.fromSemitones`. |
| `@tonaljs/scale` | `theory.ts:482` | `Scale.get` inside `getScaleNotes`. |
| `@tonaljs/chord` | `theory.ts:509` | `Chord.get` inside `getChordNotes`. |
| `@tonaljs/key` | `theory.ts:578`, `degrees.ts` | `Key.majorKey / minorKey` for signatures + degree resolution. |

Inside the **backing-track path**, Tonal is reached only via `getDiatonicChord()` (`progressionGeneration.ts:40`) — i.e., one symbol → triad notes. Everything downstream (voicing, bass-note role, beat dispatch) is hand-rolled.

### Not used but should be (with file:line targets)

1. **`Tonal.RomanNumeral`** — `progressionDomain.ts` (Roman-numeral parsing) and `degrees.ts`.
   Roman numerals are parsed with hand-rolled regex + lookup. `RomanNumeral.get("V7")` returns `{ chordType, root, …}` and consolidates degree+quality+inversion handling. Direct replacement.

2. **`Tonal.Progression.fromRomanNumerals / toRomanNumerals`** — `progressionGeneration.ts:40–98`.
   Generate progressions from `["I", "vi", "ii", "V"]` in any key for free. Currently templates store absolute chord data and have to be re-rooted manually.

3. **`Tonal.Key.chords / Key.secondaryDominants`** — `progressionGeneration.ts`.
   The cadential/cycle template catalog hand-encodes diatonic pools. `Key.majorKey("C").chords` returns the full diatonic 7-chord list, and `.secondaryDominants` returns V/ii, V/iii, etc. — unlocks "suggest a secondary dominant here" features for free.

4. **`Tonal.Mode`** — `theory.ts`, scale catalog.
   Modes are listed as standalone scales. `Mode.notes(modeName, tonic)` + `Mode.triads` would let the backing-track engine pick mode-appropriate chord pools (e.g. Dorian → i, IV, v, ♭VII).

5. **`Tonal.Chord.extended / Chord.detect`** — `progressionAudio.ts:27–68`.
   `Chord.get("CM").notes` is the only path used. `Chord.extended("CM")` yields 7ths/9ths/11ths/13ths automatically — a richer voicing source for jazz genres. `Chord.detect(notes)` would let the UI label inversions (`C/E`).

6. **`Tonal.Range / Tonal.Note.transpose` for register-aware bass** — `progressionAudio.ts` `resolveBassNoteForRole`.
   Bass octave is currently hard-coded. `Range.numeric(["E1","E3"])` + nearest-pitch lookup would keep bass in a coherent register across keys (right now low-key bass can drop below the open low E).

7. **Voice-leading (community: `tonal-voice-leading`)** — `progressionAudio.ts`, `scheduler.ts:154–188`.
   Each chord re-stacks from a fixed root octave, ignoring the previous chord. A nearest-inversion picker (manually implementable on top of `Tonal.Note.midi` distance, no extra dep needed) would minimize aggregate semitone motion between adjacent voicings. This is the single biggest *Tonal-side* perceptual win — and the user almost certainly notices it on chord changes.

---

## Section 4 — Top 5 Wins (Impact ÷ Effort)

Ranked for a v2.1+ plan. Each notes file:line, expected user-perceptible delta, and the reason the recent migration didn't deliver it.

### 1. Master-bus effects chain (Reverb + Compressor + Limiter) — **biggest unlock**
- **File**: `src/progressions/audio/toneBus.ts:20–104`.
- **Change**: `bus → Tone.Compressor → Tone.Reverb (decay 1.5s, wet 0.18) → Tone.Limiter → destination`.
- **Effort**: ~30 lines, no scheduling changes.
- **Why migration alone didn't help**: Tone.js was adopted *as a 1:1 replacement for raw Web Audio voices*. No effects nodes were inserted into the signal path, so the spectrum reaching the speakers is identical to pre-migration.

### 2. Voice-leading / nearest-inversion picker for chord voicings
- **Files**: `src/progressions/progressionAudio.ts:27–68` (resolve), `src/progressions/audio/scheduler.ts:154–188` (dispatch).
- **Change**: Track the previous chord's voicing; when resolving the next, evaluate all inversions and pick the one minimizing total semitone distance (Tonal `Note.midi`).
- **Effort**: One small module + state thread-through.
- **Why migration alone didn't help**: Voicings still come from `CHORD_DEFINITIONS` stacked from a fixed `rootOctave` — the migration didn't change voicing logic.

### 3. Cache & reuse PolySynth / MonoSynth instances; stop allocating per-hit
- **Files**: `src/progressions/audio/instruments/pianoVoice.ts`, `organVoice.ts`, `src/progressions/audio/bass.ts`.
- **Change**: One PolySynth per chord-voice type, set `maxPolyphony` at init, `triggerAttackRelease` per hit, `releaseAll` on cancel. Drop deferred `dispose` + `setTimeout` cleanup pattern.
- **Effort**: Localized refactor of each voice file.
- **Why migration alone didn't help**: The migration ported the **per-hit construct-and-dispose** pattern from the old Web Audio code instead of moving to Tone's reuse model. Likely cause of any tempo-dependent CPU spikes / clicks.

### 4. Real drum samples via `Tone.Players`
- **Files**: `src/progressions/audio/drumKit.ts` (all `schedule*`).
- **Change**: Bundle or host a compact kit (kick/snare/hat/open-hat/ride), load via `Tone.Players`, velocity → `playbackRate` + `volume`.
- **Effort**: Asset pipeline + ~80 LOC.
- **Why migration alone didn't help**: Migration kept `MembraneSynth / NoiseSynth / MetalSynth` — same synthesized timbres as the pre-Tone era.

### 5. `Tone.Part` for chord/bass/drum patterns + `scheduleRepeat` for metronome
- **File**: `src/progressions/audio/scheduler.ts:110–268`.
- **Change**: Replace the imperative pattern loops with one `Tone.Part` per lane started at `startTime` and stopped at `startTime + beatsAvailable`. Run metronome as a long-lived `Transport.scheduleRepeat("4n", …)`.
- **Effort**: Medium — touches the scheduler core but reduces code overall.
- **Why migration alone didn't help**: Strictly a structural / maintenance win; sonically identical at first.

**Honorable mentions** (lower in the ranking but cheap):
- Per-hit velocity & timing humanization (`scheduler.ts`).
- Per-instrument `Tone.Channel` sub-buses, exposing pan/volume for a future mix UI (`toneBus.ts`).
- Consolidate Roman-numeral parsing on `Tonal.RomanNumeral` (`progressionDomain.ts`, `degrees.ts`).

---

## Section 5 — Notes & Caveats

- **Why the Tone migration was "silent"**: It was a runtime swap, not a sound-design change. Tone.js doesn't make audio sound better automatically — its leverage is in (a) higher-level scheduling (Part / Sequence / Transport), and (b) the rich effects library. Items (a) and (b) were left untouched in the migration. The current code uses Tone as "raw oscillators with envelopes," which is identical in output to the prior Web Audio implementation.
- **Why the Tonal adoption was "silent"**: Only `Chord.get / Scale.get / Key.majorKey` are reached. Tonal's structural APIs — `RomanNumeral`, `Progression`, `Mode`, `Key.chords` — replace hand-rolled code without changing what the user hears. They unlock *features* (mode-aware suggestions, secondary dominants, automatic re-rooting of templates), not sound.
- **The audio-clock binding via `Tone.setContext` (`toneBus.ts:22`) is correct and load-bearing** — don't refactor it casually.
- **Deferred `setTimeout` disposal** is a workaround for per-hit synth construction. Recommendation #3 removes the need.
- **Swing implementation is solid**. Beat-domain swing is tempo-agnostic; keep it.
- **Voice-leading is the most musically impactful Tonal-side win**; effects chain is the most musically impactful Tone-side win. Recommend doing both before any drum-sample work, since each is much cheaper.

---

## Suggested v2.1 sequencing

1. **Effects chain on master bus** (1 PR, low risk, high perceptual delta).
2. **PolySynth/MonoSynth reuse** (refactor; eliminates one cluster of latent bugs).
3. **Voice-leading inversion picker** (new module; user-audible on every chord change).
4. **Tone.Part scheduler rewrite** (medium-risk core refactor; structural).
5. **Drum samples via `Tone.Players`** (asset work; biggest single perceptual jump but most logistics).
6. **Tonal `RomanNumeral / Key.chords / Progression` consolidation** (theory-side cleanup; enables modal & secondary-dominant features).
