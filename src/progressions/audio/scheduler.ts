/**
 * Scheduler: turns a single progression step (a chord with a bar/beat length)
 * into a batch of timed audio events on the shared progression bus.
 *
 * The React layer fires this once per step transition. The scheduler does
 * the per-beat work in Web Audio time, so the strum + drum + bass groove
 * stays locked to the audio clock instead of drifting with React renders.
 *
 * On pause/stop the hook calls `silenceProgressionBus()` upstream — that's
 * the single kill switch. `cancelAll()` here additionally releases the live
 * pluck/bass voices so their oscillators tear down promptly instead of
 * waiting for their full envelope.
 */

import { getNoteFrequency } from "@fretflow/core";
import { scheduleBassNote, type BassVoiceHandle } from "./bass";
import { scheduleHiHat, scheduleKick, scheduleSnare } from "./drumKit";
import { scheduleClick } from "./metronome";
import {
  buildMetronomePattern,
  POP_STRUM_PATTERN,
  repeatPatternToBeats,
  ROCK_DRUM_PATTERN,
} from "./patterns";
import { pluckString, type PluckedVoiceHandle } from "./string";

export interface SchedulerEnableFlags {
  strum: boolean;
  bass: boolean;
  drums: boolean;
  metronome: boolean;
}

export interface SchedulerStepInput {
  /** Notes for the chord voicing (e.g. ["C3","E3","G3"]). Empty disables strum. */
  voicing: readonly string[];
  /** Root note for the bass line (e.g. "C2"). Null disables bass for this step. */
  bassNote: string | null;
  /** Step length expressed in beats (may be fractional for sub-bar steps). */
  beatsAvailable: number;
  /** Beats per bar at the current meter (used for metronome accent placement). */
  beatsPerBar: number;
  /** Seconds per beat at the current tempo (= 60/BPM). */
  secondsPerBeat: number;
  /** AudioContext time at which the step begins. */
  startTime: number;
  enable: SchedulerEnableFlags;
}

export interface ScheduledStepHandle {
  /** Release every live voice scheduled by this step. */
  cancelAll: () => void;
}

const STRUM_LAG_SECONDS = 0.018;

/**
 * Schedule every instrument event for a single progression step. Returns a
 * handle the caller stores so it can cancel the step's voices on chord
 * change or pause.
 */
export function scheduleProgressionStep(
  ctx: AudioContext,
  bus: AudioNode,
  input: SchedulerStepInput,
): ScheduledStepHandle {
  const voices: Array<PluckedVoiceHandle | BassVoiceHandle> = [];
  const { startTime, secondsPerBeat, beatsAvailable, beatsPerBar, enable } = input;

  if (beatsAvailable <= 0 || secondsPerBeat <= 0) {
    return { cancelAll: () => {} };
  }

  // Strum: trigger each pattern hit, voicing notes spread across STRUM_LAG.
  if (enable.strum && input.voicing.length > 0) {
    const hits = repeatPatternToBeats(
      POP_STRUM_PATTERN,
      beatsAvailable,
      beatsPerBar,
    );
    for (const hit of hits) {
      const hitTime = startTime + hit.beat * secondsPerBeat;
      const ordered =
        hit.direction === "up" ? [...input.voicing].reverse() : input.voicing;
      ordered.forEach((note, i) => {
        const freq = getNoteFrequency(note);
        if (!Number.isFinite(freq) || freq <= 0) return;
        const noteTime = hitTime + i * STRUM_LAG_SECONDS;
        voices.push(
          pluckString(ctx, bus, freq, noteTime, { velocity: hit.velocity }),
        );
      });
    }
  }

  // Bass: root note on beat 1, fifth-style pickup on beat 3 if room.
  if (enable.bass && input.bassNote) {
    const bassFreq = getNoteFrequency(input.bassNote);
    if (Number.isFinite(bassFreq) && bassFreq > 0) {
      const bassPattern: Array<{ beat: number; velocity: number }> = [
        { beat: 0, velocity: 1 },
        { beat: 2, velocity: 0.85 },
      ];
      const bassHits = repeatPatternToBeats(
        bassPattern,
        beatsAvailable,
        beatsPerBar,
      );
      for (const hit of bassHits) {
        voices.push(
          scheduleBassNote(
            ctx,
            bus,
            bassFreq,
            startTime + hit.beat * secondsPerBeat,
            {
              velocity: hit.velocity,
              durationSec: Math.min(0.9, secondsPerBeat * 1.4),
            },
          ),
        );
      }
    }
  }

  // Drums: fire-and-forget — no live handles needed.
  if (enable.drums) {
    const kicks = repeatPatternToBeats(
      ROCK_DRUM_PATTERN.kicks,
      beatsAvailable,
      beatsPerBar,
    );
    const snares = repeatPatternToBeats(
      ROCK_DRUM_PATTERN.snares,
      beatsAvailable,
      beatsPerBar,
    );
    const hats = repeatPatternToBeats(
      ROCK_DRUM_PATTERN.hats,
      beatsAvailable,
      beatsPerBar,
    );
    for (const hit of kicks) {
      scheduleKick(ctx, bus, startTime + hit.beat * secondsPerBeat, {
        velocity: hit.velocity,
      });
    }
    for (const hit of snares) {
      scheduleSnare(ctx, bus, startTime + hit.beat * secondsPerBeat, {
        velocity: hit.velocity,
      });
    }
    for (const hit of hats) {
      scheduleHiHat(ctx, bus, startTime + hit.beat * secondsPerBeat, {
        velocity: hit.velocity,
      });
    }
  }

  if (enable.metronome) {
    const clicks = repeatPatternToBeats(
      buildMetronomePattern(beatsPerBar),
      beatsAvailable,
      beatsPerBar,
    );
    for (const hit of clicks) {
      const beatInBar = hit.beat % beatsPerBar;
      scheduleClick(ctx, bus, startTime + hit.beat * secondsPerBeat, {
        accent: Math.abs(beatInBar) < 1e-9,
        velocity: hit.velocity,
      });
    }
  }

  return {
    cancelAll: () => {
      for (const v of voices) v.cancel();
      voices.length = 0;
    },
  };
}

export const _schedulerInternals = { STRUM_LAG_SECONDS };
