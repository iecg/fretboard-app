import { describe, it, expect } from "vitest";
import { resolveBassNoteInRange } from "./bassLogic";

describe("resolveBassNoteInRange", () => {
  it("keeps the bass note within the specified octave range", () => {
    // Range E1 (40) to E3 (64)
    expect(resolveBassNoteInRange("C", "E1", "E3")).toBe("C2"); // C1 is too low (36), C2 is 48, C3 is 60. C2 is safe.
    
    // If we want a high note, D
    expect(resolveBassNoteInRange("D", "E1", "E3")).toBe("D2"); 
    
    // Test that F can be F1 or F2
    // F1 is 41, which is > 40 (E1). So F1 is valid.
    expect(resolveBassNoteInRange("F", "E1", "E3")).toMatch(/F[12]/);
  });

  it("chooses the octave closest to the previous note when multiple are valid", () => {
    // Valid for C: C2 (48), C3 (60)
    expect(resolveBassNoteInRange("C", "E1", "E3", "B2")).toBe("C3"); // B2 is 59, C3 is 60
    expect(resolveBassNoteInRange("C", "E1", "E3", "D2")).toBe("C2"); // D2 is 50, C2 is 48
  });
});
