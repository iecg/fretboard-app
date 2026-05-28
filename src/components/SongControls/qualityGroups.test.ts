import { describe, it, expect } from "vitest";
import { buildQualityGroupsWithDiatonic } from "./qualityGroups";

const labels = {
  diatonic: "Diatonic",
  triads: "Triads",
  sus: "Sus",
  sixths: "Sixths",
  sevenths: "Sevenths",
};

describe("buildQualityGroupsWithDiatonic — in-key root", () => {
  const groups = buildQualityGroupsWithDiatonic("major", "C", "F", labels);
  it("puts Diatonic first with triad + seventh entries", () => {
    expect(groups[0].groupLabel).toBe("Diatonic");
    const vals = groups[0].options.map((o) => o.value);
    expect(vals).toContain("M");    // IV triad
    expect(vals).toContain("maj7"); // IV seventh
    expect(vals).toEqual(["M", "maj7"]); // exactly 2 options, triad first
  });
  it("keeps the existing quality groups after Diatonic", () => {
    expect(groups.map((g) => g.groupLabel)).toEqual(
      ["Diatonic", "Triads", "Sus", "Sixths", "Sevenths"],
    );
  });
});

describe("buildQualityGroupsWithDiatonic — diminished diatonic root", () => {
  it("vii° (B in C major) yields dim triad + m7b5 seventh", () => {
    const groups = buildQualityGroupsWithDiatonic("major", "C", "B", labels);
    expect(groups[0].groupLabel).toBe("Diatonic");
    expect(groups[0].options.map((o) => o.value)).toEqual(["dim", "m7b5"]);
  });
});

describe("buildQualityGroupsWithDiatonic — borrowed root falls back to guess", () => {
  it("uses the borrowed-quality guess for an out-of-scale root", () => {
    const groups = buildQualityGroupsWithDiatonic("major", "C", "A#", labels);
    expect(groups[0].groupLabel).toBe("Diatonic");
    expect(groups[0].options.map((o) => o.value)).toContain("M");
  });
});
