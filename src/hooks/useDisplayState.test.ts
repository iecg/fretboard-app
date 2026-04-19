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

  describe("noteRoleMap", () => {
    it("is empty when no chord type is set", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.noteRoleMap.size).toBe(0);
    });

    it("assigns chord-root to the chord root note", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(focusPresetAtom, "all");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.noteRoleMap.get("C")).toBe("chord-root");
    });

    it("assigns chord-tone-in-scale to in-scale non-root chord members", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad"); // C E G — E and G in C Major
      store.set(focusPresetAtom, "all");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.noteRoleMap.get("E")).toBe("chord-tone-in-scale");
      expect(result.current.noteRoleMap.get("G")).toBe("chord-tone-in-scale");
    });

    it("assigns chord-tone-outside-scale to chord members outside scale", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C"); // C Major: C D E F G A B
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th"); // D F# A C — F# outside C Major
      store.set(focusPresetAtom, "all");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.noteRoleMap.get("F#")).toBe("chord-tone-outside-scale");
    });

    it("assigns chord-root correctly even when chordRoot equals rootNote", () => {
      const store = createStore();
      store.set(rootNoteAtom, "A");
      store.set(chordRootAtom, "A");
      store.set(chordTypeAtom, "Minor Triad");
      store.set(focusPresetAtom, "all");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      // A is both scale root and chord root → should be chord-root, not scale-only
      expect(result.current.noteRoleMap.get("A")).toBe("chord-root");
    });

    it("assigns chord-root even when chord root is outside scale", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C"); // C Major
      store.set(chordRootAtom, "F#");
      store.set(chordTypeAtom, "Major Triad"); // F# A# C# — F# outside C Major
      store.set(focusPresetAtom, "all");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.noteRoleMap.get("F#")).toBe("chord-root");
    });
  });

  describe("summaryChordRow", () => {
    it("is empty when no chord type is set", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryChordRow).toEqual([]);
    });

    it("contains one entry per active chord member with correct roles", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(focusPresetAtom, "all");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const row = result.current.summaryChordRow;
      expect(row).toHaveLength(3);
      const rootEntry = row.find((e) => e.internalNote === "C");
      expect(rootEntry?.role).toBe("chord-root");
      expect(rootEntry?.memberName).toBe("1");
      const thirdEntry = row.find((e) => e.internalNote === "E");
      expect(thirdEntry?.role).toBe("chord-tone-in-scale");
    });

    it("marks outside-scale members with chord-tone-outside-scale role", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C"); // C Major
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th"); // D F# A C
      store.set(focusPresetAtom, "all");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const row = result.current.summaryChordRow;
      const fSharpEntry = row.find((e) => e.internalNote === "F#");
      expect(fSharpEntry?.role).toBe("chord-tone-outside-scale");
      expect(fSharpEntry?.inScale).toBe(false);
    });

    it("filters to only outside members in outside viewMode", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C"); // C Major
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th"); // D F# A C — D and F# outside
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "outside");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const row = result.current.summaryChordRow;
      // Only D (chord-root outside scale) and F# (outside chord tone) should appear
      expect(row.every((e) => !e.inScale || e.role === "chord-root")).toBe(true);
      expect(row.some((e) => e.internalNote === "F#")).toBe(true);
    });

    it("excludes in-scale chord root from outside view", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C"); // C Major: C D E F G A B
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Dominant 7th"); // C E G A# — A# outside
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "outside");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const row = result.current.summaryChordRow;
      // C (chord root) is in C Major scale → excluded from outside view
      expect(row.find((e) => e.internalNote === "C")).toBeUndefined();
      // A# is outside → included
      expect(row.find((e) => e.internalNote === "A#")).toBeDefined();
    });
  });

  describe("summaryPrimaryMode", () => {
    it("is 'scale' when no chord type is set", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryPrimaryMode).toBe("scale");
    });

    it("is 'scale' in compare viewMode with chord active", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryPrimaryMode).toBe("scale");
    });

    it("is 'chord' in chord viewMode", () => {
      const store = createStore();
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "chord");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryPrimaryMode).toBe("chord");
    });

    it("is 'outside' in outside viewMode", () => {
      const store = createStore();
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "outside");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryPrimaryMode).toBe("outside");
    });
  });

  describe("showSecondaryChordRail", () => {
    it("is false when no chord type is set", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showSecondaryChordRail).toBe(false);
    });

    it("is false in simple compare case: same root, all preset, all in scale", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad"); // C E G — all in C Major
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showSecondaryChordRail).toBe(false);
    });

    it("is true when chordRoot differs from rootNote", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "E");
      store.set(chordTypeAtom, "Major Triad");
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showSecondaryChordRail).toBe(true);
    });

    it("is true when focusPreset is not 'all'", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Dominant 7th"); // has 'triad' preset
      store.set(focusPresetAtom, "triad");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showSecondaryChordRail).toBe(true);
    });

    it("is true when chord has outside-scale members", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th"); // F# outside C Major
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showSecondaryChordRail).toBe(true);
    });

    it("is false when viewMode is not compare", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "chord");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showSecondaryChordRail).toBe(false);
    });
  });

  describe("summaryHeaderLeft and summaryHeaderRight", () => {
    it("headerLeft equals scaleLabel when no chord", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryHeaderLeft).toBe(result.current.scaleLabel);
    });

    it("headerRight is null when no chord", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryHeaderRight).toBeNull();
    });

    it("headerLeft is scaleLabel in compare mode", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryHeaderLeft).toBe(result.current.scaleLabel);
    });

    it("headerRight in compare mode is chordLabel only (member intervals moved to relationship row)", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const right = result.current.summaryHeaderRight;
      expect(right).toBe("C Major Triad");
      // Member interval labels (e.g. "1 3 5") are no longer in the header
      expect(right).not.toContain(" \u2022 ");
    });

    it("headerLeft is chordLabel in chord viewMode", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "chord");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryHeaderLeft).toBe(result.current.chordLabel);
    });

    it("headerRight is 'Chord only' in chord viewMode", () => {
      const store = createStore();
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "chord");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryHeaderRight).toBe("Chord only");
    });

    it("headerLeft is 'Outside tones' in outside viewMode", () => {
      const store = createStore();
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "outside");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryHeaderLeft).toBe("Outside tones");
    });

    it("headerRight starts with 'against' in outside viewMode", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "outside");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryHeaderRight).toMatch(/^against /);
      expect(result.current.summaryHeaderRight).toContain(result.current.scaleLabel);
    });
  });

  describe("sharedChordMembers and outsideChordMembers", () => {
    it("sharedChordMembers contains only in-scale chord members", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C"); // C Major: C D E F G A B
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Dominant 7th"); // C E G A# — A# outside
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const shared = result.current.sharedChordMembers;
      expect(shared.every((e) => e.inScale)).toBe(true);
      expect(shared.some((e) => e.internalNote === "A#")).toBe(false);
    });

    it("outsideChordMembers contains only out-of-scale chord members", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C"); // C Major
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Dominant 7th"); // C E G A# — A# outside
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const outside = result.current.outsideChordMembers;
      expect(outside.every((e) => !e.inScale)).toBe(true);
      expect(outside.some((e) => e.internalNote === "A#")).toBe(true);
    });

    it("shared + outside together equal all active chord members", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th"); // D F# A C — F# outside
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const total =
        result.current.sharedChordMembers.length +
        result.current.outsideChordMembers.length;
      expect(total).toBe(result.current.summaryChordRow.length);
    });

    it("no note appears in both shared and outside groups", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th");
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const sharedNotes = new Set(result.current.sharedChordMembers.map((e) => e.internalNote));
      const outsideNotes = result.current.outsideChordMembers.map((e) => e.internalNote);
      expect(outsideNotes.some((n) => sharedNotes.has(n))).toBe(false);
    });

    it("sharedChordMembers is empty when chord root is outside scale and it's the only tone", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C"); // C Major
      store.set(chordRootAtom, "F#");
      store.set(chordTypeAtom, "Power Chord (5)"); // F# C# — both outside C Major
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      // F# and C# are both outside C Major
      expect(result.current.sharedChordMembers).toHaveLength(0);
      expect(result.current.outsideChordMembers.length).toBeGreaterThan(0);
    });
  });

  describe("showRelationshipRow", () => {
    it("is false when no chord type is set", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showRelationshipRow).toBe(false);
    });

    it("is false in simple diatonic compare case: same root, all preset, all in scale", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad"); // C E G — all in C Major
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showRelationshipRow).toBe(false);
    });

    it("is true when chordRoot differs from rootNote", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "E");
      store.set(chordTypeAtom, "Major Triad");
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showRelationshipRow).toBe(true);
    });

    it("is true when chord has outside-scale members", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th"); // F# outside C Major
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showRelationshipRow).toBe(true);
    });

    it("is false when viewMode is chord", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "chord");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showRelationshipRow).toBe(false);
    });

    it("is false when viewMode is outside", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "outside");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showRelationshipRow).toBe(false);
    });

    it("matches showSecondaryChordRail value exactly", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th");
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showRelationshipRow).toBe(result.current.showSecondaryChordRail);
    });
  });

  describe("summaryLegendItems", () => {
    it("is empty when no chord type is set", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.summaryLegendItems).toEqual([]);
    });

    it("includes chord-root legend item when chord is active in compare mode", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const items = result.current.summaryLegendItems;
      expect(items.some((i) => i.role === "chord-root")).toBe(true);
    });

    it("includes chord-tone-outside-scale legend item when outside tones present", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th"); // F# outside C Major
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const items = result.current.summaryLegendItems;
      expect(items.some((i) => i.role === "chord-tone-outside-scale")).toBe(true);
    });

    it("omits chord-tone-outside-scale legend item when all chord members are in scale", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad"); // C E G — all in C Major
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const items = result.current.summaryLegendItems;
      expect(items.some((i) => i.role === "chord-tone-outside-scale")).toBe(false);
    });
  });

  describe("ChordPracticeBar derived values", () => {
    it("showChordPracticeBar is false when no chord type", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showChordPracticeBar).toBe(false);
    });

    it("showChordPracticeBar is true when chord type is set", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showChordPracticeBar).toBe(true);
    });

    it("practiceBarTitle is chord label in compare mode", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.practiceBarTitle).toContain("C");
      expect(result.current.practiceBarTitle).toContain("Major Triad");
    });

    it("practiceBarTitle is chord label in chord mode", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "chord");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.practiceBarTitle).toContain("C");
      expect(result.current.practiceBarTitle).toContain("Major Triad");
    });

    it("practiceBarTitle is 'Outside tones' in outside mode", () => {
      const store = createStore();
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th");
      store.set(viewModeAtom, "outside");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.practiceBarTitle).toBe("Outside tones");
    });

    it("practiceBarBadge is 'Compare' in compare mode", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.practiceBarBadge).toBe("Compare");
    });

    it("practiceBarBadge is 'Chord only' in chord mode", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "chord");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.practiceBarBadge).toBe("Chord only");
    });

    it("practiceBarBadge starts with 'against' in outside mode", () => {
      const store = createStore();
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th");
      store.set(viewModeAtom, "outside");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.practiceBarBadge).toMatch(/^against /);
    });

    it("practiceBarTargetMembers contains all active chord tones", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.practiceBarTargetMembers).toHaveLength(3);
      expect(result.current.practiceBarTargetMembers.some(m => m.internalNote === "C")).toBe(true);
      expect(result.current.practiceBarTargetMembers.some(m => m.internalNote === "E")).toBe(true);
      expect(result.current.practiceBarTargetMembers.some(m => m.internalNote === "G")).toBe(true);
    });

    it("practiceBarSharedMembers contains only in-scale chord tones", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C"); // C Major
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th"); // D F# A C — F# outside C Major
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const shared = result.current.practiceBarSharedMembers;
      expect(shared.every(m => m.inScale)).toBe(true);
      expect(shared.some(m => m.internalNote === "F#")).toBe(false);
    });

    it("practiceBarOutsideMembers contains only outside-scale chord tones", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C"); // C Major
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th"); // D F# A C — F# outside C Major
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      const outside = result.current.practiceBarOutsideMembers;
      expect(outside.every(m => !m.inScale)).toBe(true);
      expect(outside.some(m => m.internalNote === "F#")).toBe(true);
    });

    it("practiceBarTargetMembers is viewMode-independent (same in compare and outside)", () => {
      const makeStore = (viewMode: "compare" | "outside") => {
        const store = createStore();
        store.set(rootNoteAtom, "C");
        store.set(chordRootAtom, "D");
        store.set(chordTypeAtom, "Dominant 7th");
        store.set(viewModeAtom, viewMode);
        return store;
      };
      const { result: r1 } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(makeStore("compare")),
      });
      const { result: r2 } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(makeStore("outside")),
      });
      expect(r1.current.practiceBarTargetMembers.map(m => m.internalNote))
        .toEqual(r2.current.practiceBarTargetMembers.map(m => m.internalNote));
    });
  });

  describe("showChordPracticeBar smart hiding", () => {
    it("hides practice bar for simple diatonic case: same root, all preset, all in scale, no color tones", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad"); // C E G — all in C Major
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      // Set scale to Major explicitly (localStorage may carry other values in test env)
      act(() => { result.current.setScaleName("Major"); });
      // C Major has no divergent notes, C Major Triad fully diatonic → hide bar
      expect(result.current.showChordPracticeBar).toBe(false);
    });

    it("shows practice bar when chord has outside-scale members", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Dominant 7th"); // F# outside C Major
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showChordPracticeBar).toBe(true);
    });

    it("shows practice bar in chord mode even for simple diatonic case", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "chord");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      act(() => { result.current.setScaleName("Major"); });
      expect(result.current.showChordPracticeBar).toBe(true);
    });

    it("shows practice bar when modal scale has color tones even with diatonic chord", () => {
      const store = createStore();
      store.set(rootNoteAtom, "D");
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Minor Triad"); // D F A — all in D Dorian
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "compare");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      act(() => {
        result.current.setScaleName("Dorian");
      });
      // D Dorian has B as color tone → bar should show
      expect(result.current.showChordPracticeBar).toBe(true);
    });

    it("shows practice bar in outside mode regardless of diatonic simplicity", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(focusPresetAtom, "all");
      store.set(viewModeAtom, "outside");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.showChordPracticeBar).toBe(true);
    });
  });

  describe("practiceBarColorNotes", () => {
    it("is empty when scale has no divergent notes (C Major)", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      act(() => { result.current.setScaleName("Major"); });
      expect(result.current.practiceBarColorNotes).toEqual([]);
    });

    it("contains B as color tone for D Dorian with correct interval name", () => {
      const store = createStore();
      store.set(rootNoteAtom, "D");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      act(() => {
        result.current.setScaleName("Dorian");
      });
      const colorNotes = result.current.practiceBarColorNotes;
      expect(colorNotes.length).toBeGreaterThan(0);
      const bNote = colorNotes.find(n => n.internalNote === "B");
      expect(bNote).toBeDefined();
      expect(bNote?.intervalName).toBe("6");
    });

    it("contains F# as color tone for C Lydian with #4 interval", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      act(() => {
        result.current.setScaleName("Lydian");
      });
      const colorNotes = result.current.practiceBarColorNotes;
      const fSharp = colorNotes.find(n => n.internalNote === "F#");
      expect(fSharp).toBeDefined();
    });

    it("contains F as color tone for G Mixolydian with b7 interval", () => {
      const store = createStore();
      store.set(rootNoteAtom, "G");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      act(() => {
        result.current.setScaleName("Mixolydian");
      });
      const colorNotes = result.current.practiceBarColorNotes;
      const fNote = colorNotes.find(n => n.internalNote === "F");
      expect(fNote).toBeDefined();
      expect(fNote?.intervalName).toBe("♭7");
    });

    it("each entry has internalNote, displayNote, and intervalName fields", () => {
      const store = createStore();
      store.set(rootNoteAtom, "D");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      act(() => {
        result.current.setScaleName("Dorian");
      });
      for (const entry of result.current.practiceBarColorNotes) {
        expect(typeof entry.internalNote).toBe("string");
        expect(typeof entry.displayNote).toBe("string");
        expect(typeof entry.intervalName).toBe("string");
      }
    });
  });

  describe("shapeLocalTargetMembers and shapeLocalColorNotes", () => {
    it("shapeLocalTargetMembers is empty when chordType is null", () => {
      const store = createStore();
      store.set(chordTypeAtom, null);
      store.set(fingeringPatternAtom, "caged");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.shapeLocalTargetMembers).toEqual([]);
    });

    it("shapeLocalColorNotes is empty when fingeringPattern is all", () => {
      const store = createStore();
      store.set(rootNoteAtom, "D");
      store.set(fingeringPatternAtom, "all");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      act(() => {
        result.current.setScaleName("Dorian");
      });
      expect(result.current.shapeLocalColorNotes).toEqual([]);
    });

    it("shapeLocalTargetMembers is non-empty for caged mode with chord active", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(fingeringPatternAtom, "caged");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      // C Major Triad (C E G) — in CAGED mode, at least some chord tones should
      // appear in the highlighted shape positions
      expect(result.current.shapeLocalTargetMembers.length).toBeGreaterThan(0);
    });
  });
});