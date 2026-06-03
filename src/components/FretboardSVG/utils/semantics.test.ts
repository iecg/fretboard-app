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
      const res = classifyNote(true, false, false, true, false, false, true);
      expect(res).toBe("key-tonic");
    });

    it("classifies chord-root correctly with chord overlay", () => {
      const res = classifyNote(false, true, false, true, true, true, true);
      expect(res).toBe("chord-root");
    });

    it("chord-root in-shape but out-of-voicing-range still returns chord-root", () => {
      // isChordRootNote: true, isChordTone: true, isInActiveShape: true,
      // isHighlighted: true — voicing range is no longer part of the signature.
      const res = classifyNote(
        /* isScaleRoot */ false,
        /* isChordRootNote */ true,
        /* isColorNote */ false,
        /* isHighlighted */ true,
        /* isChordTone */ true,
        /* hasChordOverlay */ true,
        /* isInActiveShape */ true,
      );
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
      const res = classifyNoteFromSemantics(sem, true, true, true);
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
      const res = classifyNoteFromSemantics(sem, true, true, false);
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
      const res = classifyNoteFromSemantics(sem, true, true, false);
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
      const res = classifyNoteFromSemantics(sem, true, true, false);
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
      const res = classifyNoteFromSemantics(sem, false, false, true);
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
      const res = classifyNoteFromSemantics(sem, true, true, false);
      expect(res).toBe("chord-tone-in-scale");
    });

    it("classifies in-shape chord tones outside the voicing range as chord-tone (3NPS bug fix)", () => {
      // Repros the 3NPS bug: a fret position sits inside the active 3NPS shape
      // (isInActiveShape: true), its pitch class is a chord tone (sem.isChordTone),
      // it's in the active scale (sem.isInScale), the user has a chord overlay
      // active (hasChordOverlay: true), but the chord-voicing engine's range
      // constraint excludes it (isChordInRange: false). The expected behavior
      // is to still classify it as a chord-tone-in-scale, not note-inactive.
      const sem: NoteSemantics = {
        isScaleRoot: false,
        isChordRoot: false,
        isChordTone: true,
        isInScale: true,
        isColorTone: false,
        isGuideTone: false,
        isTension: false,
        isDiatonicChord: false,
      };
      const res = classifyNoteFromSemantics(
        sem,
        /* isInActiveShape */ true,
        /* hasChordOverlay */ true,
        /* isHighlighted */ true,
      );
      expect(res).toBe("chord-tone-in-scale");
    });

    it("chord-root in-shape but out-of-voicing-range still returns chord-root", () => {
      // Out-of-scale chord tone that is the chord root: must be classified as
      // chord-root regardless of whether it falls within the voicing range.
      const sem: NoteSemantics = {
        isScaleRoot: false,
        isChordRoot: true,
        isChordTone: true,
        isInScale: false,
        isColorTone: false,
        isGuideTone: false,
        isTension: false,
        isDiatonicChord: false,
      };
      const res = classifyNoteFromSemantics(
        sem,
        /* isInActiveShape */ true,
        /* hasChordOverlay */ true,
        /* isHighlighted */ true,
      );
      expect(res).toBe("chord-root");
    });

    it("note-diatonic-chord in-shape but out-of-voicing-range still returns note-diatonic-chord", () => {
      // A diatonic chord tone that the voicing range excludes must still be
      // highlighted as note-diatonic-chord inside the 3NPS shape.
      const sem: NoteSemantics = {
        isScaleRoot: false,
        isChordRoot: false,
        isChordTone: true,
        isInScale: true,
        isColorTone: false,
        isGuideTone: false,
        isTension: false,
        isDiatonicChord: true,
      };
      const res = classifyNoteFromSemantics(
        sem,
        /* isInActiveShape */ true,
        /* hasChordOverlay */ true,
        /* isHighlighted */ true,
      );
      expect(res).toBe("note-diatonic-chord");
    });

    it("chord-tone-outside-scale in-shape but out-of-voicing-range still returns chord-tone-outside-scale", () => {
      // e.g. the b7 of a dominant 7th chord: not diatonic, not highlighted,
      // inside the 3NPS shape but outside the voicing's narrower range window.
      // The spec contract says it must receive a chord-tone class.
      const sem: NoteSemantics = {
        isScaleRoot: false,
        isChordRoot: false,
        isChordTone: true,
        isInScale: false,
        isColorTone: false,
        isGuideTone: false,
        isTension: false,
        isDiatonicChord: false,
      };
      const res = classifyNoteFromSemantics(
        sem,
        /* isInActiveShape */ true,
        /* hasChordOverlay */ true,
        /* isHighlighted */ false,
      );
      expect(res).toBe("chord-tone-outside-scale");
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
    nextGuideToneLabels: new Map<string, string>(),
    nextChordTones: new Set<string>(),
    incomingTones: new Set<string>(),
    departingTones: new Set<string>(),
    leadInActive: true,
  };

  it("falls back to tones-base when leadContext is undefined", () => {
    expect(getEmphasis("chord-tone-in-scale", true, undefined))
      .toEqual({ glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1 });
    expect(getEmphasis("scale-only", false, undefined))
      .toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
    expect(getEmphasis("chord-root", false, undefined))
      .toEqual({ radiusBoost: 1, opacityBoost: 1 });
  });

  it("marks a next-chord guide tone as 'guide-target' with full opacity and NO size bloom", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "B",
      nextGuideTones: new Set(["B"]),
      nextGuideToneLabels: new Map([["B", "3"]]),
    };
    // scale-only rests at radius 0.85; the target keeps that size (no bloom),
    // is brought to full opacity, and gets the ring hue + role + label.
    expect(getEmphasis("scale-only", false, ctx)).toEqual({
      glowColor: "var(--note-incoming)", radiusBoost: 0.85, opacityBoost: 1,
      transitionRole: "guide-target", guideTargetLabel: "3",
    });
  });

  it("guide-target fires regardless of the underlying noteClass", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "F", nextGuideTones: new Set(["F"]),
    };
    expect(getEmphasis("note-inactive", false, ctx).transitionRole).toBe("guide-target");
  });

  it("a non-target scale note is UNCHANGED during lead-in (no dim)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "C", nextGuideTones: new Set(["B"]),
    };
    expect(getEmphasis("scale-only", false, ctx)).toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
  });

  it("a non-target chord tone is UNCHANGED during lead-in (no dim)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "C", nextGuideTones: new Set(["B"]),
    };
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({ radiusBoost: 1, opacityBoost: 1 });
  });

  it("a held common tone keeps its hold glow DURING the lead-in (no flicker)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "A",
      commonWithNext: new Set(["A"]), nextGuideTones: new Set(["B"]),
    };
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({
      glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1,
    });
  });

  it("does NOT dim when there are no targets (empty guide set)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "C", nextGuideTones: new Set<string>(),
    };
    // Falls through to the base model: scale-only keeps its resting 0.7 — no dim.
    expect(getEmphasis("scale-only", false, ctx)).toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
  });

  it("outside the lead-in window, a held common tone keeps a static hold glow (no role)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "A", commonWithNext: new Set(["A"]), leadInActive: false,
    };
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({
      glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1,
    });
  });

  it("outside the lead-in window, a guide tone produces no role", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "B", nextGuideTones: new Set(["B"]), leadInActive: false,
    };
    expect(getEmphasis("note-inactive", false, ctx).transitionRole).toBeUndefined();
  });

});
