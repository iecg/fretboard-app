import { describe, it, expect } from "vitest";
import { getLensEmphasis, classifyNote, classifyNoteFromSemantics, getNoteVisuals } from "./semantics";
import type { LeadLensContext } from "./semantics";
import type { NoteSemantics } from "@fretflow/core";
import { RADIUS_SCALE_CHORD_TONE } from "@fretflow/core";

describe("semantics utils", () => {
  describe("getLensEmphasis", () => {
    it("returns default emphasis when no lens is active", () => {
      const res = getLensEmphasis("chord-root", undefined, false);
      expect(res).toEqual({ radiusBoost: 1, opacityBoost: 1 });
    });

    it("boosts guide tones in tones lens", () => {
      const res = getLensEmphasis("chord-tone", "tones", true);
      expect(res.glowColor).toBe("cyan");
      expect(res.radiusBoost).toBeGreaterThan(1);
    });

    it("renders non-guide chord tones at full intensity in tones lens (no dimming)", () => {
      const res = getLensEmphasis("chord-tone-in-scale", "tones", false);
      expect(res.radiusBoost).toBe(1);
      expect(res.opacityBoost).toBe(1);
    });

    it("lead lens without leadContext falls back to tones-base behavior", () => {
      // Without leadContext, Lead lens behaves like the Tones lens:
      // guide-tone flag drives the cyan glow.
      const res = getLensEmphasis("chord-tone", "lead", true);
      expect(res.glowColor).toBe("cyan");
      expect(res.radiusBoost).toBeGreaterThan(1);
    });
  });

  describe("getLensEmphasis - tones lens (Task 4.4)", () => {
    it("emphasizes guide tones with cyan glow and larger radius", () => {
      expect(getLensEmphasis("chord-tone-in-scale", "tones", true)).toEqual({
        glowColor: "cyan",
        radiusBoost: 1.15,
        opacityBoost: 1,
      });
    });

    it("emphasizes guide tones regardless of underlying noteClass", () => {
      // Even an outside-scale chord tone that happens to be a guide tone gets emphasis
      expect(getLensEmphasis("chord-tone-outside-scale", "tones", true)).toMatchObject({
        glowColor: "cyan",
      });
    });

    it("renders non-guide chord tones at full intensity (no dimming)", () => {
      // chord-root, chord-tone-in-scale, chord-tone-outside-scale, note-diatonic-chord --- none should dim
      for (const cls of ["chord-root", "chord-tone-in-scale", "chord-tone-outside-scale", "note-diatonic-chord"]) {
        expect(getLensEmphasis(cls, "tones", false)).toEqual({
          radiusBoost: 1,
          opacityBoost: 1,
        });
      }
    });

    it("dims scale-only notes (in scale, not in chord)", () => {
      expect(getLensEmphasis("scale-only", "tones", false)).toEqual({
        radiusBoost: 0.85,
        opacityBoost: 0.7,
      });
      expect(getLensEmphasis("color-tone", "tones", false)).toEqual({
        radiusBoost: 0.85,
        opacityBoost: 0.7,
      });
    });

    it("returns default for inactive notes", () => {
      expect(getLensEmphasis("note-inactive", "tones", false)).toEqual({
        radiusBoost: 1,
        opacityBoost: 1,
      });
    });
  });

  describe("classifyNote", () => {
    it("classifies key-tonic correctly without chord overlay", () => {
      const res = classifyNote(true, false, false, true, false, false, true, true);
      expect(res).toBe("key-tonic");
    });

    it("classifies chord-root correctly with chord overlay", () => {
      const res = classifyNote(false, true, false, true, true, true, true, true);
      expect(res).toBe("chord-root");
    });
  });

  describe("classifyNoteFromSemantics", () => {
    it("classifies based on semantic data", () => {
      const sem: NoteSemantics = {
        isScaleRoot: true,
        isChordRoot: true,
        isChordTone: true,
        isInScale: true,
        isColorTone: false,
        isTension: false,
        isGuideTone: false,
      };
      const res = classifyNoteFromSemantics(sem, true, true, true, true);
      expect(res).toBe("chord-root");
    });

    it("returns note-diatonic-chord for chord tone when isDiatonicChord is true", () => {
      const sem: NoteSemantics = {
        isScaleRoot: false,
        isChordRoot: false,
        isChordTone: true,
        isInScale: true,
        isColorTone: false,
        isTension: false,
        isGuideTone: false,
        isDiatonicChord: true,
      };
      const res = classifyNoteFromSemantics(sem, true, true, true, false);
      expect(res).toBe("note-diatonic-chord");
    });

    it("chord-root wins over note-diatonic-chord even when isDiatonicChord is true", () => {
      const sem: NoteSemantics = {
        isScaleRoot: false,
        isChordRoot: true,
        isChordTone: true,
        isInScale: true,
        isColorTone: false,
        isTension: false,
        isGuideTone: false,
        isDiatonicChord: true,
      };
      const res = classifyNoteFromSemantics(sem, true, true, true, false);
      expect(res).toBe("chord-root");
    });

    it("falls through to chord-tone-in-scale when isDiatonicChord is false", () => {
      const sem: NoteSemantics = {
        isScaleRoot: false,
        isChordRoot: false,
        isChordTone: true,
        isInScale: true,
        isColorTone: false,
        isTension: false,
        isGuideTone: false,
        isDiatonicChord: false,
      };
      const res = classifyNoteFromSemantics(sem, true, true, true, false);
      expect(res).toBe("chord-tone-in-scale");
    });

    it("returns note-blue for color tone without chord overlay when highlighted", () => {
      const sem: NoteSemantics = {
        isScaleRoot: false,
        isChordRoot: false,
        isChordTone: false,
        isInScale: true,
        isColorTone: true,
        isTension: false,
        isGuideTone: false,
      };
      const res = classifyNoteFromSemantics(sem, false, false, false, true);
      expect(res).toBe("note-blue");
    });

    it("falls through to chord-tone-in-scale when isDiatonicChord is undefined (manual mode)", () => {
      const sem: NoteSemantics = {
        isScaleRoot: false,
        isChordRoot: false,
        isChordTone: true,
        isInScale: true,
        isColorTone: false,
        isTension: false,
        isGuideTone: false,
        // isDiatonicChord omitted (undefined)
      };
      const res = classifyNoteFromSemantics(sem, true, true, true, false);
      expect(res).toBe("chord-tone-in-scale");
    });
  });

  describe("getNoteVisuals", () => {
    it("returns squircle for chord tones", () => {
      const res = getNoteVisuals("chord-tone-in-scale");
      expect(res.noteShape).toBe("squircle");
    });

    it("returns circle for active notes", () => {
      const res = getNoteVisuals("note-active");
      expect(res.noteShape).toBe("circle");
    });

    it("returns squircle + RADIUS_SCALE_CHORD_TONE for note-diatonic-chord", () => {
      const res = getNoteVisuals("note-diatonic-chord");
      expect(res.noteShape).toBe("squircle");
      expect(res.radiusScale).toBe(RADIUS_SCALE_CHORD_TONE);
    });
  });
});

