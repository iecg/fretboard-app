/**
 * Organ chord voice for the progression backing track. A Tone.PolySynth of
 * Tone.Synth voices with a sine oscillator + drawbar-style partials gives
 * the held, breathy character of a tonewheel organ. The envelope sustains
 * high (0.9) so the chord holds at full level until release — by default
 * notes ring for 1.5s; `style: "staccato"` cuts that to 0.2s for short hits.
 *
 * Replaces the prior raw-Web-Audio drawbar additive synthesis with a Tone-
 * native voice so silenceProgressionBus()/Transport scheduling stay coherent
 * with the rest of the backing track (bass, metronome, strum, piano).
 */
import * as Tone from "tone";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

// Release tail is 0.6s; defer dispose past that so the natural decay isn't
// truncated when a chord change cancels a still-ringing voice.
const DISPOSE_TAIL_MS = 700;
const STACCATO_DURATION = 0.2;
const SUSTAINED_DURATION = 1.5;

export const organVoice: ChordVoice = {
  scheduleChord(
    _ctx: AudioContext,
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
      // Sine-flavoured drawbar partials. Tone requires `type: "custom"`
      // whenever a partials array is supplied; the gently-decaying amplitudes
      // here approximate a Hammond drawbar registration of the lower harmonics.
      oscillator: {
        type: "custom",
        partials: [1, 0.6, 0.4, 0.3, 0.2],
      },
      envelope: { attack: 0.02, decay: 0.05, sustain: 0.9, release: 0.6 },
      volume: -10,
    });
    // Allow at least the full voicing simultaneously. Default polyphony (32)
    // is plenty, but we clamp the floor to the voicing width in case Tone
    // ever lowers the default.
    synth.maxPolyphony = Math.max(notes.length, 6);
    synth.connect(dest);

    // Organs default to sustained — the short style only fires when the
    // caller explicitly opts in with `style: "staccato"`.
    const duration =
      options.style === "staccato" ? STACCATO_DURATION : SUSTAINED_DURATION;
    synth.triggerAttackRelease(notes as string[], duration, time, velocity);

    let cancelled = false;
    return {
      cancel: () => {
        if (cancelled) return;
        cancelled = true;
        // releaseAll triggers the envelope's release on every currently-
        // playing voice. We defer dispose so the 0.6s release tail isn't
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
