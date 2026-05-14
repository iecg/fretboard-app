import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import {
  ensureProgressionAudio,
  resumeProgressionAudio,
  restoreProgressionBus,
  silenceProgressionBus,
} from "../progressions/audio/bus";
import {
  scheduleProgressionStep,
  type ScheduledStepHandle,
} from "../progressions/audio/scheduler";
import { isMutedAtom } from "../store/atoms";
import { resolveChordVoicing } from "../progressions/progressionAudio";
import {
  findNextResolvableStepIndex,
  type ResolvedProgressionStep,
} from "../progressions/progressionDomain";
import { useProgressionState } from "./useProgressionState";

/** Lead time between scheduling and the audible hit. Keeps Web Audio from
 * dropping the first event when `currentTime` and "now" are equal. */
const SCHEDULE_LEAD_SECONDS = 0.02;

/** Octave used for the synthesized bass note. */
const BASS_OCTAVE = 2;

interface ScheduledSegment {
  stepIndex: number;
  /** AudioContext time at which this step starts. */
  startTime: number;
  /** AudioContext time at which this step ends — used to anchor the next. */
  endTime: number;
  handle: ScheduledStepHandle;
}

interface SchedulerInputs {
  steps: readonly ResolvedProgressionStep[];
  tempo: number;
  beatsPerBar: number;
  enable: {
    strum: boolean;
    bass: boolean;
    drums: boolean;
    metronome: boolean;
  };
}

function buildSegment(
  ctx: AudioContext,
  bus: AudioNode,
  stepIndex: number,
  startTime: number,
  inputs: SchedulerInputs,
): ScheduledSegment | null {
  const step = inputs.steps[stepIndex];
  if (!step || step.unavailable || !step.root || !step.quality) return null;

  const voicing = resolveChordVoicing(step.root, step.quality);
  const bassNote = step.root ? `${step.root}${BASS_OCTAVE}` : null;
  const secondsPerBeat = 60 / Math.max(1, inputs.tempo);
  const beatsAvailable =
    step.duration.unit === "bar"
      ? step.duration.value * inputs.beatsPerBar
      : step.duration.value;
  const durationSec = beatsAvailable * secondsPerBeat;

  const handle = scheduleProgressionStep(ctx, bus, {
    voicing,
    bassNote,
    beatsAvailable,
    beatsPerBar: inputs.beatsPerBar,
    secondsPerBeat,
    startTime,
    enable: inputs.enable,
  });

  return {
    stepIndex,
    startTime,
    endTime: startTime + durationSec,
    handle,
  };
}

/**
 * Drive the progression backing track. Maintains a small queue of two
 * pre-scheduled "segments" (current + next) so the chord at the bar
 * boundary fires on the audio clock instead of waiting for React's step
 * timer to advance. This eliminates the perceptible lag at chord
 * transitions even when the JS event loop is busy.
 *
 * Lifecycle:
 *  - On step transition: drop expired segments, ensure the new active step
 *    is scheduled, then queue the step that follows it.
 *  - On tempo / meter / enable-flag changes: cancel pending segments and
 *    re-schedule so the user hears the new groove on the next chord.
 *  - On pause/mute/block: cancel every segment and silence the bus in
 *    ~20ms via `silenceProgressionBus()`.
 */
