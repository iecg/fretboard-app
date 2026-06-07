import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import { cagedShapesAtom, collapseToSingleShape } from "./fingeringAtoms";

describe("collapseToSingleShape", () => {
  it("keeps E when present", () => {
    expect(collapseToSingleShape(["C", "A", "G", "E", "D"])).toBe("E");
    expect(collapseToSingleShape(["E"])).toBe("E");
  });

  it("falls back to the first entry when E is absent", () => {
    expect(collapseToSingleShape(["C", "A"])).toBe("C");
    expect(collapseToSingleShape(["G"])).toBe("G");
  });

  it("falls back to E for an empty list", () => {
    expect(collapseToSingleShape([])).toBe("E");
  });
});

describe("cagedShapesAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to a single E shape", () => {
    const store = createStore();
    const value = store.get(cagedShapesAtom);
    expect(Array.from(value)).toEqual(["E"]);
  });

  it("collapses a persisted multi-shape value to one shape on load", () => {
    localStorage.setItem("fretflow:cagedShapes", JSON.stringify(["C", "A", "G", "E", "D"]));
    const store = createStore();
    const value = store.get(cagedShapesAtom);
    expect(Array.from(value)).toEqual(["E"]);
  });
});
