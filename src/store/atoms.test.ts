// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStore, type Atom } from "jotai";
import { RESET } from "jotai/utils";
import { k } from "../test-utils/storage";
import { setRootNoteAtom, setScaleNameAtom, setFingeringPatternAtom, resetAtom } from "./actions";
import { isMutedAtom } from "./audioAtoms";
import { chordRootAtom, chordTypeAtom, linkChordRootAtom, practiceLensAtom, chordOverlayHiddenAtom, chordTonesAtom } from "./chordOverlayAtoms";
import { updateActiveChordAtom, activeChordCachedDegreeAtom } from "./songStateAtoms";
import { cagedShapesAtom, fingeringPatternAtom, npsPositionAtom, clickedShapeAtom } from "./fingeringAtoms";
import { fretStartAtom, fretEndAtom, fretZoomAtom, tuningNameAtom, currentTuningAtom } from "./layoutAtoms";
import { progressionStepsAtom, progressionTempoBpmAtom, progressionPlayingAtom, activeProgressionStepIndexAtom, setProgressionPlayingAtom } from "./progressionAtoms";
import { rootNoteAtom, scaleNameAtom, accidentalModeAtom, useFlatsAtom, colorNotesAtom, scaleVisibleAtom, toggleScaleVisibleAtom, effectiveHiddenNotesAtom, effectiveColorNotesAtom, hiddenNotesAtom, toggleHiddenNoteAtom } from "./scaleAtoms";
import { displayFormatAtom } from "./uiAtoms";
import { STANDARD_TUNING, TUNINGS } from "@fretflow/core";
import { CAGED_SHAPES } from "@fretflow/core";

function makeStore() {
  return createStore();
}

// Trigger onMount for an atom so atomWithStorage reads from localStorage.
function mount<T>(store: ReturnType<typeof createStore>, atom: Atom<T>): () => void {
  return store.sub(atom, () => {});
}

