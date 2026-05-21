/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no real AudioContext, so mock the slice of `tone` we touch.
// PolySynth/Filter/Volume are exposed as constructor spies whose instances
// we can inspect after each call.
const mocks = vi.hoisted(() => {
  const ensureStartedMock = vi.fn(async () => {});

  const triggerAttackRelease = vi.fn();
  const polySynthInstances: any[] = [];
  // Use `function` (not arrow) so the mock is constructable via `new`.
  const PolySynth = vi.fn(function PolySynthMock() {
    const instance = {
      triggerAttackRelease,
      connect: vi.fn().mockReturnThis(),
      toDestination: vi.fn().mockReturnThis(),
      dispose: vi.fn(),
    };
    polySynthInstances.push(instance);
    return instance;
  });

  const filterInstances: any[] = [];
  const Filter = vi.fn(function FilterMock() {
    const instance = {
      connect: vi.fn().mockReturnThis(),
      toDestination: vi.fn().mockReturnThis(),
      dispose: vi.fn(),
    };
    filterInstances.push(instance);
    return instance;
  });

  const volumeInstances: any[] = [];
  const Volume = vi.fn(function VolumeMock(initialDb: number) {
    const volumeParam = {
      value: initialDb,
      rampTo: vi.fn(),
    };
    const instance = {
      volume: volumeParam,
      connect: vi.fn().mockReturnThis(),
      toDestination: vi.fn().mockReturnThis(),
      dispose: vi.fn(),
    };
    volumeInstances.push(instance);
    return instance;
  });

  // Synth is just a class token passed to PolySynth — no behavior needed.
  const Synth = vi.fn(function SynthMock() {});

  return {
    ensureStartedMock,
    PolySynth,
    Filter,
    Volume,
    Synth,
    polySynthInstances,
    filterInstances,
    volumeInstances,
    triggerAttackRelease,
  };
});

vi.mock("tone", () => ({
  PolySynth: mocks.PolySynth,
  Synth: mocks.Synth,
  Filter: mocks.Filter,
  Volume: mocks.Volume,
}));

vi.mock("./toneInit", () => ({
  ensureToneStarted: mocks.ensureStartedMock,
}));

import { __resetSynthForTests, synth } from "./audio";

beforeEach(() => {
  mocks.PolySynth.mockClear();
  mocks.Filter.mockClear();
  mocks.Volume.mockClear();
  mocks.triggerAttackRelease.mockClear();
  mocks.ensureStartedMock.mockClear();
  mocks.polySynthInstances.length = 0;
  mocks.filterInstances.length = 0;
  mocks.volumeInstances.length = 0;
  __resetSynthForTests();
});

