import { createStore } from "jotai";
import { describe, it, expect } from "vitest";
import { handSizeAtom } from "./settingsAtoms";

describe("handSizeAtom", () => {
  it("defaults to 'medium'", () => {
    const store = createStore();
    expect(store.get(handSizeAtom)).toBe("medium");
  });

  it("accepts small/medium/large", () => {
    const store = createStore();
    for (const s of ["small", "medium", "large"] as const) {
      store.set(handSizeAtom, s);
      expect(store.get(handSizeAtom)).toBe(s);
    }
  });
});