describe("atoms", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Each storage abstraction (raw string, boolean, number, custom JSON) is
  // tested via one representative atom — the abstraction is shared, so per-atom
  // round-trip duplication adds no signal.
  describe("storage abstractions", () => {
    it("rawString: round-trips read/write and RESET removes the key", () => {
      localStorage.setItem(k("rootNote"), "G");
      const store = makeStore();
      const unsub = mount(store, rootNoteAtom);
      expect(store.get(rootNoteAtom)).toBe("G");
      store.set(rootNoteAtom, "D");
      expect(localStorage.getItem(k("rootNote"))).toBe("D");
      store.set(rootNoteAtom, RESET);
      expect(localStorage.getItem(k("rootNote"))).toBeNull();
      unsub();
    });

    it("rawString: writes default to localStorage when key absent on mount", () => {
      const store = makeStore();
      const unsub = mount(store, rootNoteAtom);
      expect(localStorage.getItem(k("rootNote"))).toBe("C");
      unsub();
    });

    it.each([
      ["true", true],
      ["false", false],
    ])('boolean: reads "%s" as %s', (stored, expected) => {
      localStorage.setItem(k("isMuted"), stored);
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(store.get(isMutedAtom)).toBe(expected);
      unsub();
    });

    it("boolean: write, RESET, and self-heal of garbage values", () => {
      const store = makeStore();
      store.set(isMutedAtom, true);
      expect(localStorage.getItem(k("isMuted"))).toBe("true");
      store.set(isMutedAtom, RESET);
      expect(localStorage.getItem(k("isMuted"))).toBeNull();

      // Self-heal: garbage in storage falls back to default + rewrites.
      localStorage.setItem(k("isMuted"), "not-a-bool");
      const store2 = makeStore();
      const unsub = mount(store2, isMutedAtom);
      expect(store2.get(isMutedAtom)).toBe(false);
      expect(localStorage.getItem(k("isMuted"))).toBe("false");
      unsub();
    });

    it("storage: throwing getItem returns initial value and warns", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage blocked");
      });
      const store = makeStore();
      const unsub = mount(store, isMutedAtom);
      expect(store.get(isMutedAtom)).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        "localStorage.getItem failed",
        expect.objectContaining({ key: k("isMuted") }),
      );
      spy.mockRestore();
      warnSpy.mockRestore();
      unsub();
    });

    it("number: round-trips reads and writes", () => {
      localStorage.setItem(k("fretZoom"), "150");
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(150);
      store.set(fretZoomAtom, 200);
      expect(localStorage.getItem(k("fretZoom"))).toBe("200");
      unsub();
    });

    it.each([
      ["NaN", "non-numeric"],
      ["9999", "out-of-range high"],
      ["10", "below min"],
      ["75.5", "non-integer float"],
      ["50", "legacy sub-auto"],
    ])("number: self-heals %s (%s) to default 100", (stored) => {
      localStorage.setItem(k("fretZoom"), stored);
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(100);
      expect(localStorage.getItem(k("fretZoom"))).toBe("100");
      unsub();
    });
  });

  // Atom-specific migrations / validators that aren't covered by the shared
  // storage abstraction (custom serializers, enum validation, legacy renames).
  describe("atom-specific storage migrations", () => {
    it("scaleName: legacy 'Minor' migrates to 'Natural Minor'", () => {
      localStorage.setItem(k("scaleName"), "Minor");
      const store = makeStore();
      const unsub = mount(store, scaleNameAtom);
      expect(store.get(scaleNameAtom)).toBe("Natural Minor");
      expect(localStorage.getItem(k("scaleName"))).toBe("Natural Minor");
      unsub();
    });

    it("cagedShapes: round-trips a JSON array as a Set", () => {
      localStorage.setItem(k("cagedShapes"), JSON.stringify(["C", "A"]));
      const store = makeStore();
      const unsub = mount(store, cagedShapesAtom);
      const shapes = store.get(cagedShapesAtom);
      expect(shapes).toBeInstanceOf(Set);
      expect([...shapes]).toEqual(expect.arrayContaining(["C", "A"]));
      store.set(cagedShapesAtom, new Set(["C", "G"] as const));
      expect(JSON.parse(localStorage.getItem(k("cagedShapes"))!)).toEqual(["C", "G"]);
      unsub();
    });

    it("cagedShapes: invalid JSON falls back to the full default Set", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      localStorage.setItem(k("cagedShapes"), "not-valid-json{{{");
      const store = makeStore();
      const unsub = mount(store, cagedShapesAtom);
      expect(store.get(cagedShapesAtom).size).toBe(CAGED_SHAPES.length);
      warnSpy.mockRestore();
      unsub();
    });
  });

  // Phase 2.5: chordTypeAtom is a read-only derived view of the active
  // progression step's resolved quality. Writes flow through
  // `updateActiveChordAtom` in songStateAtoms.
  describe("chordTypeAtom (derived, read-only)", () => {
    it("reads the active step's qualityOverride", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Minor 7th", manualRoot: "C" },
      ]);
      expect(store.get(chordTypeAtom)).toBe("Minor 7th");
    });

    it("falls back to the diatonic default when no override is set", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      expect(store.get(chordTypeAtom)).toBe("Major Triad");
    });

    it("returns null when the progression is empty (overlay off)", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, []);
      expect(store.get(chordTypeAtom)).toBeNull();
    });
  });

  describe("setRootNoteAtom — manualRoot transposition", () => {
    it("transposes manualRoot when the scale root changes (was: link-sync)", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Major Triad", manualRoot: "C" },
      ]);
      store.set(rootNoteAtom, "C");
      store.set(setRootNoteAtom, "G");
      expect(store.get(progressionStepsAtom)[0]!.manualRoot).toBe("G");
      expect(store.get(chordRootAtom)).toBe("G");
    });

    it.each([
      ["I", "G", "Major Triad"],
      ["vi", "E", "Minor Triad"],
    ])("preserves diatonic resolution on scale-root change (degree %s → root %s, %s)", (degree, expectedRoot, expectedType) => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "x", degree: degree as import("@fretflow/core").DegreeId, duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(setRootNoteAtom, "G");
      expect(store.get(chordRootAtom)).toBe(expectedRoot);
      expect(store.get(chordTypeAtom)).toBe(expectedType);
    });
  });

  describe("scaleNameAtom — chord re-resolves through the progression step", () => {
    it("direct scale-name change re-resolves the diatonic chord at the cached degree", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "x", degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(scaleNameAtom, "Mixolydian");
      expect(store.get(chordRootAtom)).toBe("D");
      expect(store.get(chordTypeAtom)).toBe("Minor Triad");
    });

    it("simultaneous root + scale write re-resolves the diatonic chord", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(rootNoteAtom, "G");
      store.set(scaleNameAtom, "Mixolydian");
      expect(store.get(chordRootAtom)).toBe("G");
      expect(store.get(chordTypeAtom)).toBe("Major Triad");
    });
  });

  describe("setScaleNameAtom — progression degree remap on mode change", () => {
    it.each([
      // Major → Dorian: I (semitone 0) remaps to i (Minor Triad on A).
      ["Major", "Dorian", "I", "A", "i", "A", "Minor Triad"],
      // Major → Mixolydian: V (semitone 7) remaps to v (Minor Triad on G).
      ["Major", "Mixolydian", "V", "C", "v", "G", "Minor Triad"],
      // Major → Lydian: V stays V (both have Major Triad on semitone 7).
      ["Major", "Lydian", "V", "C", "V", "G", "Major Triad"],
    ])("%s → %s: degree %s remaps to %s on root %s", (
      fromScale, toScale, fromDegree, root, toDegree, expectedRoot, expectedType,
    ) => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "x", degree: fromDegree as import("@fretflow/core").DegreeId, duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
      store.set(rootNoteAtom, root);
      store.set(scaleNameAtom, fromScale);
      store.set(setScaleNameAtom, toScale);
      expect(store.get(progressionStepsAtom)[0]!.degree).toBe(toDegree);
      expect(store.get(chordRootAtom)).toBe(expectedRoot);
      expect(store.get(chordTypeAtom)).toBe(expectedType);
    });

    it("remaps the degree by ordinal — ii in C Major → II in C Phrygian (Major Triad on Db)", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "x", degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(setScaleNameAtom, "Phrygian");
      // Phrygian's ordinal-1 degree is "II" (semitone 1, Major Triad on Db).
      expect(store.get(progressionStepsAtom)[0]!.degree).toBe("II");
      expect(store.get(chordTypeAtom)).toBe("Major Triad");
    });

    it("preserves chord-quality override across scale changes (sticky)", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "x", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th", manualRoot: null },
      ]);
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(setScaleNameAtom, "Lydian");
      expect(store.get(progressionStepsAtom)[0]!.qualityOverride).toBe("Dominant 7th");
      expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
    });
  });

  describe("resetAtom", () => {
    it("clears only fretflow-prefixed localStorage keys and resets every atom to its default", () => {
      localStorage.setItem(k("rootNote"), "G");
      localStorage.setItem(k("scaleName"), "Dorian");
      localStorage.setItem("unrelatedKey", "keep");

      const store = makeStore();
      // Mutate a broad cross-section so the reset has to cover every category.
      store.set(progressionStepsAtom, [
        { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Minor Triad", manualRoot: "F#" },
      ]);
      store.set(rootNoteAtom, "G");
      store.set(scaleNameAtom, "Dorian");
      store.set(isMutedAtom, true);
      store.set(fretZoomAtom, 200);
      store.set(displayFormatAtom, "degrees");
      store.set(linkChordRootAtom, false);
      store.set(practiceLensAtom, "tones");
      store.set(fingeringPatternAtom, "caged");
      store.set(npsPositionAtom, 3);
      store.set(tuningNameAtom, "Drop D");
      store.set(fretStartAtom, 3);
      store.set(fretEndAtom, 12);
      store.set(accidentalModeAtom, "flats");
      store.set(chordOverlayHiddenAtom, true);

      store.set(resetAtom);
      // resetAtom restores progressionStepsAtom to its non-empty default;
      // clear it here so we can assert chord-tone identity isn't carried over.
      store.set(progressionStepsAtom, []);

      expect(localStorage.getItem("unrelatedKey")).toBe("keep");
      expect(localStorage.getItem(k("rootNote"))).toBeNull();

      expect(store.get(rootNoteAtom)).toBe("C");
      expect(store.get(scaleNameAtom)).toBe("Major");
      expect(store.get(isMutedAtom)).toBe(false);
      expect(store.get(fretZoomAtom)).toBe(100);
      expect(store.get(displayFormatAtom)).toBe("notes");
      expect(store.get(chordTypeAtom)).toBeNull();
      expect(store.get(chordRootAtom)).toBe("C");
      expect(store.get(linkChordRootAtom)).toBe(true);
      expect(store.get(fingeringPatternAtom)).toBe("none");
      expect(store.get(npsPositionAtom)).toBe(1);
      expect(store.get(tuningNameAtom)).toBe("Standard");
      expect(store.get(fretStartAtom)).toBe(0);
      expect(store.get(fretEndAtom)).toBe(25);
      expect(store.get(accidentalModeAtom)).toBe("auto");
      expect(store.get(chordOverlayHiddenAtom)).toBe(false);
    });
  });

  describe("legacy-key migration (runs at module load)", () => {
    it("copies legacy unprefixed key to prefixed key and removes the original", async () => {
      localStorage.setItem("rootNote", "G");
      vi.resetModules();
      const scaleAtoms = await import("../store/scaleAtoms");
      const store = makeStore();
      const unsub = mount(store, scaleAtoms.rootNoteAtom);
      expect(store.get(scaleAtoms.rootNoteAtom)).toBe("G");
      expect(localStorage.getItem("rootNote")).toBeNull();
      expect(localStorage.getItem(k("rootNote"))).toBe("G");
      unsub();
    });

    it("removes legacy key without overwriting an existing prefixed key", async () => {
      localStorage.setItem(k("rootNote"), "D");
      localStorage.setItem("rootNote", "G");
      vi.resetModules();
      await import("../store/scaleAtoms");
      expect(localStorage.getItem(k("rootNote"))).toBe("D");
      expect(localStorage.getItem("rootNote")).toBeNull();
    });
  });

  describe("useFlatsAtom (derived)", () => {
    it.each([
      ["G", "Major", "auto", false],
      ["F", "Major", "auto", true],
      ["F", "Major", "sharps", false],
      ["G", "Major", "flats", true],
    ])("root=%s scale=%s mode=%s → useFlats=%s", (root, scale, mode, expected) => {
      const store = makeStore();
      store.set(rootNoteAtom, root);
      store.set(scaleNameAtom, scale);
      store.set(accidentalModeAtom, mode as "auto" | "sharps" | "flats");
      expect(store.get(useFlatsAtom)).toBe(expected);
    });
  });

  describe("currentTuningAtom (derived)", () => {
    it.each([
      ["Standard", TUNINGS["Standard"]],
      ["Drop D", TUNINGS["Drop D"]],
      ["Unknown Tuning That Does Not Exist", STANDARD_TUNING],
    ])("tuningName='%s' returns expected tuning", (name, expected) => {
      const store = makeStore();
      store.set(tuningNameAtom, name);
      expect(store.get(currentTuningAtom)).toEqual(expected);
    });
  });

  describe("chordTonesAtom (derived)", () => {
    it("returns [] when chord overlay is off (empty progression)", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, []);
      expect(store.get(chordTonesAtom)).toEqual([]);
    });

    it("re-derives when the active step's manualRoot changes", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Major Triad", manualRoot: "C" },
      ]);
      expect(store.get(chordTonesAtom)).toEqual(["C", "E", "G"]);
      store.set(updateActiveChordAtom, { root: "G" });
      expect(store.get(chordTonesAtom)).toEqual(["G", "B", "D"]);
    });
  });

  describe("colorNotesAtom (derived)", () => {
    it.each([
      ["C", "Major", []],
      ["A", "Natural Minor", []],
      ["C", "Minor Blues", ["F#"]],
    ])("root=%s scale=%s → colorNotes=%j", (root, scale, expected) => {
      const store = makeStore();
      store.set(rootNoteAtom, root);
      store.set(scaleNameAtom, scale);
      expect(store.get(colorNotesAtom)).toEqual(expected);
    });
  });

  describe("clickedShapeAtom", () => {
    it("defaults to null and round-trips set/unset", () => {
      const store = makeStore();
      expect(store.get(clickedShapeAtom)).toBeNull();
      store.set(clickedShapeAtom, "E");
      expect(store.get(clickedShapeAtom)).toBe("E");
      store.set(clickedShapeAtom, null);
      expect(store.get(clickedShapeAtom)).toBeNull();
    });
  });

  describe("scale visibility (scaleVisibleAtom + toggleScaleVisibleAtom)", () => {
    it("toggling off clears individually hidden notes and hides the scale", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(toggleHiddenNoteAtom, "E");
      store.set(toggleHiddenNoteAtom, "G");
      expect(store.get(hiddenNotesAtom).size).toBe(2);
      store.set(toggleScaleVisibleAtom);
      expect(store.get(scaleVisibleAtom)).toBe(false);
      expect(store.get(hiddenNotesAtom).size).toBe(0);
    });

    it("toggling on restores full scale with no hidden notes", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(toggleHiddenNoteAtom, "E");
      store.set(toggleScaleVisibleAtom);
      store.set(toggleScaleVisibleAtom);
      expect(store.get(scaleVisibleAtom)).toBe(true);
      expect(store.get(hiddenNotesAtom).size).toBe(0);
    });

    it("resets to visible=true via resetAtom", () => {
      const store = makeStore();
      store.set(scaleVisibleAtom, false);
      store.set(resetAtom);
      expect(store.get(scaleVisibleAtom)).toBe(true);
    });
  });

  describe("effective* atoms gated by scaleVisible", () => {
    it("effectiveHiddenNotes is empty when scale is hidden, populated when visible", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(toggleHiddenNoteAtom, "E");
      expect(store.get(effectiveHiddenNotesAtom).has("E")).toBe(true);
      store.set(scaleVisibleAtom, false);
      expect(store.get(effectiveHiddenNotesAtom).size).toBe(0);
    });

    it("effectiveColorNotes is empty when scale is hidden, blue note when visible", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Minor Blues");
      store.set(scaleVisibleAtom, true);
      expect(store.get(effectiveColorNotesAtom)).toEqual(["F#"]);
      store.set(scaleVisibleAtom, false);
      expect(store.get(effectiveColorNotesAtom)).toEqual([]);
    });
  });

  describe("setFingeringPatternAtom — sets pattern without side-effects on chord", () => {
    it("sets fingeringPatternAtom to the requested value", () => {
      const store = makeStore();
      store.set(setFingeringPatternAtom, "caged");
      expect(store.get(fingeringPatternAtom)).toBe("caged");
    });

    it.each<[string, "one-string" | "two-strings" | "caged" | "none" | "3nps"]>([
      ["I", "one-string"],
      ["V", "two-strings"],
      ["IV", "caged"],
      ["ii", "none"],
      ["iii", "3nps"],
    ])("preserves the active step's cached degree='%s' across pattern change to %s", (degree, pattern) => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "x", degree: degree as import("@fretflow/core").DegreeId, duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
      store.set(setFingeringPatternAtom, pattern);
      expect(store.get(fingeringPatternAtom)).toBe(pattern);
      expect(store.get(activeChordCachedDegreeAtom)).toBe(degree);
    });
  });

  describe("progression action integration", () => {
    it("setScaleNameAtom remaps progression degree labels by ordinal and preserves the cursor", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
        { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
        { id: "three", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
      store.set(activeProgressionStepIndexAtom, 2);
      store.set(setScaleNameAtom, "Natural Minor");
      expect(store.get(progressionStepsAtom).map((s) => s.degree)).toEqual(["i", "v", "VI"]);
      expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
    });

    it("setFingeringPatternAtom does NOT pause progression playback for any pattern", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
      store.set(setProgressionPlayingAtom, true);
      store.set(setFingeringPatternAtom, "one-string");

      expect(store.get(progressionPlayingAtom)).toBe(true);
    });

    it("resetAtom resets persisted progression tempo", () => {
      const store = makeStore();
      store.set(progressionTempoBpmAtom, 140);
      store.set(resetAtom);
      expect(store.get(progressionTempoBpmAtom)).toBe(90);
    });
  });
});
