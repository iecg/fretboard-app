// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStore, type Atom } from "jotai";
import { RESET } from "jotai/utils";
import { k } from "../test-utils/storage";
import {
  rootNoteAtom,
  scaleNameAtom,
  scaleBrowseModeAtom,
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  cagedShapesAtom,
  fingeringPatternAtom,
  displayFormatAtom,
  isMutedAtom,
  fretStartAtom,
  fretEndAtom,
  fretZoomAtom,
  tuningNameAtom,
  accidentalModeAtom,
  mobileTabAtom,
  npsPositionAtom,
  chordFretSpreadAtom,
  practiceLensAtom,
  setRootNoteAtom,
  resetAtom,
  landscapeNarrowTabAtom,
  useFlatsAtom,
  currentTuningAtom,
  chordTonesAtom,
  colorNotesAtom,
  clickedShapeAtom,
  scaleVisibleAtom,
  toggleScaleVisibleAtom,
  effectiveHiddenNotesAtom,
  effectiveColorNotesAtom,
  hiddenNotesAtom,
  toggleHiddenNoteAtom,
} from "./atoms";
import { STANDARD_TUNING, TUNINGS } from "../core/guitar";
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
      localStorage.setItem(k("rootNote"), "G");
      const store = makeStore();
      const unsub = mount(store, rootNoteAtom);
      expect(store.get(rootNoteAtom)).toBe("G");
      unsub();
    });

    it("writes default to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, rootNoteAtom);
      expect(localStorage.getItem(k("rootNote"))).toBe("C");
      unsub();
    });

    it("writes new value via setItem", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "D");
      expect(localStorage.getItem(k("rootNote"))).toBe("D");
    });

    it("removes localStorage key on RESET", () => {
      localStorage.setItem(k("rootNote"), "G");
      const store = makeStore();
      store.set(rootNoteAtom, RESET);
      expect(localStorage.getItem(k("rootNote"))).toBeNull();
    });
  });

  describe("booleanStorage (via isMutedAtom)", () => {
    it('reads "true" as true', () => {
      localStorage.setItem(k("isMuted"), "true");
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(store.get(isMutedAtom)).toBe(true);
      unsub();
    });

    it('reads "false" as false', () => {
      localStorage.setItem(k("isMuted"), "false");
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(store.get(isMutedAtom)).toBe(false);
      unsub();
    });

    it("writes default false to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(localStorage.getItem(k("isMuted"))).toBe("false");
      unsub();
    });

    it("writes boolean as string via setItem", () => {
      const store = makeStore();
      store.set(isMutedAtom, true);
      expect(localStorage.getItem(k("isMuted"))).toBe("true");
    });

    it("removes localStorage key on RESET", () => {
      localStorage.setItem(k("isMuted"), "true");
      const store = makeStore();
      store.set(isMutedAtom, RESET);
      expect(localStorage.getItem(k("isMuted"))).toBeNull();
    });

    it("self-heals invalid stored boolean values", () => {
      localStorage.setItem(k("isMuted"), "not-a-bool");
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(store.get(isMutedAtom)).toBe(false);
      expect(localStorage.getItem(k("isMuted"))).toBe("false");
      unsub();
    });

    it("returns initialValue when localStorage.getItem throws", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage blocked");
      });
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(store.get(isMutedAtom)).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith("localStorage.getItem failed", expect.objectContaining({ key: k("isMuted") }));
      spy.mockRestore();
      warnSpy.mockRestore();
      unsub();
    });
  });

  describe("numberStorage (via fretZoomAtom)", () => {
    it("reads numeric string as number", () => {
      localStorage.setItem(k("fretZoom"), "150");
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(150);
      unsub();
    });

    it("writes default to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(localStorage.getItem(k("fretZoom"))).toBe("100");
      unsub();
    });

    it("writes number as string via setItem", () => {
      const store = makeStore();
      store.set(fretZoomAtom, 200);
      expect(localStorage.getItem(k("fretZoom"))).toBe("200");
    });

    it("removes localStorage key on RESET", () => {
      localStorage.setItem(k("fretZoom"), "200");
      const store = makeStore();
      store.set(fretZoomAtom, RESET);
      expect(localStorage.getItem(k("fretZoom"))).toBeNull();
    });

    it("self-heals NaN and non-finite values to default", () => {
      localStorage.setItem(k("fretZoom"), "NaN");
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(100);
      expect(localStorage.getItem(k("fretZoom"))).toBe("100");
      unsub();
    });

    it("self-heals out-of-range values to default", () => {
      localStorage.setItem(k("fretZoom"), "9999");
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(100);
      expect(localStorage.getItem(k("fretZoom"))).toBe("100");
      unsub();
    });

    it("self-heals non-integer float values to default", () => {
      localStorage.setItem(k("fretZoom"), "75.5");
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(100);
      expect(localStorage.getItem(k("fretZoom"))).toBe("100");
      unsub();
    });

    it("self-heals below-min values to default", () => {
      localStorage.setItem(k("fretZoom"), "10"); // fretZoom min is 50
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(100);
      expect(localStorage.getItem(k("fretZoom"))).toBe("100");
      unsub();
    });

    it("returns initialValue when localStorage.getItem throws", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage blocked");
      });
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(100);
      expect(warnSpy).toHaveBeenCalledWith("localStorage.getItem failed", expect.objectContaining({ key: k("fretZoom") }));
      spy.mockRestore();
      warnSpy.mockRestore();
      unsub();
    });
  });

  describe("mobileTabStorage", () => {
    it("migrates legacy key tab values to scales", () => {
      localStorage.setItem(k("mobileTab"), "key");
      const store = makeStore();
      const unsub = mount(store, mobileTabAtom);

      expect(store.get(mobileTabAtom)).toBe("scales");
      expect(localStorage.getItem(k("mobileTab"))).toBe("scales");

      unsub();
    });

    it("migrates legacy scale tab values to scales", () => {
      localStorage.setItem(k("mobileTab"), "scale");
      const store = makeStore();
      const unsub = mount(store, mobileTabAtom);

      expect(store.get(mobileTabAtom)).toBe("scales");
      expect(localStorage.getItem(k("mobileTab"))).toBe("scales");

      unsub();
    });

    it("migrates legacy theory tab values to scales", () => {
      localStorage.setItem(k("mobileTab"), "theory");
      const store = makeStore();
      const unsub = mount(store, mobileTabAtom);

      expect(store.get(mobileTabAtom)).toBe("scales");
      expect(localStorage.getItem(k("mobileTab"))).toBe("scales");

      unsub();
    });

    it("migrates legacy settings tab values to view", () => {
      localStorage.setItem(k("mobileTab"), "settings");
      const store = makeStore();
      const unsub = mount(store, mobileTabAtom);

      expect(store.get(mobileTabAtom)).toBe("view");
      expect(localStorage.getItem(k("mobileTab"))).toBe("view");

      unsub();
    });

    it("keeps valid stored tab values unchanged", () => {
      localStorage.setItem(k("mobileTab"), "view");
      const store = makeStore();
      const unsub = mount(store, mobileTabAtom);

      expect(store.get(mobileTabAtom)).toBe("view");
      expect(localStorage.getItem(k("mobileTab"))).toBe("view");

      unsub();
    });

    it("falls back to scales for invalid stored tab values", () => {
      localStorage.setItem(k("mobileTab"), "invalid-tab");
      const store = makeStore();
      const unsub = mount(store, mobileTabAtom);

      expect(store.get(mobileTabAtom)).toBe("scales");
      expect(localStorage.getItem(k("mobileTab"))).toBe("scales");

      unsub();
    });
  });

  describe("scaleNameStorage", () => {
    it("normalizes legacy Minor values to Natural Minor", () => {
      localStorage.setItem(k("scaleName"), "Minor");
      const store = makeStore();
      const unsub = mount(store, scaleNameAtom);

      expect(store.get(scaleNameAtom)).toBe("Natural Minor");
      expect(localStorage.getItem(k("scaleName"))).toBe("Natural Minor");

      unsub();
    });
  });

  describe("scaleBrowseModeStorage", () => {
    it("keeps valid stored browse modes unchanged", () => {
      localStorage.setItem(k("scaleBrowseMode"), "relative");
      const store = makeStore();
      const unsub = mount(store, scaleBrowseModeAtom);

      expect(store.get(scaleBrowseModeAtom)).toBe("relative");
      expect(localStorage.getItem(k("scaleBrowseMode"))).toBe("relative");

      unsub();
    });

    it("falls back to parallel for invalid browse modes", () => {
      localStorage.setItem(k("scaleBrowseMode"), "sideways");
      const store = makeStore();
      const unsub = mount(store, scaleBrowseModeAtom);

      expect(store.get(scaleBrowseModeAtom)).toBe("parallel");
      expect(localStorage.getItem(k("scaleBrowseMode"))).toBe("parallel");

      unsub();
    });
  });

  // Phase 02: chordTypeAtom is now a writable derived atom backed by chordQualityOverrideAtom.
  // Read path: composes from backing atoms (degree mode) or chordQualityOverrideAtom (manual mode).
  // Write path: stores value in k("chordQualityOverride") and flips mode to "manual".
  describe("chordTypeStorage", () => {
    it("reads empty string as null", () => {
      localStorage.setItem(k("chordType"), "");
      const store = makeStore();
      const unsub = mount(store, chordTypeAtom);
      expect(store.get(chordTypeAtom)).toBeNull();
      unsub();
    });

    it("reads non-empty string as chord type via migration", () => {
      localStorage.setItem(k("chordType"), "Major Triad");
      const store = makeStore();
      const unsub = mount(store, chordTypeAtom);
      expect(store.get(chordTypeAtom)).toBe("Major Triad");
      unsub();
    });

    it("writes null as empty string to chordQualityOverride key", () => {
      const store = makeStore();
      store.set(chordTypeAtom, null);
      // Phase 02: writes go to chordQualityOverride, not the legacy chordType key.
      expect(localStorage.getItem(k("chordQualityOverride"))).toBe("");
      expect(localStorage.getItem(k("chordOverlayMode"))).toBe("manual");
    });

    it("writes chord type string to chordQualityOverride key", () => {
      const store = makeStore();
      store.set(chordTypeAtom, "Minor 7th");
      // Phase 02: writes go to chordQualityOverride, not the legacy chordType key.
      expect(localStorage.getItem(k("chordQualityOverride"))).toBe("Minor 7th");
      expect(localStorage.getItem(k("chordOverlayMode"))).toBe("manual");
    });
  });

  describe("cagedShapesStorage", () => {
    it("reads JSON array as Set", () => {
      localStorage.setItem(k("cagedShapes"), JSON.stringify(["C", "A"]));
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
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      localStorage.setItem(k("cagedShapes"), "not-valid-json{{{");
      const store = makeStore();
      const unsub = mount(store, cagedShapesAtom);
      const shapes = store.get(cagedShapesAtom);
      expect(shapes).toBeInstanceOf(Set);
      expect(shapes.size).toBe(CAGED_SHAPES.length);
      expect(warnSpy).toHaveBeenCalledWith("localStorage.getItem failed", expect.objectContaining({ key: k("cagedShapes") }));
      warnSpy.mockRestore();
      unsub();
    });

    it("writes default JSON array to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, cagedShapesAtom);
      const stored = localStorage.getItem(k("cagedShapes"));
      expect(JSON.parse(stored!)).toEqual(CAGED_SHAPES);
      unsub();
    });

    it("writes Set as JSON array via setItem", () => {
      const store = makeStore();
      store.set(cagedShapesAtom, new Set(["C", "G"] as const));
      const stored = localStorage.getItem(k("cagedShapes"));
      expect(JSON.parse(stored!)).toEqual(["C", "G"]);
    });

    it("removes localStorage key on RESET", () => {
      localStorage.setItem(k("cagedShapes"), JSON.stringify(["C"]));
      const store = makeStore();
      store.set(cagedShapesAtom, RESET);
      expect(localStorage.getItem(k("cagedShapes"))).toBeNull();
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
      localStorage.setItem(k("rootNote"), "G");
      localStorage.setItem(k("scaleName"), "Dorian");
      localStorage.setItem("unrelatedKey", "keep");
      const store = makeStore();
      store.set(resetAtom);
      expect(localStorage.getItem(k("rootNote"))).toBeNull();
      expect(localStorage.getItem(k("scaleName"))).toBeNull();
      expect(localStorage.getItem("unrelatedKey")).toBe("keep");
    });

    it("resets core atoms to defaults", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "G");
      store.set(scaleNameAtom, "Dorian");
      store.set(scaleBrowseModeAtom, "relative");
      store.set(isMutedAtom, true);
      store.set(fretZoomAtom, 200);
      store.set(displayFormatAtom, "degrees");
      store.set(chordTypeAtom, "Major Triad");

      store.set(resetAtom);

      expect(store.get(rootNoteAtom)).toBe("C");
      expect(store.get(scaleNameAtom)).toBe("Major");
      expect(store.get(scaleBrowseModeAtom)).toBe("parallel");
      expect(store.get(isMutedAtom)).toBe(false);
      expect(store.get(fretZoomAtom)).toBe(100);
      expect(store.get(displayFormatAtom)).toBe("notes");
      expect(store.get(chordTypeAtom)).toBeNull();
    });

    it("resets all remaining atoms to defaults", () => {
      const store = makeStore();
      store.set(chordRootAtom, "G");
      store.set(linkChordRootAtom, false);
      store.set(practiceLensAtom, "targets");
      store.set(chordFretSpreadAtom, 5);
      store.set(fingeringPatternAtom, "caged");
      store.set(npsPositionAtom, 3);
      store.set(scaleBrowseModeAtom, "relative");
      store.set(tuningNameAtom, "Drop D");
      store.set(fretStartAtom, 3);
      store.set(fretEndAtom, 12);
      store.set(accidentalModeAtom, "flats");
      store.set(mobileTabAtom, "view");
      store.set(landscapeNarrowTabAtom, "key");

      store.set(resetAtom);

      expect(store.get(chordRootAtom)).toBe("C");
      expect(store.get(linkChordRootAtom)).toBe(true);
      expect(store.get(chordFretSpreadAtom)).toBe(0);
      expect(store.get(fingeringPatternAtom)).toBe("all");
      expect(store.get(npsPositionAtom)).toBe(1);
      expect(store.get(scaleBrowseModeAtom)).toBe("parallel");
      expect(store.get(tuningNameAtom)).toBe("Standard");
      expect(store.get(fretStartAtom)).toBe(0);
      expect(store.get(fretEndAtom)).toBe(25);
      expect(store.get(accidentalModeAtom)).toBe("auto");
      expect(store.get(mobileTabAtom)).toBe("scales");
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
      expect(localStorage.getItem(k("rootNote"))).toBe("G");
      unsub();
    });

    it("removes legacy key without overwriting existing prefixed key", async () => {
      // When the prefixed key already exists, migration must skip the copy
      // but still remove the stale legacy key (the continue branch in migrateLegacyKeys).
      localStorage.setItem(k("rootNote"), "D");
      localStorage.setItem("rootNote", "G");
      vi.resetModules();
      await import("../store/atoms");

      expect(localStorage.getItem(k("rootNote"))).toBe("D");
      expect(localStorage.getItem("rootNote")).toBeNull();
    });
  });

  describe("useFlatsAtom", () => {
    it("returns false for G Major (sharps key, auto mode)", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "G");
      store.set(scaleNameAtom, "Major");
      store.set(accidentalModeAtom, "auto");
      expect(store.get(useFlatsAtom)).toBe(false);
    });

    it("returns true for F Major (flats key, auto mode)", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "F");
      store.set(scaleNameAtom, "Major");
      store.set(accidentalModeAtom, "auto");
      expect(store.get(useFlatsAtom)).toBe(true);
    });

    it("returns false when accidentalMode is forced to sharps", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "F");
      store.set(scaleNameAtom, "Major");
      store.set(accidentalModeAtom, "sharps");
      expect(store.get(useFlatsAtom)).toBe(false);
    });

    it("returns true when accidentalMode is forced to flats", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "G");
      store.set(scaleNameAtom, "Major");
      store.set(accidentalModeAtom, "flats");
      expect(store.get(useFlatsAtom)).toBe(true);
    });
  });

  describe("currentTuningAtom", () => {
    it("returns Standard tuning for standard tuning name", () => {
      const store = makeStore();
      store.set(tuningNameAtom, "Standard");
      expect(store.get(currentTuningAtom)).toEqual(TUNINGS["Standard"]);
    });

    it("returns Drop D tuning for Drop D tuning name", () => {
      const store = makeStore();
      store.set(tuningNameAtom, "Drop D");
      expect(store.get(currentTuningAtom)).toEqual(TUNINGS["Drop D"]);
    });

    it("falls back to STANDARD_TUNING for unknown tuning name", () => {
      const store = makeStore();
      store.set(tuningNameAtom, "Unknown Tuning That Does Not Exist");
      expect(store.get(currentTuningAtom)).toEqual(STANDARD_TUNING);
    });
  });

  describe("chordTonesAtom", () => {
    it("returns [] when chordTypeAtom is null", () => {
      const store = makeStore();
      store.set(chordTypeAtom, null);
      expect(store.get(chordTonesAtom)).toEqual([]);
    });

    it("returns C, E, G for chordRoot=C and chordType=Major Triad", () => {
      const store = makeStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      expect(store.get(chordTonesAtom)).toEqual(["C", "E", "G"]);
    });

    it("re-derives when chordRootAtom changes", () => {
      const store = makeStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      expect(store.get(chordTonesAtom)).toEqual(["C", "E", "G"]);
      store.set(chordRootAtom, "G");
      expect(store.get(chordTonesAtom)).toEqual(["G", "B", "D"]);
    });
  });

  describe("colorNotesAtom", () => {
    it("returns [] for C Major (no divergent notes from reference scale)", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      expect(store.get(colorNotesAtom)).toEqual([]);
    });

    it("returns the b5 blue note for C Minor Blues", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Minor Blues");
      // b5 of C is F# (semitone 6)
      expect(store.get(colorNotesAtom)).toEqual(["F#"]);
    });

    it("returns [] for A Natural Minor (reference minor scale, no divergence)", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "A");
      store.set(scaleNameAtom, "Natural Minor");
      expect(store.get(colorNotesAtom)).toEqual([]);
    });
  });

  describe("clickedShapeAtom", () => {
    it("defaults to null", () => {
      const store = makeStore();
      expect(store.get(clickedShapeAtom)).toBeNull();
    });

    it("round-trips set and reset via store.set", () => {
      const store = makeStore();
      store.set(clickedShapeAtom, "E");
      expect(store.get(clickedShapeAtom)).toBe("E");
      store.set(clickedShapeAtom, null);
      expect(store.get(clickedShapeAtom)).toBeNull();
    });
  });

  describe("scaleVisibleAtom", () => {
    it("defaults to true", () => {
      const store = makeStore();
      const unsub = mount(store, scaleVisibleAtom);
      expect(store.get(scaleVisibleAtom)).toBe(true);
      unsub();
    });

    it("reads stored true from localStorage", () => {
      localStorage.setItem(k("scaleVisible"), "true");
      const store = makeStore();
      const unsub = mount(store, scaleVisibleAtom);
      expect(store.get(scaleVisibleAtom)).toBe(true);
      unsub();
    });

    it("reads stored false from localStorage", () => {
      localStorage.setItem(k("scaleVisible"), "false");
      const store = makeStore();
      const unsub = mount(store, scaleVisibleAtom);
      expect(store.get(scaleVisibleAtom)).toBe(false);
      unsub();
    });

    it("falls back to true for invalid stored value", () => {
      localStorage.setItem(k("scaleVisible"), "invalid");
      const store = makeStore();
      const unsub = mount(store, scaleVisibleAtom);
      expect(store.get(scaleVisibleAtom)).toBe(true);
      unsub();
    });

    it("persists false to localStorage", () => {
      const store = makeStore();
      store.set(scaleVisibleAtom, false);
      expect(localStorage.getItem(k("scaleVisible"))).toBe("false");
    });

    it("resetAtom resets scaleVisibleAtom to true", () => {
      const store = makeStore();
      store.set(scaleVisibleAtom, false);
      store.set(resetAtom);
      expect(store.get(scaleVisibleAtom)).toBe(true);
    });
  });

  describe("toggleScaleVisibleAtom", () => {
    it("eye off hides the scale (visible false)", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      expect(store.get(scaleVisibleAtom)).toBe(true);
      store.set(toggleScaleVisibleAtom);
      expect(store.get(scaleVisibleAtom)).toBe(false);
    });

    it("eye off clears individually hidden notes", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(toggleHiddenNoteAtom, "E");
      store.set(toggleHiddenNoteAtom, "G");
      expect(store.get(hiddenNotesAtom).size).toBe(2);
      store.set(toggleScaleVisibleAtom);
      expect(store.get(hiddenNotesAtom).size).toBe(0);
    });

    it("eye on restores the full scale (no hidden notes)", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(toggleHiddenNoteAtom, "E");
      store.set(toggleScaleVisibleAtom); // off — clears hidden notes
      store.set(toggleScaleVisibleAtom); // on
      expect(store.get(scaleVisibleAtom)).toBe(true);
      expect(store.get(hiddenNotesAtom).size).toBe(0);
    });

    it("individual note toggles only matter while scale is visible", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      // Toggle note while visible — it is reflected in effectiveHiddenNotes
      store.set(toggleHiddenNoteAtom, "B");
      expect(store.get(effectiveHiddenNotesAtom).has("B")).toBe(true);
      // Turn scale off — effectiveHiddenNotes returns empty
      store.set(toggleScaleVisibleAtom);
      expect(store.get(effectiveHiddenNotesAtom).size).toBe(0);
    });
  });

  describe("effectiveHiddenNotesAtom", () => {
    it("returns hidden notes when scale is visible", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(toggleHiddenNoteAtom, "E");
      expect(store.get(effectiveHiddenNotesAtom).has("E")).toBe(true);
      expect(store.get(effectiveHiddenNotesAtom).size).toBe(1);
    });

    it("returns empty set when scale is not visible", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(toggleHiddenNoteAtom, "E");
      store.set(scaleVisibleAtom, false);
      expect(store.get(effectiveHiddenNotesAtom).size).toBe(0);
    });
  });

  describe("effectiveColorNotesAtom", () => {
    it("returns color notes when scale is visible", () => {
      const store = makeStore();
      store.set(scaleVisibleAtom, true);
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Minor Blues");
      expect(store.get(effectiveColorNotesAtom)).toEqual(["F#"]);
    });

    it("returns empty array when scale is not visible", () => {
      const store = makeStore();
      store.set(scaleVisibleAtom, false);
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Minor Blues");
      expect(store.get(effectiveColorNotesAtom)).toEqual([]);
    });

    it("color notes appear without chord overlay when scale is visible", () => {
      const store = makeStore();
      store.set(scaleVisibleAtom, true);
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Minor Blues");
      // No chord overlay (chordType remains null by default)
      expect(store.get(effectiveColorNotesAtom)).toEqual(["F#"]);
    });
  });
});