export function useProgressionAudioPlayback() {
  const {
    progressionEnabled,
    progressionPlaying,
    progressionPlaybackBlockedReason,
    progressionLoopEnabled,
    activeProgressionStepIndex,
    resolvedProgressionSteps,
    progressionTempoBpm,
    beatsPerBar,
    progressionStrumEnabled,
    progressionBassEnabled,
    progressionDrumsEnabled,
    progressionMetronomeEnabled,
  } = useProgressionState();
  const isMuted = useAtomValue(isMutedAtom);

  const segmentsRef = useRef<ScheduledSegment[]>([]);
  /** Tracks which step we were on last effect run so we can distinguish a
   * chord transition (pre-schedule the next) from a tempo/flag change
   * (reschedule everything). */
  const lastStepRef = useRef<number | null>(null);

  useEffect(() => {
    // Defensive: HMR or hook-shape changes between reloads can leave the
    // ref holding a value from the previous version of the hook. Re-establish
    // the array invariant on every effect entry.
    if (!Array.isArray(segmentsRef.current)) {
      segmentsRef.current = [];
    }
    const stopAll = () => {
      segmentsRef.current.forEach((s) => s.handle.cancelAll());
      segmentsRef.current = [];
      silenceProgressionBus();
      lastStepRef.current = null;
    };

    if (
      !progressionEnabled
      || !progressionPlaying
      || progressionPlaybackBlockedReason
      || isMuted
    ) {
      stopAll();
      return;
    }

    const audio = ensureProgressionAudio();
    if (!audio) return;
    void resumeProgressionAudio();
    restoreProgressionBus();

    const inputs: SchedulerInputs = {
      steps: resolvedProgressionSteps,
      tempo: progressionTempoBpm,
      beatsPerBar,
      enable: {
        strum: progressionStrumEnabled,
        bass: progressionBassEnabled,
        drums: progressionDrumsEnabled,
        metronome: progressionMetronomeEnabled,
      },
    };

    const now = audio.ctx.currentTime;
    const isStepTransition =
      lastStepRef.current !== null
      && lastStepRef.current !== activeProgressionStepIndex;

    // Drop segments whose audio has finished.
    segmentsRef.current = segmentsRef.current.filter((s) => s.endTime > now);

    if (!isStepTransition) {
      // First activation or a non-step dep change (tempo/flags): wipe the
      // queue so the new settings take effect on the current chord.
      segmentsRef.current.forEach((s) => s.handle.cancelAll());
      segmentsRef.current = [];
    } else {
      // Step transition: the active chord was already pre-scheduled — keep
      // it. Drop anything we may have queued for a step the user just
      // skipped past (manual prev/next).
      segmentsRef.current = segmentsRef.current.filter(
        (s) => s.stepIndex === activeProgressionStepIndex,
      );
    }

    // Ensure the active step has a live segment. If we lost the
    // pre-scheduled one (cancelled above, or this is the first chord),
    // start it from "now + lead".
    if (
      !segmentsRef.current.find((s) => s.stepIndex === activeProgressionStepIndex)
    ) {
      const seg = buildSegment(
        audio.ctx,
        audio.bus,
        activeProgressionStepIndex,
        now + SCHEDULE_LEAD_SECONDS,
        inputs,
      );
      if (seg) segmentsRef.current.push(seg);
    }

    // Pre-schedule the next resolvable step so its first hit lands exactly
    // when the current chord's bar ends.
    const nextIdx = findNextResolvableStepIndex(
      resolvedProgressionSteps,
      activeProgressionStepIndex,
      1,
      progressionLoopEnabled,
    );
    if (
      nextIdx !== null
      && !segmentsRef.current.find((s) => s.stepIndex === nextIdx)
    ) {
      const tail = segmentsRef.current[segmentsRef.current.length - 1];
      const startAt = tail ? tail.endTime : now + SCHEDULE_LEAD_SECONDS;
      const seg = buildSegment(audio.ctx, audio.bus, nextIdx, startAt, inputs);
      if (seg) segmentsRef.current.push(seg);
    }

    lastStepRef.current = activeProgressionStepIndex;
  }, [
    progressionEnabled,
    progressionPlaying,
    progressionPlaybackBlockedReason,
    progressionLoopEnabled,
    activeProgressionStepIndex,
    resolvedProgressionSteps,
    isMuted,
    progressionTempoBpm,
    beatsPerBar,
    progressionStrumEnabled,
    progressionBassEnabled,
    progressionDrumsEnabled,
    progressionMetronomeEnabled,
  ]);
}
