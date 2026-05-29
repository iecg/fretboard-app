// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

const setContextSpy = vi.hoisted(() => vi.fn());
const getContextSpy = vi.hoisted(() => vi.fn());
const drawInstance = vi.hoisted(() => ({ expiration: 0.25 }));
const getDrawSpy = vi.hoisted(() => vi.fn(() => drawInstance));

vi.mock("tone", () => ({
  setContext: setContextSpy,
  getContext: getContextSpy,
  getDraw: getDrawSpy,
}));

// Stub the Tone-heavy materializer; keep planSignalGraph real.
const disposeSpies: Array<ReturnType<typeof vi.fn>> = [];
vi.mock("./sound/buildSignalGraph", async (orig) => {
  const actual = await orig<typeof import("./sound/buildSignalGraph")>();
  return {
    ...actual,
    materializeSignalGraph: vi.fn(() => {
      const dispose = vi.fn();
      disposeSpies.push(dispose);
      const node = () => ({ connect: vi.fn(), disconnect: vi.fn() }) as unknown as AudioNode;
      return {
        inputs: { chord: node(), bass: node(), drums: node(), metronome: node() },
        dispose,
      };
    }),
  };
});

import {
  _resetProgressionAudioForTests,
  ensureProgressionAudio,
  configureProgressionGraph,
} from "./bus";
import { _resetToneBusForTests } from "./toneBus";
import { planSignalGraph } from "./sound/buildSignalGraph";
import { TIER_PROFILES } from "./sound/qualityTiers";
import { getGenreMix } from "./sound/genreMixPresets";

describe("configureProgressionGraph", () => {
  beforeEach(() => {
    _resetProgressionAudioForTests();
    _resetToneBusForTests();
    setContextSpy.mockReset();
    getContextSpy.mockReset();
    getDrawSpy.mockReset().mockReturnValue(drawInstance);
    drawInstance.expiration = 0.25;
    disposeSpies.length = 0;
    (window as unknown as { AudioContext: unknown }).AudioContext = vi.fn(function () {
      return {
        createGain: () => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }),
        destination: {},
        currentTime: 0,
        state: "running",
      };
    }) as unknown as typeof AudioContext;
  });

  it("materializes a graph and disposes the prior graph on rebuild", () => {
    expect(ensureProgressionAudio()).not.toBeNull();
    const g1 = configureProgressionGraph(planSignalGraph(TIER_PROFILES.standard, getGenreMix("jazz")!));
    expect(g1).not.toBeNull();
    const g2 = configureProgressionGraph(planSignalGraph(TIER_PROFILES.eco, getGenreMix("funk")!));
    expect(g2).not.toBeNull();
    expect(disposeSpies[0]).toHaveBeenCalledTimes(1); // first graph disposed on rebuild
    expect(disposeSpies[1]).not.toHaveBeenCalled();
  });
});
