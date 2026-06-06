import * as Tone from "tone";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";
import type { PolyChordSpec } from "../sound/patchTypes";

interface PooledSynthEntry {
  synth: Tone.PolySynth<Tone.Synth>;
  busyUntil: number;
  leaseGeneration: number;
}

const DEFAULT_SHARED_MAX_POLYPHONY = 32;

export function createReusableChordVoice(spec: PolyChordSpec): ChordVoice {
  const synthPool = new WeakMap<AudioNode, PooledSynthEntry[]>();
  const durationFor = (o: ChordVoiceOptions) =>
    o.durationSec ?? (o.style === "sustained" ? spec.sustainedDurationSec : spec.shortDurationSec);

  const removeEntry = (dest: AudioNode, entry: PooledSynthEntry) => {
    const entries = synthPool.get(dest);
    if (!entries) return;
    const next = entries.filter((c) => c !== entry);
    if (next.length === 0) synthPool.delete(dest); else synthPool.set(dest, next);
  };

  const createEntry = (dest: AudioNode, notes: readonly string[]): PooledSynthEntry => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: spec.oscillator,
      envelope: spec.envelope,
      volume: spec.volume,
    });
    synth.maxPolyphony = Math.max(notes.length, spec.maxPolyphonyFloor, DEFAULT_SHARED_MAX_POLYPHONY);
    synth.connect(dest);
    return { synth, busyUntil: 0, leaseGeneration: 0 };
  };

  const acquireEntry = (dest: AudioNode, notes: readonly string[], now: number): PooledSynthEntry => {
    const entries = synthPool.get(dest) ?? [];
    const reusable = entries.find((e) => e.busyUntil <= now);
    if (reusable) {
      reusable.synth.maxPolyphony = Math.max(notes.length, spec.maxPolyphonyFloor, DEFAULT_SHARED_MAX_POLYPHONY);
      return reusable;
    }
    const created = createEntry(dest, notes);
    synthPool.set(dest, [...entries, created]);
    return created;
  };

  return {
    scheduleChord(dest, notes, time, options): VoiceHandle {
      const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.7));
      if (velocity <= 0 || notes.length === 0) return { cancel: () => {} };
      const now = Tone.now();
      const scheduledNotes = [...notes];
      const durationSec = durationFor(options);
      const playbackStartTime = Math.max(now, time);
      const entry = acquireEntry(dest, scheduledNotes, now);
      const leaseGeneration = entry.leaseGeneration + 1;
      entry.leaseGeneration = leaseGeneration;
      entry.busyUntil = playbackStartTime + durationSec + spec.releaseTailSec;
      entry.synth.triggerAttackRelease(scheduledNotes, durationSec, time, velocity);
      let cancelled = false;
      return {
        cancel: () => {
          if (cancelled) return;
          cancelled = true;
          if (entry.leaseGeneration !== leaseGeneration) return;
          const cancelTime = Tone.now();
          if (cancelTime < time) { removeEntry(dest, entry); entry.busyUntil = 0; entry.synth.dispose(); return; }
          if (cancelTime >= entry.busyUntil) return;
          entry.busyUntil = cancelTime + spec.releaseTailSec;
          entry.synth.releaseAll(cancelTime);
        },
      };
    },
  };
}
