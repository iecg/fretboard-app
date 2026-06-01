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
import { getGenreMix, DEFAULT_GENRE_MIX } from "./sound/genreMixPresets";

const MIX_A = getGenreMix("jazz")!;
const MIX_B = getGenreMix("funk")!;

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

  it("does not rebuild the graph when the plan is unchanged", () => {
    expect(ensureProgressionAudio()).not.toBeNull();
    const plan = planSignalGraph(TIER_PROFILES.standard, DEFAULT_GENRE_MIX);
    const g1 = configureProgressionGraph(plan);
    const g2 = configureProgressionGraph(
      planSignalGraph(TIER_PROFILES.standard, DEFAULT_GENRE_MIX),
    ); // deeply-equal plan
    expect(g1).not.toBeNull();
    expect(g2).toBe(g1); // reused, not rebuilt
    expect(disposeSpies[0]).not.toHaveBeenCalled(); // no teardown of the live graph
  });

  it("rebuilds when the plan changes", () => {
    expect(ensureProgressionAudio()).not.toBeNull();
    const g1 = configureProgressionGraph(planSignalGraph(TIER_PROFILES.standard, MIX_A));
    const g2 = configureProgressionGraph(planSignalGraph(TIER_PROFILES.standard, MIX_B));
    expect(g1).not.toBeNull();
    expect(g2).not.toBe(g1);
    // A same-tier, mix-only plan change still rebuilds → the prior graph is disposed.
    expect(disposeSpies[0]).toHaveBeenCalledTimes(1);
    expect(disposeSpies[1]).not.toHaveBeenCalled();
  });

  it("invalidates the cache when the returned graph is disposed externally", () => {
    expect(ensureProgressionAudio()).not.toBeNull();
    const plan = planSignalGraph(TIER_PROFILES.standard, DEFAULT_GENRE_MIX);
    const g1 = configureProgressionGraph(plan);
    expect(g1).not.toBeNull();
    g1!.dispose(); // external teardown must clear currentGraph/lastPlanKey
    expect(disposeSpies[0]).toHaveBeenCalledTimes(1);
    // Same plan again: must NOT reuse the disposed graph — it rebuilds.
    const g2 = configureProgressionGraph(
      planSignalGraph(TIER_PROFILES.standard, DEFAULT_GENRE_MIX),
    );
    expect(g2).not.toBe(g1);
    // Wrapped dispose is idempotent — a second call is a no-op.
    g1!.dispose();
    expect(disposeSpies[0]).toHaveBeenCalledTimes(1);
  });
});
