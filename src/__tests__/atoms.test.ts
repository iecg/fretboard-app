// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createStore, type Atom } from "jotai";
import { RESET } from "jotai/utils";
import {
  rootNoteAtom,
  scaleNameAtom,
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  cagedShapesAtom,
  fingeringPatternAtom,
  displayFormatAtom,
  shapeLabelsAtom,
  isMutedAtom,
  fretStartAtom,
  fretEndAtom,
  fretZoomAtom,
  tuningNameAtom,
  accidentalModeAtom,
  mobileTabAtom,
  npsPositionAtom,
  hideNonChordNotesAtom,
  chordFretSpreadAtom,
  chordIntervalFilterAtom,
  setRootNoteAtom,
  resetAtom,
} from "../store/atoms";
import { CAGED_SHAPES } from "../shapes";

function makeStore() {
  return createStore();
}

// Trigger onMount for an atom so atomWithStorage reads from localStorage.
// Returns cleanup (unsubscribe) function.
function mount<T>(
  store: ReturnType<typeof createStore>,
  atom: Atom<T>,
): () => void {
  return store.sub(atom, () => {});
}

describe("atoms", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("rawStringStorage (via rootNoteAtom)", () => {
    it("reads existing localStorage value on mount", () => {
      localStorage.setItem("rootNote", "G");
      const store = makeStore();
      const unsub = mount(store, rootNoteAtom);
      expect(store.get(rootNoteAtom)).toBe("G");
      unsub();
    });

    it("writes default to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, rootNoteAtom);
      expect(localStorage.getItem("rootNote")).toBe("C");
      unsub();
    });

    it("writes new value via setItem", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "D");
      expect(localStorage.getItem("rootNote")).toBe("D");
    });

    it("removes localStorage key on RESET", () => {
      localStorage.setItem("rootNote", "G");
      const store = makeStore();
      store.set(rootNoteAtom, RESET);
      expect(localStorage.getItem("rootNote")).toBeNull();
    });
  });

  describe("booleanStorage (via isMutedAtom)", () => {
    it('reads "true" as true', () => {
      localStorage.setItem("isMuted", "true");
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(store.get(isMutedAtom)).toBe(true);
      unsub();
    });

    it('reads "false" as false', () => {
      localStorage.setItem("isMuted", "false");
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(store.get(isMutedAtom)).toBe(false);
      unsub();
    });

    it("writes default false to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(localStorage.getItem("isMuted")).toBe("false");
      unsub();
    });

    it("writes boolean as string via setItem", () => {
      const store = makeStore();
      store.set(isMutedAtom, true);
      expect(localStorage.getItem("isMuted")).toBe("true");
    });

    it("removes localStorage key on RESET", () => {
      localStorage.setItem("isMuted", "true");
      const store = makeStore();
      store.set(isMutedAtom, RESET);
      expect(localStorage.getItem("isMuted")).toBeNull();
    });
  });

  describe("numberStorage (via fretZoomAtom)", () => {
    it("reads numeric string as number", () => {
      localStorage.setItem("fretZoom", "150");
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(150);
      unsub();
    });

    it("writes default to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(localStorage.getItem("fretZoom")).toBe("100");
      unsub();
    });

    it("writes number as string via setItem", () => {
      const store = makeStore();
      store.set(fretZoomAtom, 200);
      expect(localStorage.getItem("fretZoom")).toBe("200");
    });

    it("removes localStorage key on RESET", () => {
      localStorage.setItem("fretZoom", "200");
      const store = makeStore();
      store.set(fretZoomAtom, RESET);
      expect(localStorage.getItem("fretZoom")).toBeNull();
    });
  });

  describe("mobileTabStorage", () => {
    it("migrates legacy settings tab values to fretboard", () => {
      localStorage.setItem("mobileTab", "settings");
      const store = makeStore();
      const unsub = mount(store, mobileTabAtom);

      expect(store.get(mobileTabAtom)).toBe("fretboard");
      expect(localStorage.getItem("mobileTab")).toBe("fretboard");

      unsub();
    });

    it("keeps valid stored tab values unchanged", () => {
      localStorage.setItem("mobileTab", "fretboard");
      const store = makeStore();
      const unsub = mount(store, mobileTabAtom);

      expect(store.get(mobileTabAtom)).toBe("fretboard");
      expect(localStorage.getItem("mobileTab")).toBe("fretboard");

      unsub();
    });

    it("falls back to key for invalid stored tab values", () => {
      localStorage.setItem("mobileTab", "invalid-tab");
      const store = makeStore();
      const unsub = mount(store, mobileTabAtom);

      expect(store.get(mobileTabAtom)).toBe("key");
      expect(localStorage.getItem("mobileTab")).toBe("key");

      unsub();
    });
  });

  describe("chordTypeStorage", () => {
    it("reads empty string as null", () => {
      localStorage.setItem("chordType", "");
      const store = makeStore();
      const unsub = mount(store, chordTypeAtom);
      expect(store.get(chordTypeAtom)).toBeNull();
      unsub();
    });

    it("reads non-empty string as chord type", () => {
      localStorage.setItem("chordType", "Major Triad");
      const store = makeStore();
      const unsub = mount(store, chordTypeAtom);
      expect(store.get(chordTypeAtom)).toBe("Major Triad");
      unsub();
    });

    it("writes default empty string to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, chordTypeAtom);
      expect(localStorage.getItem("chordType")).toBe("");
      unsub();
    });

    it("writes null as empty string via setItem", () => {
      const store = makeStore();
      store.set(chordTypeAtom, null);
      expect(localStorage.getItem("chordType")).toBe("");
    });

    it("writes chord type string via setItem", () => {
      const store = makeStore();
      store.set(chordTypeAtom, "Minor 7th");
      expect(localStorage.getItem("chordType")).toBe("Minor 7th");
    });
  });

  describe("cagedShapesStorage", () => {
    it("reads JSON array as Set", () => {
      localStorage.setItem("cagedShapes", JSON.stringify(["C", "A"]));
      const store = makeStore();
      const unsub = mount(store, cagedShapesAtom);
      const shapes = store.get(cagedShapesAtom);
      expect(shapes).toBeInstanceOf(Set);
      expect(shapes.has("C")).toBe(true);
      expect(shapes.has("A")).toBe(true);
      expect(shapes.has("G")).toBe(false);
      unsub();
    });

    it("falls back to default Set on invalid JSON", () => {
      localStorage.setItem("cagedShapes", "not-valid-json{{{");
      const store = makeStore();
      const unsub = mount(store, cagedShapesAtom);
      const shapes = store.get(cagedShapesAtom);
      expect(shapes).toBeInstanceOf(Set);
      expect(shapes.size).toBe(CAGED_SHAPES.length);
      unsub();
    });

    it("writes default JSON array to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, cagedShapesAtom);
      const stored = localStorage.getItem("cagedShapes");
      expect(JSON.parse(stored!)).toEqual(CAGED_SHAPES);
      unsub();
    });

    it("writes Set as JSON array via setItem", () => {
      const store = makeStore();
      store.set(cagedShapesAtom, new Set(["C", "G"] as const));
      const stored = localStorage.getItem("cagedShapes");
      expect(JSON.parse(stored!)).toEqual(["C", "G"]);
    });

    it("removes localStorage key on RESET", () => {
      localStorage.setItem("cagedShapes", JSON.stringify(["C"]));
      const store = makeStore();
      store.set(cagedShapesAtom, RESET);
      expect(localStorage.getItem("cagedShapes")).toBeNull();
    });
  });

  describe("setRootNoteAtom", () => {
    it("sets rootNote", () => {
      const store = makeStore();
      store.set(setRootNoteAtom, "G");
      expect(store.get(rootNoteAtom)).toBe("G");
    });

    it("syncs chordRoot when linkChordRoot is true", () => {
      const store = makeStore();
      store.set(linkChordRootAtom, true);
      store.set(setRootNoteAtom, "G");
      expect(store.get(chordRootAtom)).toBe("G");
    });

    it("does not sync chordRoot when linkChordRoot is false", () => {
      const store = makeStore();
      store.set(chordRootAtom, "D");
      store.set(linkChordRootAtom, false);
      store.set(setRootNoteAtom, "G");
      expect(store.get(rootNoteAtom)).toBe("G");
      expect(store.get(chordRootAtom)).toBe("D");
    });
  });

  describe("resetAtom", () => {
    it("clears localStorage", () => {
      localStorage.setItem("rootNote", "G");
      localStorage.setItem("scaleName", "Dorian");
      const store = makeStore();
      store.set(resetAtom);
      expect(localStorage.getItem("rootNote")).toBeNull();
      expect(localStorage.getItem("scaleName")).toBeNull();
    });

    it("resets core atoms to defaults", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "G");
      store.set(scaleNameAtom, "Dorian");
      store.set(isMutedAtom, true);
      store.set(fretZoomAtom, 200);
      store.set(displayFormatAtom, "degrees");
      store.set(chordTypeAtom, "Major Triad");

      store.set(resetAtom);

      expect(store.get(rootNoteAtom)).toBe("C");
      expect(store.get(scaleNameAtom)).toBe("Major");
      expect(store.get(isMutedAtom)).toBe(false);
      expect(store.get(fretZoomAtom)).toBe(100);
      expect(store.get(displayFormatAtom)).toBe("notes");
      expect(store.get(chordTypeAtom)).toBeNull();
    });

    it("resets all remaining atoms to defaults", () => {
      const store = makeStore();
      store.set(chordRootAtom, "G");
      store.set(linkChordRootAtom, false);
      store.set(hideNonChordNotesAtom, true);
      store.set(chordFretSpreadAtom, 5);
      store.set(chordIntervalFilterAtom, "Triad");
      store.set(fingeringPatternAtom, "caged");
      store.set(npsPositionAtom, 3);
      store.set(shapeLabelsAtom, "caged");
      store.set(tuningNameAtom, "Drop D");
      store.set(fretStartAtom, 3);
      store.set(fretEndAtom, 12);
      store.set(accidentalModeAtom, "flats");
      // Controls tab was renamed from legacy "settings" to "fretboard".
      store.set(mobileTabAtom, "fretboard");

      store.set(resetAtom);

      expect(store.get(chordRootAtom)).toBe("C");
      expect(store.get(linkChordRootAtom)).toBe(true);
      expect(store.get(hideNonChordNotesAtom)).toBe(false);
      expect(store.get(chordFretSpreadAtom)).toBe(0);
      expect(store.get(chordIntervalFilterAtom)).toBe("All");
      expect(store.get(fingeringPatternAtom)).toBe("all");
      expect(store.get(npsPositionAtom)).toBe(0);
      expect(store.get(shapeLabelsAtom)).toBe("none");
      expect(store.get(tuningNameAtom)).toBe("Standard");
      expect(store.get(fretStartAtom)).toBe(0);
      expect(store.get(fretEndAtom)).toBe(24);
      expect(store.get(accidentalModeAtom)).toBe("auto");
      expect(store.get(mobileTabAtom)).toBe("key");
    });
  });
});
