import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoisted Tone synth spies — one helper per ctor we actually need to
// distinguish on:
//   - `membrane` backs MembraneSynth (kick)
//   - `noise`    backs NoiseSynth    (snare)
//   - `metal`    backs MetalSynth    (HiHat AND Ride)
//
// The metal helper is shared because both voices use the same constructor.
// Tests that need to distinguish HiHat from Ride read off the ctor call list
// by index, which keeps the mock plumbing simple.
const membrane = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../test-utils/toneMocks");
  return createToneSynthSpies();
});
const noise = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../test-utils/toneMocks");
  return createToneSynthSpies();
});
const metal = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../test-utils/toneMocks");
  return createToneSynthSpies();
});

vi.mock("tone", async () => {
  const m = await membrane;
  const n = await noise;
  const mt = await metal;
  return {
    MembraneSynth: m.spies.ctorSpy,
    NoiseSynth: n.spies.ctorSpy,
    MetalSynth: mt.spies.ctorSpy,
    now: () => 0,
  };
});

import {
  scheduleKick,
  scheduleSnare,
  scheduleHiHat,
  scheduleRide,
} from "./drumKit";

describe("drumKit — Tone backend", () => {
  let membraneSpies: Awaited<typeof membrane>["spies"];
  let noiseSpies: Awaited<typeof noise>["spies"];
  let metalSpies: Awaited<typeof metal>["spies"];

  beforeEach(async () => {
    const m = await membrane;
    const n = await noise;
    const mt = await metal;
    membraneSpies = m.spies;
    noiseSpies = n.spies;
    metalSpies = mt.spies;
    vi.useFakeTimers();
    m.reset();
    n.reset();
    mt.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("scheduleKick", () => {
    it("constructs MembraneSynth with sine oscillator + pitch decay", () => {
      scheduleKick({ currentTime: 0 } as AudioContext, {} as AudioNode, 1.5);
      expect(membraneSpies.ctorSpy).toHaveBeenCalledTimes(1);
      const [opts] = membraneSpies.ctorSpy.mock.calls[0]!;
      expect(opts.oscillator.type).toBe("sine");
      expect(opts.pitchDecay).toBeCloseTo(0.04, 3);
      expect(opts.octaves).toBe(6);
      expect(opts.envelope.attack).toBeCloseTo(0.001, 4);
    });

    it("triggers C1 at the requested time + velocity", () => {
      scheduleKick(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        2.5,
        { velocity: 0.8 },
      );
      expect(membraneSpies.triggerAttackRelease).toHaveBeenCalledTimes(1);
      const [note, , time, velocity] =
        membraneSpies.triggerAttackRelease.mock.calls[0]!;
      expect(note).toBe("C1");
      expect(time).toBeCloseTo(2.5, 3);
      expect(velocity).toBeCloseTo(0.8, 2);
    });

    it("skips zero-velocity hits (no MembraneSynth constructed)", () => {
      scheduleKick(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        0,
        { velocity: 0 },
      );
      expect(membraneSpies.ctorSpy).not.toHaveBeenCalled();
      expect(membraneSpies.triggerAttackRelease).not.toHaveBeenCalled();
    });

    it("cancel() defers dispose past the kick release tail", () => {
      const handle = scheduleKick(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        0,
      );
      handle.cancel();
      expect(membraneSpies.dispose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(700); // > KICK_DISPOSE_MS (600)
      expect(membraneSpies.dispose).toHaveBeenCalledTimes(1);
    });

    it("cancel() is idempotent — repeated calls dispose only once", () => {
      const handle = scheduleKick(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        0,
      );
      handle.cancel();
      handle.cancel();
      handle.cancel();
      vi.advanceTimersByTime(700);
      expect(membraneSpies.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe("scheduleSnare", () => {
    it("constructs NoiseSynth with white noise + AD envelope", () => {
      scheduleSnare({ currentTime: 0 } as AudioContext, {} as AudioNode, 1.5);
      expect(noiseSpies.ctorSpy).toHaveBeenCalledTimes(1);
      const [opts] = noiseSpies.ctorSpy.mock.calls[0]!;
      expect(opts.noise.type).toBe("white");
      expect(opts.envelope.attack).toBeCloseTo(0.001, 4);
      expect(opts.envelope.decay).toBeCloseTo(0.18, 3);
      expect(opts.envelope.sustain).toBe(0);
    });

    it("triggers with NO note arg — (duration, time, velocity) signature", () => {
      scheduleSnare(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        3.25,
        { velocity: 0.7 },
      );
      expect(noiseSpies.triggerAttackRelease).toHaveBeenCalledTimes(1);
      const args = noiseSpies.triggerAttackRelease.mock.calls[0]!;
      // First arg is duration (a number), NOT a note string.
      expect(typeof args[0]).toBe("number");
      expect(args[0]).toBeCloseTo(0.18, 3);
      expect(args[1]).toBeCloseTo(3.25, 3);
      expect(args[2]).toBeCloseTo(0.7, 2);
    });

    it("skips zero-velocity hits (no NoiseSynth constructed)", () => {
      scheduleSnare(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        0,
        { velocity: 0 },
      );
      expect(noiseSpies.ctorSpy).not.toHaveBeenCalled();
      expect(noiseSpies.triggerAttackRelease).not.toHaveBeenCalled();
    });

    it("cancel() defers dispose past the snare release tail and is idempotent", () => {
      const handle = scheduleSnare(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        0,
      );
      handle.cancel();
      handle.cancel();
      expect(noiseSpies.dispose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(400); // > SNARE_DISPOSE_MS (300)
      expect(noiseSpies.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe("scheduleHiHat", () => {
    it("constructs MetalSynth with short decay (0.05) when closed (default)", () => {
      scheduleHiHat({ currentTime: 0 } as AudioContext, {} as AudioNode, 1.5);
      expect(metalSpies.ctorSpy).toHaveBeenCalledTimes(1);
      const [opts] = metalSpies.ctorSpy.mock.calls[0]!;
      expect(opts.envelope.decay).toBeCloseTo(0.05, 3);
      expect(opts.harmonicity).toBeCloseTo(5.1, 2);
      expect(opts.modulationIndex).toBe(32);
    });

    it("constructs MetalSynth with long decay (0.35) when open === true", () => {
      scheduleHiHat(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        1.5,
        { open: true },
      );
      const [opts] = metalSpies.ctorSpy.mock.calls[0]!;
      expect(opts.envelope.decay).toBeCloseTo(0.35, 3);
    });

    it("triggers C6 with closed-hat duration at the requested time + velocity", () => {
      scheduleHiHat(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        1.75,
        { velocity: 0.4 },
      );
      const [note, duration, time, velocity] =
        metalSpies.triggerAttackRelease.mock.calls[0]!;
      expect(note).toBe("C6");
      expect(duration).toBeCloseTo(0.05, 3);
      expect(time).toBeCloseTo(1.75, 3);
      expect(velocity).toBeCloseTo(0.4, 2);
    });

    it("skips zero-velocity hits (no MetalSynth constructed)", () => {
      scheduleHiHat(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        0,
        { velocity: 0 },
      );
      expect(metalSpies.ctorSpy).not.toHaveBeenCalled();
      expect(metalSpies.triggerAttackRelease).not.toHaveBeenCalled();
    });

    it("cancel() defers dispose past the closed-hat release tail", () => {
      const handle = scheduleHiHat(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        0,
      );
      handle.cancel();
      expect(metalSpies.dispose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(200); // > HAT_CLOSED_DISPOSE_MS (150)
      expect(metalSpies.dispose).toHaveBeenCalledTimes(1);
    });

    it("cancel() on open hat defers dispose past the longer open-hat tail", () => {
      const handle = scheduleHiHat(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        0,
        { open: true },
      );
      handle.cancel();
      // Closed-hat tail (150ms) should NOT yet have disposed the open hat.
      vi.advanceTimersByTime(200);
      expect(metalSpies.dispose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(400); // total 600 > HAT_OPEN_DISPOSE_MS (500)
      expect(metalSpies.dispose).toHaveBeenCalledTimes(1);
    });

    it("cancel() is idempotent — repeated calls dispose only once", () => {
      const handle = scheduleHiHat(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        0,
      );
      handle.cancel();
      handle.cancel();
      handle.cancel();
      vi.advanceTimersByTime(200);
      expect(metalSpies.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe("scheduleRide", () => {
    it("constructs MetalSynth with long decay (1.0)", () => {
      scheduleRide({ currentTime: 0 } as AudioContext, {} as AudioNode, 1.5);
      expect(metalSpies.ctorSpy).toHaveBeenCalledTimes(1);
      const [opts] = metalSpies.ctorSpy.mock.calls[0]!;
      expect(opts.envelope.decay).toBeCloseTo(1.0, 3);
      expect(opts.harmonicity).toBeCloseTo(3.1, 2);
      expect(opts.modulationIndex).toBe(22);
    });

    it("triggers D6 at the requested time + velocity", () => {
      scheduleRide(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        4.0,
        { velocity: 0.6 },
      );
      const [note, duration, time, velocity] =
        metalSpies.triggerAttackRelease.mock.calls[0]!;
      expect(note).toBe("D6");
      expect(duration).toBeCloseTo(1.0, 3);
      expect(time).toBeCloseTo(4.0, 3);
      expect(velocity).toBeCloseTo(0.6, 2);
    });

    it("skips zero-velocity hits (no MetalSynth constructed)", () => {
      scheduleRide(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        0,
        { velocity: 0 },
      );
      expect(metalSpies.ctorSpy).not.toHaveBeenCalled();
      expect(metalSpies.triggerAttackRelease).not.toHaveBeenCalled();
    });

    it("cancel() defers dispose past the ride release tail and is idempotent", () => {
      const handle = scheduleRide(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        0,
      );
      handle.cancel();
      handle.cancel();
      expect(metalSpies.dispose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1600); // > RIDE_DISPOSE_MS (1500)
      expect(metalSpies.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
