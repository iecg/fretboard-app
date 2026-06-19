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
const RELEASE = 0.01;

export interface ClickOptions {
  accent?: boolean;
  velocity?: number;
}

export interface ClickHandle {
  cancel: () => void;
}

let metronomeSynth: Tone.Synth | null = null;

function getSynth(): Tone.Synth {
  if (!metronomeSynth) {
    metronomeSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: DECAY, sustain: 0, release: RELEASE },
    });
  }
  return metronomeSynth;
}

export function scheduleClick(
  dest: AudioNode,
  time: number,
  options: ClickOptions = {},
): ClickHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.6));
  if (velocity <= 0) return { cancel: () => {} };

  const frequency = options.accent ? ACCENT_FREQ : NORMAL_FREQ;
  const synth = getSynth();
  synth.disconnect();
  synth.connect(dest);

  // Route through the existing progression bus so silenceProgressionBus()
  // mutes the metronome along with the rest of the backing track.
  synth.triggerAttackRelease(frequency, DECAY, time, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;

      const cancelTime = Tone.now();
      if (cancelTime < time) {
        // Cancel future notes scheduled
        synth.envelope.cancel(cancelTime);
        return;
      }

      try {
        // Close the envelope explicitly so the tail isn't truncated mid-decay.
        synth.triggerRelease(cancelTime);
      } catch {
        // If triggerRelease throws (e.g. context is closed/suspended), ignore.
      }
    },
  };
}

export const _metronomeInternals = { ACCENT_FREQ, NORMAL_FREQ, DECAY };
