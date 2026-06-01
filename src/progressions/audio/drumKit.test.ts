import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDrumKitPatch } from "./sound/instrumentPatches";

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
const clock = vi.hoisted(() => ({ now: 0 }));

vi.mock("tone", async () => {
  const m = await membrane;
  const n = await noise;
  const mt = await metal;
  return {
    MembraneSynth: m.spies.ctorSpy,
    NoiseSynth: n.spies.ctorSpy,
    MetalSynth: mt.spies.ctorSpy,
    now: () => clock.now,
  };
});

describe("drumKit — Tone backend", () => {
  let membraneSpies: Awaited<typeof membrane>["spies"];
  let noiseSpies: Awaited<typeof noise>["spies"];
  let metalSpies: Awaited<typeof metal>["spies"];
  let membraneTone: Awaited<typeof membrane>;
  let scheduleKick: typeof import("./drumKit").scheduleKick;
  let scheduleSnare: typeof import("./drumKit").scheduleSnare;
  let scheduleHiHat: typeof import("./drumKit").scheduleHiHat;
  let scheduleRide: typeof import("./drumKit").scheduleRide;
  let scheduleCrossStick: typeof import("./drumKit").scheduleCrossStick;

  beforeEach(async () => {
    const m = await membrane;
    const n = await noise;
    const mt = await metal;
    membraneTone = m;
    membraneSpies = m.spies;
    noiseSpies = n.spies;
    metalSpies = mt.spies;
    vi.useFakeTimers();
    clock.now = 0;
    m.reset();
    n.reset();
    mt.reset();
    vi.resetModules();
    ({ scheduleKick, scheduleSnare, scheduleHiHat, scheduleRide, scheduleCrossStick } =
      await import("./drumKit"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("scheduleKick", () => {
    it("constructs MembraneSynth with sine oscillator + pitch decay", () => {
      scheduleKick({} as AudioNode, 1.5);
      expect(membraneSpies.ctorSpy).toHaveBeenCalledTimes(1);
      const [opts] = membraneSpies.ctorSpy.mock.calls[0]!;
      expect(opts.oscillator.type).toBe("sine");
      expect(opts.pitchDecay).toBeCloseTo(0.04, 3);
      expect(opts.octaves).toBe(6);
      expect(opts.envelope.attack).toBeCloseTo(0.001, 4);
    });

    it("triggers C1 at the requested time + velocity", () => {
      scheduleKick(
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

    it("reuses one MembraneSynth for non-overlapping hits on the same destination", () => {
      const dest = {} as AudioNode;
      scheduleKick(dest, 0, { velocity: 0.8 });
      clock.now = 1.2;
      scheduleKick(dest, 1.3, { velocity: 0.75 });

      expect(membraneSpies.ctorSpy).toHaveBeenCalledTimes(1);
      expect(membraneSpies.triggerAttackRelease).toHaveBeenCalledTimes(2);
    });

    it("allocates separate MembraneSynths for future hits scheduled in one pass", () => {
      const dest = {} as AudioNode;
      scheduleKick(dest, 2, { velocity: 0.8 });
      scheduleKick(dest, 2.6, { velocity: 0.75 });

      expect(membraneSpies.ctorSpy).toHaveBeenCalledTimes(2);
      expect(membraneSpies.triggerAttackRelease).toHaveBeenCalledTimes(2);
    });

    it("keeps different destinations on different leased synths", () => {
      const firstDest = {} as AudioNode;
      const secondDest = {} as AudioNode;

      scheduleKick(firstDest, 0, { velocity: 0.8 });
      clock.now = 1.2;
      scheduleKick(secondDest, 1.3, { velocity: 0.75 });

      expect(membraneSpies.ctorSpy).toHaveBeenCalledTimes(2);
      expect(membraneTone.instances[0]?.connect).toHaveBeenCalledWith(firstDest);
      expect(membraneTone.instances[1]?.connect).toHaveBeenCalledWith(secondDest);
    });

    it("skips zero-velocity hits (no MembraneSynth constructed)", () => {
      scheduleKick(
        {} as AudioNode,
        0,
        { velocity: 0 },
      );
      expect(membraneSpies.ctorSpy).not.toHaveBeenCalled();
      expect(membraneSpies.triggerAttackRelease).not.toHaveBeenCalled();
    });

    it("cancel() defers dispose past the kick release tail", () => {
      const handle = scheduleKick(
        {} as AudioNode,
        0,
      );
      handle.cancel();
      expect(membraneSpies.dispose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(700); // > KICK_DISPOSE_MS (600)
      expect(membraneSpies.dispose).toHaveBeenCalledTimes(1);
    });

    it("cancel() prevents a future-scheduled kick from ever being attacked", async () => {
      const handle = scheduleKick({} as AudioNode, 2, { velocity: 0.8 });

      expect(membraneSpies.triggerAttackRelease).toHaveBeenCalledTimes(1);
      expect(membraneSpies.playbackAttackRelease).not.toHaveBeenCalled();

      handle.cancel();
      await vi.advanceTimersByTimeAsync(2_500);
      clock.now = 2.5;

      expect(membraneSpies.playbackAttackRelease).not.toHaveBeenCalled();
    });

    it("cancel() is idempotent — repeated calls dispose only once", () => {
      const handle = scheduleKick(
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
      scheduleSnare({} as AudioNode, 1.5);
      expect(noiseSpies.ctorSpy).toHaveBeenCalledTimes(1);
      const [opts] = noiseSpies.ctorSpy.mock.calls[0]!;
      expect(opts.noise.type).toBe("white");
      expect(opts.envelope.attack).toBeCloseTo(0.001, 4);
      expect(opts.envelope.decay).toBeCloseTo(0.18, 3);
      expect(opts.envelope.sustain).toBe(0);
    });

    it("applies the kit snare volume override so a soft brush can still be lifted", () => {
      const kit = getDrumKitPatch("kit-jazz-brush")!;
      expect(kit.voices.snare!.volume).toBeGreaterThan(0); // lifted brush
      scheduleSnare({} as AudioNode, 0, { velocity: 0.3, kit });
      const [opts] = noiseSpies.ctorSpy.mock.calls[0]!;
      expect(opts.volume).toBe(kit.voices.snare!.volume);
    });

    it("defaults the snare volume to 0dB when the kit omits it", () => {
      scheduleSnare({} as AudioNode, 0, { velocity: 0.8 });
      const [opts] = noiseSpies.ctorSpy.mock.calls[0]!;
      expect(opts.volume).toBe(0);
    });

    it("triggers with NO note arg — (duration, time, velocity) signature", () => {
      scheduleSnare(
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

    it("reuses one NoiseSynth for non-overlapping hits on the same destination", () => {
      const dest = {} as AudioNode;
      scheduleSnare(dest, 0, { velocity: 0.8 });
      clock.now = 0.6;
      scheduleSnare(dest, 0.7, { velocity: 0.75 });

      expect(noiseSpies.ctorSpy).toHaveBeenCalledTimes(1);
      expect(noiseSpies.triggerAttackRelease).toHaveBeenCalledTimes(2);
    });

    it("skips zero-velocity hits (no NoiseSynth constructed)", () => {
      scheduleSnare(
        {} as AudioNode,
        0,
        { velocity: 0 },
      );
      expect(noiseSpies.ctorSpy).not.toHaveBeenCalled();
      expect(noiseSpies.triggerAttackRelease).not.toHaveBeenCalled();
    });

    it("cancel() defers dispose past the snare release tail and is idempotent", () => {
      const handle = scheduleSnare(
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
      scheduleHiHat({} as AudioNode, 1.5);
      expect(metalSpies.ctorSpy).toHaveBeenCalledTimes(1);
      const [opts] = metalSpies.ctorSpy.mock.calls[0]!;
      expect(opts.envelope.decay).toBeCloseTo(0.05, 3);
      expect(opts.harmonicity).toBeCloseTo(5.1, 2);
      expect(opts.modulationIndex).toBe(32);
    });

    it("constructs MetalSynth with long decay (0.35) when open === true", () => {
      scheduleHiHat(
        {} as AudioNode,
        1.5,
        { open: true },
      );
      const [opts] = metalSpies.ctorSpy.mock.calls[0]!;
      expect(opts.envelope.decay).toBeCloseTo(0.35, 3);
    });

    it("triggers C6 with closed-hat duration at the requested time + velocity", () => {
      scheduleHiHat(
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

    it("reuses one MetalSynth for non-overlapping closed-hat hits on the same destination", () => {
      const dest = {} as AudioNode;
      scheduleHiHat(dest, 0, { velocity: 0.4 });
      clock.now = 0.3;
      scheduleHiHat(dest, 0.35, { velocity: 0.5 });

      expect(metalSpies.ctorSpy).toHaveBeenCalledTimes(1);
      expect(metalSpies.triggerAttackRelease).toHaveBeenCalledTimes(2);
    });

    it("skips zero-velocity hits (no MetalSynth constructed)", () => {
      scheduleHiHat(
        {} as AudioNode,
        0,
        { velocity: 0 },
      );
      expect(metalSpies.ctorSpy).not.toHaveBeenCalled();
      expect(metalSpies.triggerAttackRelease).not.toHaveBeenCalled();
    });

    it("cancel() defers dispose past the closed-hat release tail", () => {
      const handle = scheduleHiHat(
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
      scheduleRide({} as AudioNode, 1.5);
      expect(metalSpies.ctorSpy).toHaveBeenCalledTimes(1);
      const [opts] = metalSpies.ctorSpy.mock.calls[0]!;
      expect(opts.envelope.decay).toBeCloseTo(1.0, 3);
      expect(opts.harmonicity).toBeCloseTo(3.1, 2);
      expect(opts.modulationIndex).toBe(22);
    });

    it("triggers D6 at the requested time + velocity", () => {
      scheduleRide(
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

    it("reuses one MetalSynth for non-overlapping ride hits on the same destination", () => {
      const dest = {} as AudioNode;
      scheduleRide(dest, 0, { velocity: 0.6 });
      clock.now = 1.6;
      scheduleRide(dest, 1.7, { velocity: 0.5 });

      expect(metalSpies.ctorSpy).toHaveBeenCalledTimes(1);
      expect(metalSpies.triggerAttackRelease).toHaveBeenCalledTimes(2);
    });

    it("skips zero-velocity hits (no MetalSynth constructed)", () => {
      scheduleRide(
        {} as AudioNode,
        0,
        { velocity: 0 },
      );
      expect(metalSpies.ctorSpy).not.toHaveBeenCalled();
      expect(metalSpies.triggerAttackRelease).not.toHaveBeenCalled();
    });

    it("cancel() defers dispose past the ride release tail and is idempotent", () => {
      const handle = scheduleRide(
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

  describe("scheduleCrossStick", () => {
    it("constructs a MembraneSynth with a triangle click voice", () => {
      scheduleCrossStick({} as AudioNode, 1.5);
      expect(membraneSpies.ctorSpy).toHaveBeenCalledTimes(1);
      const [opts] = membraneSpies.ctorSpy.mock.calls[0]!;
      expect(opts.oscillator.type).toBe("triangle");
      expect(opts.envelope.sustain).toBe(0);
      expect(opts.envelope.decay).toBeCloseTo(0.06, 3);
    });

    it("triggers a high woody click (G4) at the requested time + velocity", () => {
      scheduleCrossStick({} as AudioNode, 2.5, { velocity: 0.8 });
      expect(membraneSpies.triggerAttackRelease).toHaveBeenCalledTimes(1);
      const [note, , time, velocity] =
        membraneSpies.triggerAttackRelease.mock.calls[0]!;
      expect(note).toBe("G4");
      expect(time).toBeCloseTo(2.5, 3);
      expect(velocity).toBeCloseTo(0.8, 2);
    });

    it("skips zero-velocity hits (no MembraneSynth constructed)", () => {
      scheduleCrossStick({} as AudioNode, 1, { velocity: 0 });
      expect(membraneSpies.ctorSpy).not.toHaveBeenCalled();
    });

    it("reuses one MembraneSynth for non-overlapping hits on the same destination", () => {
      const dest = {} as AudioNode;
      scheduleCrossStick(dest, 0, { velocity: 0.8 });
      clock.now = 0.3; // past the first hit's busy window (0 + 0.12)
      scheduleCrossStick(dest, 0.4, { velocity: 0.7 });

      expect(membraneSpies.ctorSpy).toHaveBeenCalledTimes(1);
      expect(membraneSpies.triggerAttackRelease).toHaveBeenCalledTimes(2);
    });

    it("allocates separate MembraneSynths for future hits scheduled in one pass", () => {
      const dest = {} as AudioNode;
      scheduleCrossStick(dest, 2, { velocity: 0.8 });
      scheduleCrossStick(dest, 2.6, { velocity: 0.7 });

      expect(membraneSpies.ctorSpy).toHaveBeenCalledTimes(2);
      expect(membraneSpies.triggerAttackRelease).toHaveBeenCalledTimes(2);
    });

    it("keeps different destinations on different leased synths", () => {
      const firstDest = {} as AudioNode;
      const secondDest = {} as AudioNode;

      scheduleCrossStick(firstDest, 0, { velocity: 0.8 });
      clock.now = 0.3;
      scheduleCrossStick(secondDest, 0.4, { velocity: 0.7 });

      expect(membraneSpies.ctorSpy).toHaveBeenCalledTimes(2);
      expect(membraneTone.instances[0]?.connect).toHaveBeenCalledWith(firstDest);
      expect(membraneTone.instances[1]?.connect).toHaveBeenCalledWith(secondDest);
    });

    it("cancel() defers dispose past the cross-stick release tail", () => {
      const handle = scheduleCrossStick({} as AudioNode, 0);
      handle.cancel();
      expect(membraneSpies.dispose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(200); // > CROSS_STICK_DISPOSE_MS (120)
      expect(membraneSpies.dispose).toHaveBeenCalledTimes(1);
    });

    it("cancel() is idempotent — repeated calls dispose only once", () => {
      const handle = scheduleCrossStick({} as AudioNode, 0);
      handle.cancel();
      handle.cancel();
      handle.cancel();
      vi.advanceTimersByTime(200);
      expect(membraneSpies.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe("kit patch overrides", () => {
    it("applies kit kick overrides (pitchDecay/octaves/decay) over the defaults", () => {
      const kit = getDrumKitPatch("kit-funk")!;
      scheduleKick({} as AudioNode, 0, { velocity: 1, kit });
      expect(membraneSpies.ctorSpy).toHaveBeenCalledTimes(1);
      const [opts] = membraneSpies.ctorSpy.mock.calls[0]!;
      expect(opts.pitchDecay).toBeCloseTo(kit.voices.kick!.pitchDecay!, 4);
      expect(opts.octaves).toBe(kit.voices.kick!.octaves);
      expect(opts.envelope.decay).toBeCloseTo(kit.voices.kick!.envelope!.decay!, 4);
    });

    it("applies the kit ride volume override so the ride can be tamed below 0dB", () => {
      const kit = getDrumKitPatch("kit-jazz-brush")!;
      expect(kit.voices.ride!.volume).toBe(-10); // tamed jazz ride
      scheduleRide({} as AudioNode, 0, { velocity: 1, kit });
      const [opts] = metalSpies.ctorSpy.mock.calls[0]!;
      expect(opts.volume).toBe(kit.voices.ride!.volume);
    });

    it("defaults the ride volume to 0dB when the kit omits it", () => {
      scheduleRide({} as AudioNode, 0, { velocity: 1 });
      const [opts] = metalSpies.ctorSpy.mock.calls[0]!;
      expect(opts.volume).toBe(0);
    });
  });
});
