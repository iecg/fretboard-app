import { describe, it, expect, beforeEach, vi } from "vitest";
import { runV2RedesignMigration } from "./v2RedesignMigration";

const STORAGE_PREFIX = "fretflow:";

beforeEach(() => {
  localStorage.clear();
});

describe("runV2RedesignMigration", () => {
  it("removes the retired regionAtom key", () => {
    localStorage.setItem(`${STORAGE_PREFIX}region`, JSON.stringify("position"));
    runV2RedesignMigration();
    expect(localStorage.getItem(`${STORAGE_PREFIX}region`)).toBeNull();
  });

  it("removes the retired chordFretSpread key", () => {
    localStorage.setItem(`${STORAGE_PREFIX}chordFretSpread`, JSON.stringify(2));
    runV2RedesignMigration();
    expect(localStorage.getItem(`${STORAGE_PREFIX}chordFretSpread`)).toBeNull();
  });

  it("is idempotent (running twice does not throw)", () => {
    runV2RedesignMigration();
    expect(() => runV2RedesignMigration()).not.toThrow();
  });

  it("survives a localStorage that throws (private mode)", () => {
    const spy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => runV2RedesignMigration()).not.toThrow();
    spy.mockRestore();
  });
});
