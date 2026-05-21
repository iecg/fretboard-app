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

const ACCENT_FREQ = 1500;
const NORMAL_FREQ = 900;
const DECAY = 0.04;

export interface ClickOptions {
  accent?: boolean;
  velocity?: number;
}

export interface ClickHandle {
  cancel: () => void;
}

export function scheduleClick(
  dest: AudioNode,
  time: number,
  options: ClickOptions = {},
): ClickHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.6));
  if (velocity <= 0) return { cancel: () => {} };

  const frequency = options.accent ? ACCENT_FREQ : NORMAL_FREQ;
  const synth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: DECAY, sustain: 0, release: 0.01 },
  });
  // Route through the existing progression bus so silenceProgressionBus()
  // mutes the metronome along with the rest of the backing track.
  synth.connect(dest);
  synth.triggerAttackRelease(frequency, DECAY, time, velocity);

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
      try {
        // Close the envelope explicitly so the tail isn't truncated mid-decay.
        synth.triggerRelease(Tone.now());
        // Give the release ~10 ms to settle, then free the resources.
        setTimeout(() => {
          try {
            synth.dispose();
          } catch {
            /* already disposed */
          }
        }, 20);
      } catch {
        // If triggerRelease throws (already disposed?) fall through to dispose.
        try {
          synth.dispose();
        } catch {
          /* already disposed */
        }
      }
    },
  };
}

export const _metronomeInternals = { ACCENT_FREQ, NORMAL_FREQ, DECAY };
