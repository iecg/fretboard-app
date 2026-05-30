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

  it("borrowed major roots use an UPPERCASE numeral matching the maj quality", () => {
    const borrowed = groups[1].options;
    // C major borrows ♭III / ♭VI / ♭VII — all major triads from parallel minor,
    // so the numeral case must be uppercase and the hint must read "maj".
    const bVII = borrowed.find((o) => o.value === "A#");
    expect(bVII?.label.startsWith("♯VI · A♯ · maj")).toBe(true);
    for (const o of borrowed) {
      expect(o.label).toContain("· maj");
    }
  });

  it("chromatic options carry a quality hint (defaulting to maj)", () => {
    const chromatic = groups[2].options;
    expect(chromatic.length).toBeGreaterThan(0);
    for (const o of chromatic) {
      expect(o.label).toContain("· maj");
    }
    expect(chromatic.find((o) => o.value === "C#")?.label).toBe("♯I · C♯ · maj");
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
  it("spells borrowed minor roots with a lowercase numeral matching 'min'", () => {
    // C# in A minor borrows from parallel A major's iii (C#m) → minor → lowercase.
    expect(borrowed.find((o) => o.value === "C#")?.label).toBe("iii · C♯ · min");
    for (const o of borrowed) {
      expect(o.label.startsWith(" ·")).toBe(false); // no empty leading numeral
      expect(o.label.endsWith("· M")).toBe(false);  // hint is "min"/"maj", not raw "M"
    }
  });
  it("spells the borrowed diminished root with a lowercase numeral + ° and 'dim'", () => {
    // G# in A minor borrows from parallel A major's vii° (G#dim).
    expect(borrowed.find((o) => o.value === "G#")?.label).toBe("vii° · G♯ · dim");
  });
});

describe("buildChordRootGroups — auto-accidental scale spelling (C minor)", () => {
  // preferFlats=false on purpose: proper per-degree spelling must NOT depend on
  // the global flat/sharp flag — C natural minor spells one of each letter
  // (C D E♭ F G A♭ B♭), never D♯/G♯/A♯, regardless.
  const groups = buildChordRootGroups("minor", "C", false);
  const diatonic = groups[0].options;
  it("spells the diatonic roots with proper flats, not sharps", () => {
    expect(diatonic.find((o) => o.value === "D#")?.label).toBe("III · E♭ · maj");
    expect(diatonic.find((o) => o.value === "G#")?.label).toBe("VI · A♭ · maj");
    expect(diatonic.find((o) => o.value === "A#")?.label).toBe("VII · B♭ · maj");
  });
});

describe("buildChordRootGroups — quality lock keeps diatonic degrees stable", () => {
  // C minor, locked to major, preferFlats=false. Diatonic roots must keep their
  // in-scale degree string (III / VI / VII), NOT be respelled from the chromatic
  // offset (which would surface E♭ as ♯II). Only the hint follows the lock.
  const groups = buildChordRootGroups(
    "minor",
    "C",
    false,
    { diatonic: "Diatonic", borrowed: "Borrowed", chromatic: "Chromatic" },
    "M",
  );
  const diatonic = groups[0].options;

  it("preserves diatonic numerals under the lock", () => {
    expect(diatonic.find((o) => o.value === "D#")?.label).toBe("III · E♭ · maj");
    expect(diatonic.find((o) => o.value === "G#")?.label).toBe("VI · A♭ · maj");
    expect(diatonic.find((o) => o.value === "A#")?.label).toBe("VII · B♭ · maj");
  });

  it("never relabels a diatonic root as a chromatic alteration", () => {
    for (const o of diatonic) {
      expect(o.label.startsWith("♯")).toBe(false);
    }
  });
});

describe("classifyRoot", () => {
  it("returns inScale + numeral for diatonic, manual + quality-aware numeral for non-diatonic", () => {
    expect(classifyRoot("major", "C", "F")).toEqual({ inScale: true, numeral: "IV" });
    // A# in C major is a major borrowed chord → UPPERCASE numeral, sharp spelling.
    expect(classifyRoot("major", "C", "A#")).toEqual({ inScale: false, numeral: "♯VI" });
    // C# in A minor is a minor borrowed chord → lowercase numeral.
    expect(classifyRoot("minor", "A", "C#")).toEqual({ inScale: false, numeral: "iii" });
  });

  it("matches the dropdown's flat spelling when preferFlats is set", () => {
    // With preferFlats the same A# borrowed chord reads as ♭VII (Bb side).
    expect(classifyRoot("major", "C", "A#", true)).toEqual({ inScale: false, numeral: "♭VII" });
  });
});
