import { describe, it, expect } from "vitest";
import { getDiatonicNotes } from "./diatonicNotes";

describe("getDiatonicNotes", () => {
  it("C Major returns 7 in-key notes: C D E F G A B", () => {
    const notes = getDiatonicNotes("major", "C");
    expect(notes).toEqual(new Set(["C", "D", "E", "F", "G", "A", "B"]));
  });

  it("A Natural Minor returns A B C D E F G", () => {
    const notes = getDiatonicNotes("minor", "A");
    expect(notes).toEqual(new Set(["A", "B", "C", "D", "E", "F", "G"]));
  });

  it("returns an empty set for an unknown scale", () => {
    expect(getDiatonicNotes("Bogus Mode", "C").size).toBe(0);
  });

  it("normalizes flat-spelled output to sharps", () => {
    // F Major scale: F G A Bb C D E. Internal storage = sharps form.
    const notes = getDiatonicNotes("major", "F");
    expect(notes.has("A#")).toBe(true); // Bb → A# in sharps form.
    expect(notes.has("Bb")).toBe(false);
  });
});
