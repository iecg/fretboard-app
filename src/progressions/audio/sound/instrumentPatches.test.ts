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
