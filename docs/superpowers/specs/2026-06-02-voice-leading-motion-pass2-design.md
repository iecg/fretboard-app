# Voice-Leading Motion — Pass 2 (Bounded & Predictable) Design

**Date:** 2026-06-02
**Status:** Approved (pending spec review)
**Supersedes behavior in:** `2026-06-01-voice-leading-motion-design.md` (the slide model and cap). Builds on the same branch (`claude/voice-leading-motion`, PR #512).

## Why a second pass

Local testing of the first implementation surfaced three problems. Each was root-caused from the code:

1. **Slides fire every bar for a multi-bar chord.** The playback timeline calls `setActiveStep` once **per bar** (`buildAllLayers.ts:271–286` emits a chord-onset per bar; `useProgressionAudioPlayback.ts:477` calls `setActiveStep` on each) with a **one-bar** `durationSec` (`buildAllLayers.ts:283`). So `frame.localFraction` (`timeline.ts:131`) is fraction-through-the-current-**bar**, resetting to 0 each bar — but `leadInActiveAtom` / `isInLeadInWindow` treat it as fraction-through-the-**step**. For a multi-bar chord the lead-in window reopens in the final slice of every bar. (Latent since #511; single-bar chords have step == bar, so it only shows for multi-bar chords. The slide made it obvious where the ghost-only preview had hidden it.)

2. **Slides span the whole fretboard.** Two causes: (a) the cap kept the **longest**-travel pairs (the first spec said "keep the longest-travel ones" — backwards); (b) when no CAGED shape is active, **every** note is "in-region" (`buildStaticFretboardTopology.ts:319`: `isInsideAnyPolygon || shapePolygons.length === 0`), so pairing spans the whole neck. Default playback is whole-board (`fingeringPattern` defaults to `"none"`), so this is the common case.

3. **Inconsistent / unpredictable sliding.** Same root as #2 — greedy pairing across all in-region pitch-class matches + keep-longest cap is musically arbitrary, so which notes slide looks random.

## Goal

Voice-leading slides that are **musical, bounded, predictable, and fire once per chord** — working in the default whole-board view, with no change to the perf-sensitive playback infrastructure and no reintroduced performance regression (continuous motion stays compositor-driven, no per-frame React).

## Approach (chosen over alternatives)

**Bounded nearest-neighbor**, refining the existing per-note model. Rejected: voicing-anchored pairing (current voicing → next voicing per position) — most musically "correct" and naturally bounded, but needs new machinery to compute and position-match next-chord voicings (`generateVoicings` returns all voicings neck-wide with no "nearest position" parameter) and is multi-position in the default whole-board view; deferred as a possible future enhancement. Rejected: gate-to-active-shape-only — turns the feature off in the default whole-board view.

## Change 1 — Fire once per chord (step-relative lead-in)

The lead-in gates both the #511 ghost preview and the slide. Today it keys off `frame.localFraction`, which is per-bar.

**Behavior:** the lead-in opens exactly once per chord — in the chord's final lead-in window (its final bar for a multi-bar chord; the existing one-bar cap on the window length stays).

**Mechanism:** compute **step-relative progress** in the atom layer (`practiceLensAtoms.ts`) from the playhead's absolute position and the active step's start offset + duration, rather than from `frame.localFraction`. Absolute elapsed is derivable from the frame (`globalFraction × totalDurationSec`); the active step's start offset and duration are derivable from the resolved progression steps + the displayed step index. Factor the step-progress math into a **pure function** so it is unit-testable without audio.

- **No change** to the audio scheduler, `timeline.ts`, the playhead, or position readouts (that infrastructure stays per-bar; only the lead-in derivation changes).
- Single-bar chords are unaffected (step == bar → step-relative fraction equals the per-bar fraction).
- This also fixes the same every-bar re-trigger in the #511 ghost preview for multi-bar chords.

## Change 2 — Bounded nearest-neighbor pairing

Rework `computeVoiceLeadingMoves` (`src/components/FretboardSVG/utils/voiceLeading.ts`):

1. **Hard distance cap (core fix):** a pairing is allowed only if the source is within `MAX_VOICE_LEADING_FRET_SPAN` frets **and** `MAX_VOICE_LEADING_STRING_SPAN` strings of the target. Beyond that → no move (the incoming note fades in place). Measured on `stringIndex`/`fretIndex` (musical units), not pixels.
2. **Nearest source within the cap**, by pixel distance (`cx`/`cy`); one source per target (greedy, unchanged).
3. **Keep the SHORTEST moves**, not the longest, when capping the count (reverse of pass 1). Cap to `MAX_VOICE_LEADING_MOVES`.
4. **Min-travel threshold** unchanged (`MIN_VOICE_LEADING_TRAVEL_PX`) — drop sub-pixel jitter.

**Resulting rule (predictable by construction):** a note slides iff it has a departing/held chord tone within ~3 frets / 2 strings; it slides to the nearest such tone; at most the 3 shortest moves show. No board-spanning jumps; no arbitrary selection.

**Constants** (in `voiceLeading.ts`, all tunable):
- `MAX_VOICE_LEADING_FRET_SPAN = 3`
- `MAX_VOICE_LEADING_STRING_SPAN = 2`
- `MAX_VOICE_LEADING_MOVES = 3` (down from 4)
- `MIN_VOICE_LEADING_TRAVEL_PX = 8` (unchanged)

The `VoiceLeadingNote` input already carries `stringIndex`, `fretIndex`, `cx`, `cy`, `isInRegion`, `transitionRole` — no new inputs needed. The rest of the pipeline (offset stamping in `buildRenderedFretboardNotes`, `--vl-dx/--vl-dy` emission, the whole-ghost `note-incoming-slide` keyframe) is unchanged.

## Testing

- **`computeVoiceLeadingMoves`, unit:** drops moves beyond the fret/string cap (no cross-board slide); keeps the **shortest** moves when capping (replaces the pass-1 "keeps longest" test); nearest source within the cap; one source per target; correct `dx`/`dy` for an in-range move; caps to `MAX_VOICE_LEADING_MOVES`.
- **Step-relative lead-in, unit:** the pure step-progress function returns "not in lead-in" during the earlier bars of a multi-bar chord and "in lead-in" only in the final window; single-bar chords unchanged (regression guard).
- **Update existing tests** that assumed pass-1 behavior (the keep-longest cap test; any whole-board pairing assumptions).
- **Visual:** verified manually in `pnpm run dev` (the animation itself is not unit-assertable).

## Out of scope

- Voicing-anchored pairing (future enhancement).
- Any change to the audio scheduler / playhead / `timeline.ts`.
- New colors or motion vocabulary (reuses the existing whole-ghost slide from the current branch state).
