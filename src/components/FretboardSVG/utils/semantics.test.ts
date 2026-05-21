import { describe, it, expect } from "vitest";
import { getLensEmphasis, classifyNote, classifyNoteFromSemantics, getNoteVisuals } from "./semantics";
import type { NoteSemantics } from "@fretflow/core";
import { RADIUS_SCALE_CHORD_TONE } from "@fretflow/core";

describe("semantics utils", () => {
  describe("getLensEmphasis", () => {
    it("returns default emphasis when no lens is active", () => {
      const res = getLensEmphasis("chord-root", undefined, false, false);
      expect(res).toEqual({ radiusBoost: 1, opacityBoost: 1 });
    });

    it("boosts guide tones in tones lens", () => {
      const res = getLensEmphasis("chord-tone", "tones", true, false);
      expect(res.glowColor).toBe("cyan");
      expect(res.radiusBoost).toBeGreaterThan(1);
    });

    it("renders non-guide chord tones at full intensity in tones lens (no dimming)", () => {
      const res = getLensEmphasis("chord-tone-in-scale", "tones", false, false);
      expect(res.radiusBoost).toBe(1);
      expect(res.opacityBoost).toBe(1);
    });

    it("boosts tensions in lead lens", () => {
      const res = getLensEmphasis("chord-tone", "lead", false, true);
      expect(res.glowColor).toBe("orange");
      expect(res.radiusBoost).toBeGreaterThan(1);
    });
  });

  describe("getLensEmphasis - tones lens (Task 4.4)", () => {
    it("emphasizes guide tones with cyan glow and larger radius", () => {
      expect(getLensEmphasis("chord-tone-in-scale", "tones", true, false)).toEqual({
        glowColor: "cyan",
        radiusBoost: 1.15,
        opacityBoost: 1,
      });
    });

    it("emphasizes guide tones regardless of underlying noteClass", () => {
      // Even an outside-scale chord tone that happens to be a guide tone gets emphasis
      expect(getLensEmphasis("chord-tone-outside-scale", "tones", true, false)).toMatchObject({
        glowColor: "cyan",
      });
    });

    it("renders non-guide chord tones at full intensity (no dimming)", () => {
      // chord-root, chord-tone-in-scale, chord-tone-outside-scale, note-diatonic-chord --- none should dim
      for (const cls of ["chord-root", "chord-tone-in-scale", "chord-tone-outside-scale", "note-diatonic-chord"]) {
        expect(getLensEmphasis(cls, "tones", false, false)).toEqual({
          radiusBoost: 1,
          opacityBoost: 1,
        });
      }
    });

    it("dims scale-only notes (in scale, not in chord)", () => {
      expect(getLensEmphasis("scale-only", "tones", false, false)).toEqual({
        radiusBoost: 0.85,
        opacityBoost: 0.7,
      });
      expect(getLensEmphasis("color-tone", "tones", false, false)).toEqual({
        radiusBoost: 0.85,
        opacityBoost: 0.7,
      });
    });

    it("returns default for inactive notes", () => {
      expect(getLensEmphasis("note-inactive", "tones", false, false)).toEqual({
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

    // Phase 04: note-diatonic-chord branch
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

    // Phase 04: note-diatonic-chord visuals
    it("returns squircle + RADIUS_SCALE_CHORD_TONE for note-diatonic-chord", () => {
      const res = getNoteVisuals("note-diatonic-chord");
      expect(res.noteShape).toBe("squircle");
      expect(res.radiusScale).toBe(RADIUS_SCALE_CHORD_TONE);
    });
  });
});
