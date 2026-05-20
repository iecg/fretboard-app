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
  chordTonesAtom,
  setChordDegreeAtom,
  availableInversionsAtom,
  voicingMatchesAtom,
  voicingConnectorsAtom,
  fullChordsEnabledAtom,
  stringSetOptionsAtom,
  effectiveStringSetAtom,
  voicingTypeAtom,
  voicingInversionAtom,
  voicingStringSetAtom,
} from "./chordOverlayAtoms";
import { allChordMembersAtom } from "./composableSelectors";
import { progressionStepsAtom } from "./progressionAtoms";
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

  const C_MAJOR_DEGREE_SEEDS = [
    [progressionStepsAtom, []],
    [chordOverlayModeAtom, "degree"],
    [rootNoteAtom, "C"],
    [scaleNameAtom, "Major"],
  ] as const;

  it.each<{ degree: string; root: string; type: string }>([
    { degree: "I", root: "C", type: "Major Triad" },
    { degree: "vi", root: "A", type: "Minor Triad" },
  ])("degree=$degree → chordRoot=$root, chordType=$type (C Major)", ({ degree, root, type }) => {
    const store = makeAtomStore([...C_MAJOR_DEGREE_SEEDS, [chordDegreeAtom, degree]]);
    expect(store.get(chordRootAtom)).toBe(root);
    expect(store.get(chordTypeAtom)).toBe(type);
  });

  it("chordTypeAtom returns null when chordDegree is null (overlay off)", () => {
    const store = makeAtomStore([...C_MAJOR_DEGREE_SEEDS, [chordDegreeAtom, null]]);
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
    const store = makeAtomStore([[progressionStepsAtom, []]]);
    store.set(chordTypeAtom, "Major Triad");
    expect(store.get(chordOverlayModeAtom)).toBe("manual");
    expect(store.get(chordTypeAtom)).toBe("Major Triad");
  });

  it("writing to chordRootAtom flips mode to manual", () => {
    const store = makeAtomStore([[progressionStepsAtom, []]]);
    store.set(chordRootAtom, "G#");
    expect(store.get(chordOverlayModeAtom)).toBe("manual");
    expect(store.get(chordRootAtom)).toBe("G#");
  });

  it("test injection via makeAtomStore seeds chord correctly (manual mode semantics)", () => {
    // Direct atom injection via makeAtomStore (same as renderWithAtoms) sets manual mode.
    // This is correct: tests that seed a specific chord type care about chord rendering,
    // not degree alignment.
    const store = makeAtomStore([
      [progressionStepsAtom, []],
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

  const V_IN_C_MAJOR = [
    [progressionStepsAtom, []],
    [chordDegreeAtom, "V"],
    [chordOverlayModeAtom, "degree"],
    [rootNoteAtom, "C"],
    [scaleNameAtom, "Major"],
  ] as const;

  it("read path: degree mode resolves V to G/Major Triad (diatonic default) or to the override quality", () => {
    const noOverride = makeAtomStore([...V_IN_C_MAJOR]);
    expect(noOverride.get(chordRootAtom)).toBe("G");
    expect(noOverride.get(chordTypeAtom)).toBe("Major Triad");

    const withOverride = makeAtomStore([...V_IN_C_MAJOR, [chordQualityOverrideAtom, "Dominant 7th"]]);
    expect(withOverride.get(chordRootAtom)).toBe("G");
    expect(withOverride.get(chordTypeAtom)).toBe("Dominant 7th");
    expect(withOverride.get(chordOverlayModeAtom)).toBe("degree");
  });

  it("write path: writing chordTypeAtom in degree mode with active degree pins override, keeps mode = degree", () => {
    const store = makeAtomStore([...V_IN_C_MAJOR]);
    store.set(chordTypeAtom, "Dominant 7th");
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
    expect(store.get(chordQualityOverrideAtom)).toBe("Dominant 7th");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
    expect(store.get(chordRootAtom)).toBe("G");
  });

  it.each<{ label: string; seeds: readonly (readonly [unknown, unknown])[] }>([
    {
      label: "degree mode without active degree → falls through to manual",
      seeds: [[progressionStepsAtom, []], [chordDegreeAtom, null], [chordOverlayModeAtom, "degree"]],
    },
    {
      label: "already in manual mode → stays in manual",
      seeds: [[chordOverlayModeAtom, "manual"], [chordRootOverrideAtom, "C"]],
    },
  ])("write path: writing chordTypeAtom — $label", ({ seeds }) => {
    const store = makeAtomStore([...seeds] as never);
    store.set(chordTypeAtom, "Dominant 7th");
    expect(store.get(chordOverlayModeAtom)).toBe("manual");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
  });

  it.each<{ label: string; next: "ii" | "V" | null; expectDegree: string | null; expectType: string | null; expectRoot?: string }>([
    { label: "changing degree clears override (V→ii)", next: "ii", expectDegree: "ii", expectType: "Minor Triad", expectRoot: "D" },
    { label: "re-selecting same degree clears override (V→V)", next: "V", expectDegree: "V", expectType: "Major Triad" },
    { label: "turning overlay off (degree=null) clears override", next: null, expectDegree: null, expectType: null },
  ])("setChordDegreeAtom: $label", ({ next, expectDegree, expectType, expectRoot }) => {
    const store = makeAtomStore([...V_IN_C_MAJOR, [chordQualityOverrideAtom, "Dominant 7th"]]);
    store.set(setChordDegreeAtom, next);
    expect(store.get(chordDegreeAtom)).toBe(expectDegree);
    expect(store.get(chordQualityOverrideAtom)).toBeNull();
    if (expectType !== null) expect(store.get(chordTypeAtom)).toBe(expectType);
    if (expectRoot) expect(store.get(chordRootAtom)).toBe(expectRoot);
  });

  it("scale change in degree mode preserves both degree and override (sticky on scale change)", () => {
    // Major → Lydian both define V at semitone 7 (Major Triad), so the degree
    // remains stable across scales. Cross-scale remapping is out of scope here.
    const store = makeAtomStore([...V_IN_C_MAJOR, [chordQualityOverrideAtom, "Dominant 7th"]]);
    store.set(scaleNameAtom, "Lydian");
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
    expect(store.get(chordQualityOverrideAtom)).toBe("Dominant 7th");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
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
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: null },
      ]],
    ]);

    store.set(chordRootAtom, "D");

    expect(store.get(chordRootAtom)).toBe("G");
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
  });

  it("writing chordRootAtom is a no-op when progression is the active chord source (including one-string pattern)", () => {
    // With one-string pattern, progression is now still the active chord source.
    // Writing chordRootAtom while progression controls the chord is a no-op.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: null },
      ]],
      [fingeringPatternAtom, "one-string"],
    ]);

    store.set(chordRootAtom, "D");

    // Progression still controls the root — write is ignored
    expect(store.get(chordRootAtom)).toBe("G");
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
  });

  it("writing chordTypeAtom updates the active progression step override (including one-string pattern)", () => {
    // With one-string pattern, progression is now still the active chord source.
    // Writing chordTypeAtom routes through the progression step override path.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: null },
      ]],
      [fingeringPatternAtom, "one-string"],
    ]);

    store.set(chordTypeAtom, "Dominant 7th");

    expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBe("Dominant 7th");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
  });

  it("setChordDegreeAtom updates the active progression step degree (including one-string pattern)", () => {
    // With one-string pattern, progression is now still the active chord source.
    // setChordDegreeAtom routes through the progression step degree path.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: null },
      ]],
      [fingeringPatternAtom, "one-string"],
    ]);

    store.set(setChordDegreeAtom, "ii");

    expect(store.get(progressionStepsAtom)[0]?.degree).toBe("ii");
    expect(store.get(chordDegreeAtom)).toBeNull();
  });

  it("RESET on chordTypeAtom clears the active progression step override (including one-string pattern)", () => {
    // With one-string pattern, progression is now still the active chord source.
    // RESET on chordTypeAtom routes through the progression step reset path.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: "Dominant 7th" },
      ]],
      [fingeringPatternAtom, "one-string"],
    ]);

    store.set(chordTypeAtom, RESET);

    expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBeNull();
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
    expect(store.get(chordTypeAtom)).toBe("Major Triad"); // V diatonic default in C Major
  });

  it("uses fallback chord reads when progression active step is unavailable", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
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
    const store = makeAtomStore([[progressionStepsAtom, []]]);
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

  function mountAtoms(store: ReturnType<typeof createStore>, atoms: ReadonlyArray<Parameters<typeof mount>[1]>) {
    const unsubs = atoms.map((a) => mount(store, a));
    return () => unsubs.forEach((u) => u());
  }

  it("migration: overlay off (no legacy chordType) → degree=null, mode=degree", () => {
    const store = createStore();
    const unmount = mountAtoms(store, [chordDegreeAtom, chordOverlayModeAtom]);
    expect(store.get(chordDegreeAtom)).toBeNull();
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
    unmount();
  });

  it("migration: diatonic triad (C Major, I) → degree=I, mode=degree", () => {
    localStorage.setItem(k("chordRoot"), "C");
    localStorage.setItem(k("chordType"), "Major Triad");
    localStorage.setItem(k("rootNote"), "C");
    localStorage.setItem(k("scaleName"), "Major");
    const store = createStore();
    const unmount = mountAtoms(store, [chordDegreeAtom, chordOverlayModeAtom]);
    expect(store.get(chordDegreeAtom)).toBe("I");
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
    unmount();
  });

  it("migration: non-diatonic / seventh chord → mode=manual, override populated", () => {
    // Seventh chords are not in DEGREE_DIATONIC_QUALITY — always manual mode.
    localStorage.setItem(k("chordType"), "Major 7th");
    localStorage.setItem(k("chordRoot"), "D");
    const store = createStore();
    const unmount = mountAtoms(store, [chordOverlayModeAtom, chordQualityOverrideAtom, chordRootOverrideAtom]);
    expect(store.get(chordOverlayModeAtom)).toBe("manual");
    expect(store.get(chordQualityOverrideAtom)).toBe("Major 7th");
    unmount();
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
      [progressionStepsAtom, []],
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
      [progressionStepsAtom, []],
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
      [progressionStepsAtom, []],
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
  it("is false when there is no resolvable progression step", () => {
    const store = createStore();
    store.set(progressionStepsAtom, []);
    expect(store.get(chordSourceIsProgressionAtom)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task 3 regression — chord overlay independent of fingering pattern
// ---------------------------------------------------------------------------

describe("chord overlay independent of fingering pattern (Task 3 regression)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each(["one-string", "two-strings"] as const)(
    "chord tones still render with %s fingering",
    (pattern) => {
      const store = makeAtomStore([
        [progressionStepsAtom, []],
        [chordOverlayModeAtom, "manual"],
        [chordRootOverrideAtom, "C"],
        [chordQualityOverrideAtom, "Major Triad"],
        [fingeringPatternAtom, pattern],
      ]);
      expect(store.get(chordTonesAtom).length).toBeGreaterThan(0);
    },
  );

  it("progression is the active chord source even with one-string fingering", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: null },
      ]],
      [fingeringPatternAtom, "one-string"],
    ]);
    expect(store.get(chordSourceIsProgressionAtom)).toBe(true);
    expect(store.get(chordRootAtom)).toBe("G");
    expect(store.get(chordTypeAtom)).toBe("Major Triad");
  });
});

