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

  it("seats the jazz ride behind the front line (drums quieter than chord)", () => {
    const jazz = getGenreMix("jazz")!;
    expect(jazz.perInstrument.drums.volumeDb).toBeLessThan(jazz.perInstrument.chord.volumeDb);
  });

  it("keeps the jazz kit audible — not buried far below the front line", () => {
    // Regression guard: the jazz drums bus was -5dB (quietest of any genre),
    // and stacking that under the already-soft brush/ride voices made the kit
    // barely audible. It must stay below the chord but no more than ~2dB under.
    const jazz = getGenreMix("jazz")!;
    expect(jazz.perInstrument.drums.volumeDb).toBeGreaterThanOrEqual(-3);
  });

  it("pushes funk bass to at least match its chord level", () => {
    const funk = getGenreMix("funk")!;
    expect(funk.perInstrument.bass.volumeDb).toBeGreaterThanOrEqual(funk.perInstrument.chord.volumeDb);
  });
});
