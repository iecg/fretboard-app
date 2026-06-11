import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { mobilePanelAtom } from "./uiAtoms";

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
