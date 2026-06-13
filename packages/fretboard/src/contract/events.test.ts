import { describe, it, expect } from "vitest";
import type { FretboardEvent } from "./events";

// Type-level smoke: each member is assignable to FretboardEvent and discriminates on `type`.
describe("FretboardEvent union", () => {
  it("accepts all four event members", () => {
    const events: FretboardEvent[] = [
      { type: "noteActivated", frequency: 440, note: "A4", string: 0, fret: 5 },
      { type: "progressionResolved", steps: [{ index: 0, degree: "I", label: "C", unavailable: false }] },
      { type: "activeStepChanged", index: 2, label: "Am" },
      { type: "playbackStateChanged", playing: true, loading: false, blockedReason: null },
    ];
    const types = events.map((e) => e.type).sort();
    expect(types).toEqual(["activeStepChanged", "noteActivated", "playbackStateChanged", "progressionResolved"]);
  });
});
