import { describe, it, expect } from "vitest";
import { createStore } from "jotai";
import { audioQualityAtom } from "./audioAtoms";

describe("audioQualityAtom", () => {
  it("defaults to auto and accepts tier values", () => {
    const store = createStore();
    expect(store.get(audioQualityAtom)).toBe("auto");
    store.set(audioQualityAtom, "high");
    expect(store.get(audioQualityAtom)).toBe("high");
  });
});
