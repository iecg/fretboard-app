/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

// audio.ts no longer uses Tone — it owns a raw AudioContext. Mock the two side
// modules so unit tests stay synchronous and timer-free, and install a fake
// Web Audio API on window (jsdom has none).
vi.mock("./audioIdleSuspend", () => ({
  registerAudioContext: vi.fn(),
  markAudioActivity: vi.fn(),
}));
vi.mock("./audioOutputHealth", () => ({
  probeOutputHealth: vi.fn().mockResolvedValue("healthy"),
}));

class FakeAudioParam {
  value = 0;
  setValueAtTime = vi.fn((v: number) => {
    this.value = v;
    return this;
  });
  linearRampToValueAtTime = vi.fn((v: number) => {
    this.value = v;
    return this;
  });
  exponentialRampToValueAtTime = vi.fn((v: number) => {
    this.value = v;
    return this;
  });
  cancelScheduledValues = vi.fn(() => this);
}

const created: { gains: any[]; filters: any[]; oscillators: any[] } = {
  gains: [],
  filters: [],
  oscillators: [],
};
let lastPeriodicWave: { real: Float32Array; imag: Float32Array } | null = null;

class FakeGain {
  gain = new FakeAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
}
class FakeFilter {
  type = "";
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
}
class FakeOscillator {
  frequency = new FakeAudioParam();
  setPeriodicWave = vi.fn();
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}
class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {
    this.state = "running";
  });
  createGain = vi.fn(() => {
    const g = new FakeGain();
    created.gains.push(g);
    return g;
  });
  createBiquadFilter = vi.fn(() => {
    const f = new FakeFilter();
    created.filters.push(f);
    return f;
  });
  createOscillator = vi.fn(() => {
    const o = new FakeOscillator();
    created.oscillators.push(o);
    return o;
  });
  createPeriodicWave = vi.fn((real: Float32Array, imag: Float32Array) => {
    lastPeriodicWave = { real, imag };
    return { real, imag } as unknown as PeriodicWave;
  });
}

let ctorState: AudioContextState = "running";
let resumeRejects = false;

import { __resetSynthForTests, synth } from "./audio";

beforeEach(() => {
  created.gains.length = 0;
  created.filters.length = 0;
  created.oscillators.length = 0;
  lastPeriodicWave = null;
  ctorState = "running";
  resumeRejects = false;

  (window as any).AudioContext = vi.fn(function FakeCtor() {
    const ctx = new FakeAudioContext();
    ctx.state = ctorState;
    if (resumeRejects) {
      ctx.resume = vi.fn(async () => {
        throw new Error("blocked");
      });
    }
    return ctx;
  });
  (window as any).webkitAudioContext = undefined;

  __resetSynthForTests();
});

