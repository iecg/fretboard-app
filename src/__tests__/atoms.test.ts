// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
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
  landscapeNarrowTabAtom,
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
      localStorage.setItem("fretflow:rootNote", "G");
      const store = makeStore();
      const unsub = mount(store, rootNoteAtom);
      expect(store.get(rootNoteAtom)).toBe("G");
      unsub();
    });

    it("writes default to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, rootNoteAtom);
      expect(localStorage.getItem("fretflow:rootNote")).toBe("C");
      unsub();
    });

    it("writes new value via setItem", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "D");
      expect(localStorage.getItem("fretflow:rootNote")).toBe("D");
    });

    it("removes localStorage key on RESET", () => {
      localStorage.setItem("fretflow:rootNote", "G");
      const store = makeStore();
      store.set(rootNoteAtom, RESET);
      expect(localStorage.getItem("fretflow:rootNote")).toBeNull();
    });
  });

  describe("booleanStorage (via isMutedAtom)", () => {
    it('reads "true" as true', () => {
      localStorage.setItem("fretflow:isMuted", "true");
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(store.get(isMutedAtom)).toBe(true);
      unsub();
    });

    it('reads "false" as false', () => {
      localStorage.setItem("fretflow:isMuted", "false");
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(store.get(isMutedAtom)).toBe(false);
      unsub();
    });

    it("writes default false to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(localStorage.getItem("fretflow:isMuted")).toBe("false");
      unsub();
    });

    it("writes boolean as string via setItem", () => {
      const store = makeStore();
      store.set(isMutedAtom, true);
      expect(localStorage.getItem("fretflow:isMuted")).toBe("true");
    });

    it("removes localStorage key on RESET", () => {
      localStorage.setItem("fretflow:isMuted", "true");
      const store = makeStore();
      store.set(isMutedAtom, RESET);
      expect(localStorage.getItem("fretflow:isMuted")).toBeNull();
    });

    it("self-heals invalid stored boolean values", () => {
      localStorage.setItem("fretflow:isMuted", "not-a-bool");
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(store.get(isMutedAtom)).toBe(false);
      expect(localStorage.getItem("fretflow:isMuted")).toBe("false");
      unsub();
    });
  });

  describe("numberStorage (via fretZoomAtom)", () => {
    it("reads numeric string as number", () => {
      localStorage.setItem("fretflow:fretZoom", "150");
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(150);
      unsub();
    });

    it("writes default to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(localStorage.getItem("fretflow:fretZoom")).toBe("100");
      unsub();
    });

    it("writes number as string via setItem", () => {
      const store = makeStore();
      store.set(fretZoomAtom, 200);
      expect(localStorage.getItem("fretflow:fretZoom")).toBe("200");
    });

    it("removes localStorage key on RESET", () => {
      localStorage.setItem("fretflow:fretZoom", "200");
      const store = makeStore();
      store.set(fretZoomAtom, RESET);
      expect(localStorage.getItem("fretflow:fretZoom")).toBeNull();
    });

    it("self-heals NaN and non-finite values to default", () => {
      localStorage.setItem("fretflow:fretZoom", "NaN");
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(100);
      expect(localStorage.getItem("fretflow:fretZoom")).toBe("100");
      unsub();
    });

    it("self-heals out-of-range values to default", () => {
      localStorage.setItem("fretflow:fretZoom", "9999");
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(100);
      expect(localStorage.getItem("fretflow:fretZoom")).toBe("100");
      unsub();
    });
  });

  describe("mobileTabStorage", () => {
    it("migrates legacy settings tab values to fretboard", () => {
      localStorage.setItem("fretflow:mobileTab", "settings");
      const store = makeStore();
      const unsub = mount(store, mobileTabAtom);

      expect(store.get(mobileTabAtom)).toBe("fretboard");
      expect(localStorage.getItem("fretflow:mobileTab")).toBe("fretboard");

      unsub();
    });

    it("keeps valid stored tab values unchanged", () => {
      localStorage.setItem("fretflow:mobileTab", "fretboard");
      const store = makeStore();
      const unsub = mount(store, mobileTabAtom);

      expect(store.get(mobileTabAtom)).toBe("fretboard");
      expect(localStorage.getItem("fretflow:mobileTab")).toBe("fretboard");

      unsub();
    });

    it("falls back to key for invalid stored tab values", () => {
      localStorage.setItem("fretflow:mobileTab", "invalid-tab");
      const store = makeStore();
      const unsub = mount(store, mobileTabAtom);

      expect(store.get(mobileTabAtom)).toBe("key");
      expect(localStorage.getItem("fretflow:mobileTab")).toBe("key");

      unsub();
    });
  });

  describe("chordTypeStorage", () => {
    it("reads empty string as null", () => {
      localStorage.setItem("fretflow:chordType", "");
      const store = makeStore();
      const unsub = mount(store, chordTypeAtom);
      expect(store.get(chordTypeAtom)).toBeNull();
      unsub();
    });

    it("reads non-empty string as chord type", () => {
      localStorage.setItem("fretflow:chordType", "Major Triad");
      const store = makeStore();
      const unsub = mount(store, chordTypeAtom);
      expect(store.get(chordTypeAtom)).toBe("Major Triad");
      unsub();
    });

    it("writes default empty string to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, chordTypeAtom);
      expect(localStorage.getItem("fretflow:chordType")).toBe("");
      unsub();
    });

    it("writes null as empty string via setItem", () => {
      const store = makeStore();
      store.set(chordTypeAtom, null);
      expect(localStorage.getItem("fretflow:chordType")).toBe("");
    });

    it("writes chord type string via setItem", () => {
      const store = makeStore();
      store.set(chordTypeAtom, "Minor 7th");
      expect(localStorage.getItem("fretflow:chordType")).toBe("Minor 7th");
    });
  });

  describe("cagedShapesStorage", () => {
    it("reads JSON array as Set", () => {
      localStorage.setItem("fretflow:cagedShapes", JSON.stringify(["C", "A"]));
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
      localStorage.setItem("fretflow:cagedShapes", "not-valid-json{{{");
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
      const stored = localStorage.getItem("fretflow:cagedShapes");
      expect(JSON.parse(stored!)).toEqual(CAGED_SHAPES);
      unsub();
    });

    it("writes Set as JSON array via setItem", () => {
      const store = makeStore();
      store.set(cagedShapesAtom, new Set(["C", "G"] as const));
      const stored = localStorage.getItem("fretflow:cagedShapes");
      expect(JSON.parse(stored!)).toEqual(["C", "G"]);
    });

    it("removes localStorage key on RESET", () => {
      localStorage.setItem("fretflow:cagedShapes", JSON.stringify(["C"]));
      const store = makeStore();
      store.set(cagedShapesAtom, RESET);
      expect(localStorage.getItem("fretflow:cagedShapes")).toBeNull();
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
    it("clears only fretflow-prefixed keys from localStorage", () => {
      localStorage.setItem("fretflow:rootNote", "G");
      localStorage.setItem("fretflow:scaleName", "Dorian");
      localStorage.setItem("unrelatedKey", "keep");
      const store = makeStore();
      store.set(resetAtom);
      expect(localStorage.getItem("fretflow:rootNote")).toBeNull();
      expect(localStorage.getItem("fretflow:scaleName")).toBeNull();
      expect(localStorage.getItem("unrelatedKey")).toBe("keep");
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
      store.set(landscapeNarrowTabAtom, "key");

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
      expect(store.get(landscapeNarrowTabAtom)).toBe("fretboard");
    });

    it("migrates legacy unprefixed keys to prefixed keys", async () => {
      // Migration runs at module load, so we must set the legacy key *before*
      // importing atoms.ts.
      localStorage.setItem("rootNote", "G");
      vi.resetModules();
      const atoms = await import("../store/atoms");

      const store = makeStore();
      const unsub = mount(store, atoms.rootNoteAtom);
      expect(store.get(atoms.rootNoteAtom)).toBe("G");
      expect(localStorage.getItem("rootNote")).toBeNull();
      expect(localStorage.getItem("fretflow:rootNote")).toBe("G");
      unsub();
    });
  });
});
