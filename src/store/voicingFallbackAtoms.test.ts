import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import { voicingAtom } from "./chordOverlayAtoms";
import { fingeringPatternAtom } from "./fingeringAtoms";
import {
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
});
