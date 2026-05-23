import * as Tone from "tone";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

interface ReusableChordVoiceConfig {
  volume: number;
  maxPolyphonyFloor: number;
  oscillator: { type: "custom"; partials: number[] };
  envelope: { attack: number; decay: number; sustain: number; release: number };
  releaseTailSec: number;
  durationFor: (options: ChordVoiceOptions) => number;
}

interface PooledSynthEntry {
  synth: Tone.PolySynth<Tone.Synth>;
  busyUntil: number;
  leaseGeneration: number;
}

const DEFAULT_SHARED_MAX_POLYPHONY = 32;

export function createReusableChordVoice(
  config: ReusableChordVoiceConfig,
): ChordVoice {
  const synthPool = new WeakMap<AudioNode, PooledSynthEntry[]>();

  const removeEntry = (dest: AudioNode, entry: PooledSynthEntry) => {
    const entries = synthPool.get(dest);
    if (!entries) return;
    const nextEntries = entries.filter((candidate) => candidate !== entry);
    if (nextEntries.length === 0) {
      synthPool.delete(dest);
      return;
    }
    synthPool.set(dest, nextEntries);
  };

  const createEntry = (
    dest: AudioNode,
    notes: readonly string[],
  ): PooledSynthEntry => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: config.oscillator,
      envelope: config.envelope,
      volume: config.volume,
    });
    synth.maxPolyphony = Math.max(
      notes.length,
      config.maxPolyphonyFloor,
      DEFAULT_SHARED_MAX_POLYPHONY,
    );
    synth.connect(dest);
    return { synth, busyUntil: 0, leaseGeneration: 0 };
  };

  const acquireEntry = (
    dest: AudioNode,
    notes: readonly string[],
    playbackStartTime: number,
  ): PooledSynthEntry => {
    const entries = synthPool.get(dest) ?? [];
    const reusableEntry = entries.find(
      (entry) => entry.busyUntil <= playbackStartTime,
    );
    if (reusableEntry) {
      reusableEntry.synth.maxPolyphony = Math.max(
        notes.length,
        config.maxPolyphonyFloor,
        DEFAULT_SHARED_MAX_POLYPHONY,
      );
      return reusableEntry;
    }

    const createdEntry = createEntry(dest, notes);
    synthPool.set(dest, [...entries, createdEntry]);
    return createdEntry;
  };

  return {
    scheduleChord(dest, notes, time, options): VoiceHandle {
      const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.7));
      if (velocity <= 0 || notes.length === 0) return { cancel: () => {} };

      const now = Tone.now();
      const scheduledNotes = [...notes];
      const durationSec = config.durationFor(options);
      const playbackStartTime = Math.max(now, time);
      const entry = acquireEntry(dest, scheduledNotes, playbackStartTime);
      const leaseGeneration = entry.leaseGeneration + 1;
      entry.leaseGeneration = leaseGeneration;
      entry.busyUntil = playbackStartTime + durationSec + config.releaseTailSec;
      entry.synth.triggerAttackRelease(
        scheduledNotes,
        durationSec,
        time,
        velocity,
      );

      let cancelled = false;

      return {
        cancel: () => {
          if (cancelled) return;
          cancelled = true;
          if (entry.leaseGeneration !== leaseGeneration) {
            return;
          }

          const cancelTime = Tone.now();
          if (cancelTime < time) {
            removeEntry(dest, entry);
            entry.busyUntil = 0;
            entry.synth.dispose();
            return;
          }

          if (cancelTime >= entry.busyUntil) {
            return;
          }

          entry.busyUntil = cancelTime + config.releaseTailSec;
          entry.synth.releaseAll(cancelTime);
        },
      };
    },
  };
}
