import { describe, it, expect } from "vitest";
import { buildChordRootGroups, classifyRoot } from "./chordRootOptions";

describe("buildChordRootGroups — C major", () => {
  const groups = buildChordRootGroups("major", "C", false);

  it("emits Diatonic, Borrowed, Chromatic groups in order", () => {
    expect(groups.map((g) => g.groupLabel)).toEqual(["Diatonic", "Borrowed", "Chromatic"]);
  });

  it("diatonic options carry numeral · note · quality-hint labels", () => {
    const diatonic = groups[0].options;
    expect(diatonic[0].label).toBe("I · C · maj");
    expect(diatonic.find((o) => o.value === "F")?.label).toBe("IV · F · maj");
    expect(diatonic.find((o) => o.value === "A")?.label).toBe("vi · A · min");
  });

  it("borrowed options append a harmonic-move annotation when known", () => {
    const borrowed = groups[1].options;
    const bVII = borrowed.find((o) => o.value === "A#");
    expect(bVII?.label).toContain("Modal cadence");
  });

  it("every value is a sharps-form note name", () => {
    const all = groups.flatMap((g) => g.options.map((o) => o.value));
    expect(all).toContain("C");
    expect(all).toContain("A#");
    expect(all).toHaveLength(12);
  });
});

describe("buildChordRootGroups — A minor borrowed numerals", () => {
  const groups = buildChordRootGroups("minor", "A", false);
  const borrowed = groups.find((g) => g.groupLabel === "Borrowed")!.options;
  it("borrowed options carry a numeral and the 'maj' quality hint", () => {
    expect(borrowed.find((o) => o.value === "C#")?.label).toBe("iii · C♯ · maj");
    for (const o of borrowed) {
      expect(o.label.startsWith(" ·")).toBe(false); // no empty leading numeral
      expect(o.label.endsWith("· M")).toBe(false);  // hint is "maj", not raw "M"
    }
  });
});

describe("classifyRoot", () => {
  it("returns inScale + numeral for diatonic, manual + numeral for non-diatonic", () => {
    expect(classifyRoot("major", "C", "F")).toEqual({ inScale: true, numeral: "IV" });
    expect(classifyRoot("major", "C", "A#")).toEqual({ inScale: false, numeral: "bVII" });
    expect(classifyRoot("minor", "A", "C#")).toEqual({ inScale: false, numeral: "III" });
  });
});
