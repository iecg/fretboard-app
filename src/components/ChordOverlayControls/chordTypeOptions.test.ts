import { describe, it, expect } from "vitest";
import { CHORD_TYPE_SHORT_LABELS, CHORD_TYPE_DISPLAY_ORDER } from "./chordTypeOptions";

describe("extended quality labels and display order", () => {
  const expected: Array<[string, string]> = [
    ["add9", "add9"],
    ["9", "9"],
    ["maj9", "M9"],
    ["m9", "m9"],
    ["6/9", "6/9"],
    ["9sus4", "9sus4"],
    ["13", "13"],
    ["maj13", "M13"],
    ["m13", "m13"],
  ];

  it.each(expected)("%s has short label %s", (key, label) => {
    expect(CHORD_TYPE_SHORT_LABELS[key]).toBe(label);
  });

  it("every new key is present in CHORD_TYPE_DISPLAY_ORDER", () => {
    for (const [key] of expected) {
      expect(CHORD_TYPE_DISPLAY_ORDER).toContain(key);
    }
  });
});
