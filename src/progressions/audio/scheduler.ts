/**
 * Scheduler: turns a single progression step (a chord with a bar/beat length)
 * into a batch of timed audio events on the shared progression bus.
 *
 * The React layer fires this once per step transition. The scheduler does
 * the per-beat work in Web Audio time, so the strum + drum + bass groove
 * stays locked to the audio clock instead of drifting with React renders.
 *
 * Instrument-agnostic: the scheduler no longer hardcodes a single strum /
 * drum / bass pattern. It receives instrument + pattern ids and dispatches
 * to the chord-voice registry and the pattern catalog. Swing is applied
 * purely in the beat domain (off-beats shifted by `swing * 1/3` beats).
 *
 * On pause/stop the hook calls `silenceProgressionBus()` upstream for an
 * immediate fade. `cancelAll()` here also cancels pending scheduled voices
 * so future hits do not leak into resumed playback.
 */

import { getNoteFrequency } from "@fretflow/core";
import { resolveBassNoteForRole } from "../progressionAudio";
import { scheduleBassNote } from "./bass";
import {
  scheduleHiHat,
  scheduleKick,
  scheduleRide,
  scheduleSnare,
} from "./drumKit";
import { getChordVoice } from "./instruments";
import type { ChordInstrumentId, VoiceHandle } from "./instruments/types";
import { scheduleClick } from "./metronome";
import {
  buildMetronomePattern,
  getBassPattern,
  getChordPattern,
  getDrumPattern,
  getDrumVariation,
  repeatPatternToBeats,
  type CatalogDrumPattern,
  type DrumHit,
} from "./patterns";

interface SchedulerEnableFlags {
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
  /** Which chord synthesizer voices the strum lane. */
  chordInstrument: ChordInstrumentId;
  /** Catalog id of the chord/strum pattern. */
  chordPatternId: string;
  /** Catalog id of the bass pattern. */
  bassPatternId: string;
  /** Catalog id of the drum pattern. */
  drumPatternId: string;
  /** Catalog ids of additive drum variations overlaid on the base pattern. */
  drumVariations: string[];
  /** Swing ratio in [0, 1]. 0 = straight; higher pushes off-beats later. */
  swing: number;
  /** Root of the next chord (used to resolve chromatic-approach bass notes). */
  nextChordRoot?: string;
  /** Root of the current chord (enables role-resolved bass notes). */
  currentRoot?: string;
  /** Quality of the current chord (enables role-resolved bass notes). */
  currentQuality?: string;
}

export interface ScheduledStepHandle {
  /** Release every live voice scheduled by this step. */
  cancelAll: () => void;
}

const OFF_BEAT_TOLERANCE = 0.01;

/**
 * Apply swing in the beat domain: an off-beat (fractional part ≈ 0.5) is
 * shifted forward by `swing * 1/3` beats. On-beats are untouched. Keeping
 * swing in beats lets the caller scale by `secondsPerBeat` once.
 */
function swingBeat(beat: number, swing: number): number {
  if (swing <= 0) return beat;
  const isOff = Math.abs((beat % 1) - 0.5) < OFF_BEAT_TOLERANCE;
  return isOff ? beat + swing * (1 / 3) : beat;
}

/**
 * Schedule every instrument event for a single progression step. Returns a
 * handle the caller stores so it can cancel the step's voices on chord
 * change or pause.
 */
