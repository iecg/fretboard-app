# Backing-Track Musical Composition (Slice C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement voice-leading for chord progressions, register-aware bass tracking, and subtle humanization to make the backing track engine sound more musical and less robotic.

**Architecture:** Pure logic functions extracted for voice-leading and bass calculation. The scheduler will maintain `lastVoicing` state and apply random timing/velocity jitter per hit, anchored by deterministic seeds to keep looping consistent.

**Spec:** `docs/superpowers/specs/2026-05-28-backing-track-composition.md`

---

## File Structure

**New files:**
- `src/progressions/voiceLeading.ts` — nearest inversion picker using Tonal.
- `src/progressions/voiceLeading.test.ts`
- `src/progressions/bassLogic.ts` — register-aware bass resolution.
- `src/progressions/bassLogic.test.ts`
- `src/progressions/audio/humanize.ts` — deterministic jitter generator.
- `src/progressions/audio/humanize.test.ts`

**Modified files:**
- `src/progressions/progressionAudio.ts` — hook up `voiceLeading.ts` and `bassLogic.ts`. Manage `lastVoicing` across chord resolutions.
- `src/progressions/audio/scheduler.ts` — hook up `humanize.ts` to `startTime` and `velocity` for each hit.

---

## Phase 1 — Humanization Engine

### Task 1: Humanize module
- [ ] **Step 1: Write `humanize.test.ts`** asserting that given a deterministic seed (e.g., beat number), it returns reproducible jittered values within specified bounds (e.g., +/- 10ms, +/- 0.05 velocity).
- [ ] **Step 2: Write `humanize.ts`** implementing `applyJitter(time, velocity, amount, seed)`.
- [ ] **Step 3: Hook up to `scheduler.ts`**: Update the loops mapping over chord, bass, and drum patterns to pass their scheduled hits through `applyJitter`.

## Phase 2 — Voice Leading

### Task 2: Voice Leading pure logic
- [ ] **Step 1: Write `voiceLeading.test.ts`** asserting that a transition from `Cmaj7` to `Fmaj7` picks the inversion with the lowest total `Tonal.Interval.semitones` distance from the previous notes.
- [ ] **Step 2: Write `voiceLeading.ts`** implementing `getNearestInversion(prevNotes: string[], targetChord: string): string[]`. Ensure it handles cases where `prevNotes` is empty (returns root position).

### Task 3: Integrating Voice Leading into the engine
- [ ] **Step 1: Update `progressionAudio.ts`**'s `resolveChordVoicing`. Make it accept an optional `prevNotes` array. Inside, if `prevNotes` is provided, call `getNearestInversion` instead of just stacking the default definition.
- [ ] **Step 2: Update the `resolve...` caller** to thread the state. The loop iterating over progression steps needs to capture the output of `resolveChordVoicing` and pass it as the `prevNotes` argument to the next iteration.

## Phase 3 — Bass Logic

### Task 4: Register-Aware Bass logic
- [ ] **Step 1: Write `bassLogic.test.ts`** asserting that `resolveBassNote(role, chordRoot, prevNote)` clamps the octave so the bass remains within a realistic range (e.g., `E1` to `E3`).
- [ ] **Step 2: Write `bassLogic.ts`** implementing the pure function. 
- [ ] **Step 3: Integrate into `progressionAudio.ts`** replacing the hardcoded `PROGRESSION_BASS_ROOT_OCTAVE`. Ensure approach notes calculate distance to the *next* chord's root to avoid awkward jumps.

## Phase 4 — Verification
- [ ] **Step 1:** Run unit tests for all new pure functions.
- [ ] **Step 2:** Ensure E2E audio loop functions and sounds connected. Listen to a `C - F - G` loop and confirm the chords don't jump an octave.
