import { describe, it, expect } from "vitest";
import { getEmphasis, classifyNote, classifyNoteFromSemantics, getNoteVisuals } from "./semantics";
import type { LeadLensContext } from "./semantics";
import type { NoteSemantics } from "@fretflow/core";
import { RADIUS_SCALE_CHORD_TONE } from "@fretflow/core";

describe("semantics utils", () => {
  describe("getEmphasis — tones-base fallback (no leadContext)", () => {
    it("returns tones-base behavior when no leadContext is provided", () => {
      const res = getEmphasis("chord-root", false);
      expect(res).toEqual({ radiusBoost: 1, opacityBoost: 1 });
    });

    it("boosts guide tones with hold-glow token", () => {
      const res = getEmphasis("chord-tone", true);
      expect(res.glowColor).toBe("var(--note-glow-hold)");
      expect(res.radiusBoost).toBeGreaterThan(1);
    });

    it("renders non-guide chord tones at full intensity (no dimming)", () => {
      const res = getEmphasis("chord-tone-in-scale", false);
      expect(res.radiusBoost).toBe(1);
      expect(res.opacityBoost).toBe(1);
    });

    it("emphasizes guide tones with the hold-glow token and larger radius", () => {
      expect(getEmphasis("chord-tone-in-scale", true)).toEqual({
        glowColor: "var(--note-glow-hold)",
        radiusBoost: 1.15,
        opacityBoost: 1,
      });
    });

    it("emphasizes guide tones regardless of underlying noteClass", () => {
      expect(getEmphasis("chord-tone-outside-scale", true)).toMatchObject({
        glowColor: "var(--note-glow-hold)",
      });
    });

    it("renders non-guide chord tones at full intensity", () => {
      for (const cls of ["chord-root", "chord-tone-in-scale", "chord-tone-outside-scale", "note-diatonic-chord"]) {
        expect(getEmphasis(cls, false)).toEqual({
          radiusBoost: 1,
          opacityBoost: 1,
        });
      }
    });

    it("dims scale-only notes (in scale, not in chord)", () => {
      expect(getEmphasis("scale-only", false)).toEqual({
        radiusBoost: 0.85,
        opacityBoost: 0.7,
      });
      expect(getEmphasis("color-tone", false)).toEqual({
        radiusBoost: 0.85,
        opacityBoost: 0.7,
      });
    });

    it("returns default for inactive notes", () => {
      expect(getEmphasis("note-inactive", false)).toEqual({
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
// getEmphasis — voice-leading emphasis (with leadContext)
// ---------------------------------------------------------------------------

describe("getEmphasis - voice-leading emphasis", () => {
  const baseLeadContext: LeadLensContext = {
    notePc: "A",
    commonWithNext: new Set<string>(),
    nextGuideTones: new Set<string>(),
    beatPosition: 0,
    stepDurationBeats: 4,
  };

  // -------------------------------------------------------------------------
  // Fallback: no leadContext → tones-base behavior
  // -------------------------------------------------------------------------
  it("falls back to tones-base when leadContext is undefined", () => {
    // Guide tone gets hold-glow token.
    expect(getEmphasis("chord-tone-in-scale", true, undefined))
      .toEqual({ glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1 });
    // Scale-only dims.
    expect(getEmphasis("scale-only", false, undefined))
      .toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
    // Default chord tone → full intensity.
    expect(getEmphasis("chord-root", false, undefined))
      .toEqual({ radiusBoost: 1, opacityBoost: 1 });
  });

  // -------------------------------------------------------------------------
  // Hold: common tone with next chord
  // -------------------------------------------------------------------------
  it("marks common-tone chord note as hold (Am→Dm: A is common)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "A",
      commonWithNext: new Set(["A"]),
    };
    const result = getEmphasis("chord-tone-in-scale", false, ctx);
    expect(result).toEqual({ glowColor: "var(--note-glow-hold)", radiusBoost: 1.2, opacityBoost: 1 });
  });

  it("hold applies to chord-root class too (root is a common tone)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "A",
      commonWithNext: new Set(["A"]),
    };
    const result = getEmphasis("chord-root", false, ctx);
    expect(result).toEqual({ glowColor: "var(--note-glow-hold)", radiusBoost: 1.2, opacityBoost: 1 });
  });

  it("hold applies to chord-tone-outside-scale class", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "C",
      commonWithNext: new Set(["C"]),
    };
    const result = getEmphasis("chord-tone-outside-scale", false, ctx);
    expect(result).toEqual({ glowColor: "var(--note-glow-hold)", radiusBoost: 1.2, opacityBoost: 1 });
  });

  // -------------------------------------------------------------------------
  // Departing: current chord tone not in next chord
  // -------------------------------------------------------------------------
  it("marks chord-tone-not-in-common as departing (Am→Dm: C departs)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "C",
      commonWithNext: new Set(["A"]),
    };
    const result = getEmphasis("chord-tone-in-scale", false, ctx);
    expect(result).toEqual({ radiusBoost: 0.95, opacityBoost: 0.85 });
  });

  it("departing overrides guide-tone emphasis (voice-leading > chord-quality)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "C",
      commonWithNext: new Set(["A"]),
    };
    const result = getEmphasis("chord-tone-in-scale", true /* isGuideTone */, ctx);
    expect(result).toEqual({ radiusBoost: 0.95, opacityBoost: 0.85 });
  });

  it("non-chord-tone class does NOT get departing emphasis (only chord tones depart)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "G",
      commonWithNext: new Set(["A"]),
    };
    const result = getEmphasis("scale-only", false, ctx);
    expect(result).toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
  });

  // -------------------------------------------------------------------------
  // Anticipation: next chord's guide tone in the last-beat window
  // -------------------------------------------------------------------------
  it("marks next-chord guide tones as anticipation in the last beat (beatPosition=3.6, stepDuration=4)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "F",
      nextGuideTones: new Set(["F"]),
      beatPosition: 3.6,
      stepDurationBeats: 4,
    };
    const result = getEmphasis("scale-only", false, ctx);
    expect(result).toEqual({ glowColor: "var(--note-glow-anticipation)", radiusBoost: 1.15, opacityBoost: 1 });
  });

  it("anticipation fires even on notes not in the current chord", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "F",
      nextGuideTones: new Set(["F"]),
      commonWithNext: new Set(["A"]),
      beatPosition: 3.1,
      stepDurationBeats: 4,
    };
    const result = getEmphasis("note-inactive", false, ctx);
    expect(result).toEqual({ glowColor: "var(--note-glow-anticipation)", radiusBoost: 1.15, opacityBoost: 1 });
  });

  it("anticipation takes priority over hold when a note is both common AND a next-chord guide tone", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "A",
      commonWithNext: new Set(["A"]),
      nextGuideTones: new Set(["A"]),
      beatPosition: 3.5,
      stepDurationBeats: 4,
    };
    const result = getEmphasis("chord-tone-in-scale", false, ctx);
    expect(result).toEqual({ glowColor: "var(--note-glow-anticipation)", radiusBoost: 1.15, opacityBoost: 1 });
  });

  it("does NOT mark anticipation outside the last-beat window (beatPosition=2.5)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "F",
      nextGuideTones: new Set(["F"]),
      beatPosition: 2.5,
      stepDurationBeats: 4,
    };
    const result = getEmphasis("scale-only", false, ctx);
    expect(result).not.toMatchObject({ glowColor: "var(--note-glow-anticipation)" });
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
    const result = getEmphasis("scale-only", false, ctx);
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
    const result = getEmphasis("scale-only", false, ctx);
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
    const result = getEmphasis("scale-only", false, ctx);
    expect(result).toEqual({ glowColor: "var(--note-glow-anticipation)", radiusBoost: 1.15, opacityBoost: 1 });
  });

  // -------------------------------------------------------------------------
  // Tones-base fallthrough for non-chord, non-common, non-anticipated notes
  // -------------------------------------------------------------------------
  it("falls through to tones-base for scale-only notes (not in any chord)", () => {
    const ctx: LeadLensContext = { ...baseLeadContext, notePc: "G" };
    expect(getEmphasis("scale-only", false, ctx))
      .toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
  });

  it("falls through to full intensity for inactive notes (no glow, no dim)", () => {
    const ctx: LeadLensContext = { ...baseLeadContext, notePc: "G" };
    expect(getEmphasis("note-inactive", false, ctx))
      .toEqual({ radiusBoost: 1, opacityBoost: 1 });
  });

  it("guide tone emphasis fires for non-chord-tone classes when not departing or common", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext,
      notePc: "F",
      commonWithNext: new Set<string>(),
    };
    // F is scale-only (not a chord tone in current chord), guide tone flag from semantics
    const result = getEmphasis("scale-only", true /* isGuideTone */, ctx);
    // Falls to tones-base: isGuideTone=true → hold-glow token
    expect(result).toEqual({ glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1 });
  });

  // -------------------------------------------------------------------------
  // CSS var token references for lens-emphasis glow colors
  // -------------------------------------------------------------------------
  it("uses CSS var references for lens-emphasis glow colors (anticipation path)", () => {
    const leadCtx: LeadLensContext = {
      notePc: "G",
      commonWithNext: new Set<string>(),
      nextGuideTones: new Set(["G"]),
      beatPosition: 3,
      stepDurationBeats: 4,
    };
    const result = getEmphasis("scale-only", false, leadCtx);
    expect(result.glowColor).toBe("var(--note-glow-anticipation)");
  });

  it("uses the hold-glow CSS var on a current chord tone that carries through", () => {
    const leadCtx: LeadLensContext = {
      notePc: "C",
      commonWithNext: new Set(["C"]),
      nextGuideTones: new Set<string>(),
      beatPosition: 0,
      stepDurationBeats: 4,
    };
    const result = getEmphasis("chord-tone-in-scale", false, leadCtx);
    expect(result.glowColor).toBe("var(--note-glow-hold)");
  });
});
