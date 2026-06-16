# Progression Chord Audition — Design

**Date:** 2026-06-16
**Status:** Approved design, ready for implementation plan
**Topic:** Make it faster to decide "what chord goes here" in the progression editor without replaying the whole progression.

## Problem

Deciding the next (or current) chord in a progression currently requires playing the
whole progression from the transport bar to hear how a chord lands. That gets old fast
when iterating on a single slot.

Two related annoyances in the existing "add chord" flow compound it:

- **Adds to the bottom.** `addProgressionStepAtom`
  ([`packages/fretboard/src/store/progressionAtoms.ts`](../../../packages/fretboard/src/store/progressionAtoms.ts) ~line 522)
  always appends: `const next = [...get(progressionStepsAtom), createProgressionStep({...})]`.
  Adding while a middle chord is selected dumps the new chord at the end.
- **Always "+1 next degree."** The new chord's degree is chosen as
  `(previousIdx + 1) % sequence.length` relative to the active step — a fixed walk up the
  scale that ignores intent.

## Goals

1. **Audition a slot in context** without playing the whole progression (top priority).
2. **Faster building** — insert where the user is working, not at the end.

## Non-goals (parked for future features)

- **Smart / function-aware add** — choosing the next chord from cadence + chord-function
  theory. Separate feature; ties into a future "suggestions" priority.
- **Slash chords / inversions / octave** — manual bass note and register on top of the
  automatic voicing engine. Separate feature.
- **Auto-audio on edit** — auto-playing the cadence whenever root/quality/duration changes.
  Deliberately deferred; revisit after using manual audition. Manual-only for now.

## Design

### 1. Audition control (manual, selection stays silent)

- Selecting a chord row remains **silent** (no behavior change to selection).
- A dedicated **Audition** control lives in the **editor panel** for the currently
  selected slot only (not per-row — YAGNI; revisit if one-tap per-row audition is missed).
- Triggers: the Audition button **and** a keyboard key.
  - Keyboard key TBD during implementation. Avoid colliding with global play/stop
    (likely Space). Candidates: `A` or `Shift+Space`. Confirm the actual transport
    binding before choosing.

**What it plays — cadence into the slot:**

- Default audition plays `previous chord → selected chord` (a 2-chord move), using the
  current tempo and the steps' own durations.
- If the selected slot is the **first** chord (no predecessor), audition just plays that
  single chord.
- Uses the existing audio engine (GuitarSynth strum / Tone.js progression playback path)
  rather than a new sound path.

### 2. Local-loop toggle

- A toggle next to the Audition control. When **on**, audition loops a small window
  around the slot — `previous → selected → next` — repeating until the user stops.
- Window **clamps at the ends**: first slot has no previous; last slot has no next.
- When **off**, audition is the one-shot cadence from section 1.

### 3. Insert-at-cursor

- `addProgressionStepAtom` inserts the new chord **immediately after the selected chord**
  instead of appending to the end, and selects the newly inserted chord.
- If nothing is selected / list is empty, behavior is unchanged (append, which equals
  insert-at-end).

### 4. Keep "+1 next degree" default

- The new chord's degree/quality default is **unchanged** — still
  `(previousIdx + 1) % sequence.length` with diatonic quality. Only its insert position
  changes (section 3). Smarter defaults are a parked future feature.

## Affected code (orientation, not final list)

- [`packages/fretboard/src/store/progressionAtoms.ts`](../../../packages/fretboard/src/store/progressionAtoms.ts)
  — `addProgressionStepAtom` (insert-at-cursor); new audition action atom(s) and a
  local-loop toggle atom.
- [`src/components/SongControls/SongControls.tsx`](../../../src/components/SongControls/SongControls.tsx)
  — Audition button + local-loop toggle in the editor panel; keyboard binding.
- Audio path: existing GuitarSynth / Tone.js progression playback
  (`src/hooks/useProgressionAudioPlayback.ts`, `src/core/audio.ts`) — reuse, do not add a
  new sound path.

## Open questions (resolve during planning)

- Exact keyboard binding for audition (avoid Space collision).
- Whether audition reuses the full progression-playback transport or a lighter one-shot
  trigger for the 2–3 chord window.

## Testing

- Unit: `addProgressionStepAtom` inserts after the selected index and selects the new
  step; appends when nothing selected / empty.
- Unit: audition window resolves correctly — cadence (`prev → selected`), first-slot
  single chord, and clamped loop window (`prev → selected → next`) at both ends.
- Component: Audition button and local-loop toggle present in the editor panel; selection
  stays silent; keyboard trigger fires audition.
