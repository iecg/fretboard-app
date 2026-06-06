import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PolyChordSpec } from "../sound/patchTypes";

const tone = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../../test-utils/toneMocks");
  return createToneSynthSpies();
});

vi.mock("tone", async () => {
  const t = await tone;
  return {
    // createReusableChordVoice calls `new Tone.PolySynth(Tone.Synth, opts)`.
    // Reuse the shared synth-instance spy as the PolySynth constructor so
    // instance.triggerAttackRelease forwards to spies.triggerAttackRelease.
    PolySynth: t.spies.ctorSpy,
    Synth: function Synth() {},
    now: () => t.now(),
  };
});

import { createReusableChordVoice } from "./createReusableChordVoice";

const spec: PolyChordSpec = {
  volume: -6,
  maxPolyphonyFloor: 6,
  oscillator: { type: "custom", partials: [1, 0.5] },
  envelope: { attack: 0.004, decay: 0.5, sustain: 0.08, release: 1.4 },
  releaseTailSec: 1.4,
  sustainedDurationSec: 1.4,
  shortDurationSec: 0.4,
};

describe("createReusableChordVoice — durationSec handling", () => {
  beforeEach(async () => {
    (await tone).reset();
  });

  it("uses an explicit options.durationSec over the patch default", async () => {
    const t = await tone;
    const voice = createReusableChordVoice(spec);
    voice.scheduleChord({} as AudioNode, ["C4", "E4", "G4"], 0, {
      velocity: 0.8,
      style: "sustained",
      durationSec: 3.5,
    });
    // triggerAttackRelease(notes, duration, time, velocity) — duration is arg[1].
    const [, duration] = t.spies.triggerAttackRelease.mock.calls[0]!;
    expect(duration).toBe(3.5);
  });

  it("falls back to spec.sustainedDurationSec when no override is given", async () => {
    const t = await tone;
    const voice = createReusableChordVoice(spec);
    voice.scheduleChord({} as AudioNode, ["C4", "E4", "G4"], 0, {
      velocity: 0.8,
      style: "sustained",
    });
    const [, duration] = t.spies.triggerAttackRelease.mock.calls[0]!;
    expect(duration).toBe(spec.sustainedDurationSec);
  });

  it("falls back to spec.shortDurationSec for non-sustained with no override", async () => {
    const t = await tone;
    const voice = createReusableChordVoice(spec);
    voice.scheduleChord({} as AudioNode, ["C4", "E4", "G4"], 0, {
      velocity: 0.8,
      style: "staccato",
    });
    const [, duration] = t.spies.triggerAttackRelease.mock.calls[0]!;
    expect(duration).toBe(spec.shortDurationSec);
  });
});
