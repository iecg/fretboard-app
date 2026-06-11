import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { mobilePanelAtom, mobileSheetSnapAtom } from "./uiAtoms";

describe("mobileSheetSnapAtom", () => {
  it("defaults to half (resting half-open sheet)", () => {
    const store = createStore();
    expect(store.get(mobileSheetSnapAtom)).toBe("half");
  });

  it("accepts the three snap ids", () => {
    const store = createStore();
    for (const snap of ["peek", "half", "full"] as const) {
      store.set(mobileSheetSnapAtom, snap);
      expect(store.get(mobileSheetSnapAtom)).toBe(snap);
    }
  });
});

describe("mobilePanelAtom", () => {
  it("defaults to none (no dock panel open)", () => {
    const store = createStore();
    expect(store.get(mobilePanelAtom)).toBe("none");
  });

  it("accepts the three panel ids", () => {
    const store = createStore();
    for (const panel of ["overlay", "song", "none"] as const) {
      store.set(mobilePanelAtom, panel);
      expect(store.get(mobilePanelAtom)).toBe(panel);
    }
  });
});
