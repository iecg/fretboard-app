/**
 * Metronome click. A short sine ping triggered via Tone.Synth on the shared
 * progression context (see `toneBus.ts`). 1500 Hz on accent (beat 1),
 * 900 Hz on the others. 40 ms decay.
 *
 * Tone's `triggerAttackRelease(freq, duration, time, velocity)` schedules a
 * single note at `time` in audio-context seconds — the same clock space the
 * existing scheduler uses. `dest` is the progression bus; we route the
 * synth's output to it so pausing the bus also cuts the click.
 */
import * as Tone from "tone";
import { createReusableVoicePool } from "./createReusableVoicePool";

const ACCENT_FREQ = 1500;
const NORMAL_FREQ = 900;
const DECAY = 0.04;
const RELEASE = 0.01;
const RELEASE_TAIL_SEC = RELEASE;
const DISPOSE_TAIL_MS = 20;
const DISPOSE_TAIL_SEC = DISPOSE_TAIL_MS / 1000;

export interface ClickOptions {
  accent?: boolean;
  velocity?: number;
}

export interface ClickHandle {
  cancel: () => void;
}

const clickVoicePool = createReusableVoicePool({
  createVoice: () =>
    new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: DECAY, sustain: 0, release: RELEASE },
    }),
});

export function scheduleClick(
  dest: AudioNode,
  time: number,
  options: ClickOptions = {},
): ClickHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.6));
  if (velocity <= 0) return { cancel: () => {} };

  const frequency = options.accent ? ACCENT_FREQ : NORMAL_FREQ;
  const now = Tone.now();
  const playbackStartTime = Math.max(now, time);
  const lease = clickVoicePool.lease(dest, now);
  let busyUntil = playbackStartTime + DECAY + RELEASE_TAIL_SEC;
  lease.setBusyUntil(busyUntil);
  // Route through the existing progression bus so silenceProgressionBus()
  // mutes the metronome along with the rest of the backing track.
  lease.voice.triggerAttackRelease(frequency, DECAY, time, velocity);

  // Tone's voice manager will release the synth on its own, but the
  // scheduler's `cancelAll()` contract requires immediate teardown for
  // pause/stop. Dispose explicitly — but defer it slightly so the release
  // envelope can settle. `synth.dispose()` truncates the envelope; if the
  // cancel fires while the voice is mid-decay (a normal pause-mid-bar
  // scenario), cutting the tail can produce an audible click. We trigger
  // the release explicitly and let it run for ~10 ms (envelope.release)
  // before freeing resources. The 20 ms guard covers the release window
  // plus a small safety margin.
  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      if (!lease.isCurrent()) return;

      const cancelTime = Tone.now();
      if (cancelTime < time) {
        lease.dispose();
        return;
      }

      if (cancelTime >= busyUntil) {
        return;
      }

      busyUntil = cancelTime + DISPOSE_TAIL_SEC;
      lease.setBusyUntil(busyUntil);
      try {
        // Close the envelope explicitly so the tail isn't truncated mid-decay.
        lease.voice.triggerRelease(cancelTime);
        // Give the release ~10 ms to settle, then free the resources.
        setTimeout(() => {
          try {
            lease.dispose();
          } catch {
            /* already disposed */
          }
        }, DISPOSE_TAIL_MS);
      } catch {
        // If triggerRelease throws (already disposed?) fall through to dispose.
        try {
          lease.dispose();
        } catch {
          /* already disposed */
        }
      }
    },
  };
}

export const _metronomeInternals = { ACCENT_FREQ, NORMAL_FREQ, DECAY };
