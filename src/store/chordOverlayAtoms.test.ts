// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createStore, type Atom } from "jotai";
import { RESET } from "jotai/utils";
import { k } from "../test-utils/storage";
import {
  chordDegreeAtom,
  chordOverlayModeAtom,
  chordRootAtom,
  chordRootOverrideAtom,
  chordTypeAtom,
  chordQualityOverrideAtom,
} from "./chordOverlayAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import { makeAtomStore } from "../test-utils/renderWithAtoms";

// Trigger onMount for an atom so atomWithStorage reads from localStorage.
// Returns cleanup (unsubscribe) function.
function mount<T>(
  store: ReturnType<typeof createStore>,
  atom: Atom<T>,
): () => void {
  return store.sub(atom, () => {});
}

// ---------------------------------------------------------------------------
// Group A — degree mode (read path)
// ---------------------------------------------------------------------------

describe("chordOverlayAtoms — degree mode (read path)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("chordRootAtom returns diatonic root for I in C Major", () => {
    const store = makeAtomStore([
      [chordDegreeAtom, "I"],
      [chordOverlayModeAtom, "degree"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(store.get(chordRootAtom)).toBe("C");
  });

  it("chordTypeAtom returns diatonic quality for I in C Major", () => {
    const store = makeAtomStore([
      [chordDegreeAtom, "I"],
      [chordOverlayModeAtom, "degree"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(store.get(chordTypeAtom)).toBe("Major Triad");
  });

  it("chordRootAtom returns diatonic root for vi in C Major", () => {
    const store = makeAtomStore([
      [chordDegreeAtom, "vi"],
      [chordOverlayModeAtom, "degree"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(store.get(chordRootAtom)).toBe("A");
  });

  it("chordTypeAtom returns null when chordDegree is null (overlay off)", () => {
    const store = makeAtomStore([
      [chordDegreeAtom, null],
      [chordOverlayModeAtom, "degree"],
    ]);
    expect(store.get(chordTypeAtom)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Group B — manual mode (write path)
// ---------------------------------------------------------------------------

describe("chordOverlayAtoms — manual mode (write path)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writing to chordTypeAtom flips mode to manual", () => {
    // Start: fresh store (mode defaults to "degree")
    const store = makeAtomStore();
    store.set(chordTypeAtom, "Major Triad");
    expect(store.get(chordOverlayModeAtom)).toBe("manual");
    expect(store.get(chordTypeAtom)).toBe("Major Triad");
  });

  it("writing to chordRootAtom flips mode to manual", () => {
    const store = makeAtomStore();
    store.set(chordRootAtom, "G#");
    expect(store.get(chordOverlayModeAtom)).toBe("manual");
    expect(store.get(chordRootAtom)).toBe("G#");
  });

  it("test injection via makeAtomStore seeds chord correctly (manual mode semantics)", () => {
    // Direct atom injection via makeAtomStore (same as renderWithAtoms) sets manual mode.
    // This is correct: tests that seed a specific chord type care about chord rendering,
    // not degree alignment.
    const store = makeAtomStore([
      [chordTypeAtom, "Major Triad"],
      [chordRootAtom, "F#"],
    ]);
    expect(store.get(chordTypeAtom)).toBe("Major Triad");
    // Direct atom injection via renderWithAtoms sets manual mode. This is correct: tests that
    // seed a specific chord type care about chord rendering, not degree alignment.
    expect(store.get(chordOverlayModeAtom)).toBe("manual");
  });
});

// ---------------------------------------------------------------------------
// Group C — RESET propagation
// ---------------------------------------------------------------------------

describe("chordOverlayAtoms — RESET propagation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("RESET on chordTypeAtom resets all backing atoms to defaults", () => {
    const store = makeAtomStore();
    // Put in manual mode with a chord type
    store.set(chordTypeAtom, "Minor Triad");
    expect(store.get(chordOverlayModeAtom)).toBe("manual");

    // Now RESET
    store.set(chordTypeAtom, RESET);
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
    expect(store.get(chordDegreeAtom)).toBeNull();
    expect(store.get(chordTypeAtom)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Group D — storage migration
// ---------------------------------------------------------------------------

describe("chordOverlayAtoms — storage migration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migration: overlay off (no legacy chordType) → degree=null, mode=degree", () => {
    // localStorage is already clear (no legacy keys)
    const store = createStore();
    const unsubDegree = mount(store, chordDegreeAtom);
    const unsubMode = mount(store, chordOverlayModeAtom);

    expect(store.get(chordDegreeAtom)).toBeNull();
    expect(store.get(chordOverlayModeAtom)).toBe("degree");

    unsubDegree();
    unsubMode();
  });

  it("migration: diatonic triad (C Major, I) → degree=I, mode=degree", () => {
    localStorage.setItem(k("chordRoot"), "C");
    localStorage.setItem(k("chordType"), "Major Triad");
    localStorage.setItem(k("rootNote"), "C");
    localStorage.setItem(k("scaleName"), "Major");

    const store = createStore();
    const unsubDegree = mount(store, chordDegreeAtom);
    const unsubMode = mount(store, chordOverlayModeAtom);

    expect(store.get(chordDegreeAtom)).toBe("I");
    expect(store.get(chordOverlayModeAtom)).toBe("degree");

    unsubDegree();
    unsubMode();
  });

  it("migration: non-diatonic / seventh chord → mode=manual, overrides populated", () => {
    // Seventh chords are not in DEGREE_DIATONIC_QUALITY — always manual mode. Intentional.
    localStorage.setItem(k("chordType"), "Major 7th");
    localStorage.setItem(k("chordRoot"), "D");

    const store = createStore();
    const unsubMode = mount(store, chordOverlayModeAtom);
    const unsubQuality = mount(store, chordQualityOverrideAtom);
    const unsubRoot = mount(store, chordRootOverrideAtom);

    expect(store.get(chordOverlayModeAtom)).toBe("manual");
    expect(store.get(chordQualityOverrideAtom)).toBe("Major 7th");

    unsubMode();
    unsubQuality();
    unsubRoot();
  });

  it("migration round-trip: load → save → reload yields same in-memory state", () => {
    // Seed legacy keys for C Major I triad
    localStorage.setItem(k("chordRoot"), "C");
    localStorage.setItem(k("chordType"), "Major Triad");
    localStorage.setItem(k("rootNote"), "C");
    localStorage.setItem(k("scaleName"), "Major");

    // Round 1: create store A, mount atoms, read chordDegreeAtom
    const storeA = createStore();
    const unsubA = mount(storeA, chordDegreeAtom);
    expect(storeA.get(chordDegreeAtom)).toBe("I");
    // After round 1, the new v2 key should be persisted
    expect(localStorage.getItem(k("chordDegree"))).toBe("I");
    unsubA();

    // Round 2: create fresh store B (same localStorage, new v2 keys now written), mount atoms
    const storeB = createStore();
    const unsubB = mount(storeB, chordDegreeAtom);
    expect(storeB.get(chordDegreeAtom)).toBe("I");
    unsubB();
  });
});
