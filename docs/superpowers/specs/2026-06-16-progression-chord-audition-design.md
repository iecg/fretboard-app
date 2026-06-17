# Progression Chord Preview — Design

**Date:** 2026-06-16
**Status:** Implemented.
**Topic:** Make it faster to decide "what chord goes here" in the progression editor without replaying the whole progression.

> **Naming:** the user-facing control is **"Preview"** (the plain term used by Hookpad /
> Key Chords; Scaler 2 calls the same thing "Audition"). Internal identifiers keep the
> `audition*` names (`useChordAudition`, `auditionActiveAtom`, `resolveAuditionWindow`, …) —
> only the display strings say "Preview".

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

1. **Preview a slot in context** without playing the whole progression (top priority).
2. **Faster building** — insert where the user is working, not at the end.

## Non-goals (parked for future features — see [`docs/ROADMAP.md`](../../ROADMAP.md))

- **Smart / function-aware add** — choosing the next chord from cadence + chord-function
  theory. Separate feature; ties into a future "suggestions" priority.
- **Slash chords / inversions / octave** — manual bass note and register on top of the
  automatic voicing engine. Separate feature.
- **Auto-audio on edit** — auto-playing the preview whenever root/quality/duration
  changes. Deliberately deferred; revisit after using manual preview. Manual-only for now.

## Design (prior art: Hookpad "Quick Preview" plays a chord and its neighbours in quick succession)

### 1. Preview control (manual, selection stays silent)

- Selecting a chord row stays **silent** (no behavior change to selection).
- A single **Preview** button lives in the **editor-panel header** for the currently
  selected slot. No mode/loop control — preview is one snappy action (a separate Once/Loop
  toggle was prototyped and cut as clunky; re-clicking is enough to repeat).
- Triggers: the Preview button **and** the **`A`** key (free; taken keys are
  Space/`.`/R/M/1–4/arrows/Alt+arrows/T/S/C). Inert while the progression is playing
  (editor is locked then) and while muted.
- **Stop state:** while a preview sounds, the button flips to **Stop** (square icon, cyan,
  `aria-pressed`); the editor eyebrow reads **"Previewing"**. A second trigger stops it.

**What it plays — the neighbourhood as a quick phrase:**

- Plays `previous → selected → next`, **one beat per chord** (a stab-and-move-on phrase),
  NOT each chord's real length. Clamps at the ends (first slot drops `prev`; last drops
  `next`).
- Chord + bass only (drums/metronome omitted for a clean preview).
- Reuses the engine's pure builder (`buildAllLayersAsync`) and chord/bass voices, scheduled
  directly on the shared AudioContext — **not** the Tone Transport / visual clock that full
  playback owns (safe because preview and playback are mutually exclusive).

### 2. "Now playing" — moving highlight

- A dedicated `auditionDisplayIndexAtom` (overriding `displayedProgressionStepIndexAtom`
  and the progression-track view model) advances through the window so the **track playhead
  and the fretboard light up each chord as it sounds** — like playback, scoped to the
  window — **without moving the edit cursor** (`activeProgressionStepIndexAtom`). Cleared
  when the phrase ends.

### 3. Insert-at-cursor

- `addProgressionStepAtom` inserts the new chord **immediately after the selected chord**
  and selects it. Empty/no-selection list → append (equivalent to insert-at-end).

### 4. Keep "+1 next degree" default

- The new chord's degree/quality default is **unchanged** (`(previousIdx + 1) % len` with
  diatonic quality). Only its insert position changes. Smarter defaults are parked.

## Affected code

- [`packages/fretboard/src/store/progressionAtoms.ts`](../../../packages/fretboard/src/store/progressionAtoms.ts)
  — `addProgressionStepAtom` (insert-at-cursor); `auditionActiveAtom`,
  `auditionDisplayIndexAtom`, `auditionRequestTickAtom` / `requestAuditionAtom`;
  `displayedProgressionStepIndexAtom` prefers the preview index.
- [`packages/fretboard/src/progressions/auditionWindow.ts`](../../../packages/fretboard/src/progressions/auditionWindow.ts)
  — pure `resolveAuditionWindow` (neighbourhood bounds).
- [`packages/fretboard/src/hooks/useChordAudition.ts`](../../../packages/fretboard/src/hooks/useChordAudition.ts)
  — the audio + moving-highlight side-effect; mounted alongside `useProgressionAudioPlayback`.
- [`src/components/SongControls/SongControls.tsx`](../../../src/components/SongControls/SongControls.tsx)
  — Preview button (+ Stop state, "Previewing" eyebrow); [`useKeyboardShortcuts.ts`](../../../src/hooks/useKeyboardShortcuts.ts) — `A` binding;
  i18n + help-shortcut table.

## Testing

- Unit: `addProgressionStepAtom` inserts after the selected index / appends when empty;
  `resolveAuditionWindow` neighbourhood bounds (middle, first, last, single, empty,
  out-of-range); `auditionDisplayIndexAtom` overrides the displayed index without moving
  the edit cursor; `requestAudition` advances the tick.
- Component: single Preview button renders (no mode group); click advances the request
  tick; Stop state shows while previewing; disabled while playing.
- Keyboard: `A` requests a preview; inert while playing.
- Manual (audio + moving highlight): confirm by ear/eye in a real browser — the headless
  preview can't reliably grant the user-gesture-timed `AudioContext.resume()`.
