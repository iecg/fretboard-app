import { describe, it, expect } from "vitest";
import { createStore } from "jotai";
import { applyGenreStyleAtom, progressionTempoBpmAtom } from "./progressionAtoms";
import { getGenreStyle } from "../progressions/audio/genres";

describe("applyGenreStyleAtom tempo", () => {
  it("applies the genre's suggestedTempo to the tempo atom", () => {
    const store = createStore();
    store.set(progressionTempoBpmAtom, 60); // a value no genre suggests
    store.set(applyGenreStyleAtom, "funk");
    expect(store.get(progressionTempoBpmAtom)).toBe(getGenreStyle("funk")!.suggestedTempo);
  });
  it("applies tempo for a different genre too", () => {
    const store = createStore();
    store.set(applyGenreStyleAtom, "jazz");
    expect(store.get(progressionTempoBpmAtom)).toBe(getGenreStyle("jazz")!.suggestedTempo);
  });
});
