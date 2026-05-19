import { describe, expect, it } from "vitest";
import { buildStringSetOptions } from "./voicingStringSets";

describe("buildStringSetOptions", () => {
  it("offers All plus four windows for a triad (toneCount 3)", () => {
    const options = buildStringSetOptions(3);
    expect(options.map((o) => o.id)).toEqual([
      "all", "4·5·6", "3·4·5", "2·3·4", "1·2·3",
    ]);
    expect(options.map((o) => o.labelKey)).toEqual([
      "inspector.stringSetAll",
      "inspector.stringSetBass",
      "inspector.stringSetLowerMid",
      "inspector.stringSetUpperMid",
      "inspector.stringSetTreble",
    ]);
  });

  it("offers All plus three windows for a seventh chord (toneCount 4)", () => {
    const options = buildStringSetOptions(4);
    expect(options.map((o) => o.id)).toEqual([
      "all", "3·4·5·6", "2·3·4·5", "1·2·3·4",
    ]);
    expect(options.map((o) => o.labelKey)).toEqual([
      "inspector.stringSetAll",
      "inspector.stringSetBass",
      "inspector.stringSetMiddle",
      "inspector.stringSetTreble",
    ]);
  });

  it("maps each window id to the correct string-index array (0=high E … 5=low E)", () => {
    const triad = buildStringSetOptions(3);
    // Bass window "4·5·6" → guitar strings 4,5,6 → indices 3,4,5.
    expect(triad[1].strings).toEqual([3, 4, 5]);
    // Treble window "1·2·3" → guitar strings 1,2,3 → indices 0,1,2.
    expect(triad[4].strings).toEqual([0, 1, 2]);
    expect(triad[0].strings).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("offers only All for a chord with six or more tones", () => {
    expect(buildStringSetOptions(6).map((o) => o.id)).toEqual(["all"]);
    expect(buildStringSetOptions(7).map((o) => o.id)).toEqual(["all"]);
  });

  it("offers only All when the tone count is unknown (0)", () => {
    expect(buildStringSetOptions(0).map((o) => o.id)).toEqual(["all"]);
  });

  it("offers five windows for a dyad (toneCount 2)", () => {
    const options = buildStringSetOptions(2);
    expect(options.map((o) => o.labelKey)).toEqual([
      "inspector.stringSetAll",
      "inspector.stringSetBass",
      "inspector.stringSetLowerMid",
      "inspector.stringSetMiddle",
      "inspector.stringSetUpperMid",
      "inspector.stringSetTreble",
    ]);
  });
});
