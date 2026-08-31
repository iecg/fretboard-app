import { Part } from "tone";

export interface ProgressionPartHandle {
  /** Start at transport `time` (default "now") with internal cursor at
   *  `offset` seconds (default 0). Forwards verbatim to Tone.Part.start. */
  start: (time?: number, offset?: number) => void;
  /** Live-toggle loop without disposing. Optionally updates loopEnd at the
   *  same time. Used by the orchestrator's loop-toggle effect.
   *  Omitting `loopEnd` leaves the prior value intact. */
  setLoop: (loop: boolean, loopEnd?: number) => void;
  /** Stop and dispose. Idempotent. */
  dispose: () => void;
}

export interface CreateProgressionPartOptions<V> {
  events: ReadonlyArray<{ time: number; value: V }>;
  loop: boolean;
  loopEnd: number;
  onEvent: (audioTime: number, value: V) => void;
}

/**
 * Thin wrapper over `Tone.Part`. The Part fires `onEvent(audioTime, value)`
 * for each scheduled event at the audio-precise time (Tone delivers the
 * callback ~lookAhead seconds before this wall-clock-wise so consumers can
 * pre-schedule sample-accurate audio).
 */
export function createProgressionPart<V>(
  opts: CreateProgressionPartOptions<V>,
): ProgressionPartHandle {
  const tuples: Array<[number, V]> = opts.events.map((e) => [e.time, e.value]);
  const part = new Part((time: number, value: V) => {
    // Tone iterates every event scheduled at a tick in one pass, so a throw
    // here would abort the rest of that pass and silently drop the layers
    // behind this one — a drum-scheduling failure taking the chord onsets (and
    // the visual timeline they drive) down with it. Contain it to its own
    // layer; mirrors the subscriber guard in `visualClock`.
    try {
      opts.onEvent(time, value);
    } catch (err) {
      console.error("Error in progression part event:", err);
    }
  }, tuples) as unknown as {
    start: (time?: number, offset?: number) => void;
    stop: () => void;
    dispose: () => void;
    loop: boolean;
    loopEnd: number;
  };
  part.loop = opts.loop;
  if (opts.loop) part.loopEnd = opts.loopEnd;

  let disposed = false;
  return {
    start(time?: number, offset?: number) { part.start(time, offset); },
    setLoop(loop: boolean, loopEnd?: number) {
      part.loop = loop;
      if (loopEnd !== undefined) part.loopEnd = loopEnd;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      part.stop();
      part.dispose();
    },
  };
}
