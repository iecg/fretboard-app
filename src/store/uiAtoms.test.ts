import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { mobileSheetSnapAtom } from "./uiAtoms";

describe("mobileSheetSnapAtom", () => {
  it("defaults to peek", () => {
    const store = createStore();
    expect(store.get(mobileSheetSnapAtom)).toBe("peek");
  });

  it("accepts the three snap ids", () => {
    const store = createStore();
    for (const snap of ["peek", "half", "full"] as const) {
      store.set(mobileSheetSnapAtom, snap);
      expect(store.get(mobileSheetSnapAtom)).toBe(snap);
    }
  });
});
