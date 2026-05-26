/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no real AudioContext, so mock the slice of `tone` we touch.
// PolySynth/Filter/Volume are exposed as constructor spies whose instances
// we can inspect after each call.
const mocks = vi.hoisted(() => {
  const ensureStartedMock = vi.fn(async () => {});

  // Mirror the toneInit test's getContext stub so we can flip the
  // AudioContext state from tests and exercise the suspended-vs-unlocked
  // gate in setMute(false).
  const contextState = {
    value: "running" as "suspended" | "running" | "interrupted" | "closed",
  };
  const getContextMock = vi.fn(() => ({
    get state() {
      return contextState.value;
    },
  }));

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
    contextState,
    getContextMock,
  };
});

vi.mock("tone", () => ({
  PolySynth: mocks.PolySynth,
  Synth: mocks.Synth,
  Filter: mocks.Filter,
  Volume: mocks.Volume,
  getContext: mocks.getContextMock,
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
  mocks.getContextMock.mockClear();
  mocks.polySynthInstances.length = 0;
  mocks.filterInstances.length = 0;
  mocks.volumeInstances.length = 0;
  // Default to "running" so existing tests that don't care about the
  // gesture gate keep the previous behavior; the regression test below
  // flips this to "suspended" explicitly.
  mocks.contextState.value = "running";
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

    it("locks the PolySynth timbre contract (partials + envelope + polyphony)", () => {
      synth.init();
      const opts = (mocks.PolySynth.mock.calls[0] as unknown as [
        {
          maxPolyphony: number;
          options: {
            oscillator: { type: string; partials: number[] };
            envelope: { attack: number; decay: number; sustain: number; release: number };
          };
        },
      ])[0];
      expect(opts.maxPolyphony).toBe(12);
      expect(opts.options.oscillator.type).toBe("custom");
      expect(opts.options.oscillator.partials).toEqual([1, 0.8, 0.45, 0.22, 0.12, 0.05]);
      expect(opts.options.envelope.attack).toBeCloseTo(0.01);
      expect(opts.options.envelope.decay).toBeCloseTo(1.1);
      expect(opts.options.envelope.sustain).toBeCloseTo(0.05);
      expect(opts.options.envelope.release).toBeCloseTo(0.4);
    });

    it("initializes Volume at the master-gain dB (≈ -6.02 dB for 0.5 gain)", () => {
      synth.init();
      const initialDb = (mocks.Volume.mock.calls[0] as unknown as [number])[0];
      // gainToDb(0.5) === 20 * log10(0.5) ≈ -6.0206
      expect(initialDb).toBeCloseTo(-6.0206, 2);
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

    // Regression: App.tsx runs `synth.setMute(isMuted)` in a mount effect
    // and `isMutedAtom` defaults to `false`. Before this gate, the unmute
    // branch unconditionally invoked `resume()` -> `ensureToneStarted()` ->
    // `Tone.start()`, which rejects on Safari/iOS when no user gesture
    // has occurred and surfaces the "audio blocked" toast on every fresh
    // page load. setMute(false) must be a no-op for Tone.start while the
    // AudioContext is still suspended.
    it("does NOT call Tone.start when unmuting before a user gesture (context suspended)", () => {
      mocks.contextState.value = "suspended";
      synth.init();
      const volume = mocks.volumeInstances[0];
      volume.volume.rampTo.mockClear();
      mocks.ensureStartedMock.mockClear();

      synth.setMute(false);

      expect(mocks.ensureStartedMock).not.toHaveBeenCalled();
      // The volume ramp still happens — only the gesture-dependent
      // resume is suppressed.
      expect(volume.volume.rampTo).toHaveBeenCalledTimes(1);
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
