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
    }
  });

  it("every genre's chord patch is a piano (the chord layer is piano-only)", () => {
    // The chord-instrument feature (strum/organ) was dropped — synthesized
    // guitar never read as a guitar. Every genre comps on a piano poly patch.
    for (const m of GENRE_MIX_PRESETS) {
      const patch = getChordPatch(m.patches.chord)!;
      expect(patch.poly, `${m.genre} chord patch must be a poly piano`).toBeDefined();
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

  it("retunes bass bus levels to tame over-hot low end (mix balance pass)", () => {
    expect(getGenreMix("rock")!.perInstrument.bass.volumeDb).toBe(-5);
    expect(getGenreMix("blues")!.perInstrument.bass.volumeDb).toBe(-2);
    expect(getGenreMix("jazz")!.perInstrument.bass.volumeDb).toBe(-2);
    expect(getGenreMix("pop")!.perInstrument.bass.volumeDb).toBe(-1);
  });

  it("stages the piano chord bus consistently across genres (piano-only seeds)", () => {
    // -2 reference everywhere; funk and bossa tuck the comp slightly under
    // their busier rhythm sections. By-ear seeds from the piano-only pivot.
    expect(getGenreMix("pop")!.perInstrument.chord.volumeDb).toBe(-2);
    expect(getGenreMix("rock")!.perInstrument.chord.volumeDb).toBe(-2);
    expect(getGenreMix("blues")!.perInstrument.chord.volumeDb).toBe(-2);
    expect(getGenreMix("jazz")!.perInstrument.chord.volumeDb).toBe(-2);
    expect(getGenreMix("ballad")!.perInstrument.chord.volumeDb).toBe(-2);
    expect(getGenreMix("funk")!.perInstrument.chord.volumeDb).toBe(-3);
    expect(getGenreMix("bossa-nova")!.perInstrument.chord.volumeDb).toBe(-3);
  });
});
