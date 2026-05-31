import { describe, it, expect } from "vitest";
import {
  BASS_PATCHES, CHORD_PATCHES, DRUM_KIT_PATCHES,
  getBassPatch, getChordPatch, getDrumKitPatch,
  DEFAULT_CHORD_PATCH_BY_FAMILY,
} from "./instrumentPatches";

describe("instrument patches", () => {
  it("every bass patch has a live filter envelope (octaves > 0)", () => {
    expect(BASS_PATCHES.length).toBeGreaterThan(0);
    for (const p of BASS_PATCHES) {
      expect(p.filterEnvelope.octaves).toBeGreaterThan(0);
      expect(p.envelope.attack).toBeGreaterThan(0);
    }
  });

  it("every bass patch produces harmonic content so it reads on small speakers", () => {
    // Recurrence guard for the repeated "bass is inaudible" bug class. A pure
    // sine at bass frequencies (~40-165Hz) is physically weak on laptop/phone
    // speakers and most headphones, and has no overtones for the ear to track
    // the pitch by. Every bass patch must EITHER use a harmonic-rich oscillator
    // (not the sine family) OR add a saturation insert that generates
    // harmonics. This fails the moment a pure-sine bass is reintroduced.
    const SINE_FAMILY = new Set(["sine", "fatsine", "fmsine"]);
    for (const p of BASS_PATCHES) {
      const harmonicOsc = !SINE_FAMILY.has(p.oscillator.type);
      const hasSaturation = p.insert?.saturation !== undefined;
      expect(
        harmonicOsc || hasSaturation,
        `bass patch "${p.id}" is a pure sine with no saturation — it will be inaudible on small speakers`,
      ).toBe(true);
    }
  });

  it("never combines a high-cut with NO harmonic source (the inaudible combo)", () => {
    // The fatal combination for small-speaker audibility is a pure sine AND a
    // high-cut AND no saturation — that's what made the old upright vanish. A
    // high-cut is fine on its own (e.g. bass-finger cuts highs but its
    // saturation regenerates overtones), so guard the *combination*, not the
    // high-cut alone.
    const SINE_FAMILY = new Set(["sine", "fatsine", "fmsine"]);
    for (const p of BASS_PATCHES) {
      const highCut = (p.insert?.eq3?.high ?? 0) < 0;
      const pureSine = SINE_FAMILY.has(p.oscillator.type);
      const noSaturation = p.insert?.saturation === undefined;
      expect(
        highCut && pureSine && noSaturation,
        `bass patch "${p.id}" is a high-cut pure sine with no saturation — inaudible on small speakers`,
      ).toBe(false);
    }
  });

  it("poly chord patches carry poly spec, strum patches carry strum spec", () => {
    for (const p of CHORD_PATCHES) {
      if (p.family === "poly") { expect(p.poly).toBeDefined(); expect(p.strum).toBeUndefined(); }
      else { expect(p.strum).toBeDefined(); expect(p.poly).toBeUndefined(); }
    }
  });

  it("default chord patch exists for each family", () => {
    expect(getChordPatch(DEFAULT_CHORD_PATCH_BY_FAMILY.poly)?.family).toBe("poly");
    expect(getChordPatch(DEFAULT_CHORD_PATCH_BY_FAMILY.strum)?.family).toBe("strum");
  });

  it("lookups return undefined for unknown ids", () => {
    expect(getBassPatch("nope")).toBeUndefined();
    expect(getChordPatch("nope")).toBeUndefined();
    expect(getDrumKitPatch("nope")).toBeUndefined();
  });

  it("every drum kit patch has at least one voice override", () => {
    for (const k of DRUM_KIT_PATCHES) {
      expect(Object.keys(k.voices).length).toBeGreaterThan(0);
    }
  });

  it("gives the jazz brush kit a hi-hat voice for the foot chick", () => {
    const kit = getDrumKitPatch("kit-jazz-brush")!;
    expect(kit.voices.hihat).toBeDefined();
  });
});