// ---------------------------------------------------------------------------
// Task 4.5 — Lead lens: common-tone hold + departing + anticipation
// ---------------------------------------------------------------------------

describe("getLensEmphasis - lead lens (Task 4.5)", () => {
  const baseLeadContext: LeadLensContext = {
    notePc: "A",
    commonWithNext: new Set<string>(),
    nextGuideTones: new Set<string>(),
    beatPosition: 0,
    stepDurationBeats: 4,
  };

  // -------------------------------------------------------------------------
  // Backward-compatibility: no leadContext → tones-base fallback
  // -------------------------------------------------------------------------
  it("falls back to tones-base when leadContext is undefined (hold of tones lens contract)", () => {
    // Guide tone gets cyan glow, same as tones lens.
    expect(getLensEmphasis("chord-tone-in-scale", "lead", true, undefined))
      .toEqual({ glowColor: "cyan", radiusBoost: 1.15, opacityBoost: 1 });
    // Scale-only dims, same as tones lens.
    expect(getLensEmphasis("scale-only", "lead", false, undefined))
      .toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
    // Default chord tone → full intensity.
    expect(getLensEmphasis("chord-root", "lead", false, undefined))
      .toEqual({ radiusBoost: 1, opacityBoost: 1 });
  });

  // -------------------------------------------------------------------------
  // Hold: common tone with next chord
  // -------------------------------------------------------------------------
  it("marks common-tone chord note as hold (Am→Dm: A is common)", () => {
    // Am contains A, C, E. Dm contains D, F, A. Common: A.
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "A",
      commonWithNext: new Set(["A"]),
    };
    const result = getLensEmphasis("chord-tone-in-scale", "lead", false, ctx);
    expect(result).toEqual({ glowColor: "cyan", radiusBoost: 1.2, opacityBoost: 1 });
  });

  it("hold applies to chord-root class too (root is a common tone)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "A",
      commonWithNext: new Set(["A"]),
    };
    const result = getLensEmphasis("chord-root", "lead", false, ctx);
    expect(result).toEqual({ glowColor: "cyan", radiusBoost: 1.2, opacityBoost: 1 });
  });

  it("hold applies to chord-tone-outside-scale class", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "C",
      commonWithNext: new Set(["C"]),
    };
    const result = getLensEmphasis("chord-tone-outside-scale", "lead", false, ctx);
    expect(result).toEqual({ glowColor: "cyan", radiusBoost: 1.2, opacityBoost: 1 });
  });

  // -------------------------------------------------------------------------
  // Departing: current chord tone not in next chord
  // -------------------------------------------------------------------------
  it("marks chord-tone-not-in-common as departing (Am→Dm: C departs)", () => {
    // C is in Am but not in Dm.
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "C",
      commonWithNext: new Set(["A"]), // A is common, C is not
    };
    const result = getLensEmphasis("chord-tone-in-scale", "lead", false, ctx);
    expect(result).toEqual({ radiusBoost: 0.85, opacityBoost: 0.6 });
  });

  it("departing overrides guide-tone emphasis (voice-leading > chord-quality)", () => {
    // Even if isGuideTone=true (C is b3 of Am), it departs and should be dimmed.
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "C",
      commonWithNext: new Set(["A"]),
    };
    const result = getLensEmphasis("chord-tone-in-scale", "lead", true /* isGuideTone */, ctx);
    // Departing (step 3) wins over tones-base guide-tone (step 4).
    expect(result).toEqual({ radiusBoost: 0.85, opacityBoost: 0.6 });
  });

  it("non-chord-tone class does NOT get departing emphasis (only chord tones depart)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "G",
      commonWithNext: new Set(["A"]),
    };
    // scale-only note, not a chord tone — falls through to tones-base
    const result = getLensEmphasis("scale-only", "lead", false, ctx);
    expect(result).toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
  });

  // -------------------------------------------------------------------------
  // Anticipation: next chord's guide tone in the last-beat window
  // -------------------------------------------------------------------------
  it("marks next-chord guide tones as anticipation in the last beat (beatPosition=3.6, stepDuration=4)", () => {
    // F is the b3 (guide tone) of Dm.
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "F",
      nextGuideTones: new Set(["F"]),
      beatPosition: 3.6,
      stepDurationBeats: 4,
    };
    const result = getLensEmphasis("scale-only", "lead", false, ctx);
    expect(result).toEqual({ glowColor: "orange", radiusBoost: 1.15, opacityBoost: 1 });
  });

  it("anticipation fires even on notes not in the current chord", () => {
    // F is not in Am but is a guide tone of the next Dm.
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "F",
      nextGuideTones: new Set(["F"]),
      commonWithNext: new Set(["A"]),
      beatPosition: 3.1,
      stepDurationBeats: 4,
    };
    const result = getLensEmphasis("note-inactive", "lead", false, ctx);
    expect(result).toEqual({ glowColor: "orange", radiusBoost: 1.15, opacityBoost: 1 });
  });

  it("anticipation takes priority over hold when a note is both common AND a next-chord guide tone", () => {
    // If somehow A is both in commonWithNext AND in nextGuideTones, anticipation wins (highest priority).
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "A",
      commonWithNext: new Set(["A"]),
      nextGuideTones: new Set(["A"]),
      beatPosition: 3.5,
      stepDurationBeats: 4,
    };
    const result = getLensEmphasis("chord-tone-in-scale", "lead", false, ctx);
    expect(result).toEqual({ glowColor: "orange", radiusBoost: 1.15, opacityBoost: 1 });
  });

  it("does NOT mark anticipation outside the last-beat window (beatPosition=2.5)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "F",
      nextGuideTones: new Set(["F"]),
      beatPosition: 2.5,
      stepDurationBeats: 4,
    };
    const result = getLensEmphasis("scale-only", "lead", false, ctx);
    // Not in anticipation window → tones-base (scale-only = dim)
    expect(result).not.toMatchObject({ glowColor: "orange" });
    expect(result).toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
  });

  it("does NOT mark anticipation when stepDurationBeats is 0 (guard against division edge)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "F",
      nextGuideTones: new Set(["F"]),
      beatPosition: 0,
      stepDurationBeats: 0,
    };
    const result = getLensEmphasis("scale-only", "lead", false, ctx);
    expect(result).not.toMatchObject({ glowColor: "orange" });
  });

  it("does NOT mark anticipation exactly at the window boundary (beatPosition=2.999, stepDuration=4)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "F",
      nextGuideTones: new Set(["F"]),
      beatPosition: 2.999,
      stepDurationBeats: 4,
    };
    const result = getLensEmphasis("scale-only", "lead", false, ctx);
    expect(result).not.toMatchObject({ glowColor: "orange" });
  });

  it("DOES mark anticipation exactly at the window boundary (beatPosition=3.0, stepDuration=4)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "F",
      nextGuideTones: new Set(["F"]),
      beatPosition: 3.0,
      stepDurationBeats: 4,
    };
    const result = getLensEmphasis("scale-only", "lead", false, ctx);
    expect(result).toEqual({ glowColor: "orange", radiusBoost: 1.15, opacityBoost: 1 });
  });

  // -------------------------------------------------------------------------
  // Tones-base fallthrough for non-chord, non-common, non-anticipated notes
  // -------------------------------------------------------------------------
  it("falls through to tones-base for scale-only notes (not in any chord)", () => {
    const ctx: LeadLensContext = { ...baseLeadContext, notePc: "G" };
    expect(getLensEmphasis("scale-only", "lead", false, ctx))
      .toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
  });

  it("falls through to full intensity for inactive notes (no glow, no dim)", () => {
    const ctx: LeadLensContext = { ...baseLeadContext, notePc: "G" };
    expect(getLensEmphasis("note-inactive", "lead", false, ctx))
      .toEqual({ radiusBoost: 1, opacityBoost: 1 });
  });

  it("emphasizes guide tones of the current chord (tones-base) when not departing or common", () => {
    // A note is a guide tone of the current chord but is in the common set → hold wins over guide-tone.
    // But if it's NOT in commonWithNext and IS a guide tone of the current chord:
    // departing (step 3) overrides guide-tone (step 4) because chord tones depart.
    // Tones-base guide-tone only fires for non-chord-tone classes.
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "F",
      commonWithNext: new Set<string>(), // no common tones
    };
    // F is scale-only here (not a chord tone in current chord), guide tone flag from semantics
    const result = getLensEmphasis("scale-only", "lead", true /* isGuideTone */, ctx);
    // Falls to tones-base: isGuideTone=true → cyan glow
    expect(result).toEqual({ glowColor: "cyan", radiusBoost: 1.15, opacityBoost: 1 });
  });
});
