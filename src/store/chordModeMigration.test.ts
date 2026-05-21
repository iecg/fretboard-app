import { describe, it, expect, beforeEach } from "vitest";
import { runChordModeMigration } from "./chordModeMigration";
import { k } from "../utils/storage";

describe("runChordModeMigration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('"off" sets chordOverlayHidden to "true" and clears overrides + mode key', () => {
    localStorage.setItem(k("chordOverlayMode"), JSON.stringify("off"));
    localStorage.setItem(k("chordRootOverride"), JSON.stringify("G"));
    localStorage.setItem(k("chordQualityOverride"), JSON.stringify("Major Triad"));
    runChordModeMigration();
    expect(localStorage.getItem(k("chordOverlayHidden"))).toBe(JSON.stringify(true));
    expect(localStorage.getItem(k("chordOverlayMode"))).toBeNull();
    expect(localStorage.getItem(k("chordRootOverride"))).toBeNull();
    expect(localStorage.getItem(k("chordQualityOverride"))).toBeNull();
  });

  it('"manual" discards overrides without setting hidden', () => {
    localStorage.setItem(k("chordOverlayMode"), JSON.stringify("manual"));
    localStorage.setItem(k("chordRootOverride"), JSON.stringify("G"));
    runChordModeMigration();
    expect(localStorage.getItem(k("chordOverlayHidden"))).toBeNull();
    expect(localStorage.getItem(k("chordRootOverride"))).toBeNull();
    expect(localStorage.getItem(k("chordOverlayMode"))).toBeNull();
  });

  it('"degree" is a cleanup-only no-op', () => {
    localStorage.setItem(k("chordOverlayMode"), JSON.stringify("degree"));
    runChordModeMigration();
    expect(localStorage.getItem(k("chordOverlayHidden"))).toBeNull();
    expect(localStorage.getItem(k("chordOverlayMode"))).toBeNull();
  });

  it("is idempotent — second call is a no-op", () => {
    localStorage.setItem(k("chordOverlayMode"), JSON.stringify("off"));
    runChordModeMigration();
    runChordModeMigration();
    expect(localStorage.getItem(k("chordOverlayHidden"))).toBe(JSON.stringify(true));
  });

  it("skips when no legacy mode key exists", () => {
    runChordModeMigration();
    expect(localStorage.getItem(k("chordOverlayHidden"))).toBeNull();
  });
});
