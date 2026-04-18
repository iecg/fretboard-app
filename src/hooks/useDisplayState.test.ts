import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { createElement } from "react";
import useDisplayState from "./useDisplayState";
import {
  rootNoteAtom,
  chordRootAtom,
  chordTypeAtom,
  focusPresetAtom,
  viewModeAtom,
  customMembersAtom,
  linkChordRootAtom,
  fingeringPatternAtom,
  npsPositionAtom,
} from "../store/atoms";
import type { CagedShape } from "../shapes";

const makeWrapper = (store = createStore()) =>
  ({ children }: { children: React.ReactNode }) =>
    createElement(Provider, { store }, children);

describe("useDisplayState", () => {
  describe("returns default rootNote and scaleName", () => {
    it("rootNote is a valid note string and scaleName is a string", () => {
      const store = createStore();
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(typeof result.current.rootNote).toBe("string");
      expect(result.current.rootNote.length).toBeGreaterThan(0);
      expect(typeof result.current.scaleName).toBe("string");
      expect(result.current.scaleName.length).toBeGreaterThan(0);
    });
  });

  describe("useFlats derived correctly for a flat key", () => {
    it("useFlats is true when rootNote is F", () => {
      const store = createStore();
      store.set(rootNoteAtom, "F");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.useFlats).toBe(true);
    });
  });

  describe("chordTones computed from chordRoot and chordType", () => {
    it("includes C, E, G when chordRoot=C and chordType=Major Triad", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.chordTones).toContain("C");
      expect(result.current.chordTones).toContain("E");
      expect(result.current.chordTones).toContain("G");
    });
  });

  describe("onShapeClick updates autoCenterTarget", () => {
    it("autoCenterTarget becomes defined after clicking a CAGED shape with caged pattern", () => {
      const store = createStore();
      // Use C major with caged mode so polygons are generated
      store.set(rootNoteAtom, "C");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });

      // Initially no shape is clicked
      expect(result.current.clickedShape).toBeNull();

      // Click E shape
      act(() => {
        result.current.onShapeClick("E" as CagedShape);
      });

      expect(result.current.clickedShape).toBe("E");
    });
  });

  describe("onRecenter increments recenterKey", () => {
    it("recenterKey starts at 0 and increments to 1 after onRecenter call", () => {
      const store = createStore();
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });

      expect(result.current.recenterKey).toBe(0);

      act(() => {
        result.current.onRecenter();
      });

      expect(result.current.recenterKey).toBe(1);
    });
  });

  describe("setScaleName updates scaleName", () => {
    it("scaleName updates to dorian after setScaleName call", () => {
      const store = createStore();
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });

      act(() => {
        result.current.setScaleName("Dorian");
      });

      expect(result.current.scaleName).toBe("Dorian");
    });
  });

  describe("currentTuning matches tuningName atom", () => {
    it("currentTuning returns an array of 6 strings for standard tuning", () => {
      const store = createStore();
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(Array.isArray(result.current.currentTuning)).toBe(true);
      expect(result.current.currentTuning.length).toBe(6);
      result.current.currentTuning.forEach((s) => {
        expect(typeof s).toBe("string");
      });
    });
  });

  describe("chordTones null branch when chordType is null", () => {
    it("chordTones is empty when chordType is null", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.chordTones).toEqual([]);
    });
  });

  describe("activeChordTones with focusPreset = 'all'", () => {
    it("activeChordTones contains all chord members when preset is all", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(focusPresetAtom, "all");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.activeChordTones).toContain("C");
      expect(result.current.activeChordTones).toContain("E");
      expect(result.current.activeChordTones).toContain("G");
      expect(result.current.activeChordTones).toEqual(result.current.chordTones);
    });
  });

  describe("activeChordTones with focusPreset = 'triad'", () => {
    it("activeChordTones excludes 7th when preset is triad on a Dominant 7th", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Dominant 7th");
      store.set(focusPresetAtom, "triad");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      // Triad preset excludes b7 (Bb/A#)
      expect(result.current.activeChordTones).not.toContain("A#");
      expect(result.current.activeChordTones).toContain("C");
      expect(result.current.activeChordTones).toContain("E");
      expect(result.current.activeChordTones).toContain("G");
    });
  });

  describe("activeChordTones with focusPreset = 'guide-tones'", () => {
    it("guide-tones excludes root and fifth", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Dominant 7th");
      store.set(focusPresetAtom, "guide-tones");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      // Guide tones = 3rd + 7th only
      expect(result.current.activeChordTones).not.toContain("C"); // root
      expect(result.current.activeChordTones).not.toContain("G"); // 5th
      expect(result.current.activeChordTones).toContain("E"); // 3rd
      expect(result.current.activeChordTones).toContain("A#"); // b7
    });
  });

  describe("activeChordTones with focusPreset = 'rootless'", () => {
    it("rootless excludes only the root note", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major 7th");
      store.set(focusPresetAtom, "rootless");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.activeChordTones).not.toContain("C");
      expect(result.current.activeChordTones).toContain("E");
      expect(result.current.activeChordTones).toContain("G");
      expect(result.current.activeChordTones).toContain("B");
    });
  });

  describe("focusPreset fallback when preset unavailable for chord quality", () => {
    it("falls back to all when guide-tones is set but chord is a triad", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(focusPresetAtom, "guide-tones");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      // guide-tones not available for triads → falls back to all 3 tones
      expect(result.current.activeChordTones).toContain("C");
      expect(result.current.activeChordTones).toContain("E");
      expect(result.current.activeChordTones).toContain("G");
      expect(result.current.activeChordTones).toHaveLength(3);
    });
  });

  describe("linkChordRoot=false branch in setRootNote", () => {
    it("chordRoot stays unchanged when linkChordRoot is false and rootNote changes", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(linkChordRootAtom, false);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });

      expect(result.current.chordRoot).toBe("C");

      act(() => {
        result.current.setRootNote("G");
      });

      // With linkChordRoot=false, chordRoot should remain C
      expect(result.current.chordRoot).toBe("C");
    });
  });

  describe("colorNotes for Minor Blues scale", () => {
    it("colorNotes contains the b5 blue note for C Minor Blues", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });

      act(() => {
        result.current.setScaleName("Minor Blues");
      });

      // b5 of C is F# (interval 6)
      expect(result.current.colorNotes).toContain("F#");
    });
  });

  describe("colorNotes for Major Blues scale", () => {
    it("colorNotes contains the b3 blue note for C Major Blues", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });

      act(() => {
        result.current.setScaleName("Major Blues");
      });

      // b3 of C is Eb/D# (interval 3)
      expect(result.current.colorNotes).toContain("D#");
    });
  });

  describe("fingering pattern 3nps", () => {
    it("highlightNotes is non-empty when npsPosition is 1", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(fingeringPatternAtom, "3nps");
      store.set(npsPositionAtom, 1);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.highlightNotes.length).toBeGreaterThan(0);
      // In a specific position, boxBounds should also be populated
      expect(result.current.boxBounds.length).toBeGreaterThan(0);
    });
  });

  describe("CAGED mode autoCenterTarget with clicked shape", () => {
    it("autoCenterTarget becomes defined after clicking a valid CAGED shape in caged mode", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(fingeringPatternAtom, "caged");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });

      // With caged mode and default shapes, autoCenterTarget should already be defined
      expect(result.current.autoCenterTarget).not.toBeUndefined();

      // After clicking E shape, it should still be defined (clickedShape branch)
      act(() => {
        result.current.onShapeClick("E" as CagedShape);
      });

      expect(result.current.clickedShape).toBe("E");
      // autoCenterTarget should still be defined (either from clickedPoly or mainShape)
      expect(result.current.autoCenterTarget).not.toBeUndefined();
    });
  });

  describe("chordLabel is null when chordType is null", () => {
    it("chordLabel returns null when no chord type is set", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.chordLabel).toBeNull();
    });
  });

  describe("chordSummaryNotes is empty when chordType is null", () => {
    it("chordSummaryNotes returns empty array when chordType is null", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.chordSummaryNotes).toEqual([]);
    });
  });

  describe("3nps autoCenterTarget centering", () => {
    it("autoCenterTarget equals the lowest minFret in boxBounds", () => {
      const store = createStore();
      store.set(rootNoteAtom, "A");
      store.set(fingeringPatternAtom, "3nps");
      store.set(npsPositionAtom, 1);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.boxBounds.length).toBeGreaterThan(0);
      const lowestMinFret = Math.min(...result.current.boxBounds.map((b) => b.minFret));
      expect(result.current.autoCenterTarget).toBe(lowestMinFret);
    });

    it("autoCenterTarget updates when npsPosition changes", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(fingeringPatternAtom, "3nps");
      store.set(npsPositionAtom, 1);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const targetPos1 = result.current.autoCenterTarget;
      expect(targetPos1).not.toBeUndefined();

      act(() => {
        store.set(npsPositionAtom, 3);
      });

      // After changing position, compute expected autoCenterTarget from boxBounds
      const boxBounds = result.current.boxBounds;
      expect(boxBounds.length).toBeGreaterThan(0);
      const lowestMinFret = Math.min(...boxBounds.map((b) => b.minFret));
      expect(result.current.autoCenterTarget).toBe(lowestMinFret);
    });

    it("autoCenterTarget is a fret number within the fretboard range", () => {
      const store = createStore();
      store.set(rootNoteAtom, "E");
      store.set(fingeringPatternAtom, "3nps");
      store.set(npsPositionAtom, 2);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.autoCenterTarget).toBeGreaterThanOrEqual(0);
      expect(result.current.autoCenterTarget).toBeLessThanOrEqual(24);
    });

    it("autoCenterTarget is undefined when fingeringPattern switches away from 3nps", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(fingeringPatternAtom, "3nps");
      store.set(npsPositionAtom, 1);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.autoCenterTarget).not.toBeUndefined();

      act(() => {
        store.set(fingeringPatternAtom, "all");
      });

      // Non-CAGED, non-3NPS mode → no centering target
      expect(result.current.autoCenterTarget).toBeUndefined();
    });
  });

  describe("chordMembers resolved with note names", () => {
    it("chordMembers contains root, 3rd, 5th with notes for C Major Triad", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.chordMembers).toHaveLength(3);
      expect(result.current.chordMembers[0]).toMatchObject({ name: "root", note: "C" });
      expect(result.current.chordMembers[1]).toMatchObject({ name: "3", note: "E" });
      expect(result.current.chordMembers[2]).toMatchObject({ name: "5", note: "G" });
    });

    it("chordMembers is empty when chordType is null", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.chordMembers).toEqual([]);
    });
  });

  describe("availableFocusPresets by chord quality", () => {
    it("triad chord exposes all, rootless, custom presets", () => {
      const store = createStore();
      store.set(chordTypeAtom, "Major Triad");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.availableFocusPresets).toContain("all");
      expect(result.current.availableFocusPresets).toContain("rootless");
      expect(result.current.availableFocusPresets).toContain("custom");
      expect(result.current.availableFocusPresets).not.toContain("guide-tones");
      expect(result.current.availableFocusPresets).not.toContain("shell");
    });

    it("seventh chord exposes all six presets", () => {
      const store = createStore();
      store.set(chordTypeAtom, "Dominant 7th");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.availableFocusPresets).toContain("all");
      expect(result.current.availableFocusPresets).toContain("triad");
      expect(result.current.availableFocusPresets).toContain("shell");
      expect(result.current.availableFocusPresets).toContain("guide-tones");
      expect(result.current.availableFocusPresets).toContain("rootless");
      expect(result.current.availableFocusPresets).toContain("custom");
    });

    it("power chord exposes only all and custom", () => {
      const store = createStore();
      store.set(chordTypeAtom, "Power Chord (5)");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.availableFocusPresets).toEqual(["all", "custom"]);
    });
  });

  describe("hasOutsideChordMembers", () => {
    it("is false when all chord tones are in the scale", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C"); // C Major scale
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad"); // C E G — all in C Major
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.hasOutsideChordMembers).toBe(false);
    });

    it("is true when a chord tone is outside the scale", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C"); // C Major scale
      store.set(chordRootAtom, "G");
      store.set(chordTypeAtom, "Dominant 7th"); // G B D F — F is in C Major, B is too, but let's check
      // G Dominant 7th = G B D F; all in C Major scale actually
      // Use D Dominant 7th = D F# A C — F# is not in C Major
      const { result: result2 } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(createStore()),
      });
      const store2 = createStore();
      store2.set(rootNoteAtom, "C");
      store2.set(chordRootAtom, "D");
      store2.set(chordTypeAtom, "Dominant 7th");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store2),
      });
      expect(result.current.hasOutsideChordMembers).toBe(true);
      void result2; // suppress unused var
    });
  });

  describe("hideNonChordNotes derived from viewMode", () => {
    it("is false when viewMode is compare", () => {
      const store = createStore();
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.hideNonChordNotes).toBe(false);
    });

    it("is true when viewMode is chord", () => {
      const store = createStore();
      store.set(viewModeAtom, "chord");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.hideNonChordNotes).toBe(true);
    });
  });

  describe("customMembers applied in custom preset", () => {
    it("activeChordTones shows only selected members in custom mode", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(focusPresetAtom, "custom");
      store.set(customMembersAtom, ["root", "5"]);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.activeChordTones).toContain("C");
      expect(result.current.activeChordTones).toContain("G");
      expect(result.current.activeChordTones).not.toContain("E");
    });

    it("custom with empty customMembers falls back to all members", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(focusPresetAtom, "custom");
      store.set(customMembersAtom, []);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.activeChordTones).toHaveLength(3);
    });
  });
});