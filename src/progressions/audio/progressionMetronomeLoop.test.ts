// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toneMocks = vi.hoisted(() => {
  type Cb = (time: number) => void;
  interface LoopInstance {
    callback: Cb;
    interval: string | number;
    startedTime: number | null;
    disposed: boolean;
    start(time?: number): LoopInstance;
    dispose(): LoopInstance;
  }
  const loops: LoopInstance[] = [];
  function LoopCtor(callback: Cb, interval: string | number): LoopInstance {
    const inst: LoopInstance = {
      callback, interval, startedTime: null, disposed: false,
      start(time?: number) { this.startedTime = time ?? 0; return this; },
      dispose() { this.disposed = true; return this; },
    };
    loops.push(inst);
    return inst;
  }
  return { Loop: LoopCtor as unknown as new (...args: unknown[]) => unknown, loops };
});
vi.mock("tone", () => ({ Loop: toneMocks.Loop }));

import { createMetronomeLoop } from "./progressionMetronomeLoop";

describe("createMetronomeLoop", () => {
  beforeEach(() => { toneMocks.loops.length = 0; });
  afterEach(() => { vi.restoreAllMocks(); });

  it("constructs a Tone.Loop at quarter-note interval", () => {
    createMetronomeLoop({ beatsPerBar: 4, onBeat: () => {} });
    expect(toneMocks.loops).toHaveLength(1);
    expect(toneMocks.loops[0].interval).toBe("4n");
  });

  it("fires onBeat with audio time + the correct 1-based beat number (cycling 1..beatsPerBar)", () => {
    const onBeat = vi.fn();
    createMetronomeLoop({ beatsPerBar: 3, onBeat });
    const loop = toneMocks.loops[0];
    loop.callback(0.0); loop.callback(0.5); loop.callback(1.0); loop.callback(1.5);
    expect(onBeat.mock.calls).toEqual([[0.0, 1], [0.5, 2], [1.0, 3], [1.5, 1]]);
  });

  it("start + dispose forward through to Tone.Loop", () => {
    const h = createMetronomeLoop({ beatsPerBar: 4, onBeat: () => {} });
    h.start(2);
    expect(toneMocks.loops[0].startedTime).toBe(2);
    h.dispose();
    expect(toneMocks.loops[0].disposed).toBe(true);
  });
});
