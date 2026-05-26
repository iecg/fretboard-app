import * as Tone from "tone";
import { createReusableVoicePool } from "./createReusableVoicePool";

const PARTIALS = [1, 0.6, 0.4, 0.3, 0.2, 0.1, 0.06];
const ATTACK = 0.005;
const DECAY = 0.5;
const SUSTAIN = 0.2;
const RELEASE = 1.5;
const NOTE_DURATION = 1.5;
const RELEASE_TAIL_SEC = NOTE_DURATION + RELEASE + 0.1;

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

  lease.voice.triggerAttackRelease(frequency, NOTE_DURATION, startTime, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
    },
  };
}
