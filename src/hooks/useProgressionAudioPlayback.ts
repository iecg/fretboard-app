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
import {
  clearTimeline,
  pauseTimeline,
  setActiveStep,
} from "../progressions/audio/timeline";
import { isMutedAtom } from "../store/atoms";
import { resolveChordVoicing } from "../progressions/progressionAudio";
import {
  findNextResolvableStepIndex,
  type ResolvedProgressionStep,
} from "../progressions/progressionDomain";
import { useProgressionState } from "./useProgressionState";

/** Lead between scheduling and audible hit; keeps Web Audio from dropping
 * the first event when `currentTime` and "now" are the same sample. */
const SCHEDULE_LEAD_SECONDS = 0.02;

/** Octave for the synthesized bass line. Two octaves below middle C sits
 * in the typical electric-bass register. */
const BASS_OCTAVE = 2;

interface ScheduledSegment {
  stepIndex: number;
  startTime: number;
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
 * pre-scheduled segments (current + next) so the chord at the bar
 * boundary fires on the audio clock instead of waiting for React's step
 * timer to advance.
 *
 * Also writes the active step into the shared `timeline` module — the
 * playhead, position readout, and React playback loop all read from it,
 * so audio and UI stay locked to a single AudioContext clock.
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
  const lastStepRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Array.isArray(segmentsRef.current)) segmentsRef.current = [];

    const stopAll = () => {
      segmentsRef.current.forEach((s) => s.handle.cancelAll());
      segmentsRef.current = [];
      silenceProgressionBus();
      lastStepRef.current = null;
    };

    if (
      !progressionEnabled
      || progressionPlaybackBlockedReason
      || isMuted
    ) {
      stopAll();
      clearTimeline();
      return;
    }

    if (!progressionPlaying) {
      stopAll();
      pauseTimeline();
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

    // Drop segments whose audio has already finished.
    segmentsRef.current = segmentsRef.current.filter((s) => s.endTime > now);

    if (!isStepTransition) {
      // First activation or a non-step dep change (tempo / flags / resumed
      // from pause): wipe the queue so the new settings take effect on the
      // current chord starting at the next audio frame.
      segmentsRef.current.forEach((s) => s.handle.cancelAll());
      segmentsRef.current = [];
    } else {
      // Step transition: the active chord was already pre-scheduled. Keep
      // it; drop anything queued for a step the user just skipped past.
      segmentsRef.current = segmentsRef.current.filter(
        (s) => s.stepIndex === activeProgressionStepIndex,
      );
    }

    // Ensure the active step has a live segment.
    let activeSeg = segmentsRef.current.find(
      (s) => s.stepIndex === activeProgressionStepIndex,
    );
    if (!activeSeg) {
      const startAt = now + SCHEDULE_LEAD_SECONDS;
      const seg = buildSegment(
        audio.ctx,
        audio.bus,
        activeProgressionStepIndex,
        startAt,
        inputs,
      );
      if (seg) {
        segmentsRef.current.push(seg);
        activeSeg = seg;
      }
    }

    // Publish the active step to the shared timeline so the playhead /
    // position readout / playback loop read from the same audio clock.
    if (activeSeg) {
      setActiveStep(
        activeSeg.stepIndex,
        activeSeg.startTime,
        activeSeg.endTime - activeSeg.startTime,
      );
    } else {
      clearTimeline();
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
