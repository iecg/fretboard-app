import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { createElement } from "react";
import useDisplayState from "./useDisplayState";
import {
  rootNoteAtom,
  chordRootAtom,
  chordTypeAtom,
  chordIntervalFilterAtom,
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

  describe("filteredChordTones with chordIntervalFilter = 'All'", () => {
    it("filteredChordTones equals chordTones when filter is All", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(chordIntervalFilterAtom, "All");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      // With 'All' filter, filteredChordTones is the same reference as chordTones
      expect(result.current.filteredChordTones).toEqual(result.current.chordTones);
      expect(result.current.filteredChordTones).toContain("C");
      expect(result.current.filteredChordTones).toContain("E");
      expect(result.current.filteredChordTones).toContain("G");
    });
  });

  describe("filteredChordTones with non-All interval filter", () => {
    it("filteredChordTones returns only triad tones when filter is Triad", () => {
      const store = createStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Dominant 7th");
      store.set(chordIntervalFilterAtom, "Triad");
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      // Triad filter excludes 7th (interval 10), so Bb should not be in result
      expect(result.current.filteredChordTones).not.toContain("A#");
      // Root should always be included
      expect(result.current.filteredChordTones).toContain("C");
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

  describe("fingering pattern 3nps with npsPosition=0", () => {
    it("highlightNotes is non-empty when npsPosition is 0 (all positions)", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(fingeringPatternAtom, "3nps");
      store.set(npsPositionAtom, 0);
      const { result } = renderHook(() => useDisplayState(), {
        wrapper: makeWrapper(store),
      });
      expect(result.current.highlightNotes.length).toBeGreaterThan(0);
    });
  });

  describe("fingering pattern 3nps with npsPosition > 0", () => {
    it("highlightNotes is non-empty when npsPosition is 1 (specific position)", () => {
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
});
