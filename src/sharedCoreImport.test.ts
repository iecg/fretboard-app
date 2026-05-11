import { describe, expect, it } from "vitest";
import { CAGED_SHAPES, getScaleNotes, STANDARD_TUNING } from "@fretflow/core";

describe("@fretflow/core workspace package", () => {
  it("exposes reusable music and shape primitives to the web app", () => {
    expect(getScaleNotes("C", "Major")).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
    expect(STANDARD_TUNING).toEqual(["E4", "B3", "G3", "D3", "A2", "E2"]);
    expect(CAGED_SHAPES).toContain("C");
  });
});
