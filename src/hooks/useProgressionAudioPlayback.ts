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
 * the first event when `currentTime` and "now" are the same sample. Increased
 * to 50ms to safely clear the fade-out ramp of replaced voices, avoiding
 * "repeated" note flams during mid-bar re-scheduling. */
const SCHEDULE_LEAD_SECONDS = 0.05;

interface ScheduledSegment {
  stepIndex: number;
  startTime: number;
  endTime: number;
  handle: ScheduledStepHandle;
  root: string | null;
  quality: string | null;
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

type EnableFlags = SchedulerInputs["enable"];

function sameEnableFlags(a: EnableFlags | null, b: EnableFlags): boolean {
  return !!a
    && a.strum === b.strum
    && a.bass === b.bass
    && a.drums === b.drums
    && a.metronome === b.metronome;
}

function buildSegment(
  ctx: AudioContext,
  bus: AudioNode,
  stepIndex: number,
  startTime: number,
  inputs: SchedulerInputs,
  scheduleFromTime?: number,
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
    scheduleFromTime,
    enable: inputs.enable,
  });

  return {
    stepIndex,
    startTime,
    endTime: startTime + durationSec,
    handle,
    root: step.root,
    quality: step.quality,
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
  const lastEnableRef = useRef<EnableFlags | null>(null);
  const lastActiveStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Array.isArray(segmentsRef.current)) segmentsRef.current = [];

    const stopAll = () => {
      segmentsRef.current.forEach((s) => s.handle.cancelAll());
      segmentsRef.current = [];
      silenceProgressionBus();
      lastStepRef.current = null;
      lastEnableRef.current = null;
      lastActiveStartTimeRef.current = null;
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
    const enableChanged = !sameEnableFlags(lastEnableRef.current, inputs.enable);
    wasPlayingRef.current = true;

    // Drop segments whose audio has already finished.
    segmentsRef.current = segmentsRef.current.filter((s) => s.endTime > now);

    if (justStarted) {
      // Cold start or resumed from pause: clear the queue and schedule the
      // current chord from `now + LEAD`.
      segmentsRef.current.forEach((s) => s.handle.cancelAll());
      segmentsRef.current = [];
      lastActiveStartTimeRef.current = null;
    } else {
      // Reconciliation: discard segments that are no longer part of the
      // current/next sequence, or whose resolution has become stale.
      const nextIdx = findNextResolvableStepIndex(
        resolvedProgressionSteps,
        activeProgressionStepIndex,
        1,
        progressionLoopEnabled,
      );

      const keepers: ScheduledSegment[] = [];
      for (const s of segmentsRef.current) {
        const step = resolvedProgressionSteps[s.stepIndex];
        const isDesired =
          s.stepIndex === activeProgressionStepIndex || s.stepIndex === nextIdx;

        const isCorrect =
          step && step.root === s.root && step.quality === s.quality;

        // Instrument toggles are direct performance controls. Rebuild the
        // active segment immediately to apply the new texture.
        const forceRebuildActive =
          s.stepIndex === activeProgressionStepIndex && enableChanged;

        if (isDesired && isCorrect && !forceRebuildActive) {
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
      // Re-scheduling the active segment: if we have a record of its
      // previous startTime, use it so the bar doesn't restart rhythmically.
      // Otherwise, anchor it to `now`.
      const startAt = (lastStepRef.current === activeProgressionStepIndex)
        ? (lastActiveStartTimeRef.current ?? now)
        : now;

      const seg = buildSegment(
        audio.ctx,
        audio.bus,
        activeProgressionStepIndex,
        startAt,
        inputs,
        now + SCHEDULE_LEAD_SECONDS,
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
      lastActiveStartTimeRef.current = activeSeg.startTime;
    } else {
      clearTimeline();
      lastActiveStartTimeRef.current = null;
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
      const tail = segmentsRef.current.find((s) => s.stepIndex === activeProgressionStepIndex);
      const startAt = tail ? tail.endTime : now + SCHEDULE_LEAD_SECONDS;
      const seg = buildSegment(audio.ctx, audio.bus, nextIdx, startAt, inputs);
      if (seg) segmentsRef.current.push(seg);
    }

    lastStepRef.current = activeProgressionStepIndex;
    lastEnableRef.current = inputs.enable;
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
