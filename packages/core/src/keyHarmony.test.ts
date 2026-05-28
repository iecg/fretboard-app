import { describe, it, expect } from "vitest";
import { getScaleRoots, getHarmonyParentScale, type ScaleRootInfo } from "./keyHarmony";

function byClass(roots: ScaleRootInfo[], cls: ScaleRootInfo["rootClass"]) {
  return roots.filter((r) => r.rootClass === cls).map((r) => r.note);
}

describe("getHarmonyParentScale", () => {
  it("maps pentatonic/blues to their parent", () => {
    expect(getHarmonyParentScale("major pentatonic")).toBe("major");
    expect(getHarmonyParentScale("minor blues")).toBe("minor");
  });
  it("passes through 7-note scales", () => {
    expect(getHarmonyParentScale("dorian")).toBe("dorian");
  });
});

describe("getScaleRoots — C major", () => {
  const roots = getScaleRoots("major", "C");
  it("returns 12 notes ordered by offset", () => {
    expect(roots).toHaveLength(12);
    expect(roots[0]).toMatchObject({ note: "C", offset: 0, rootClass: "diatonic" });
  });
  it("classifies the 7 diatonic roots with their default quality", () => {
    expect(byClass(roots, "diatonic")).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
    expect(roots[9]).toMatchObject({ note: "A", defaultQuality: "m" }); // vi (offset 9)
    expect(roots[11]).toMatchObject({ note: "B", defaultQuality: "dim" }); // vii° (offset 11)
  });
  it("classifies the common borrowed roots (bIII, bVI, bVII)", () => {
    expect(byClass(roots, "borrowed").sort()).toEqual(["A#", "D#", "G#"].sort());
  });
  it("leaves the remaining notes chromatic", () => {
    expect(byClass(roots, "chromatic").sort()).toEqual(["C#", "F#"].sort());
  });
});

describe("getScaleRoots — major pentatonic routes through parent major", () => {
  it("matches the major-key classification", () => {
    const penta = getScaleRoots("major pentatonic", "C");
    const major = getScaleRoots("major", "C");
    expect(penta).toEqual(major);
  });
});

describe("getScaleRoots — A natural minor", () => {
  it("A minor borrows from parallel major (C#, F#, G#)", () => {
    const roots = getScaleRoots("minor", "A");
    expect(roots.filter((r) => r.rootClass === "borrowed").map((r) => r.note).sort())
      .toEqual(["C#", "F#", "G#"].sort());
  });
});

describe("getScaleRoots — modes pick the right parallel pool", () => {
  it("D dorian (minor-flavored) borrows from parallel major", () => {
    const roots = getScaleRoots("dorian", "D");
    expect(roots).toHaveLength(12);
    expect(roots.filter((r) => r.rootClass === "borrowed").length).toBeGreaterThan(0);
    expect(roots.filter((r) => r.rootClass === "borrowed").map((r) => r.note).sort())
      .toEqual(["C#", "F#"].sort());
  });
  it("D mixolydian (major-flavored) borrows from parallel minor (includes F)", () => {
    const roots = getScaleRoots("mixolydian", "D");
    const borrowed = roots.filter((r) => r.rootClass === "borrowed").map((r) => r.note);
    expect(borrowed).toContain("F");
  });
});
