import { describe, it, expect } from "vitest";
import { buildQualityGroupsWithDiatonic } from "./qualityGroups";

const labels = {
  diatonic: "Diatonic",
  triads: "Triads",
  sus: "Sus",
  sixths: "Sixths",
  sevenths: "Sevenths",
  extensions: "Extensions",
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
      ["Diatonic", "Triads", "Sus", "Sixths", "Sevenths", "Extensions"],
    );
  });
  it("does not duplicate diatonic values in the base groups", () => {
    const allValues = groups.flatMap((g) => g.options.map((o) => o.value));
    const dupes = allValues.filter((v, i) => allValues.indexOf(v) !== i);
    expect(dupes).toEqual([]);
    const triads = groups.find((g) => g.groupLabel === "Triads")!;
    expect(triads.options.map((o) => o.value)).not.toContain("M");
    const sevenths = groups.find((g) => g.groupLabel === "Sevenths")!;
    expect(sevenths.options.map((o) => o.value)).not.toContain("maj7");
  });
});

describe("buildQualityGroupsWithDiatonic — diminished diatonic root", () => {
  it("vii° (B in C major) yields dim triad + m7b5 seventh", () => {
    const groups = buildQualityGroupsWithDiatonic("major", "C", "B", labels);
    expect(groups[0].groupLabel).toBe("Diatonic");
    expect(groups[0].options.map((o) => o.value)).toEqual(["dim", "m7b5"]);
  });
  it("removes the dim diatonic values from base groups", () => {
    const groups = buildQualityGroupsWithDiatonic("major", "C", "B", labels);
    const triads = groups.find((g) => g.groupLabel === "Triads")!;
    expect(triads.options.map((o) => o.value)).not.toContain("dim");
    const sevenths = groups.find((g) => g.groupLabel === "Sevenths")!;
    expect(sevenths.options.map((o) => o.value)).not.toContain("m7b5");
  });
});

describe("buildQualityGroupsWithDiatonic — borrowed root falls back to guess", () => {
  it("uses the borrowed-quality guess for an out-of-scale root", () => {
    const groups = buildQualityGroupsWithDiatonic("major", "C", "A#", labels);
    expect(groups[0].groupLabel).toBe("Diatonic");
    expect(groups[0].options.map((o) => o.value)).toContain("M");
  });
});

describe("Extensions group", () => {
  const labelsWithExt = {
    diatonic: "Diatonic",
    triads: "Triads",
    sus: "Sus",
    sixths: "Sixths",
    sevenths: "Sevenths",
    extensions: "Extensions",
  };

  // Use a root with no diatonic match so the base groups render in full.
  const groups = buildQualityGroupsWithDiatonic("major", "C", "C#", labelsWithExt);

  it("emits an Extensions group with the nine extended qualities in order", () => {
    const ext = groups.find((g) => g.groupLabel === "Extensions");
    expect(ext).toBeDefined();
    expect(ext!.options.map((o) => o.value)).toEqual([
      "add9", "9", "maj9", "m9", "6/9", "9sus4", "13", "maj13", "m13",
    ]);
  });

  it("Extensions options carry their short display labels", () => {
    const ext = groups.find((g) => g.groupLabel === "Extensions")!;
    expect(ext.options.find((o) => o.value === "maj9")?.label).toBe("M9");
    expect(ext.options.find((o) => o.value === "13")?.label).toBe("13");
  });
});
