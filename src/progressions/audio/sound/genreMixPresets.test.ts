import { describe, it, expect } from "vitest";
import { GENRE_MIX_PRESETS, getGenreMix } from "./genreMixPresets";
import { getBassPatch, getChordPatch, getDrumKitPatch } from "./instrumentPatches";
import { GENRE_STYLES } from "../genres";

describe("genre mix presets", () => {
  it("has a preset for every genre style", () => {
    for (const g of GENRE_STYLES) {
      expect(getGenreMix(g.id), `missing mix for ${g.id}`).toBeDefined();
    }
  });

  it("every preset references existing patch ids in all families", () => {
    for (const m of GENRE_MIX_PRESETS) {
      expect(getBassPatch(m.patches.bass), `bass ${m.patches.bass}`).toBeDefined();
      expect(getChordPatch(m.patches.chord), `chord ${m.patches.chord}`).toBeDefined();
      expect(getDrumKitPatch(m.patches.drumKit), `kit ${m.patches.drumKit}`).toBeDefined();
    }
  });

  it("genre chord-patch family matches the genre's chordInstrument family", () => {
    for (const g of GENRE_STYLES) {
      const mix = getGenreMix(g.id)!;
      const patch = getChordPatch(mix.patches.chord)!;
      const expectedFamily = g.chordInstrument === "strum" ? "strum" : "poly";
      expect(patch.family, `${g.id}`).toBe(expectedFamily);
    }
  });

  it("pan values stay within [-1, 1] and sends within [0, 1]", () => {
    for (const m of GENRE_MIX_PRESETS) {
      for (const key of ["chord", "bass", "drums", "metronome"] as const) {
        const ch = m.perInstrument[key];
        expect(ch.pan).toBeGreaterThanOrEqual(-1);
        expect(ch.pan).toBeLessThanOrEqual(1);
        expect(ch.reverbSend).toBeGreaterThanOrEqual(0);
        expect(ch.reverbSend).toBeLessThanOrEqual(1);
      }
    }
  });
});
