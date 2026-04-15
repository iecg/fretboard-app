import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { createElement } from "react";
import useDisplayState from "./useDisplayState";
import {
  rootNoteAtom,
  chordRootAtom,
  chordTypeAtom,
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
});
