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
import { resolveBassLineNotes, resolveChordVoicing } from "../progressions/progressionAudio";
import {
  findNextResolvableStepIndex,
  type ResolvedProgressionStep,
} from "../progressions/progressionDomain";
import { useProgressionState } from "./useProgressionState";

/** Lead between scheduling and audible hit; keeps Web Audio from dropping
 * the first event when `currentTime` and "now" are the same sample. */
const SCHEDULE_LEAD_SECONDS = 0.02;

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
  const bassNotes = resolveBassLineNotes(step.root, step.quality);
  const secondsPerBeat = 60 / Math.max(1, inputs.tempo);
  const beatsAvailable =
    step.duration.unit === "bar"
      ? step.duration.value * inputs.beatsPerBar
      : step.duration.value;
  const durationSec = beatsAvailable * secondsPerBeat;

  const handle = scheduleProgressionStep(ctx, bus, {
    voicing,
    bassNotes,
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
  // Tracks whether playback was running on the last effect entry. Lets us
  // distinguish "cold start / resumed from pause" (we must schedule the
  // current chord from `now`) from "mid-playback dep change" (we keep the
  // current chord intact and apply the new params on the next bar).
  const wasPlayingRef = useRef<boolean>(false);

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
      wasPlayingRef.current = false;
      return;
    }

    if (!progressionPlaying) {
      stopAll();
      pauseTimeline();
      wasPlayingRef.current = false;
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
    const justStarted = !wasPlayingRef.current;
    wasPlayingRef.current = true;

    const isStepTransition =
      !justStarted
      && lastStepRef.current !== null
      && lastStepRef.current !== activeProgressionStepIndex;

    // Drop segments whose audio has already finished.
    segmentsRef.current = segmentsRef.current.filter((s) => s.endTime > now);

    if (justStarted) {
      // Cold start or resumed from pause: clear the queue and schedule the
      // current chord from `now + LEAD`. Resuming from pause must restart
      // the bar from beat 0 so the user hears the chord again.
      segmentsRef.current.forEach((s) => s.handle.cancelAll());
      segmentsRef.current = [];
    } else if (isStepTransition) {
      // Step boundary: the active chord was already pre-scheduled — keep
      // it and drop any queued segments for steps the user skipped past.
      segmentsRef.current = segmentsRef.current.filter(
        (s) => s.stepIndex === activeProgressionStepIndex,
      );
    } else {
      // Mid-step dep change (layer toggle / tempo / meter): preserve the
      // currently-playing segment unchanged so the bar doesn't restart, and
      // cancel only the pre-scheduled "next" segment. The user-toggled
      // layer takes effect on the next bar boundary, which matches a
      // hardware DAW's "punch-in" model and avoids audible double hits
      // from a mid-bar restart.
      const keepers: ScheduledSegment[] = [];
      for (const s of segmentsRef.current) {
        if (s.stepIndex === activeProgressionStepIndex) {
          keepers.push(s);
        } else {
          s.handle.cancelAll();
        }
      }
      segmentsRef.current = keepers;
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
