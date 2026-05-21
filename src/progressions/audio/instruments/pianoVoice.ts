/**
 * Piano chord voice for the progression backing track. A Tone.PolySynth of
 * Tone.Synth voices with a triangle oscillator + harmonic partials gives a
 * percussive plucked-piano character. The amplitude envelope decays quickly
 * (sustain 0.1) so default playback is staccato; `style: "sustained"` simply
 * holds the gate open longer (1.2s vs 0.4s) before triggering release.
 *
 * Replaces the prior raw-Web-Audio FM synthesis with a Tone-native voice so
 * silenceProgressionBus()/Transport scheduling stay coherent with the rest of
 * the backing track (bass, metronome, strum).
 */
import * as Tone from "tone";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

// Release tail is 1.2s; defer dispose past that so the natural decay isn't
// truncated when a chord change cancels a still-ringing voice.
const DISPOSE_TAIL_MS = 1300;
const STACCATO_DURATION = 0.4;
const SUSTAINED_DURATION = 1.2;

export const pianoVoice: ChordVoice = {
  scheduleChord(
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle {
    const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.7));
    // Skip silent or empty chords entirely. Constructing a PolySynth for an
    // inaudible hit would allocate voices we'd have to clean up for no gain.
    if (velocity <= 0 || notes.length === 0) {
      return { cancel: () => {} };
    }

    const synth = new Tone.PolySynth(Tone.Synth, {
      // Triangle-flavoured partials. Tone requires `type: "custom"` whenever
      // a partials array is supplied; the descending amplitudes here give a
      // bright, slightly-percussive piano-ish timbre on top of the
      // amplitude-envelope decay.
      oscillator: {
        type: "custom",
        partials: [1, 0.5, 0.25, 0.12],
      },
      envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 1.2 },
      volume: -6,
    });
    // Allow at least the full voicing simultaneously. Default polyphony (32)
    // is plenty, but we clamp the floor to the voicing width in case Tone
    // ever lowers the default.
    synth.maxPolyphony = Math.max(notes.length, 6);
    synth.connect(dest);

    const duration =
      options.style === "sustained" ? SUSTAINED_DURATION : STACCATO_DURATION;
    synth.triggerAttackRelease(notes as string[], duration, time, velocity);

    let cancelled = false;
    return {
      cancel: () => {
        if (cancelled) return;
        cancelled = true;
        // releaseAll triggers the envelope's release on every currently-
        // playing voice. We defer dispose so the 1.2s release tail isn't
        // chopped off mid-decay (which would produce an audible click).
        try {
          synth.releaseAll(Tone.now());
          setTimeout(() => {
            try {
              synth.dispose();
            } catch {
              /* already disposed */
            }
          }, DISPOSE_TAIL_MS);
        } catch {
          try {
            synth.dispose();
          } catch {
            /* already disposed */
          }
        }
      },
    };
  },
};
