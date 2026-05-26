import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import { voicingAtom, voicingStringSetAtom } from "./chordOverlayAtoms";
import { fingeringPatternAtom } from "./fingeringAtoms";
import {
  fallbackPolygonsAtom,
  fallbackVoicingMatchesAtom,
  hasFallbackPositionsAtom,
} from "./voicingFallbackAtoms";

describe("fallbackVoicingMatchesAtom", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("returns empty when voicing mode is 'close'", () => {
    store.set(voicingAtom, "close");
    expect(store.get(fallbackVoicingMatchesAtom)).toEqual([]);
  });

  it("returns empty when voicing mode is 'off'", () => {
    store.set(voicingAtom, "off");
    expect(store.get(fallbackVoicingMatchesAtom)).toEqual([]);
  });

  it("returns empty when no fingering pattern is active", () => {
    store.set(voicingAtom, "full");
    store.set(fingeringPatternAtom, "none");
    expect(store.get(fallbackVoicingMatchesAtom)).toEqual([]);
  });
});

describe("hasFallbackPositionsAtom", () => {
  it("is false when fallback list is empty", () => {
    const store = createStore();
    store.set(voicingAtom, "close");
    expect(store.get(hasFallbackPositionsAtom)).toBe(false);
  });

  it("derives from fallbackPolygonsAtom, not the string-set-filtered list", () => {
    // Architectural invariant: picker visibility (hasFallbackPositionsAtom)
    // must NOT depend on the user's voicingStringSetAtom selection. Otherwise
    // picking a string set that yields zero in-polygon fits causes the picker
    // to unmount and the user is stuck (see systematic-debugging session
    // 2026-05-26: B7 / C major / Caged).
    const store = createStore();
    store.set(voicingAtom, "full");
    store.set(fingeringPatternAtom, "caged");

    const polygonsBefore = store.get(fallbackPolygonsAtom);
    const hasBefore = store.get(hasFallbackPositionsAtom);

    // Change the user's string-set pick to something different.
    store.set(voicingStringSetAtom, "top-4");
    const polygonsAfter = store.get(fallbackPolygonsAtom);
    const hasAfter = store.get(hasFallbackPositionsAtom);

    // fallbackPolygonsAtom does not depend on voicingStringSetAtom -> same ref.
    expect(polygonsAfter).toBe(polygonsBefore);
    expect(hasAfter).toBe(hasBefore);
  });
});
