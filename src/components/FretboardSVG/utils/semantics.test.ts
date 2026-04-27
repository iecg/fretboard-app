import { describe, it, expect } from "vitest";
import { getLensEmphasis, classifyNote, classifyNoteFromSemantics, getNoteVisuals } from "./semantics";
import type { NoteSemantics } from "../../../core/theory";
import { RADIUS_SCALE_CHORD_TONE } from "../../../core/constants";

describe("semantics utils", () => {
  describe("getLensEmphasis", () => {
    it("returns default emphasis when no lens is active", () => {
      const res = getLensEmphasis("chord-root", undefined, false, false);
      expect(res).toEqual({ radiusBoost: 1, opacityBoost: 1 });
    });

    it("boosts guide tones in guide-tones lens", () => {
      const res = getLensEmphasis("chord-tone", "guide-tones", true, false);
      expect(res.glowColor).toBe("cyan");
      expect(res.radiusBoost).toBeGreaterThan(1);
    });

    it("dims non-guide chord tones in guide-tones lens", () => {
      const res = getLensEmphasis("chord-tone", "guide-tones", false, false);
      expect(res.radiusBoost).toBeLessThan(1);
      expect(res.opacityBoost).toBeLessThan(1);
    });

    it("boosts tensions in tension lens", () => {
      const res = getLensEmphasis("chord-tone", "tension", false, true);
      expect(res.glowColor).toBe("orange");
      expect(res.radiusBoost).toBeGreaterThan(1);
    });
  });

  describe("classifyNote", () => {
    it("classifies key-tonic correctly without chord overlay", () => {
      const res = classifyNote(true, false, false, true, false, false, true, true, [], [], 0);
      expect(res).toBe("key-tonic");
    });

    it("classifies chord-root correctly with chord overlay", () => {
      const res = classifyNote(false, true, false, true, true, true, true, true, [], [], 0);
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
      const res = classifyNoteFromSemantics(sem, true, true, true, true, [], [], 0);
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
      const res = classifyNoteFromSemantics(sem, true, true, true, false, [], [], 0);
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
      const res = classifyNoteFromSemantics(sem, true, true, true, false, [], [], 0);
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
      const res = classifyNoteFromSemantics(sem, true, true, true, false, [], [], 0);
      expect(res).toBe("chord-tone-in-scale");
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
      const res = classifyNoteFromSemantics(sem, true, true, true, false, [], [], 0);
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
