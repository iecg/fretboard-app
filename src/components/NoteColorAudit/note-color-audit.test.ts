import { describe, expect, it } from "vitest";
import {
  AUDIT_DEGREE_MODES,
  AUDIT_LENSES,
  AUDIT_THEMES,
  CHORD_ROW_SWATCHES,
  DEGREE_CHIP_SWATCHES,
  DEGREE_RAMP_SWATCHES,
  FRETBOARD_AUDIT_GROUPS,
  FRETBOARD_NOTE_SWATCHES,
  PRACTICE_PILL_SWATCHES,
  getRenderedAuditCases,
} from "./noteColorAuditFixtures";

describe("note color audit fixtures", () => {
  it("generates unique audit ids for every rendered case", () => {
    const ids = getRenderedAuditCases().map((auditCase) => auditCase.auditId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the required themes, lenses, and degree-color modes", () => {
    expect(AUDIT_THEMES.map((theme) => theme.dataTheme)).toEqual([
      "modern-light",
      "modern-dark",
    ]);
    expect(AUDIT_LENSES.map((lens) => lens.id)).toEqual([
      "none",
      "guide-tones",
      "tension",
    ]);
    expect(AUDIT_DEGREE_MODES.map((mode) => mode.enabled)).toEqual([false, true]);
  });

  it("keeps chord lens contexts scoped to rendered fretboard cases", () => {
    const renderedCases = getRenderedAuditCases();
    const nonFretboardContexts = renderedCases
      .filter((auditCase) => auditCase.surface !== "fretboard")
      .map((auditCase) => auditCase.contextId);
    const nonLensSurfaces = ["practice-pill", "degree-chip", "chord-row", "degree-ramp"];

    expect(new Set(nonFretboardContexts)).toEqual(new Set(["none"]));
    for (const surface of nonLensSurfaces) {
      expect(
        new Set(
          renderedCases
            .filter((auditCase) => auditCase.surface === surface)
            .map((auditCase) => auditCase.contextId),
        ),
      ).toEqual(new Set(["none"]));
    }
    expect(FRETBOARD_AUDIT_GROUPS.map((group) => group.id)).toEqual([
      "none",
      "guide-tones",
      "tension",
    ]);
  });

  it("renders compact lens-delta groups for fretboard notes", () => {
    const renderedFretboardContexts = getRenderedAuditCases()
      .filter((auditCase) => auditCase.surface === "fretboard")
      .map((auditCase) => auditCase.contextId);

    expect(new Set(renderedFretboardContexts)).toEqual(
      new Set(["none", "guide-tones", "tension"]),
    );
    expect(
      FRETBOARD_AUDIT_GROUPS.find((group) => group.id === "guide-tones")?.cases.map(
        (auditCase) => auditCase.id,
      ),
    ).toEqual([
      "guide-tone-emphasis",
      "root-guide-deemphasis",
      "chord-tone-guide-deemphasis",
      "diatonic-guide-deemphasis",
      "color-tone-guide-deemphasis",
    ]);
    expect(
      FRETBOARD_AUDIT_GROUPS.find((group) => group.id === "tension")?.cases.map(
        (auditCase) => auditCase.id,
      ),
    ).toEqual([
      "outside-tension-emphasis",
      "root-tension-emphasis",
      "root-tension-deemphasis",
      "chord-tone-tension-deemphasis",
      "diatonic-tension-deemphasis",
      "color-tone-tension-deemphasis",
    ]);
  });

  it("covers required fretboard note roles", () => {
    expect(FRETBOARD_NOTE_SWATCHES.map((swatch) => swatch.id)).toEqual([
      "key-tonic",
      "note-active",
      "scale-only",
      "note-blue",
      "color-tone",
      "chord-root",
      "chord-root-tension",
      "chord-tone-in-scale",
      "note-diatonic-chord",
      "chord-tone-outside-scale",
    ]);
  });

  it("covers required practice pill and degree chip states", () => {
    expect(PRACTICE_PILL_SWATCHES.map((swatch) => swatch.id)).toEqual([
      "inactive",
      "in-scale",
      "chord-root",
      "guide-tone",
      "in-scale-guide-tone",
      "tension",
      "root-tension",
      "hidden",
      "degree-colored-in-scale",
    ]);
    expect(DEGREE_CHIP_SWATCHES.map((swatch) => swatch.id)).toEqual([
      "inactive",
      "in-scale",
      "tonic",
      "color-note",
      "hidden",
      "degree-colored",
      "degree-colored-color-note",
      "hidden-degree-colored",
    ]);
  });

  it("covers chord row strip audit states", () => {
    expect(CHORD_ROW_SWATCHES.map((swatch) => swatch.id)).toEqual([
      "row-chip-inactive",
      "row-chip-chord-root",
      "row-chip-chord-tone-in-scale",
      "row-chip-outside-chord",
      "legend-chord-root",
      "legend-chord-tone-in-scale",
      "legend-outside-chord",
      "legend-scale-only",
    ]);

    expect(
      getRenderedAuditCases()
        .filter((auditCase) => auditCase.surface === "chord-row")
        .map((auditCase) => auditCase.swatchId),
    ).toEqual([
      "row-chip-inactive",
      "row-chip-chord-root",
      "row-chip-chord-tone-in-scale",
      "row-chip-outside-chord",
      "legend-chord-root",
      "legend-chord-tone-in-scale",
      "legend-outside-chord",
      "legend-scale-only",
      "row-chip-inactive",
      "row-chip-chord-root",
      "row-chip-chord-tone-in-scale",
      "row-chip-outside-chord",
      "legend-chord-root",
      "legend-chord-tone-in-scale",
      "legend-outside-chord",
      "legend-scale-only",
    ]);
  });

  it("covers the real degree color ramp", () => {
    expect(DEGREE_RAMP_SWATCHES.map((swatch) => swatch.id)).toEqual([
      "I",
      "II",
      "III",
      "IV",
      "V",
      "VI",
      "VII",
      "b5",
    ]);
    expect(DEGREE_RAMP_SWATCHES.find((swatch) => swatch.id === "VI")?.degreeColor).toBe(
      "#fdd835",
    );
    expect(DEGREE_RAMP_SWATCHES.find((swatch) => swatch.id === "b5")?.degreeColor).toBe(
      "#0047ff",
    );
  });
});