describe("GuitarSynth (raw Web Audio)", () => {
  describe("init", () => {
    it("builds master gain, lowpass filter, and the partials periodic wave", () => {
      synth.init();
      expect(created.gains.length).toBe(1);
      expect(created.filters.length).toBe(1);
      const filter = created.filters[0];
      expect(filter.type).toBe("lowpass");
      expect(filter.frequency.value).toBe(10000);
      expect(filter.Q.value).toBeCloseTo(0.1);
      expect(lastPeriodicWave).not.toBeNull();
      expect(Array.from(lastPeriodicWave!.imag)).toEqual([0, 1, 0.8, 0.45, 0.22, 0.12, 0.05]);
      expect(Array.from(lastPeriodicWave!.real)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    it("is idempotent on subsequent calls", () => {
      synth.init();
      synth.init();
      synth.init();
      expect(created.filters.length).toBe(1);
    });

    it("initializes master gain at 0.5 when unmuted", () => {
      synth.init();
      expect(created.gains[0].gain.value).toBeCloseTo(0.5);
    });
  });

  describe("playNote", () => {
    it("creates an oscillator with the periodic wave at the requested frequency", async () => {
      await synth.playNote(440);
      expect(created.oscillators.length).toBe(1);
      const osc = created.oscillators[0];
      expect(osc.setPeriodicWave).toHaveBeenCalledTimes(1);
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(440, expect.any(Number));
      expect(osc.start).toHaveBeenCalledTimes(1);
      expect(osc.stop).toHaveBeenCalledTimes(1);
    });

    it("schedules the attack ramp to full amplitude (no lookahead — uses currentTime)", async () => {
      await synth.playNote(440);
      const env = created.gains[created.gains.length - 1];
      expect(env.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
    });

    it("auto-initializes if init() was not called first", async () => {
      await synth.playNote(110);
      expect(created.filters.length).toBe(1);
      expect(created.oscillators.length).toBe(1);
    });

    it("caps concurrent voices at 12 (skips beyond the cap)", async () => {
      for (let i = 0; i < 12; i++) await synth.playNote(220);
      expect(created.oscillators.length).toBe(12);
      await synth.playNote(220);
      expect(created.oscillators.length).toBe(12);
    });

    it("frees a voice when its oscillator ends, allowing new notes", async () => {
      for (let i = 0; i < 12; i++) await synth.playNote(220);
      created.oscillators[0].onended?.();
      await synth.playNote(220);
      expect(created.oscillators.length).toBe(13);
    });

    it("resumes its own context before playing when not running", async () => {
      ctorState = "suspended";
      synth.init();
      const ctx = (synth as any).ctx as FakeAudioContext;
      await synth.playNote(440);
      expect(ctx.resume).toHaveBeenCalled();
      expect(created.oscillators.length).toBe(1);
    });

    it("invokes onError and plays nothing when resume rejects", async () => {
      ctorState = "suspended";
      resumeRejects = true;
      const onError = vi.fn();
      synth.onError = onError;

      await synth.playNote(330);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toMatch(/audio could not be started/i);
      expect(created.oscillators.length).toBe(0);
      synth.onError = undefined;
    });
  });

  describe("setMute", () => {
    it("ramps master gain to 0 on mute", () => {
      synth.init();
      const master = created.gains[0];
      master.gain.linearRampToValueAtTime.mockClear();
      synth.setMute(true);
      expect(master.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
    });

    it("ramps master gain back to 0.5 on unmute", () => {
      synth.init();
      const master = created.gains[0];
      synth.setMute(true);
      master.gain.linearRampToValueAtTime.mockClear();
      synth.setMute(false);
      expect(master.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, expect.any(Number));
    });

    it("suppresses playNote while muted", async () => {
      synth.init();
      synth.setMute(true);
      await synth.playNote(440);
      expect(created.oscillators.length).toBe(0);
    });

    it("does NOT resume when unmuting before a user gesture (context suspended)", () => {
      ctorState = "suspended";
      synth.init();
      const ctx = (synth as any).ctx as FakeAudioContext;
      synth.setMute(false);
      expect(ctx.resume).not.toHaveBeenCalled();
      expect(created.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalled();
    });
  });

  describe("resume", () => {
    it("initializes lazily and resumes its own context", async () => {
      ctorState = "suspended";
      await synth.resume();
      const ctx = (synth as any).ctx as FakeAudioContext;
      expect(created.filters.length).toBe(1);
      expect(ctx.resume).toHaveBeenCalled();
    });

    it("forwards a resume failure via onError", async () => {
      ctorState = "suspended";
      resumeRejects = true;
      const onError = vi.fn();
      synth.onError = onError;
      await synth.resume();
      expect(onError).toHaveBeenCalledTimes(1);
      synth.onError = undefined;
    });
  });

  describe("graceful degradation", () => {
    it("marks itself unsupported when no AudioContext constructor exists", async () => {
      (window as any).AudioContext = undefined;
      (window as any).webkitAudioContext = undefined;
      __resetSynthForTests();

      synth.init();
      await synth.playNote(440);
      expect(created.oscillators.length).toBe(0);
    });
  });
});
