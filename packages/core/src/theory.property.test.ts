import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getScaleNotes, NOTES } from "./theory";
import { SCALES } from "./theoryCatalog";

const noteArb = fc.constantFrom(...NOTES);
const scaleNameArb = fc.constantFrom(...Object.keys(SCALES));

describe("Music theory property-based tests", () => {
  it("scale notes are always valid note names", () => {
    fc.assert(
      fc.property(noteArb, scaleNameArb, (root, scale) => {
        const notes = getScaleNotes(root, scale);
        for (const note of notes) {
          expect(NOTES).toContain(note);
        }
      }),
    );
  });

  it("scale note count matches interval count", () => {
    fc.assert(
      fc.property(noteArb, scaleNameArb, (root, scale) => {
        const notes = getScaleNotes(root, scale);
        const intervals = SCALES[scale];
        expect(notes.length).toBe(intervals.length);
      }),
    );
  });

  it("scale always starts with root note", () => {
    fc.assert(
      fc.property(noteArb, scaleNameArb, (root, scale) => {
        const notes = getScaleNotes(root, scale);
        if (notes.length > 0) {
          expect(notes[0]).toBe(root);
        }
      }),
    );
  });

  it("scale notes have no duplicates", () => {
    fc.assert(
      fc.property(noteArb, scaleNameArb, (root, scale) => {
        const notes = getScaleNotes(root, scale);
        expect(new Set(notes).size).toBe(notes.length);
      }),
    );
  });
});
