# Backing-Track Musical Composition (Slice C)

**Status:** Design — ready for implementation plan.
**Date:** 2026-05-29
**Predecessors:** audit `2026-05-21-backing-track-tonal-audit.md`; sound/mix slice `2026-05-28-backing-track-sound-and-mix-design.md`.
**Theme:** The *musical composition* half of "replace a YouTube backing track." Slice A+B makes it sound good; slice C makes it play musically.

---

## 1. Goal

Kill the "drum-machine / loop-pedal stiffness" and make the backing band sound like players reacting to a chord chart, not a grid. The focus is on voice-leading, bass register awareness, and subtle humanization. Generative patterns (AI/dynamic beats and progressions) are deferred to a separate generative slice.

## 2. Scope

1. **Voice-leading / nearest-inversion picker** (audit Win #2).
   - Track the previous chord voicing. Choose the next chord's inversion to minimize total semitone motion (via `Tonal.Note.midi` distance). This makes chord changes sound like a pianist moving fingers minimally rather than jumping hands.
2. **Register-aware bass** (audit Tonal #6).
   - Keep bass in a coherent register across keys instead of the hardcoded octave 2. Range clamp (e.g. E1–E3) with nearest-pitch selection. Smarter chromatic approach with look-ahead to the next chord's root.
3. **Humanization** (audit Win honorable mention).
   - Per-hit timing jitter (±~5-10 ms) and velocity wobble (±~0.05-0.10), applied at schedule time in `scheduler.ts`. Swing stays as-is (already solid).
4. **Tonal structural consolidation** (audit Tonal #1–5).
   - Use `Tonal.RomanNumeral`, `Tonal.Progression`, `Tonal.Key.chords` — unlock mode-appropriate chord pools and consolidate hand-rolled Roman-numeral parsing.

## 3. Architecture & Signal Flow

### 3.1 Voice Leading (`src/progressions/voiceLeading.ts`)
Create a pure function `getNearestInversion(prevNotes: string[], targetChord: string): string[]`.
- It will evaluate all standard inversions (root position, 1st, 2nd, 3rd) of the target chord.
- Calculate the aggregate `Tonal.Interval.semitones` distance between voices.
- Return the array of notes for the chosen inversion.
- `progressionAudio.ts` will maintain `lastVoicing` state and use it when resolving the next step.

### 3.2 Bass Register Tracking (`src/progressions/bassLogic.ts`)
Create `resolveBassNoteForRole(role, chord, prevNote, targetRange)`.
- Use `Tonal.Range.numeric` to define a valid bass range (e.g., E1 to E3).
- Choose octaves to keep bass motion minimal unless a jump is required to stay in range.
- Approach notes (chromatic/diatonic) look ahead to the *next* chord's root.

### 3.3 Humanization Engine (`src/progressions/audio/humanize.ts`)
Inject slight randomization to `startTime` and `velocity` inside the `Tone.Part` scheduler callbacks.
- `applyJitter(time: number, velocity: number, amount: number): { time: number, velocity: number }`.
- Use a deterministic seeded RNG (e.g., based on the bar and beat) so a loop repeats identically per loop iteration, avoiding chaotic playback but feeling loose.

## 4. Testing
- Unit tests for `getNearestInversion` to ensure minimal voice movement (e.g., C -> G should keep the G voice stationary).
- Unit tests for bass range bounding.
- Playback engine tests asserting deterministic but non-zero jitter based on loop step.

## 5. Dependencies
- Relies on A+B (patches/mix). The voice-leading changes which pitches sound, which will interact with the A+B mix/inserts.
