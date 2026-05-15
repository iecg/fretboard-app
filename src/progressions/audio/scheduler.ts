/**
 * Scheduler: turns a single progression step (a chord with a bar/beat length)
 * into a batch of timed audio events on the shared progression bus.
 *
 * The React layer fires this once per step transition. The scheduler does
 * the per-beat work in Web Audio time, so the strum + drum + bass groove
 * stays locked to the audio clock instead of drifting with React renders.
 *
 * On pause/stop the hook calls `silenceProgressionBus()` upstream for an
 * immediate fade. `cancelAll()` here also cancels pending scheduled voices
 * so future hits do not leak into resumed playback.
 */

import { getNoteFrequency } from "@fretflow/core";
import { scheduleBassNote, type BassVoiceHandle } from "./bass";
import {
  scheduleHiHat,
  scheduleKick,
  scheduleSnare,
  type DrumVoiceHandle,
} from "./drumKit";
import { scheduleClick, type ClickHandle } from "./metronome";
import {
  buildMetronomePattern,
  POP_STRUM_PATTERN,
  repeatPatternToBeats,
  ROOT_FIFTH_BASS_PATTERN,
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
  /** Bass line notes, root first and optional fifth second (e.g. ["C2","G2"]). */
  bassNotes: readonly string[];
  /** Step length expressed in beats (may be fractional for sub-bar steps). */
  beatsAvailable: number;
  /** Beats per bar at the current meter (used for metronome accent placement). */
  beatsPerBar: number;
  /** Seconds per beat at the current tempo (= 60/BPM). */
  secondsPerBeat: number;
  /** AudioContext time at which the step begins. */
  startTime: number;
  /** Optional lower bound for scheduled events, used when rebuilding a
   *  still-playing step after an instrument toggle without moving the
   *  timeline back to beat 0. */
  scheduleFromTime?: number;
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
  const voices: Array<
    PluckedVoiceHandle | BassVoiceHandle | DrumVoiceHandle | ClickHandle
  > = [];
  const {
    startTime,
    secondsPerBeat,
    beatsAvailable,
    beatsPerBar,
    enable,
    scheduleFromTime = startTime,
  } = input;

  if (beatsAvailable <= 0 || secondsPerBeat <= 0) {
    return { cancelAll: () => {} };
  }

  const shouldScheduleHit = (time: number) => time >= scheduleFromTime;

  // Strum: trigger each pattern hit, voicing notes spread across STRUM_LAG.
  if (enable.strum && input.voicing.length > 0) {
    const hits = repeatPatternToBeats(
      POP_STRUM_PATTERN,
      beatsAvailable,
      beatsPerBar,
    );
    for (const hit of hits) {
      const hitTime = startTime + hit.beat * secondsPerBeat;
      if (!shouldScheduleHit(hitTime)) continue;
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

  // Bass: root note on beat 1, chord fifth on beat 3, repeated per bar.
  if (enable.bass && input.bassNotes.length > 0) {
    const bassHits = repeatPatternToBeats(
      ROOT_FIFTH_BASS_PATTERN,
      beatsAvailable,
      beatsPerBar,
    );
    for (const hit of bassHits) {
      const note =
        hit.note === "fifth"
          ? input.bassNotes[1] ?? input.bassNotes[0]
          : input.bassNotes[0];
      const bassFreq = getNoteFrequency(note);
      if (Number.isFinite(bassFreq) && bassFreq > 0) {
        const hitTime = startTime + hit.beat * secondsPerBeat;
        if (!shouldScheduleHit(hitTime)) continue;
        voices.push(
          scheduleBassNote(
            ctx,
            bus,
            bassFreq,
            hitTime,
            {
              velocity: hit.velocity,
              durationSec: Math.min(0.9, secondsPerBeat * 1.4),
            },
          ),
        );
      }
    }
  }

  // Drums: scheduled source nodes are tracked so pause/resume can cancel
  // future hits before rebuilding the bar from beat 0.
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
      const hitTime = startTime + hit.beat * secondsPerBeat;
      if (!shouldScheduleHit(hitTime)) continue;
      voices.push(
        scheduleKick(ctx, bus, hitTime, {
          velocity: hit.velocity,
        }),
      );
    }
    for (const hit of snares) {
      const hitTime = startTime + hit.beat * secondsPerBeat;
      if (!shouldScheduleHit(hitTime)) continue;
      voices.push(
        scheduleSnare(ctx, bus, hitTime, {
          velocity: hit.velocity,
        }),
      );
    }
    for (const hit of hats) {
      const hitTime = startTime + hit.beat * secondsPerBeat;
      if (!shouldScheduleHit(hitTime)) continue;
      voices.push(
        scheduleHiHat(ctx, bus, hitTime, {
          velocity: hit.velocity,
        }),
      );
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
      const hitTime = startTime + hit.beat * secondsPerBeat;
      if (!shouldScheduleHit(hitTime)) continue;
      voices.push(
        scheduleClick(ctx, bus, hitTime, {
          accent: Math.abs(beatInBar) < 1e-9,
          velocity: hit.velocity,
        }),
      );
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
