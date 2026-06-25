import { describe, it, expect, beforeEach, vi } from "vitest";

const tone = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../../test-utils/toneMocks");
  return createToneSynthSpies();
});

vi.mock("tone", async () => {
  const t = await tone;
  return {
    // getChordVoice calls `new Tone.PolySynth(Tone.Synth, opts)`. Reuse the
    // shared synth-instance spy as the PolySynth constructor.
    PolySynth: t.spies.ctorSpy,
    Synth: function Synth() {},
    now: () => t.now(),
  };
});

import { getChordVoice, _resetChordSynths } from "./index";

describe("chord voice resolution (piano-only chord layer)", () => {
  beforeEach(async () => {
    // Clear leftover synths first so their dispose() doesn't count against the
    // freshly-reset spies.
    _resetChordSynths();
    (await tone).reset();
  });

  it("resolves a known patch id to a memoized voice", () => {
    const v = getChordVoice("chord-epiano");
    expect(typeof v.scheduleChord).toBe("function");
    expect(v).toBe(getChordVoice("chord-epiano"));
  });

  it("falls back to the grand piano for unknown patch ids", () => {
    const unknown = getChordVoice("chord-does-not-exist");
    const grand = getChordVoice("chord-grand-piano");
    expect(unknown).toBe(grand);
  });

  it("floors shared-synth polyphony at 32 (above each patch's per-chord floor)", async () => {
    const t = await tone;
    getChordVoice("chord-epiano").scheduleChord({} as AudioNode, ["C4", "E4", "G4"], 0, {
      velocity: 0.8,
      style: "sustained",
    });
    // One shared PolySynth carries every overlapping chord + release tail, so
    // polyphony must not collapse to the patch's small per-chord floor (6).
    expect(t.instances[0]?.maxPolyphony).toBe(32);
  });

  it("cancel() of a future chord is idempotent — disposes the shared synth once", async () => {
    const t = await tone;
    t.setNow(0);
    const handle = getChordVoice("chord-epiano").scheduleChord(
      {} as AudioNode,
      ["C4", "E4", "G4"],
      5,
      { velocity: 0.8, style: "sustained" },
    );
    handle.cancel();
    handle.cancel();
    handle.cancel();
    expect(t.spies.dispose).toHaveBeenCalledTimes(1);
  });
});
