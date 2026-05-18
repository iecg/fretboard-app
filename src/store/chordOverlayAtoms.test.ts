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
  setChordDegreeAtom,
  availableInversionsAtom,
  voicingMatchesAtom,
  fullChordsEnabledAtom,
} from "./chordOverlayAtoms";
import { allChordMembersAtom } from "./composableSelectors";
import {
  progressionEnabledAtom,
  progressionStepsAtom,
} from "./progressionAtoms";
import { chordSourceIsProgressionAtom } from "./atoms";
import { fingeringPatternAtom } from "./fingeringAtoms";
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
// Group B.5 — degree mode quality override (preserves degree on quality change)
// ---------------------------------------------------------------------------

describe("chordOverlayAtoms — degree mode quality override", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("read path: degree mode + override returns the override quality (V Dom7 in C Major)", () => {
    const store = makeAtomStore([
      [chordDegreeAtom, "V"],
      [chordOverlayModeAtom, "degree"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordQualityOverrideAtom, "Dominant 7th"],
    ]);
    expect(store.get(chordRootAtom)).toBe("G"); // V root from degree
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th"); // user override
    expect(store.get(chordOverlayModeAtom)).toBe("degree"); // mode preserved
  });

  it("read path: degree mode without override returns diatonic default (V Major Triad in C Major)", () => {
    const store = makeAtomStore([
      [chordDegreeAtom, "V"],
      [chordOverlayModeAtom, "degree"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      // chordQualityOverrideAtom intentionally not seeded → null
    ]);
    expect(store.get(chordRootAtom)).toBe("G");
    expect(store.get(chordTypeAtom)).toBe("Major Triad"); // diatonic default
  });

  it("write path: writing chordTypeAtom in degree mode with active degree keeps mode = degree", () => {
    const store = makeAtomStore([
      [chordDegreeAtom, "V"],
      [chordOverlayModeAtom, "degree"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    store.set(chordTypeAtom, "Dominant 7th");
    expect(store.get(chordOverlayModeAtom)).toBe("degree"); // NOT flipped to manual
    expect(store.get(chordQualityOverrideAtom)).toBe("Dominant 7th");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
    expect(store.get(chordRootAtom)).toBe("G"); // V root still derived from degree
  });

  it("write path: writing chordTypeAtom in degree mode WITHOUT active degree falls through to manual", () => {
    // Without a degree set, there's nothing to "preserve" — degree mode with a
    // null degree means overlay-off, so writing a chord type explicitly should
    // engage manual mode (current contract).
    const store = makeAtomStore([
      [chordDegreeAtom, null],
      [chordOverlayModeAtom, "degree"],
    ]);
    store.set(chordTypeAtom, "Dominant 7th");
    expect(store.get(chordOverlayModeAtom)).toBe("manual");
  });

  it("write path: manual mode unchanged — writing chordTypeAtom keeps mode = manual", () => {
    const store = makeAtomStore([
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "C"],
    ]);
    store.set(chordTypeAtom, "Dominant 7th");
    expect(store.get(chordOverlayModeAtom)).toBe("manual");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
  });

  it("setChordDegreeAtom: changing degree clears the quality override", () => {
    const store = makeAtomStore([
      [chordDegreeAtom, "V"],
      [chordOverlayModeAtom, "degree"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordQualityOverrideAtom, "Dominant 7th"],
    ]);
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
    store.set(setChordDegreeAtom, "ii");
    expect(store.get(chordDegreeAtom)).toBe("ii");
    expect(store.get(chordQualityOverrideAtom)).toBeNull();
    expect(store.get(chordTypeAtom)).toBe("Minor Triad"); // ii diatonic default
    expect(store.get(chordRootAtom)).toBe("D");
  });

  it("setChordDegreeAtom: re-selecting the same degree clears the override", () => {
    const store = makeAtomStore([
      [chordDegreeAtom, "V"],
      [chordOverlayModeAtom, "degree"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordQualityOverrideAtom, "Dominant 7th"],
    ]);
    store.set(setChordDegreeAtom, "V"); // re-click same degree clears the pin
    expect(store.get(chordDegreeAtom)).toBe("V");
    expect(store.get(chordQualityOverrideAtom)).toBeNull();
    expect(store.get(chordTypeAtom)).toBe("Major Triad"); // V diatonic default in C major
  });

  it("setChordDegreeAtom: turning overlay off (degree=null) clears override", () => {
    const store = makeAtomStore([
      [chordDegreeAtom, "V"],
      [chordOverlayModeAtom, "degree"],
      [chordQualityOverrideAtom, "Dominant 7th"],
    ]);
    store.set(setChordDegreeAtom, null);
    expect(store.get(chordDegreeAtom)).toBeNull();
    expect(store.get(chordQualityOverrideAtom)).toBeNull();
  });

  it("scale change in degree mode preserves both degree and override (sticky on scale change)", () => {
    // Use Major → Lydian — both define "V" at semitone 7 (Major Triad), so the
    // degree resolves consistently across the scale change. Dorian etc. would
    // remap V → v (minor) which is a different code path (cross-scale degree
    // remapping is outside this fix's scope).
    const store = makeAtomStore([
      [chordDegreeAtom, "V"],
      [chordOverlayModeAtom, "degree"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordQualityOverrideAtom, "Dominant 7th"],
    ]);
    store.set(scaleNameAtom, "Lydian");
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
    expect(store.get(chordQualityOverrideAtom)).toBe("Dominant 7th");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
    // V in C Lydian → G (degree-derived root re-resolves).
    expect(store.get(chordRootAtom)).toBe("G");
  });
});

describe("chordOverlayAtoms - progression source priority", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("progression mode takes over chordRootAtom and chordTypeAtom", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: "Dominant 7th" },
      ]],
    ]);

    expect(store.get(chordRootAtom)).toBe("G");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
  });

  it("writing chordTypeAtom while progression is enabled updates the active step override", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: null },
      ]],
    ]);

    store.set(chordTypeAtom, "Dominant 7th");

    expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBe("Dominant 7th");
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
  });

  it("RESET on chordTypeAtom while progression is enabled clears the active step override", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: "Dominant 7th" },
      ]],
    ]);

    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");

    store.set(chordTypeAtom, RESET);

    expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBeNull();
    expect(store.get(chordTypeAtom)).toBe("Major Triad");
  });

  it("setChordDegreeAtom updates active progression step degree while progression is enabled", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: null },
      ]],
    ]);

    store.set(setChordDegreeAtom, "ii");

    expect(store.get(progressionStepsAtom)[0]?.degree).toBe("ii");
    expect(store.get(chordDegreeAtom)).toBeNull();
    expect(store.get(chordRootAtom)).toBe("D");
    expect(store.get(chordTypeAtom)).toBe("Minor Triad");
  });

  it("writing chordRootAtom while progression is enabled does not switch to manual mode", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: null },
      ]],
    ]);

    store.set(chordRootAtom, "D");

    expect(store.get(chordRootAtom)).toBe("G");
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
  });

  it("writing chordRootAtom updates fallback root when progression is enabled but pattern-disabled", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: null },
      ]],
      [fingeringPatternAtom, "one-string"],
    ]);

    store.set(chordRootAtom, "D");

    expect(store.get(chordRootAtom)).toBe("D");
    expect(store.get(chordOverlayModeAtom)).toBe("manual");
  });

  it("writing chordTypeAtom updates fallback quality without mutating hidden progression when pattern-disabled", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: null },
      ]],
      [fingeringPatternAtom, "one-string"],
    ]);

    store.set(chordTypeAtom, "Dominant 7th");

    expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBeNull();
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
  });

  it("setChordDegreeAtom updates fallback degree without mutating hidden progression when pattern-disabled", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: null },
      ]],
      [fingeringPatternAtom, "one-string"],
    ]);

    store.set(setChordDegreeAtom, "ii");

    expect(store.get(chordDegreeAtom)).toBe("ii");
    expect(store.get(progressionStepsAtom)[0]?.degree).toBe("V");
  });

  it("RESET on chordTypeAtom resets fallback atoms without clearing hidden progression override when pattern-disabled", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: "Dominant 7th" },
      ]],
      [fingeringPatternAtom, "one-string"],
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "D"],
      [chordQualityOverrideAtom, "Minor Triad"],
    ]);

    store.set(chordTypeAtom, RESET);

    expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBe("Dominant 7th");
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
    expect(store.get(chordDegreeAtom)).toBeNull();
    expect(store.get(chordTypeAtom)).toBeNull();
  });

  it("uses fallback chord reads when progression active step is unavailable", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "bad", degree: "not-a-degree", duration: "1-bar", qualityOverride: null },
      ]],
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "D"],
      [chordQualityOverrideAtom, "Minor Triad"],
    ]);

    expect(store.get(chordRootAtom)).toBe("D");
    expect(store.get(chordTypeAtom)).toBe("Minor Triad");
  });

  it("writes fallback chord values when progression active step is unavailable", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "bad", degree: "not-a-degree", duration: "1-bar", qualityOverride: null },
      ]],
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "D"],
      [chordQualityOverrideAtom, "Minor Triad"],
    ]);

    store.set(chordTypeAtom, "Major Triad");
    store.set(chordRootAtom, "F");

    expect(store.get(chordTypeAtom)).toBe("Major Triad");
    expect(store.get(chordRootAtom)).toBe("F");
    expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBeNull();
  });

  it("setChordDegreeAtom updates fallback degree when progression active step is unavailable", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "bad", degree: "not-a-degree", duration: "1-bar", qualityOverride: null },
      ]],
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "D"],
      [chordQualityOverrideAtom, "Minor Triad"],
    ]);

    store.set(setChordDegreeAtom, "ii");

    expect(store.get(chordDegreeAtom)).toBe("ii");
    expect(store.get(progressionStepsAtom)[0]?.degree).toBe("not-a-degree");
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

