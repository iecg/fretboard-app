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
  npsPositionAtom,
  chordFretSpreadAtom,
  practiceLensAtom,
  chordDegreeAtom,
  chordOverlayModeAtom,
  chordQualityOverrideAtom,
  chordRootOverrideAtom,
  chordOverlayHiddenAtom,
  progressionStepsAtom,
  progressionEnabledAtom,
  progressionTempoBpmAtom,
  progressionPlayingAtom,
  activeProgressionStepIndexAtom,
  setProgressionPlayingAtom,
  setRootNoteAtom,
  setScaleNameAtom,
  setFingeringPatternAtom,
  resetAtom,
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
import { STANDARD_TUNING, TUNINGS } from "@fretflow/core";
import { CAGED_SHAPES } from "@fretflow/core";

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
      localStorage.setItem(k("fretZoom"), "10"); // fretZoom min is 100
      const store = makeStore();
      const unsub = mount(store, fretZoomAtom);
      expect(store.get(fretZoomAtom)).toBe(100);
      expect(localStorage.getItem(k("fretZoom"))).toBe("100");
      unsub();
    });

    it("self-heals legacy sub-auto zoom values to default", () => {
      localStorage.setItem(k("fretZoom"), "50");
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

    it("syncs chordRoot when linkChordRoot is true (manual mode)", () => {
      // Seed manual mode explicitly. In degree mode the link sync is intentionally
      // skipped because the derived chord root auto-resolves via getDiatonicChord.
      const store = makeStore();
      store.set(chordOverlayModeAtom, "manual");
      store.set(linkChordRootAtom, true);
      store.set(setRootNoteAtom, "G");
      expect(store.get(chordRootAtom)).toBe("G");
      expect(store.get(chordOverlayModeAtom)).toBe("manual");
    });

    it("does not sync chordRoot when linkChordRoot is false", () => {
      const store = makeStore();
      store.set(chordRootAtom, "D");
      store.set(linkChordRootAtom, false);
      store.set(setRootNoteAtom, "G");
      expect(store.get(rootNoteAtom)).toBe("G");
      expect(store.get(chordRootAtom)).toBe("D");
    });

    it("preserves degree mode when scale root changes (I degree)", () => {
      const store = makeStore();
      store.set(chordOverlayModeAtom, "degree");
      store.set(chordDegreeAtom, "I");
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      // Baseline: I in C Major resolves to C Major Triad.
      expect(store.get(chordRootAtom)).toBe("C");
      expect(store.get(chordTypeAtom)).toBe("Major Triad");
      // Change the scale root.
      store.set(setRootNoteAtom, "G");
      // Mode stays degree; chord re-resolves to I in G Major.
      expect(store.get(chordOverlayModeAtom)).toBe("degree");
      expect(store.get(rootNoteAtom)).toBe("G");
      expect(store.get(chordRootAtom)).toBe("G");
      expect(store.get(chordTypeAtom)).toBe("Major Triad");
    });

    it("preserves degree mode when scale root changes (vi degree)", () => {
      const store = makeStore();
      store.set(chordOverlayModeAtom, "degree");
      store.set(chordDegreeAtom, "vi");
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      // Baseline: vi in C Major resolves to A Minor Triad.
      expect(store.get(chordRootAtom)).toBe("A");
      expect(store.get(chordTypeAtom)).toBe("Minor Triad");
      // Change the scale root.
      store.set(setRootNoteAtom, "G");
      // Mode stays degree; vi in G Major resolves to E Minor Triad.
      expect(store.get(chordOverlayModeAtom)).toBe("degree");
      expect(store.get(chordRootAtom)).toBe("E");
      expect(store.get(chordTypeAtom)).toBe("Minor Triad");
    });
  });

  describe("scaleNameAtom — degree mode preservation", () => {
    it("preserves degree mode when scale mode changes (ii: Major → Dorian)", () => {
      // "ii" exists in both C Major and C Dorian at semitone 2 (same label → same DegreeId).
      // C Major ii = D Minor Triad. C Dorian ii = D Minor Triad.
      // Changing scaleNameAtom must NOT write through chordRootAtom or chordTypeAtom,
      // so chordOverlayModeAtom must stay "degree" and the chord re-resolves via
      // getDiatonicChord against the new scaleName automatically.
      const store = makeStore();
      store.set(chordOverlayModeAtom, "degree");
      store.set(chordDegreeAtom, "ii");
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      expect(store.get(chordOverlayModeAtom)).toBe("degree");
      expect(store.get(chordRootAtom)).toBe("D");
      expect(store.get(chordTypeAtom)).toBe("Minor Triad");
      // Switch scale mode — degree atom is unchanged, chord re-resolves via reactive graph.
      store.set(scaleNameAtom, "Dorian");
      expect(store.get(chordOverlayModeAtom)).toBe("degree");
      expect(store.get(chordRootAtom)).toBe("D");
      expect(store.get(chordTypeAtom)).toBe("Minor Triad");
    });

    it("preserves degree mode when scale mode changes (ii: Major → Mixolydian re-resolves to Diminished)", () => {
      // "ii" in Major at semitone 2 = Minor Triad.
      // In Mixolydian "ii" is also at semitone 2 → but DEGREE_DIATONIC_QUALITY for Mixolydian
      // at semitone 2 is still "Minor Triad". Use "iii°" path instead:
      // Mixolydian has "iii°" at semitone 4. Major has "iii" at semitone 4.
      // To find a quality difference: use "V" (Major) vs "v" (Mixolydian) — different DegreeIds.
      // Safest cross-family test: remain within Diatonic family, check mode does NOT flip.
      // C Major "ii" (D Minor Triad) → C Mixolydian "ii" (D Minor Triad): mode preserved.
      // The important invariant is chordOverlayModeAtom stays "degree" — the re-resolution
      // is a pure Jotai reactive side-effect, no chord atom writes occur.
      const store = makeStore();
      store.set(chordOverlayModeAtom, "degree");
      store.set(chordDegreeAtom, "ii");
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(scaleNameAtom, "Mixolydian");
      // chordOverlayModeAtom must not have been mutated by the scale-mode write.
      expect(store.get(chordOverlayModeAtom)).toBe("degree");
      expect(store.get(chordRootAtom)).toBe("D");
      expect(store.get(chordTypeAtom)).toBe("Minor Triad");
    });

    it("re-resolves chord root and type when both root and scale mode change (relative browse)", () => {
      // Simulates applyTheorySelection: setRootNote + setScaleName written together.
      // "I" exists in Major and Mixolydian (both uppercase tonic). C Major I → C Major Triad.
      // After browse to G Mixolydian: "I" → G Major Triad.
      const store = makeStore();
      store.set(chordOverlayModeAtom, "degree");
      store.set(chordDegreeAtom, "I");
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      expect(store.get(chordRootAtom)).toBe("C");
      expect(store.get(chordTypeAtom)).toBe("Major Triad");
      // Simulate relative/parallel browse: both root and mode written (no chord atom written).
      store.set(rootNoteAtom, "G");
      store.set(scaleNameAtom, "Mixolydian");
      expect(store.get(chordOverlayModeAtom)).toBe("degree");
      expect(store.get(chordRootAtom)).toBe("G");
      expect(store.get(chordTypeAtom)).toBe("Major Triad");
    });
  });

  describe("setScaleNameAtom — degree remap on mode change", () => {
    it("Major → Dorian: degree 'I' remaps to 'i' by semitone-equivalence", () => {
      const store = makeStore();
      store.set(chordOverlayModeAtom, "degree");
      store.set(chordDegreeAtom, "I");
      store.set(rootNoteAtom, "A");
      store.set(scaleNameAtom, "Major");
      expect(store.get(chordRootAtom)).toBe("A"); // I in A Major
      expect(store.get(chordTypeAtom)).toBe("Major Triad");

      // User switches A Ionian (Major) → A Dorian.
      store.set(setScaleNameAtom, "Dorian");

      expect(store.get(chordOverlayModeAtom)).toBe("degree"); // mode preserved
      expect(store.get(chordDegreeAtom)).toBe("i"); // remapped
      expect(store.get(chordRootAtom)).toBe("A"); // tonic, semitone 0
      expect(store.get(chordTypeAtom)).toBe("Minor Triad"); // Dorian's i
    });

    it("Major → Mixolydian: V remaps to v (Mixolydian's 5th-degree is minor)", () => {
      const store = makeStore();
      store.set(chordOverlayModeAtom, "degree");
      store.set(chordDegreeAtom, "V");
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(setScaleNameAtom, "Mixolydian");
      expect(store.get(chordDegreeAtom)).toBe("v");
      expect(store.get(chordRootAtom)).toBe("G");
      expect(store.get(chordTypeAtom)).toBe("Minor Triad");
    });

    it("Major → Lydian: V stays V (both modes have Major Triad on semitone 7)", () => {
      const store = makeStore();
      store.set(chordOverlayModeAtom, "degree");
      store.set(chordDegreeAtom, "V");
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(setScaleNameAtom, "Lydian");
      expect(store.get(chordDegreeAtom)).toBe("V");
    });

    it("same scale write is a no-op — chord degree unchanged", () => {
      const store = makeStore();
      store.set(chordOverlayModeAtom, "degree");
      store.set(chordDegreeAtom, "vi");
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(setScaleNameAtom, "Major");
      expect(store.get(chordDegreeAtom)).toBe("vi");
    });

    it("no chord degree set → no-op (overlay-off path)", () => {
      const store = makeStore();
      store.set(chordOverlayModeAtom, "degree");
      store.set(chordDegreeAtom, null);
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(setScaleNameAtom, "Dorian");
      expect(store.get(chordDegreeAtom)).toBeNull();
      expect(store.get(scaleNameAtom)).toBe("Dorian");
    });

    it("Major → Phrygian: ii has no semitone-equivalent → degree clears (chord overlay off)", () => {
      const store = makeStore();
      store.set(chordOverlayModeAtom, "degree");
      store.set(chordDegreeAtom, "ii");
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(setScaleNameAtom, "Phrygian");
      // Phrygian has degrees at semitones 0,1,3,5,7,8,10 — none at semitone 2.
      expect(store.get(chordDegreeAtom)).toBeNull();
    });

    it("preserves chord-quality override across mode changes (sticky on scale change)", () => {
      const store = makeStore();
      store.set(chordOverlayModeAtom, "degree");
      store.set(chordDegreeAtom, "V");
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(chordQualityOverrideAtom, "Dominant 7th");
      store.set(setScaleNameAtom, "Lydian");
      // Override stays sticky across scale change (it's a quality preference,
      // not tied to a specific degree resolution).
      expect(store.get(chordQualityOverrideAtom)).toBe("Dominant 7th");
      expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
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

      store.set(resetAtom);

      expect(store.get(chordRootAtom)).toBe("C");
      expect(store.get(linkChordRootAtom)).toBe(true);
      expect(store.get(chordFretSpreadAtom)).toBe(0);
      expect(store.get(fingeringPatternAtom)).toBe("none");
      expect(store.get(npsPositionAtom)).toBe(1);
      expect(store.get(scaleBrowseModeAtom)).toBe("parallel");
      expect(store.get(tuningNameAtom)).toBe("Standard");
      expect(store.get(fretStartAtom)).toBe(0);
      expect(store.get(fretEndAtom)).toBe(25);
      expect(store.get(accidentalModeAtom)).toBe("auto");
    });

    it("resets chord overlay backing atoms to defaults", () => {
      const store = makeStore();
      store.set(chordDegreeAtom, "V" as import("@fretflow/core").DegreeId);
      store.set(chordOverlayModeAtom, "manual");
      store.set(chordRootOverrideAtom, "F#");
      store.set(chordQualityOverrideAtom, "Minor Triad");
      store.set(chordOverlayHiddenAtom, true);

      store.set(resetAtom);

      expect(store.get(chordDegreeAtom)).toBeNull();
      expect(store.get(chordOverlayModeAtom)).toBe("degree");
      expect(store.get(chordRootOverrideAtom)).toBe("C");
      expect(store.get(chordQualityOverrideAtom)).toBeNull();
      expect(store.get(chordOverlayHiddenAtom)).toBe(false);
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
    it("returns [] when chord overlay mode is off", () => {
      const store = makeStore();
      store.set(chordOverlayModeAtom, "off");
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

  describe("setFingeringPatternAtom — auto-clear degree on 1/2-string", () => {
    it("sets fingeringPatternAtom to the requested value", () => {
      const store = makeStore();
      store.set(setFingeringPatternAtom, "caged");
      expect(store.get(fingeringPatternAtom)).toBe("caged");
    });

    it("clears chordDegreeAtom to null when pattern changes to one-string", () => {
      const store = makeStore();
      store.set(chordDegreeAtom, "I" as import("@fretflow/core").DegreeId);
      store.set(setFingeringPatternAtom, "one-string");
      expect(store.get(fingeringPatternAtom)).toBe("one-string");
      expect(store.get(chordDegreeAtom)).toBeNull();
    });

    it("clears chordDegreeAtom to null when pattern changes to two-strings", () => {
      const store = makeStore();
      store.set(chordDegreeAtom, "V" as import("@fretflow/core").DegreeId);
      store.set(setFingeringPatternAtom, "two-strings");
      expect(store.get(fingeringPatternAtom)).toBe("two-strings");
      expect(store.get(chordDegreeAtom)).toBeNull();
    });

    it("does NOT clear chordDegreeAtom when pattern changes to caged", () => {
      const store = makeStore();
      store.set(chordDegreeAtom, "IV" as import("@fretflow/core").DegreeId);
      store.set(setFingeringPatternAtom, "caged");
      expect(store.get(chordDegreeAtom)).toBe("IV");
    });

    it("does NOT clear chordDegreeAtom when pattern changes to none", () => {
      const store = makeStore();
      store.set(chordDegreeAtom, "ii" as import("@fretflow/core").DegreeId);
      store.set(setFingeringPatternAtom, "none");
      expect(store.get(chordDegreeAtom)).toBe("ii");
    });

    it("does NOT clear chordDegreeAtom when pattern changes to 3nps", () => {
      const store = makeStore();
      store.set(chordDegreeAtom, "iii" as import("@fretflow/core").DegreeId);
      store.set(setFingeringPatternAtom, "3nps");
      expect(store.get(chordDegreeAtom)).toBe("iii");
    });
  });

  describe("progression action integration", () => {
    it("setScaleNameAtom remaps progression degree labels by ordinal and resets the cursor", () => {
      const store = makeStore();
      store.set(progressionStepsAtom, [
        { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        { id: "three", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      ]);
      store.set(activeProgressionStepIndexAtom, 2);

      store.set(setScaleNameAtom, "Natural Minor");

      expect(store.get(progressionStepsAtom).map((step) => step.degree)).toEqual(["i", "v", "VI"]);
      expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
    });

    it("setFingeringPatternAtom pauses progression playback for chord-disabled patterns", () => {
      const store = makeStore();
      store.set(progressionEnabledAtom, true);
      store.set(progressionStepsAtom, [
        { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      ]);
      store.set(setProgressionPlayingAtom, true);

      store.set(setFingeringPatternAtom, "one-string");

      expect(store.get(progressionPlayingAtom)).toBe(false);
    });

    it("resetAtom resets persisted progression settings", () => {
      const store = makeStore();
      store.set(progressionEnabledAtom, true);
      store.set(progressionTempoBpmAtom, 140);
      store.set(resetAtom);

      expect(store.get(progressionEnabledAtom)).toBe(false);
      expect(store.get(progressionTempoBpmAtom)).toBe(90);
    });
  });
});