describe("GuitarSynth (Tone-backed)", () => {
  describe("init", () => {
    it("constructs a PolySynth, Filter, and Volume on first call", () => {
      synth.init();
      expect(mocks.PolySynth).toHaveBeenCalledTimes(1);
      expect(mocks.Filter).toHaveBeenCalledTimes(1);
      expect(mocks.Volume).toHaveBeenCalledTimes(1);
    });

    it("is idempotent on subsequent calls", () => {
      synth.init();
      synth.init();
      synth.init();
      expect(mocks.PolySynth).toHaveBeenCalledTimes(1);
      expect(mocks.Filter).toHaveBeenCalledTimes(1);
      expect(mocks.Volume).toHaveBeenCalledTimes(1);
    });

    it("routes PolySynth -> Filter -> Volume -> destination", () => {
      synth.init();
      const polySynth = mocks.polySynthInstances[0];
      const filter = mocks.filterInstances[0];
      const volume = mocks.volumeInstances[0];

      // Volume is connected straight to destination.
      expect(volume.toDestination).toHaveBeenCalledTimes(1);
      // Filter routes into Volume; PolySynth routes into Filter.
      expect(filter.connect).toHaveBeenCalledWith(volume);
      expect(polySynth.connect).toHaveBeenCalledWith(filter);
    });
  });

  describe("playNote", () => {
    it("triggers the PolySynth with the requested frequency", async () => {
      await synth.playNote(440);
      expect(mocks.triggerAttackRelease).toHaveBeenCalledTimes(1);
      expect(mocks.triggerAttackRelease.mock.calls[0][0]).toBe(440);
    });

    it("ensures Tone has started before triggering", async () => {
      await synth.playNote(220);
      expect(mocks.ensureStartedMock).toHaveBeenCalled();
    });

    it("auto-initializes if init() was not called first", async () => {
      await synth.playNote(110);
      expect(mocks.PolySynth).toHaveBeenCalledTimes(1);
      expect(mocks.triggerAttackRelease).toHaveBeenCalledTimes(1);
    });

    it("invokes onError when ensureToneStarted rejects", async () => {
      mocks.ensureStartedMock.mockRejectedValueOnce(new Error("blocked"));
      const onError = vi.fn();
      synth.onError = onError;

      await synth.playNote(330);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toMatch(/audio could not be started/i);
      expect(mocks.triggerAttackRelease).not.toHaveBeenCalled();

      synth.onError = undefined;
    });
  });

  describe("setMute", () => {
    it("ramps master volume down on mute", () => {
      synth.init();
      const volume = mocks.volumeInstances[0];
      volume.volume.rampTo.mockClear();

      synth.setMute(true);

      expect(volume.volume.rampTo).toHaveBeenCalledTimes(1);
      const [target] = volume.volume.rampTo.mock.calls[0];
      expect(target).toBe(-Infinity);
    });

    it("ramps master volume back up on unmute", () => {
      synth.init();
      const volume = mocks.volumeInstances[0];
      synth.setMute(true);
      volume.volume.rampTo.mockClear();

      synth.setMute(false);

      expect(volume.volume.rampTo).toHaveBeenCalledTimes(1);
      const [target] = volume.volume.rampTo.mock.calls[0];
      // gainToDb(0.5) ≈ -6.0206 dB
      expect(target).toBeCloseTo(-6.0206, 2);
    });

    it("suppresses subsequent playNote calls while muted", async () => {
      synth.init();
      synth.setMute(true);
      mocks.triggerAttackRelease.mockClear();

      await synth.playNote(440);

      expect(mocks.triggerAttackRelease).not.toHaveBeenCalled();
    });

    it("allows playback after unmute", async () => {
      synth.init();
      synth.setMute(true);
      synth.setMute(false);
      mocks.triggerAttackRelease.mockClear();

      await synth.playNote(440);

      expect(mocks.triggerAttackRelease).toHaveBeenCalledTimes(1);
    });
  });

  describe("resume", () => {
    it("delegates to ensureToneStarted", async () => {
      await synth.resume();
      expect(mocks.ensureStartedMock).toHaveBeenCalled();
    });

    it("initializes lazily before starting Tone", async () => {
      await synth.resume();
      expect(mocks.PolySynth).toHaveBeenCalledTimes(1);
    });

    it("forwards failures via onError", async () => {
      mocks.ensureStartedMock.mockRejectedValueOnce(new Error("blocked"));
      const onError = vi.fn();
      synth.onError = onError;

      await synth.resume();

      expect(onError).toHaveBeenCalledTimes(1);
      synth.onError = undefined;
    });
  });

  describe("graceful degradation", () => {
    it("marks itself unsupported if Tone construction throws", () => {
      mocks.PolySynth.mockImplementationOnce(() => {
        throw new Error("no audio");
      });

      synth.init();

      // No further init attempts after marking unsupported.
      synth.init();
      expect(mocks.PolySynth).toHaveBeenCalledTimes(1);
    });

    it("playNote becomes a no-op when unsupported", async () => {
      mocks.PolySynth.mockImplementationOnce(() => {
        throw new Error("no audio");
      });
      synth.init();
      mocks.ensureStartedMock.mockClear();

      await synth.playNote(440);

      expect(mocks.triggerAttackRelease).not.toHaveBeenCalled();
    });
  });
});