// ---------------------------------------------------------------------------
// Group E — allChordMembersAtom.scaleDegree population
// ---------------------------------------------------------------------------

describe("allChordMembersAtom — scaleDegree population", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("in-scale note E gets scaleDegree 'iii' in C Major I chord", () => {
    const store = makeAtomStore([
      [chordDegreeAtom, "I"],
      [chordOverlayModeAtom, "degree"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const members = store.get(allChordMembersAtom);
    const eEntry = members.find((m) => m.internalNote === "E");
    expect(eEntry).toBeDefined();
    expect(eEntry!.scaleDegree).toBe("iii");
  });

  it("in-scale root note C gets scaleDegree 'I' in C Major I chord", () => {
    const store = makeAtomStore([
      [chordDegreeAtom, "I"],
      [chordOverlayModeAtom, "degree"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const members = store.get(allChordMembersAtom);
    const cEntry = members.find((m) => m.internalNote === "C");
    expect(cEntry).toBeDefined();
    expect(cEntry!.scaleDegree).toBe("I");
  });

  it("out-of-scale chord tone has scaleDegree undefined", () => {
    // D Major = D, F#, A. F# is not in C Major scale.
    const store2 = makeAtomStore([
      [chordOverlayModeAtom, "manual"],
      [chordRootAtom, "D"],
      [chordTypeAtom, "Major Triad"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const members = store2.get(allChordMembersAtom);
    // D Major = D, F#, A. F# is not in C Major scale.
    const fSharpEntry = members.find((m) => m.internalNote === "F#");
    expect(fSharpEntry).toBeDefined();
    expect(fSharpEntry!.inScale).toBe(false);
    expect(fSharpEntry!.scaleDegree).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Group F — allChordMembersAtom: scaleInterval for out-of-scale notes
// ---------------------------------------------------------------------------

describe("allChordMembersAtom — scaleInterval for out-of-scale notes", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Case 1: C Major + Eb7 — all four chord tones get correct scale-relative scaleInterval", () => {
    const store = makeAtomStore([
      [chordOverlayModeAtom, "manual"],
      [chordRootAtom, "D#"], // D# = Eb internally
      [chordTypeAtom, "Dominant 7th"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const members = store.get(allChordMembersAtom);

    // Eb = D# internally, interval from C = ♭3 (semitone 3)
    const ebEntry = members.find((m) => m.internalNote === "D#");
    expect(ebEntry).toBeDefined();
    expect(ebEntry!.inScale).toBe(false);
    expect(ebEntry!.scaleInterval).toBe("♭3");
    expect(ebEntry!.scaleDegree).toBeUndefined();

    // G is in C Major — scaleInterval should be set too (semitone 7 = "5")
    const gEntry = members.find((m) => m.internalNote === "G");
    expect(gEntry).toBeDefined();
    expect(gEntry!.inScale).toBe(true);
    expect(gEntry!.scaleInterval).toBe("5");
    expect(gEntry!.scaleDegree).toBeDefined();

    // Bb = A# internally, interval from C = ♭7 (semitone 10)
    const bbEntry = members.find((m) => m.internalNote === "A#");
    expect(bbEntry).toBeDefined();
    expect(bbEntry!.inScale).toBe(false);
    expect(bbEntry!.scaleInterval).toBe("♭7");
    expect(bbEntry!.scaleDegree).toBeUndefined();

    // Db = C# internally, interval from C = ♭2 (semitone 1)
    const dbEntry = members.find((m) => m.internalNote === "C#");
    expect(dbEntry).toBeDefined();
    expect(dbEntry!.inScale).toBe(false);
    expect(dbEntry!.scaleInterval).toBe("♭2");
    expect(dbEntry!.scaleDegree).toBeUndefined();
  });

  it("Case 2: A Natural Minor + E7 — G# (only out-of-scale note) gets scaleInterval='7'", () => {
    const store = makeAtomStore([
      [chordOverlayModeAtom, "manual"],
      [chordRootAtom, "E"],
      [chordTypeAtom, "Dominant 7th"],
      [rootNoteAtom, "A"],
      [scaleNameAtom, "Natural Minor"],
    ]);
    const members = store.get(allChordMembersAtom);

    // G# is out of A Natural Minor (which has G natural).
    // G# (index 8) from A tonic (index 9): semitone = (8-9+12)%12 = 11 = major 7th = "7"
    const gsEntry = members.find((m) => m.internalNote === "G#");
    expect(gsEntry).toBeDefined();
    expect(gsEntry!.inScale).toBe(false);
    expect(gsEntry!.scaleInterval).toBe("7");
    expect(gsEntry!.scaleDegree).toBeUndefined();

    // In-scale members also get scaleInterval
    const eEntry = members.find((m) => m.internalNote === "E");
    expect(eEntry).toBeDefined();
    expect(eEntry!.inScale).toBe(true);
    expect(eEntry!.scaleInterval).toBeDefined();

    const bEntry = members.find((m) => m.internalNote === "B");
    expect(bEntry).toBeDefined();
    expect(bEntry!.inScale).toBe(true);
    expect(bEntry!.scaleInterval).toBeDefined();

    const dEntry = members.find((m) => m.internalNote === "D");
    expect(dEntry).toBeDefined();
    expect(dEntry!.inScale).toBe(true);
    expect(dEntry!.scaleInterval).toBeDefined();
  });

  it("Case 3: C Major + Augmented Triad — G# is out-of-scale with scaleInterval='b6'", () => {
    const store = makeAtomStore([
      [chordOverlayModeAtom, "manual"],
      [chordRootAtom, "C"],
      [chordTypeAtom, "Augmented Triad"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const members = store.get(allChordMembersAtom);

    // C: in scale, interval = "1"
    const cEntry = members.find((m) => m.internalNote === "C");
    expect(cEntry).toBeDefined();
    expect(cEntry!.inScale).toBe(true);
    expect(cEntry!.scaleInterval).toBe("1");
    expect(cEntry!.scaleDegree).toBeDefined();

    // E: in scale, interval = "3"
    const eEntry = members.find((m) => m.internalNote === "E");
    expect(eEntry).toBeDefined();
    expect(eEntry!.inScale).toBe(true);
    expect(eEntry!.scaleInterval).toBe("3");
    expect(eEntry!.scaleDegree).toBeDefined();

    // G# = out-of-scale tension tone. G# (index 8) from C tonic (index 0):
    // semitone = 8 = INTERVAL_NAMES[8] = "b6" → formatAccidental → "♭6"
    const gsEntry = members.find((m) => m.internalNote === "G#");
    expect(gsEntry).toBeDefined();
    expect(gsEntry!.inScale).toBe(false);
    expect(gsEntry!.scaleInterval).toBe("♭6");
    expect(gsEntry!.scaleDegree).toBeUndefined();
  });
});

describe("chordSourceIsProgressionAtom", () => {
  it("is false when progression mode is disabled", () => {
    const store = createStore();
    store.set(progressionEnabledAtom, false);
    expect(store.get(chordSourceIsProgressionAtom)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group G — voicing atoms
// ---------------------------------------------------------------------------

describe("voicing atoms", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("availableInversionsAtom excludes 3rd for a triad", () => {
    const store = createStore();
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, "Major Triad");
    store.set(chordOverlayModeAtom, "manual");
    expect(store.get(availableInversionsAtom)).toEqual(["root", "1st", "2nd"]);
  });

  it("availableInversionsAtom includes 3rd for a seventh chord", () => {
    const store = createStore();
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, "Major 7th");
    store.set(chordOverlayModeAtom, "manual");
    expect(store.get(availableInversionsAtom)).toEqual(["root", "1st", "2nd", "3rd"]);
  });

  it("voicingMatchesAtom is empty when Full Chords is off", () => {
    const store = createStore();
    store.set(fullChordsEnabledAtom, false);
    expect(store.get(voicingMatchesAtom)).toEqual([]);
  });
});