describe("voicing string set", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const MANUAL_C = [
    [progressionStepsAtom, []],
    [chordOverlayModeAtom, "manual"],
    [chordRootOverrideAtom, "C"],
  ] as const;

  it.each<{ quality: string; ids: string[] }>([
    { quality: "Major Triad", ids: ["all", "4·5·6", "3·4·5", "2·3·4", "1·2·3"] },
    { quality: "Major 7th", ids: ["all", "3·4·5·6", "2·3·4·5", "1·2·3·4"] },
  ])("string-set options match tone count for $quality", ({ quality, ids }) => {
    const store = makeAtomStore([...MANUAL_C, [chordQualityOverrideAtom, quality]]);
    expect(store.get(stringSetOptionsAtom).map((o) => o.id)).toEqual(ids);
  });

  it.each<{ label: string; quality: string; expected: number[] }>([
    { label: "valid stored id resolves to its string-index array", quality: "Major Triad", expected: [3, 4, 5] },
    { label: "invalid stored id for chord falls back to all six strings", quality: "Major 7th", expected: [0, 1, 2, 3, 4, 5] },
  ])("effectiveStringSetAtom: $label", ({ quality, expected }) => {
    const store = makeAtomStore([
      ...MANUAL_C,
      [chordQualityOverrideAtom, quality],
      [voicingStringSetAtom, "4·5·6"],
    ]);
    expect(store.get(effectiveStringSetAtom)).toEqual(expected);
  });

  it("voicingMatchesAtom returns engine output for a valid triad window", () => {
    const store = makeAtomStore([
      ...MANUAL_C,
      [chordQualityOverrideAtom, "Major Triad"],
      [voicingTypeAtom, "triad"],
      [voicingStringSetAtom, "4·5·6"],
    ]);
    const matches = store.get(voicingMatchesAtom);
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      for (const n of m.notes) expect([3, 4, 5]).toContain(n.stringIndex);
    }
  });

  it("ignores the string set and inversion while voicingType is caged", () => {
    const store = makeAtomStore([
      ...MANUAL_C,
      [chordQualityOverrideAtom, "Major Triad"],
      [voicingTypeAtom, "caged"],
      [voicingStringSetAtom, "1·2·3"],
      [voicingInversionAtom, "2nd"],
    ]);
    const matches = store.get(voicingMatchesAtom);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.shape !== undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group G — voicing atoms
// ---------------------------------------------------------------------------

describe("voicing atoms", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each<{ quality: string; inversions: string[] }>([
    { quality: "Major Triad", inversions: ["root", "1st", "2nd"] },
    { quality: "Major 7th", inversions: ["root", "1st", "2nd", "3rd"] },
    { quality: "Power Chord (5)", inversions: ["root"] },
  ])("availableInversionsAtom for $quality → $inversions", ({ quality, inversions }) => {
    const store = createStore();
    store.set(progressionStepsAtom, []);
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, quality);
    store.set(chordOverlayModeAtom, "manual");
    expect(store.get(availableInversionsAtom)).toEqual(inversions);
  });

  it("voicingMatchesAtom returns engine output when a chord is active, regardless of Full Chords", () => {
    const store = createStore();
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, "Major Triad");
    store.set(fullChordsEnabledAtom, false);
    expect(store.get(voicingMatchesAtom).length).toBeGreaterThan(0);
  });

  it("voicingConnectorsAtom defaults to true", () => {
    const store = createStore();
    expect(store.get(voicingConnectorsAtom)).toBe(true);
  });
});

