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
import { useProgressionState } from "./useProgressionState";

/** Lead time between scheduling and the audible hit. Keeps Web Audio from
 * dropping the first event when `currentTime` and "now" are equal. */
const SCHEDULE_LEAD_SECONDS = 0.02;

/** Octave used for the synthesized bass note. Two octaves below middle C
 * sits in the typical electric-bass register without thumping the mix. */
const BASS_OCTAVE = 2;

/**
 * Drive the progression backing track. Each time the active step changes,
 * schedules a full bar of strum/bass/drum/metronome events onto the
 * `AudioContext` clock so the groove stays locked even when React renders
 * drift. On pause/mute the progression bus is silenced in ~20ms; on resume
 * it's restored before the next step's events fire.
 */
export function useProgressionAudioPlayback() {
  const {
    progressionEnabled,
    progressionPlaying,
    progressionPlaybackBlockedReason,
    activeProgressionStepIndex,
    activeResolvedProgressionStep,
    progressionTempoBpm,
    beatsPerBar,
    progressionStrumEnabled,
    progressionBassEnabled,
    progressionDrumsEnabled,
    progressionMetronomeEnabled,
  } = useProgressionState();
  const isMuted = useAtomValue(isMutedAtom);

  // Step we last scheduled, so unrelated atom updates that re-run this effect
  // don't double-schedule the same chord.
  const lastScheduledStepRef = useRef<number | null>(null);
  // Live voice handles for the currently-ringing step; cancelled on chord
  // change or pause so plucked-string tails don't bleed into the next step.
  const liveStepRef = useRef<ScheduledStepHandle | null>(null);

  // Cancel + silence helper. Idempotent — safe to call on every state branch.
  const stopAll = () => {
    liveStepRef.current?.cancelAll();
    liveStepRef.current = null;
    silenceProgressionBus();
    lastScheduledStepRef.current = null;
  };

  useEffect(() => {
    if (
      !progressionEnabled
      || !progressionPlaying
      || progressionPlaybackBlockedReason
      || isMuted
    ) {
      stopAll();
      return;
    }

    // Same step already scheduled — skip (atom-fan-out re-renders shouldn't
    // restart the bar).
    if (lastScheduledStepRef.current === activeProgressionStepIndex) return;

    const audio = ensureProgressionAudio();
    if (!audio) return;
    void resumeProgressionAudio();

    // Bring the bus back to full level in case a previous pause silenced it.
    restoreProgressionBus();

    const step = activeResolvedProgressionStep;
    if (!step || step.unavailable || !step.root || !step.quality) return;

    const voicing = resolveChordVoicing(step.root, step.quality);
    const bassNote = step.root ? `${step.root}${BASS_OCTAVE}` : null;
    const secondsPerBeat = 60 / Math.max(1, progressionTempoBpm);
    const beatsAvailable =
      step.duration.unit === "bar"
        ? step.duration.value * beatsPerBar
        : step.duration.value;

    // Cancel the previous step's live voices before scheduling the next.
    liveStepRef.current?.cancelAll();

    liveStepRef.current = scheduleProgressionStep(audio.ctx, audio.bus, {
      voicing,
      bassNote,
      beatsAvailable,
      beatsPerBar,
      secondsPerBeat,
      startTime: audio.ctx.currentTime + SCHEDULE_LEAD_SECONDS,
      enable: {
        strum: progressionStrumEnabled,
        bass: progressionBassEnabled,
        drums: progressionDrumsEnabled,
        metronome: progressionMetronomeEnabled,
      },
    });
    lastScheduledStepRef.current = activeProgressionStepIndex;

    return () => {
      liveStepRef.current?.cancelAll();
      liveStepRef.current = null;
    };
  }, [
    progressionEnabled,
    progressionPlaying,
    progressionPlaybackBlockedReason,
    activeProgressionStepIndex,
    activeResolvedProgressionStep,
    isMuted,
    progressionTempoBpm,
    beatsPerBar,
    progressionStrumEnabled,
    progressionBassEnabled,
    progressionDrumsEnabled,
    progressionMetronomeEnabled,
  ]);
}
