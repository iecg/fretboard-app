// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetProgressionAudioForTests,
  ensureProgressionAudio,
  resumeProgressionAudio,
  configureProgressionGraph,
} from "./bus";

// Stub Tone so bus.ts can initialize without a real AudioContext.
vi.mock("tone", () => ({
  getDraw: () => ({ expiration: 0.25 }),
  setContext: vi.fn(),
  Channel: class { connect() { return this; } disconnect() {} dispose() {} },
  Compressor: class { connect() { return this; } disconnect() {} dispose() {} },
  Limiter: class { connect() { return this; } disconnect() {} dispose() {} },
  Gain: class { connect() { return this; } disconnect() {} dispose() {} },
  EQ3: class { connect() { return this; } disconnect() {} dispose() {} },
  Chebyshev: class { connect() { return this; } disconnect() {} dispose() {} },
  Distortion: class { connect() { return this; } disconnect() {} dispose() {} },
  Reverb: class { connect() { return this; } disconnect() {} dispose() {} generate() { return Promise.resolve(this); } },
  Freeverb: class { connect() { return this; } disconnect() {} dispose() {} },
  JCReverb: class { connect() { return this; } disconnect() {} dispose() {} },
  connect: () => {},
}));

describe("ensureProgressionAudio", () => {
  beforeEach(() => {
    _resetProgressionAudioForTests();
  });

  it("logs a dev-mode warning when init throws", () => {
    const origCtor = (window as unknown as { AudioContext: unknown }).AudioContext;
    // Force a throw inside the try: monkey-patch window.AudioContext to throw.
    // Must use a class (function constructor) so Vitest doesn't emit its own
    // "did not use 'function' or 'class'" warning on the spy call.
    class BrokenAudioContext {
      constructor() {
        throw new Error("induced failure for warn-test");
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext =
      BrokenAudioContext as unknown as typeof AudioContext;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const audio = ensureProgressionAudio();

    expect(audio).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[progression-audio]"),
      expect.any(Error),
    );

    warnSpy.mockRestore();
    (window as unknown as { AudioContext: unknown }).AudioContext = origCtor;
    _resetProgressionAudioForTests();
  });
});

describe("resumeProgressionAudio – suspension recovery", () => {
  let stateChangeHandler: (() => void) | null;
  let mockCtx: Record<string, unknown>;

  function makeMockCtx() {
    return {
      currentTime: 0,
      sampleRate: 44100,
      state: "running" as AudioContextState,
      createGain: () => ({
        gain: { value: 0.55 },
        connect: vi.fn().mockReturnThis(),
        disconnect: vi.fn(),
      }),
      destination: {},
      resume: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        stateChangeHandler = handler;
      }),
    };
  }

  beforeEach(() => {
    _resetProgressionAudioForTests();
    stateChangeHandler = null;
    mockCtx = makeMockCtx();
    (window as unknown as { AudioContext: unknown }).AudioContext =
      vi.fn(function () {
        // Return the latest mockCtx — tests that need a fresh instance
        // reassign mockCtx before the next ensureProgressionAudio() call.
        return mockCtx;
      }) as unknown as typeof AudioContext;
  });

  afterEach(() => {
    _resetProgressionAudioForTests();
  });

  it("invalidates the signal-graph cache after a suspend/resume cycle", async () => {
    const audio = ensureProgressionAudio();
    expect(audio).not.toBeNull();

    // Build a graph (populates the cache).
    const { planSignalGraph } = await import("./sound/buildSignalGraph");
    const { TIER_PROFILES } = await import("./sound/qualityTiers");
    const { DEFAULT_GENRE_MIX } = await import("./sound/genreMixPresets");
    const plan = planSignalGraph(TIER_PROFILES.eco, DEFAULT_GENRE_MIX);

    const g1 = configureProgressionGraph(plan);
    expect(g1).not.toBeNull();

    // Same plan → cache hit (same object returned).
    const g2 = configureProgressionGraph(plan);
    expect(g2).toBe(g1);

    // Simulate Safari suspending the context.
    mockCtx.state = "suspended";
    stateChangeHandler?.();

    // Resume.
    mockCtx.state = "running";
    await resumeProgressionAudio();

    // Same plan → cache MISS (graph was invalidated by the recovery path).
    const g3 = configureProgressionGraph(plan);
    expect(g3).not.toBe(g1);
    expect(g3).not.toBeNull();
  });

  it("replaces the AudioContext after long idle (zombie detection)", () => {
    const audio1 = ensureProgressionAudio();
    expect(audio1).not.toBeNull();
    const ctx1 = audio1!.ctx;

    let fakeNow = performance.now();
    vi.spyOn(performance, "now").mockImplementation(() => fakeNow);

    // Touch lastAudioActivityMs.
    ensureProgressionAudio();

    // Advance 61 seconds past the idle threshold.
    fakeNow += 61_000;

    // Swap in a fresh mock so the rebuilt context is a new object.
    mockCtx = makeMockCtx();

    const audio2 = ensureProgressionAudio();
    expect(audio2).not.toBeNull();
    expect(audio2!.ctx).not.toBe(ctx1);

    vi.mocked(performance.now).mockRestore();
  });


  it("reconnects bus → ctx.destination after suspension", async () => {
    const audio = ensureProgressionAudio();
    expect(audio).not.toBeNull();
    const busConnectSpy = vi.fn();
    const busDisconnectSpy = vi.fn();
    // Replace the bus's connect/disconnect with spies.
    const busRef = audio!.bus;
    busRef.connect = busConnectSpy as unknown as typeof busRef.connect;
    busRef.disconnect = busDisconnectSpy;

    // Simulate suspend → resume.
    mockCtx.state = "suspended";
    stateChangeHandler?.();
    mockCtx.state = "running";
    await resumeProgressionAudio();

    expect(busDisconnectSpy).toHaveBeenCalled();
    expect(busConnectSpy).toHaveBeenCalledWith(audio!.ctx.destination);
  });
});