export function scheduleProgressionStep(
  bus: AudioNode,
  input: SchedulerStepInput,
): ScheduledStepHandle {
  const voices: VoiceHandle[] = [];
  const {
    startTime,
    secondsPerBeat,
    beatsAvailable,
    beatsPerBar,
    enable,
    swing,
    scheduleFromTime = startTime,
  } = input;

  // `beatsPerBar` is a divisor in the drum bar loop (`beatsAvailable / beatsPerBar`).
  // A non-positive value would yield a non-finite bar count and hang the loop.
  if (beatsAvailable <= 0 || secondsPerBeat <= 0 || beatsPerBar <= 0) {
    return { cancelAll: () => {} };
  }

  const shouldScheduleHit = (time: number) => time >= scheduleFromTime;

  // Chord / strum lane — dispatch to the configured chord voice and pattern.
  const chordPattern = getChordPattern(input.chordPatternId);
  if (enable.strum && chordPattern && input.voicing.length > 0) {
    const voice = getChordVoice(input.chordInstrument);
    const hits = repeatPatternToBeats(
      chordPattern.hits,
      beatsAvailable,
      beatsPerBar,
    );
    for (const hit of hits) {
      const hitTime = startTime + swingBeat(hit.beat, swing) * secondsPerBeat;
      if (!shouldScheduleHit(hitTime)) continue;
      voices.push(
        voice.scheduleChord(bus, input.voicing, hitTime, {
          velocity: hit.velocity,
          style: hit.style,
          direction: hit.direction,
        }),
      );
    }
  }

  // Bass lane — resolve note roles against the active chord when available.
  const bassPattern = getBassPattern(input.bassPatternId);
  if (enable.bass && bassPattern && input.bassNotes.length > 0) {
    const bassHits = repeatPatternToBeats(
      bassPattern.hits,
      beatsAvailable,
      beatsPerBar,
    );
    for (const hit of bassHits) {
      let note: string;
      if (input.currentRoot && input.currentQuality) {
        note = resolveBassNoteForRole(
          input.currentRoot,
          input.currentQuality,
          hit.note,
          input.nextChordRoot,
        );
      } else if (hit.note === "fifth") {
        note = input.bassNotes[1] ?? input.bassNotes[0];
      } else {
        note = input.bassNotes[0];
      }
      const bassFreq = getNoteFrequency(note);
      if (!Number.isFinite(bassFreq) || bassFreq <= 0) continue;
      const hitTime = startTime + swingBeat(hit.beat, swing) * secondsPerBeat;
      if (!shouldScheduleHit(hitTime)) continue;
      voices.push(
        scheduleBassNote(bus, bassFreq, hitTime, {
          velocity: hit.velocity,
          durationSec: Math.min(0.9, secondsPerBeat * 1.4),
        }),
      );
    }
  }

  // Drums — base pattern every bar, variations overlaid additively on bars
  // where `barIndex % barInterval === 0`.
  const drumPattern = getDrumPattern(input.drumPatternId);
  if (enable.drums && drumPattern) {
    const scheduleDrumPattern = (pattern: CatalogDrumPattern, barOffset: number) => {
      const scheduleLane = (
        lane: readonly DrumHit[] | undefined,
        fire: (hitTime: number, velocity: number) => VoiceHandle,
      ) => {
        if (!lane) return;
        for (const hit of lane) {
          const absBeat = barOffset * beatsPerBar + hit.beat;
          if (absBeat >= beatsAvailable) continue;
          const hitTime =
            startTime +
            (barOffset * beatsPerBar + swingBeat(hit.beat, swing)) *
              secondsPerBeat;
          if (!shouldScheduleHit(hitTime)) continue;
          voices.push(fire(hitTime, hit.velocity));
        }
      };
      scheduleLane(pattern.kicks, (t, v) =>
        scheduleKick(bus, t, { velocity: v }),
      );
      scheduleLane(pattern.snares, (t, v) =>
        scheduleSnare(bus, t, { velocity: v }),
      );
      scheduleLane(pattern.hats, (t, v) =>
        scheduleHiHat(bus, t, { velocity: v }),
      );
      scheduleLane(pattern.openHats, (t, v) =>
        scheduleHiHat(bus, t, { velocity: v, open: true }),
      );
      scheduleLane(pattern.ride, (t, v) =>
        scheduleRide(bus, t, { velocity: v }),
      );
    };

    const activeVariations = input.drumVariations
      .map((id) => getDrumVariation(id))
      .filter((v): v is NonNullable<typeof v> => v !== undefined);

    const barCount = Math.ceil(beatsAvailable / beatsPerBar);
    for (let bar = 0; bar < barCount; bar++) {
      scheduleDrumPattern(drumPattern, bar);
      for (const variation of activeVariations) {
        if (bar % variation.barInterval === 0) {
          scheduleDrumPattern(variation.pattern, bar);
        }
      }
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
        scheduleClick(bus, hitTime, {
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
