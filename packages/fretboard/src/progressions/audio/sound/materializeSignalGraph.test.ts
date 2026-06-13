import { describe, it, expect, vi, beforeEach } from "vitest";

// Reproduces the browser's Web Audio behavior: a NATIVE AudioNode.connect()
// throws "Overload resolution failed" when handed a Tone.js node (a
// ToneAudioNode is not a native AudioNode). Tone nodes are tagged `__tone`.
// Tone's top-level `connect()` helper is the correct native↔Tone bridge and is
// mocked here as a recording no-op.
const connectSpy = vi.fn();
const nativeGains: Array<{ connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];

vi.mock("tone", () => {
  class ToneNode {
    __tone = true;
    input = this;
    connect() {
      return this;
    }
    disconnect() {
      return this;
    }
    dispose() {}
  }
  class FakeReverb extends ToneNode {
    generate() {
      return Promise.resolve(this);
    }
  }
  return {
    Channel: ToneNode,
    Compressor: ToneNode,
    Limiter: ToneNode,
    Gain: ToneNode,
    EQ3: ToneNode,
    Chebyshev: ToneNode,
    Distortion: ToneNode,
    Freeverb: ToneNode,
    JCReverb: ToneNode,
    Reverb: FakeReverb,
    connect: (...args: unknown[]) => connectSpy(...args),
  };
});

import { materializeSignalGraph, planSignalGraph } from "./buildSignalGraph";
import { TIER_PROFILES } from "./qualityTiers";
import { getGenreMix } from "./genreMixPresets";

function makeNativeGain() {
  const g = {
    connect: vi.fn((dest: { __tone?: boolean } | undefined) => {
      if (dest && dest.__tone) {
        // Mirror the real browser rejection.
        throw new TypeError(
          "Failed to execute 'connect' on 'AudioNode': Overload resolution failed.",
        );
      }
      return dest;
    }),
    disconnect: vi.fn(),
  };
  nativeGains.push(g);
  return g;
}

const fakeCtx = {
  createGain: () => makeNativeGain(),
} as unknown as AudioContext;

// Native master-bus destination (e.g. the master GainNode): a Tone node may
// connect INTO it (Tone→native is valid), so it must NOT throw.
const nativeDestination = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

describe("materializeSignalGraph native↔Tone wiring", () => {
  beforeEach(() => {
    connectSpy.mockClear();
    nativeGains.length = 0;
  });

  it("does not call native AudioNode.connect() with a Tone node (high tier, inserts on)", () => {
    const plan = planSignalGraph(TIER_PROFILES.high, getGenreMix("pop")!);
    expect(() =>
      materializeSignalGraph(fakeCtx, nativeDestination, plan),
    ).not.toThrow();
    // The native input → Tone hops must go through Tone's connect() helper.
    expect(connectSpy).toHaveBeenCalled();
  });

  it("does not throw on eco tier where the input feeds the Channel directly (no inserts)", () => {
    const plan = planSignalGraph(TIER_PROFILES.eco, getGenreMix("pop")!);
    expect(() =>
      materializeSignalGraph(fakeCtx, nativeDestination, plan),
    ).not.toThrow();
  });
});
