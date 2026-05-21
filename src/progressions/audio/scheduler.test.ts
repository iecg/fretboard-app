import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNoteFrequency } from "@fretflow/core";

// Mock the metronome module so the scheduler integration test can assert on
// `scheduleClick` calls directly instead of inspecting Web Audio nodes. The
// real metronome is built on Tone.Synth (see metronome.ts) and lives outside
// the `MockCtx` it would have used; we spy on the call surface that matters.
const scheduleClickSpy = vi.hoisted(() => vi.fn());
const cancelClickSpy = vi.hoisted(() => vi.fn());
vi.mock("./metronome", () => ({
  scheduleClick: scheduleClickSpy.mockImplementation(() => ({
    cancel: cancelClickSpy,
  })),
  _metronomeInternals: { ACCENT_FREQ: 1500, NORMAL_FREQ: 900, DECAY: 0.04 },
}));

// Same pattern for the bass voice — Tone.MonoSynth-backed under the hood.
// The spy captures (dest, frequency, time, options) per scheduleBassNote call
// and the cancel spy fires when the step handle tears down the lane.
const scheduleBassNoteSpy = vi.hoisted(() => vi.fn());
const cancelBassSpy = vi.hoisted(() => vi.fn());
vi.mock("./bass", () => ({
  scheduleBassNote: scheduleBassNoteSpy.mockImplementation(() => ({
    cancel: cancelBassSpy,
  })),
}));

// And the plucked-string voice — now Tone.PluckSynth-backed via strumVoice.
// Mocking `./string` keeps strum-lane tests asserting on the call count of
// `pluckString` (one per voicing note per strum hit) rather than the now-
// empty oscillator pool.
const pluckStringSpy = vi.hoisted(() => vi.fn());
const cancelPluckSpy = vi.hoisted(() => vi.fn());
vi.mock("./string", () => ({
  pluckString: pluckStringSpy.mockImplementation(() => ({
    cancel: cancelPluckSpy,
  })),
}));

// Drum-kit voices — now Tone-backed (MembraneSynth / NoiseSynth / MetalSynth).
// Mocking `./drumKit` lets the drum-lane assertions count call surfaces (kick,
// snare, hi-hat, ride) rather than poking at raw oscillators / buffer sources
// that no longer exist after the Phase 7B migration.
const kickSpy = vi.hoisted(() => vi.fn());
const snareSpy = vi.hoisted(() => vi.fn());
const hatSpy = vi.hoisted(() => vi.fn());
const rideSpy = vi.hoisted(() => vi.fn());
const cancelDrumSpy = vi.hoisted(() => vi.fn());
vi.mock("./drumKit", () => ({
  scheduleKick: kickSpy.mockImplementation(() => ({ cancel: cancelDrumSpy })),
  scheduleSnare: snareSpy.mockImplementation(() => ({ cancel: cancelDrumSpy })),
  scheduleHiHat: hatSpy.mockImplementation(() => ({ cancel: cancelDrumSpy })),
  scheduleRide: rideSpy.mockImplementation(() => ({ cancel: cancelDrumSpy })),
}));

import { scheduleProgressionStep } from "./scheduler";
import { _metronomeInternals } from "./metronome";

// All voice modules (metronome, bass, drum kit, plucked string) are mocked
// at the call surface above — the scheduler no longer touches Web Audio
// directly, so the test asserts on the spy call counts/args rather than on
// raw oscillator pools. A bare `AudioNode` stand-in is enough for the bus.

// Default catalog-driven fields that reproduce the OLD hardcoded behavior:
// strum voice + pop-8ths (== POP_STRUM_PATTERN), root-fifth bass, rock drums,
// no swing, no variations. Spread into every step input so existing
// assertions about hit counts / timing remain valid.
const defaultNewFields = {
  chordInstrument: "strum" as const,
  chordPatternId: "pop-8ths",
  bassPatternId: "root-fifth",
  drumPatternId: "rock",
  drumVariations: [] as string[],
  swing: 0,
};

