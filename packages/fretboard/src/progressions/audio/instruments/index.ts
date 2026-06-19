import * as Tone from "tone";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";
import { getChordPatch, DEFAULT_CHORD_PATCH_ID } from "../sound/instrumentPatches";

export type { ChordVoice } from "./types";

const synthsByPatchId = new Map<string, Tone.PolySynth<Tone.Synth>>();
const voiceCache = new Map<string, ChordVoice>();

export function getChordVoice(patchId: string): ChordVoice {
  const patch = getChordPatch(patchId) ?? getChordPatch(DEFAULT_CHORD_PATCH_ID)!;
  const cached = voiceCache.get(patch.id);
  if (cached) return cached;

  const spec = patch.poly;
  const durationFor = (o: ChordVoiceOptions) =>
    o.durationSec ?? (o.style === "sustained" ? spec.sustainedDurationSec : spec.shortDurationSec);

  const voice: ChordVoice = {
    scheduleChord(dest, notes, time, options): VoiceHandle {
      const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.7));
      if (velocity <= 0 || notes.length === 0) return { cancel: () => {} };

      let synth = synthsByPatchId.get(patch.id);
      if (!synth) {
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: spec.oscillator,
          envelope: spec.envelope,
          volume: spec.volume,
        });
        synth.maxPolyphony = spec.maxPolyphonyFloor || 32;
        synthsByPatchId.set(patch.id, synth);
      }

      synth.disconnect();
      synth.connect(dest);

      const durationSec = durationFor(options);
      synth.triggerAttackRelease(notes as string[], durationSec, time, velocity);

      return {
        cancel: () => {
          const cancelTime = Tone.now();
          if (cancelTime < time) {
            synth.dispose();
            synthsByPatchId.delete(patch.id);
            return;
          }
          try {
            synth.releaseAll(cancelTime);
          } catch {
            // Ignore
          }
        },
      };
    },
  };

  voiceCache.set(patch.id, voice);
  return voice;
}

/** Test-only reset so the module behaves predictably across vitest runs. */
export function _resetChordSynths(): void {
  synthsByPatchId.forEach((synth) => {
    try {
      synth.dispose();
    } catch {
      // Ignore
    }
  });
  synthsByPatchId.clear();
  voiceCache.clear();
}
