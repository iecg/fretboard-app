import * as Tone from "tone";
import { createReusableVoicePool } from "./createReusableVoicePool";

const PARTIALS = [1, 0.8, 0.45, 0.22, 0.12, 0.05];
const ATTACK = 0.01;
const DECAY = 1.1;
const SUSTAIN = 0.05;
const RELEASE = 0.4;
const NOTE_DURATION = 1.8;
const RELEASE_TAIL_SEC = NOTE_DURATION + RELEASE + 0.15;

export interface PluckedVoiceHandle {
  cancel: () => void;
}

export interface PluckStringOptions {
  velocity?: number;
}

const pluckPool = createReusableVoicePool({
  createVoice: () =>
    new Tone.Synth({
      oscillator: {
        type: "custom",
        partials: PARTIALS,
      },
      envelope: {
        attack: ATTACK,
        decay: DECAY,
        sustain: SUSTAIN,
        release: RELEASE,
      },
    }),
});

export function pluckString(
  dest: AudioNode,
  frequency: number,
  startTime: number,
  options: PluckStringOptions = {},
): PluckedVoiceHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 1));
  if (velocity <= 0) return { cancel: () => {} };

  const now = Tone.now();
  const playbackStartTime = Math.max(now, startTime);
  const lease = pluckPool.lease(dest, now);
  lease.setBusyUntil(playbackStartTime + RELEASE_TAIL_SEC);

  lease.voice.triggerAttackRelease(
    frequency,
    NOTE_DURATION,
    startTime,
    velocity,
  );

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
    },
  };
}