describe("scheduleProgressionStep", () => {
  const bus = {} as AudioNode;

  beforeEach(() => {
    cancelClickSpy.mockReset();
    scheduleClickSpy.mockReset().mockImplementation(() => ({
      cancel: cancelClickSpy,
    }));
    cancelBassSpy.mockReset();
    scheduleBassNoteSpy.mockReset().mockImplementation(() => ({
      cancel: cancelBassSpy,
    }));
    cancelPluckSpy.mockReset();
    pluckStringSpy.mockReset().mockImplementation(() => ({
      cancel: cancelPluckSpy,
    }));
    cancelDrumSpy.mockReset();
    kickSpy.mockReset().mockImplementation(() => ({ cancel: cancelDrumSpy }));
    snareSpy.mockReset().mockImplementation(() => ({ cancel: cancelDrumSpy }));
    hatSpy.mockReset().mockImplementation(() => ({ cancel: cancelDrumSpy }));
    rideSpy.mockReset().mockImplementation(() => ({ cancel: cancelDrumSpy }));
  });

  it("returns a no-op handle when beatsAvailable is 0", () => {
    const handle = scheduleProgressionStep(bus, {
      voicing: ["C3"],
      bassNotes: ["C2"],
      beatsAvailable: 0,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: true, bass: true, drums: true, metronome: true },
      ...defaultNewFields,
    });
    expect(scheduleClickSpy).not.toHaveBeenCalled();
    expect(scheduleBassNoteSpy).not.toHaveBeenCalled();
    expect(pluckStringSpy).not.toHaveBeenCalled();
    expect(() => handle.cancelAll()).not.toThrow();
  });

  it("returns a no-op handle when beatsPerBar is 0", () => {
    const handle = scheduleProgressionStep(bus, {
      voicing: ["C3"],
      bassNotes: ["C2"],
      beatsAvailable: 4,
      beatsPerBar: 0,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: true, bass: true, drums: true, metronome: true },
      ...defaultNewFields,
    });
    expect(scheduleClickSpy).not.toHaveBeenCalled();
    expect(() => handle.cancelAll()).not.toThrow();
  });

  it("returns a no-op handle when beatsPerBar is negative", () => {
    const handle = scheduleProgressionStep(bus, {
      voicing: ["C3"],
      bassNotes: ["C2"],
      beatsAvailable: 4,
      beatsPerBar: -4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: true, bass: true, drums: true, metronome: true },
      ...defaultNewFields,
    });
    expect(scheduleClickSpy).not.toHaveBeenCalled();
    expect(() => handle.cancelAll()).not.toThrow();
  });

  it("does not schedule any voices when all flags are off", () => {
    scheduleProgressionStep(bus, {
      voicing: ["C3", "E3", "G3"],
      bassNotes: ["C2"],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: false, drums: false, metronome: false },
      ...defaultNewFields,
    });
    expect(scheduleClickSpy).not.toHaveBeenCalled();
    expect(scheduleBassNoteSpy).not.toHaveBeenCalled();
    expect(pluckStringSpy).not.toHaveBeenCalled();
    expect(kickSpy).not.toHaveBeenCalled();
    expect(snareSpy).not.toHaveBeenCalled();
    expect(hatSpy).not.toHaveBeenCalled();
    expect(rideSpy).not.toHaveBeenCalled();
  });

  it("schedules strum hits only when strum flag is on", () => {
    scheduleProgressionStep(bus, {
      voicing: ["C3", "E3", "G3"],
      bassNotes: [],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: true, bass: false, drums: false, metronome: false },
      ...defaultNewFields,
    });
    // 6 strum hits × 3-note voicing = 18 pluckString invocations.
    // (Tone.PluckSynth-backed — asserted via the spy on the call surface.)
    expect(pluckStringSpy).toHaveBeenCalledTimes(18);
  });

  it("schedules bass voices when bass flag is on", () => {
    scheduleProgressionStep(bus, {
      voicing: [],
      bassNotes: ["C2"],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: true, drums: false, metronome: false },
      ...defaultNewFields,
    });
    // Beats 0 and 2 = two bass hits. The bass voice is now Tone-backed,
    // so we inspect the scheduleBassNote spy rather than oscillator count.
    expect(scheduleBassNoteSpy).toHaveBeenCalledTimes(2);
  });

  it("uses the second bass note on beat 3 when available", () => {
    scheduleProgressionStep(bus, {
      voicing: [],
      bassNotes: ["C2", "G2"],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: true, drums: false, metronome: false },
      ...defaultNewFields,
    });

    // scheduleBassNote(dest, frequency, time, options) — pull frequency
    // and time off each call.
    expect(scheduleBassNoteSpy).toHaveBeenCalledTimes(2);
    const calls = scheduleBassNoteSpy.mock.calls.map((args) => [args[1], args[2]]);
    expect(calls).toEqual([
      [getNoteFrequency("C2"), 0],
      [getNoteFrequency("G2"), 1],
    ]);
  });

  it("cancels scheduled bass voices when the step handle is cancelled", () => {
    const handle = scheduleProgressionStep(bus, {
      voicing: [],
      bassNotes: ["C2", "G2"],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: true, drums: false, metronome: false },
      ...defaultNewFields,
    });

    expect(scheduleBassNoteSpy).toHaveBeenCalledTimes(2);
    expect(cancelBassSpy).not.toHaveBeenCalled();

    handle.cancelAll();

    // Each bass voice's cancel() should fire on step cancellation.
    expect(cancelBassSpy).toHaveBeenCalledTimes(2);
  });

  it("schedules metronome clicks (one per beat) only when flag is on", () => {
    scheduleProgressionStep(bus, {
      voicing: [],
      bassNotes: [],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: false, drums: false, metronome: true },
      ...defaultNewFields,
    });
    expect(scheduleClickSpy).toHaveBeenCalledTimes(4);
  });

  it("cancels scheduled metronome clicks when the step handle is cancelled", () => {
    const handle = scheduleProgressionStep(bus, {
      voicing: [],
      bassNotes: [],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 3,
      enable: { strum: false, bass: false, drums: false, metronome: true },
      ...defaultNewFields,
    });

    expect(scheduleClickSpy).toHaveBeenCalledTimes(4);
    expect(cancelClickSpy).not.toHaveBeenCalled();

    handle.cancelAll();

    // Each metronome voice's cancel() should fire on step cancellation.
    expect(cancelClickSpy).toHaveBeenCalledTimes(4);
  });

  it("keeps step timing but skips past hits when rescheduling from a cutoff", () => {
    scheduleProgressionStep(bus, {
      voicing: [],
      bassNotes: [],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 10,
      scheduleFromTime: 10.76,
      enable: { strum: false, bass: false, drums: false, metronome: true },
      ...defaultNewFields,
    });

    // scheduleClick(dest, time, options) — extract the `time` arg.
    const clickTimes = scheduleClickSpy.mock.calls.map((args) => args[1]);
    expect(clickTimes).toEqual([11, 11.5]);
  });

  it("schedules drum voices on the kick/snare/hat lanes only when drums flag is on", () => {
    scheduleProgressionStep(bus, {
      voicing: [],
      bassNotes: [],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: false, drums: true, metronome: false },
      ...defaultNewFields,
    });
    // Rock pattern: kicks on 1+3, snares on 2+4, hi-hat on every 8th note.
    // All drum voices are now Tone-backed — asserted via spies on the call
    // surface rather than by counting raw audio nodes.
    expect(kickSpy).toHaveBeenCalled();
    expect(snareSpy).toHaveBeenCalled();
    expect(hatSpy).toHaveBeenCalled();
  });

  it("cancels scheduled drum hits when the step handle is cancelled", () => {
    const handle = scheduleProgressionStep(bus, {
      voicing: [],
      bassNotes: [],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 3,
      enable: { strum: false, bass: false, drums: true, metronome: false },
      ...defaultNewFields,
    });

    // Total drum hits scheduled across the bar = sum of kick/snare/hat calls.
    const totalHits =
      kickSpy.mock.calls.length +
      snareSpy.mock.calls.length +
      hatSpy.mock.calls.length +
      rideSpy.mock.calls.length;
    expect(totalHits).toBeGreaterThan(0);
    expect(cancelDrumSpy).not.toHaveBeenCalled();

    handle.cancelAll();

    // Each scheduled drum voice's cancel() should fire on step cancellation.
    expect(cancelDrumSpy).toHaveBeenCalledTimes(totalHits);
  });

  it("clips strum hits past the available beats", () => {
    scheduleProgressionStep(bus, {
      voicing: ["C3"],
      bassNotes: [],
      beatsAvailable: 1, // only beat 0 of POP_STRUM_PATTERN qualifies
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: true, bass: false, drums: false, metronome: false },
      ...defaultNewFields,
    });
    expect(pluckStringSpy).toHaveBeenCalledTimes(1);
  });

  it("repeats strum hits once per bar for multi-bar chords", () => {
    scheduleProgressionStep(bus, {
      voicing: ["C3"],
      bassNotes: [],
      beatsAvailable: 8,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: true, bass: false, drums: false, metronome: false },
      ...defaultNewFields,
    });
    expect(pluckStringSpy).toHaveBeenCalledTimes(12);
  });

  it("accents each bar downbeat when metronome repeats over multi-bar chords", () => {
    scheduleProgressionStep(bus, {
      voicing: [],
      bassNotes: [],
      beatsAvailable: 8,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: false, drums: false, metronome: true },
      ...defaultNewFields,
    });

    // scheduleClick(dest, time, { accent, velocity }) — pick `accent`
    // off each call and map back to the internal frequency for parity with
    // the prior assertion.
    const frequencies = scheduleClickSpy.mock.calls.map((args) =>
      args[2]?.accent ? _metronomeInternals.ACCENT_FREQ : _metronomeInternals.NORMAL_FREQ,
    );
    expect(frequencies).toEqual([
      _metronomeInternals.ACCENT_FREQ,
      _metronomeInternals.NORMAL_FREQ,
      _metronomeInternals.NORMAL_FREQ,
      _metronomeInternals.NORMAL_FREQ,
      _metronomeInternals.ACCENT_FREQ,
      _metronomeInternals.NORMAL_FREQ,
      _metronomeInternals.NORMAL_FREQ,
      _metronomeInternals.NORMAL_FREQ,
    ]);
  });

  it("repeats the root-fifth bass pattern once per bar for multi-bar chords", () => {
    scheduleProgressionStep(bus, {
      voicing: [],
      bassNotes: ["C2", "G2"],
      beatsAvailable: 8,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: true, drums: false, metronome: false },
      ...defaultNewFields,
    });

    // scheduleBassNote(dest, frequency, time, options) — pair frequency
    // with start time for each hit.
    const scheduledNotes = scheduleBassNoteSpy.mock.calls.map((args) => [
      args[1],
      args[2],
    ]);
    expect(scheduledNotes).toEqual([
      [getNoteFrequency("C2"), 0],
      [getNoteFrequency("G2"), 1],
      [getNoteFrequency("C2"), 2],
      [getNoteFrequency("G2"), 3],
    ]);
  });
});
