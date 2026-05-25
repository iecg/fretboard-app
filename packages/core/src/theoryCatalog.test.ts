import { describe, expect, it } from "vitest";
import {
  getActiveScaleBrowseOption,
  getAdjacentScaleName,
  getAdjacentScaleBrowseOption,
  getEffectiveScaleBrowseMode,
  getScaleBrowseOptions,
  getScaleDisplayLabel,
  getScaleMemberTerm,
  resolveScaleCatalogEntry,
  SCALE_TO_PARENT_MAJOR_OFFSET,
  SCALES,
} from "./theoryCatalog";
import { CHORD_DEFINITIONS } from "./theory";

describe("chord catalog — new chord types round-trip", () => {
  const NEW_CHORD_TYPES: Array<{ key: string; intervals: number[] }> = [
    { key: "Augmented Triad", intervals: [0, 4, 8] },
    { key: "Sus2", intervals: [0, 2, 7] },
    { key: "Minor 6th", intervals: [0, 3, 7, 9] },
    { key: "Diminished 7th", intervals: [0, 3, 6, 9] },
    { key: "Half-Diminished 7th", intervals: [0, 3, 6, 10] },
    { key: "Minor-Major 7th", intervals: [0, 3, 7, 11] },
  ];

  for (const { key, intervals } of NEW_CHORD_TYPES) {
    it(`${key} is defined in CHORD_DEFINITIONS`, () => {
      expect(CHORD_DEFINITIONS[key]).toBeDefined();
    });

    it(`${key} has correct interval set`, () => {
      expect(CHORD_DEFINITIONS[key].members.map((m) => m.semitone)).toEqual(intervals);
    });
  }
});

describe("theory catalog", () => {
  it("resolves every persisted scaleName to the correct family and member", () => {
    expect(resolveScaleCatalogEntry("major").family.id).toBe("major");
    expect(resolveScaleCatalogEntry("minor").member.shortLabel).toBe(
      "Aeolian",
    );
    expect(resolveScaleCatalogEntry("harmonic minor").family.id).toBe(
      "harmonic-minor",
    );
    expect(resolveScaleCatalogEntry("melodic minor").family.id).toBe(
      "melodic-minor",
    );
    expect(resolveScaleCatalogEntry("minor pentatonic").family.id).toBe(
      "pentatonic",
    );
    expect(resolveScaleCatalogEntry("minor blues").family.id).toBe("blues");
  });

  it("wraps family stepping in both directions", () => {
    expect(getAdjacentScaleName("major", -1)).toBe("locrian");
    expect(getAdjacentScaleName("locrian", 1)).toBe("major");
    expect(getAdjacentScaleName("minor blues", 1)).toBe("major blues");
    expect(getAdjacentScaleName("major blues", 1)).toBe("minor blues");
  });

  it("exposes the new harmonic minor and melodic minor interval sets", () => {
    expect(SCALES["locrian 6"]).toEqual([0, 1, 3, 5, 6, 9, 10]);
    expect(SCALES["lydian dominant"]).toEqual([0, 2, 4, 6, 7, 9, 10]);
    expect(SCALES["altered"]).toEqual([0, 1, 3, 4, 6, 8, 10]);
  });

  it("exposes parent major offsets for the new families", () => {
    expect(SCALE_TO_PARENT_MAJOR_OFFSET["harmonic minor"]).toBe(3);
    expect(SCALE_TO_PARENT_MAJOR_OFFSET["phrygian dominant"]).toBe(8);
    expect(SCALE_TO_PARENT_MAJOR_OFFSET["melodic minor"]).toBe(3);
    expect(SCALE_TO_PARENT_MAJOR_OFFSET["locrian #2"]).toBe(6);
  });

  it("uses alias-friendly display labels and hybrid terminology", () => {
    expect(getScaleDisplayLabel("major")).toBe("Major (Ionian)");
    expect(getScaleDisplayLabel("minor")).toBe(
      "Natural Minor (Aeolian)",
    );
    expect(getScaleDisplayLabel("melodic minor")).toBe(
      "Melodic Minor (Jazz Minor)",
    );
    expect(getScaleMemberTerm("dorian")).toBe("Mode");
    expect(getScaleMemberTerm("minor pentatonic")).toBe("Variant");
  });

  it("builds parallel browse options with a fixed root", () => {
    expect(
      getScaleBrowseOptions("C", "major", "parallel").map(
        (option) => option.label,
      ),
    ).toEqual([
      "C Major (Ionian)",
      "C Dorian",
      "C Phrygian",
      "C Lydian",
      "C Mixolydian",
      "C Natural Minor (Aeolian)",
      "C Locrian",
    ]);
  });

  it("builds relative browse options with ordinal mode labels", () => {
    expect(
      getScaleBrowseOptions("C", "major", "relative").map(
        (option) => option.label,
      ),
    ).toEqual([
      "C Major (Ionian) (1st Mode)",
      "D Dorian (2nd Mode)",
      "E Phrygian (3rd Mode)",
      "F Lydian (4th Mode)",
      "G Mixolydian (5th Mode)",
      "A Natural Minor (Aeolian) (6th Mode)",
      "B Locrian (7th Mode)",
    ]);
  });

  it("infers the family context for non-tonic modal selections", () => {
    expect(
      getActiveScaleBrowseOption("D", "dorian", "relative").label,
    ).toBe("D Dorian (2nd Mode)");
    expect(
      getScaleBrowseOptions("E", "phrygian dominant", "relative").map(
        (option) => option.label,
      ),
    ).toEqual([
      "A Harmonic Minor (1st Mode)",
      "B Locrian Natural 6 (2nd Mode)",
      "C Ionian Augmented (3rd Mode)",
      "D Dorian Sharp 4 (4th Mode)",
      "E Phrygian Dominant (5th Mode)",
      "F Lydian Sharp 2 (6th Mode)",
      "G# Altered Diminished (7th Mode)",
    ]);
  });

  it("steps through the computed browse order", () => {
    expect(
      getAdjacentScaleBrowseOption("C", "major", "relative", 1).label,
    ).toBe("D Dorian (2nd Mode)");
    expect(
      getAdjacentScaleBrowseOption("C", "major", "parallel", 1).label,
    ).toBe("C Dorian");
  });

  it("falls back to parallel browsing for pentatonic and blues families", () => {
    expect(getEffectiveScaleBrowseMode("minor pentatonic", "relative")).toBe(
      "parallel",
    );
    expect(
      getScaleBrowseOptions("C", "minor pentatonic", "relative").map(
        (option) => option.label,
      ),
    ).toEqual(["C Minor Pentatonic", "C Major Pentatonic"]);
  });
});
