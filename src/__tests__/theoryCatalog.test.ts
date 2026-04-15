import { describe, expect, it } from "vitest";
import {
  getAdjacentScaleName,
  getScaleDisplayLabel,
  getScaleMemberTerm,
  resolveScaleCatalogEntry,
  SCALE_TO_PARENT_MAJOR_OFFSET,
  SCALES,
} from "../theoryCatalog";

describe("theory catalog", () => {
  it("resolves every persisted scaleName to the correct family and member", () => {
    expect(resolveScaleCatalogEntry("Major").family.id).toBe("major");
    expect(resolveScaleCatalogEntry("Natural Minor").member.shortLabel).toBe(
      "Aeolian",
    );
    expect(resolveScaleCatalogEntry("Harmonic Minor").family.id).toBe(
      "harmonic-minor",
    );
    expect(resolveScaleCatalogEntry("Melodic Minor").family.id).toBe(
      "melodic-minor",
    );
    expect(resolveScaleCatalogEntry("Minor Pentatonic").family.id).toBe(
      "pentatonic",
    );
    expect(resolveScaleCatalogEntry("Minor Blues").family.id).toBe("blues");
  });

  it("wraps family stepping in both directions", () => {
    expect(getAdjacentScaleName("Major", -1)).toBe("Locrian");
    expect(getAdjacentScaleName("Locrian", 1)).toBe("Major");
    expect(getAdjacentScaleName("Minor Blues", 1)).toBe("Major Blues");
    expect(getAdjacentScaleName("Major Blues", 1)).toBe("Minor Blues");
  });

  it("exposes the new harmonic minor and melodic minor interval sets", () => {
    expect(SCALES["Locrian Natural 6"]).toEqual([0, 1, 3, 5, 6, 9, 10]);
    expect(SCALES["Lydian Dominant"]).toEqual([0, 2, 4, 6, 7, 9, 10]);
    expect(SCALES["Altered"]).toEqual([0, 1, 3, 4, 6, 8, 10]);
  });

  it("exposes parent major offsets for the new families", () => {
    expect(SCALE_TO_PARENT_MAJOR_OFFSET["Harmonic Minor"]).toBe(3);
    expect(SCALE_TO_PARENT_MAJOR_OFFSET["Phrygian Dominant"]).toBe(8);
    expect(SCALE_TO_PARENT_MAJOR_OFFSET["Melodic Minor"]).toBe(3);
    expect(SCALE_TO_PARENT_MAJOR_OFFSET["Locrian Natural 2"]).toBe(6);
  });

  it("uses alias-friendly display labels and hybrid terminology", () => {
    expect(getScaleDisplayLabel("Major")).toBe("Major (Ionian)");
    expect(getScaleDisplayLabel("Natural Minor")).toBe(
      "Natural Minor (Aeolian)",
    );
    expect(getScaleDisplayLabel("Melodic Minor")).toBe(
      "Melodic Minor (Jazz Minor)",
    );
    expect(getScaleMemberTerm("Dorian")).toBe("Mode");
    expect(getScaleMemberTerm("Minor Pentatonic")).toBe("Variant");
  });
});
