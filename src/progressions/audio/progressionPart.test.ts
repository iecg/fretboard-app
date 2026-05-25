// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toneMocks = vi.hoisted(() => {
  type Cb = (time: number, value: unknown) => void;
  interface PartInstance {
    callback: Cb;
    events: Array<[number, unknown]>;
    loop: boolean;
    loopEnd: number;
    startedTime: number | null;
    startedOffset: number | null;
    disposed: boolean;
    start(time?: number, offset?: number): PartInstance;
    stop(): PartInstance;
    dispose(): PartInstance;
  }
  const parts: PartInstance[] = [];

  function PartCtor(callback: Cb, events: Array<[number, unknown]>): PartInstance {
    const inst: PartInstance = {
      callback,
      events: [...events],
      loop: false,
      loopEnd: 0,
      startedTime: null,
      startedOffset: null,
      disposed: false,
      start(time?: number, offset?: number) {
        this.startedTime = time ?? 0;
        this.startedOffset = offset ?? 0;
        return this;
      },
      stop() { return this; },
      dispose() { this.disposed = true; return this; },
    };
    parts.push(inst);
    return inst;
  }
  return { Part: PartCtor as unknown as new (...args: unknown[]) => unknown, parts };
});
vi.mock("tone", () => ({ Part: toneMocks.Part }));

import { createProgressionPart } from "./progressionPart";

describe("createProgressionPart", () => {
  beforeEach(() => { toneMocks.parts.length = 0; });
  afterEach(() => { vi.restoreAllMocks(); });

  it("constructs Tone.Part with one event per supplied {time, value}", () => {
    createProgressionPart<{ id: string }>({
      events: [{ time: 0, value: { id: "a" } }, { time: 1.5, value: { id: "b" } }],
      loop: true,
      loopEnd: 3,
      onEvent: () => {},
    });
    expect(toneMocks.parts).toHaveLength(1);
    expect(toneMocks.parts[0].events).toEqual([[0, { id: "a" }], [1.5, { id: "b" }]]);
    expect(toneMocks.parts[0].loop).toBe(true);
    expect(toneMocks.parts[0].loopEnd).toBe(3);
  });

  it("does not set loopEnd when loop is false", () => {
    createProgressionPart({
      events: [{ time: 0, value: 1 }],
      loop: false,
      loopEnd: 99, // ignored
      onEvent: () => {},
    });
    expect(toneMocks.parts[0].loop).toBe(false);
  });

  it("invokes onEvent with audio time + the original value when Tone fires", () => {
    const onEvent = vi.fn();
    createProgressionPart<{ id: string }>({
      events: [{ time: 0, value: { id: "x" } }],
      loop: false,
      loopEnd: 1,
      onEvent,
    });
    toneMocks.parts[0].callback(0.42, { id: "x" });
    expect(onEvent).toHaveBeenCalledWith(0.42, { id: "x" });
  });

  it("start(time, offset) forwards both args; dispose() is idempotent", () => {
    const h = createProgressionPart({
      events: [{ time: 0, value: 1 }],
      loop: false,
      loopEnd: 1,
      onEvent: () => {},
    });
    h.start(2.5, 0.4);
    expect(toneMocks.parts[0].startedTime).toBe(2.5);
    expect(toneMocks.parts[0].startedOffset).toBe(0.4);
    h.dispose();
    h.dispose();
    expect(toneMocks.parts[0].disposed).toBe(true);
  });

  it("setLoop(true, end) live-flips part.loop + part.loopEnd without rebuilding", () => {
    const h = createProgressionPart({
      events: [{ time: 0, value: 1 }],
      loop: false,
      loopEnd: 0,
      onEvent: () => {},
    });
    h.setLoop(true, 8);
    expect(toneMocks.parts[0].loop).toBe(true);
    expect(toneMocks.parts[0].loopEnd).toBe(8);
    h.setLoop(false);
    expect(toneMocks.parts[0].loop).toBe(false);
    // loopEnd unchanged when not supplied:
    expect(toneMocks.parts[0].loopEnd).toBe(8);
  });
});
