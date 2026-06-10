import { describe, it, expect } from "vitest";
import { GENRE_MIX_PRESETS, getGenreMix, MASTER_LIMITER_CEILING_DB } from "./genreMixPresets";
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
      if (m.patches.chordAlt) {
        expect(getChordPatch(m.patches.chordAlt), `chordAlt ${m.patches.chordAlt}`).toBeDefined();
      }
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

  it("defaults blues to a strummed guitar with the organ preserved as the alt patch", () => {
    const blues = getGenreMix("blues")!;
    const primary = getChordPatch(blues.patches.chord)!;
    expect(primary.family).toBe("strum"); // default out-of-the-box = strummed guitar
    expect(blues.patches.chordAlt).toBe("chord-jazz-organ");
    const alt = getChordPatch(blues.patches.chordAlt!)!;
    expect(alt.family).toBe("poly"); // organ still reachable via the keys instrument
  });

  it("any genre's chordAlt (when present) is the opposite family of its default chord patch", () => {
    for (const m of GENRE_MIX_PRESETS) {
      if (!m.patches.chordAlt) continue;
      const primary = getChordPatch(m.patches.chord)!;
      const alt = getChordPatch(m.patches.chordAlt);
      expect(alt, `chordAlt ${m.patches.chordAlt} not found`).toBeDefined();
      expect(alt!.family, `${m.genre}`).not.toBe(primary.family);
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

  it("uses one shared output ceiling for every genre (no genre is mastered louder)", () => {
    // Root-cause guard: loudness differences between genres must come from
    // compression + instrument balance, NEVER from a hotter peak ceiling.
    // Rock previously sat at -0.8 (and funk -0.6), making them audibly louder.
    for (const m of GENRE_MIX_PRESETS) {
      expect(m.master.limiterThreshold, `genre ${m.genre}`).toBe(MASTER_LIMITER_CEILING_DB);
    }
  });

  it("does not stage the rock kit hotter than the pop reference", () => {
    // Rock's long-ringing strum + constant pedal bass already give it the
    // highest sustained energy; its drums must not also sit above pop's.
    const rock = getGenreMix("rock")!;
    const pop = getGenreMix("pop")!;
    expect(rock.perInstrument.drums.volumeDb).toBeLessThanOrEqual(pop.perInstrument.drums.volumeDb);
  });

  it("keeps the rock bass from sitting too present (the buzzy pick patch)", () => {
    // Rock uses the sawtooth bass-pick — the most harmonic-rich/buzzy patch.
    // At 0dB it was too present; it must be tucked at least 1dB under unity.
    const rock = getGenreMix("rock")!;
    expect(rock.perInstrument.bass.volumeDb).toBeLessThanOrEqual(-1);
  });

  it("uses the short funk-scratch guitar patch for funk", () => {
    expect(getGenreMix("funk")!.patches.chord).toBe("chord-funk-scratch");
  });

  it("retunes bass bus levels to tame over-hot low end (mix balance pass)", () => {
    expect(getGenreMix("rock")!.perInstrument.bass.volumeDb).toBe(-5);
    expect(getGenreMix("blues")!.perInstrument.bass.volumeDb).toBe(-2);
    expect(getGenreMix("jazz")!.perInstrument.bass.volumeDb).toBe(-2);
    expect(getGenreMix("pop")!.perInstrument.bass.volumeDb).toBe(-1);
  });

  it("funk's chord patch is short-decay so the guitar can actually scratch", () => {
    // Recurrence guard: two prior funk passes failed because the guitar was a
    // long-ringing acoustic strum. The funk chord patch must stay short.
    const patchId = getGenreMix("funk")!.patches.chord;
    const patch = getChordPatch(patchId)!;
    expect(patch.strum!.noteDurationSec).toBeLessThanOrEqual(0.3);
  });
});
