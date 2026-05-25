import { Loop } from "tone";

export interface MetronomeLoopHandle {
  start: (time?: number) => void;
  dispose: () => void;
}

export interface CreateMetronomeLoopOptions {
  beatsPerBar: number;
  /** Called once per beat at audio-precise time. `beatInBar` is 1-based and
   *  cycles 1..beatsPerBar so callers can light an accent on beat 1. */
  onBeat: (audioTime: number, beatInBar: number) => void;
}

/**
 * Thin wrapper over `Tone.Loop` for the metronome — a perfectly periodic
 * once-per-beat callback. Beat numbering is owned by the wrapper so the
 * caller's onBeat closure stays free of cycle counters.
 * The beat counter resets to 1 on construction; dispose and rebuild the
 * Loop to resync the downbeat at a new start position.
 */
export function createMetronomeLoop(
  opts: CreateMetronomeLoopOptions,
): MetronomeLoopHandle {
  const beatsPerBar = Math.max(1, opts.beatsPerBar);
  let nextBeat = 1;
  const loop = new Loop((time: number) => {
    const beat = nextBeat;
    nextBeat = beat % beatsPerBar + 1;
    opts.onBeat(time, beat);
  }, "4n") as unknown as {
    start: (time?: number) => void;
    dispose: () => void;
  };

  let disposed = false;
  return {
    start(time?: number) { loop.start(time); },
    dispose() {
      if (disposed) return;
      disposed = true;
      loop.dispose();
    },
  };
}
