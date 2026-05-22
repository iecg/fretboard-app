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

  it("removes all retired voicing-era keys", () => {
    const keys = [
      "voicingType",
      "voicingInversion",
      "voicingStringSet",
      "voicingConnectors",
      "voicingSectionExpanded",
    ];
    for (const key of keys) {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify("anything"));
    }
    runV2RedesignMigration();
    for (const key of keys) {
      expect(localStorage.getItem(`${STORAGE_PREFIX}${key}`)).toBeNull();
    }
  });

  it("migrates voicingType='caged' → voicing='full'", () => {
    localStorage.setItem(`${STORAGE_PREFIX}voicingType`, JSON.stringify("caged"));
    runV2RedesignMigration();
    const next = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}voicing`) ?? "null");
    expect(next).toBe("full");
  });

  it("migrates voicingType='drop2' → voicing='close'", () => {
    localStorage.setItem(`${STORAGE_PREFIX}voicingType`, JSON.stringify("drop2"));
    runV2RedesignMigration();
    const next = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}voicing`) ?? "null");
    expect(next).toBe("close");
  });

  it("migrates voicingType='triad' → voicing='close'", () => {
    localStorage.setItem(`${STORAGE_PREFIX}voicingType`, JSON.stringify("triad"));
    runV2RedesignMigration();
    const next = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}voicing`) ?? "null");
    expect(next).toBe("close");
  });

  it("migrates voicingConnectors=false → voicing='off' (connectors-off wins over voicingType)", () => {
    localStorage.setItem(`${STORAGE_PREFIX}voicingType`, JSON.stringify("caged"));
    localStorage.setItem(`${STORAGE_PREFIX}voicingConnectors`, JSON.stringify(false));
    runV2RedesignMigration();
    const next = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}voicing`) ?? "null");
    expect(next).toBe("off");
  });

  it("does not write voicing when an existing v2 value is present", () => {
    localStorage.setItem(`${STORAGE_PREFIX}voicingType`, JSON.stringify("drop2"));
    localStorage.setItem(`${STORAGE_PREFIX}voicing`, JSON.stringify("full"));
    runV2RedesignMigration();
    const next = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}voicing`) ?? "null");
    expect(next).toBe("full"); // unchanged
  });

  it("writes nothing when no v1 voicing keys are present", () => {
    runV2RedesignMigration();
    expect(localStorage.getItem(`${STORAGE_PREFIX}voicing`)).toBeNull();
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
