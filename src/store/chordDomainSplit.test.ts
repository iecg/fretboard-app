// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import {
  LENS_REGISTRY,
  type LensAvailabilityContext,
} from "@fretflow/core";
import { chordMemberFactsAtom, practiceLensAtom } from "./chordOverlayAtoms";
import { lensAvailabilityContextAtom, lensAvailabilityAtom } from "./practiceLensAtoms";
import { progressionStepsAtom } from "./progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import { updateActiveChordAtom } from "./songStateAtoms";

function makeStore() {
  const store = createStore();
  // Phase 2.5: the chord is owned by the active progression step. Each test
  // seeds a single manual-root step so `chordRootAtom` / `chordTypeAtom`
  // resolve to specific values; `disableChordOverlay` (below) empties the
  // progression for "overlay off" cases.
  //
  // `degree: "ii"` resolves in every diatonic scale (Major, Dorian, …) so
  // the tests can swap scales freely without the step turning `unavailable`.
  store.set(progressionStepsAtom, [
    {
      id: "test-step",
      degree: "ii",
      duration: { value: 1, unit: "bar" },
      qualityOverride: null,
      manualRoot: "C",
    },
  ]);
  return store;
}

function setChord(store: ReturnType<typeof createStore>, root: string, quality: string) {
  store.set(updateActiveChordAtom, { root, quality });
}

function disableChordOverlay(store: ReturnType<typeof createStore>) {
  store.set(progressionStepsAtom, []);
}

describe("chordMemberFactsAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when chord overlay is off", () => {
    const store = makeStore();
    disableChordOverlay(store);
    expect(store.get(chordMemberFactsAtom)).toHaveLength(0);
  });

  it("returns all members for a triad regardless of scale", () => {
    const store = makeStore();
    setChord(store, "C", "Major Triad");
    const facts = store.get(chordMemberFactsAtom);
    expect(facts).toHaveLength(3);
  });

  it("root member has isChordRoot=true, others false", () => {
    const store = makeStore();
    setChord(store, "G", "Dominant 7th");
    const facts = store.get(chordMemberFactsAtom);
    const rootFact = facts.find((f) => f.isChordRoot);
    expect(rootFact).toBeDefined();
    expect(rootFact!.internalNote).toBe("G");
    expect(rootFact!.semitone).toBe(0);
    const nonRoots = facts.filter((f) => !f.isChordRoot);
    expect(nonRoots.length).toBe(3); // B, D, F
  });

  it("exposes correct semitones for Dominant 7th (G)", () => {
    const store = makeStore();
    setChord(store, "G", "Dominant 7th");
    const facts = store.get(chordMemberFactsAtom);
    const semitones = facts.map((f) => f.semitone).sort((a, b) => a - b);
    expect(semitones).toEqual([0, 4, 7, 10]); // root, 3, 5, b7
  });

  it("exposes correct internal notes for C Minor Triad", () => {
    const store = makeStore();
    setChord(store, "C", "Minor Triad");
    const facts = store.get(chordMemberFactsAtom);
    const notes = facts.map((f) => f.internalNote);
    expect(notes).toContain("C");
    expect(notes).toContain("D#"); // b3
    expect(notes).toContain("G");
  });

  it("does NOT depend on scale — same result regardless of rootNoteAtom/scaleNameAtom", () => {
    // Phase 2.5: set the scale FIRST, then pin manualRoot/qualityOverride.
    // Otherwise the rootNote-change listener transposes manualRoot.
    const storeA = makeStore();
    storeA.set(rootNoteAtom, "A");
    storeA.set(scaleNameAtom, "Major");
    setChord(storeA, "C", "Major Triad");

    // Scale F# Dorian (very different from A major)
    const storeB = makeStore();
    storeB.set(rootNoteAtom, "F#");
    storeB.set(scaleNameAtom, "Dorian");
    setChord(storeB, "C", "Major Triad");

    const factsA = storeA.get(chordMemberFactsAtom);
    const factsB = storeB.get(chordMemberFactsAtom);

    // Both should give the exact same chord facts
    expect(factsA.map((f) => f.internalNote)).toEqual(
      factsB.map((f) => f.internalNote),
    );
    expect(factsA.map((f) => f.semitone)).toEqual(
      factsB.map((f) => f.semitone),
    );
    expect(factsA.map((f) => f.isChordRoot)).toEqual(
      factsB.map((f) => f.isChordRoot),
    );
  });

  it("memberName is formatted correctly (root=1, b3=♭3, b7=♭7)", () => {
    const store = makeStore();
    setChord(store, "G", "Minor 7th");
    const facts = store.get(chordMemberFactsAtom);
    const names = facts.map((f) => f.memberName);
    expect(names).toContain("1");
    expect(names).toContain("♭3");
    expect(names).toContain("5");
    expect(names).toContain("♭7");
  });
});

describe("Focus removal", () => {
  it("chord domain is scale-free: chordMemberFactsAtom returns same facts for any scale", () => {
    // Set rootNote + scale FIRST, then setChord — otherwise the Phase 2.2
    // manualRoot transposition listener would shift the seeded chord when
    // rootNoteAtom changes, defeating the test's "same chord, different scale"
    // premise.
    const storeA = makeStore();
    storeA.set(rootNoteAtom, "A");
    storeA.set(scaleNameAtom, "Major");
    setChord(storeA, "C", "Major Triad");

    const storeB = makeStore();
    storeB.set(rootNoteAtom, "F#");
    storeB.set(scaleNameAtom, "Dorian");
    setChord(storeB, "C", "Major Triad");

    const factsA = storeA.get(chordMemberFactsAtom);
    const factsB = storeB.get(chordMemberFactsAtom);
    expect(factsA.map((f) => f.internalNote)).toEqual(factsB.map((f) => f.internalNote));
    expect(factsA.map((f) => f.semitone)).toEqual(factsB.map((f) => f.semitone));
  });
});

describe("LENS_REGISTRY", () => {
  it("contains exactly two chord-overlay lenses (tones + lead)", () => {
    const ids = LENS_REGISTRY.map((e) => e.id);
    expect(ids).toContain("tones");
    expect(ids).toContain("lead");
    expect(ids).not.toContain("targets");
    expect(ids).not.toContain("guide-tones");
    expect(ids).not.toContain("tension");
    expect(ids).not.toContain("color");
    expect(ids).not.toContain("targets-color");
    expect(ids).toHaveLength(2);
  });

  it("every entry has a non-empty label and description", () => {
    for (const entry of LENS_REGISTRY) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it("uses correct labels matching the target visible names", () => {
    const byId = Object.fromEntries(LENS_REGISTRY.map((e) => [e.id, e.label]));
    expect(byId["tones"]).toBe("Tones");
    expect(byId["lead"]).toBe("Lead");
    expect(byId["targets"]).toBeUndefined();
    expect(byId["guide-tones"]).toBeUndefined();
    expect(byId["tension"]).toBeUndefined();
    expect(byId["targets-color"]).toBeUndefined();
    expect(byId["color"]).toBeUndefined();
  });

  it("no lens has hideWhenUnavailable=true (Task 4.1 — both lenses always shown)", () => {
    for (const entry of LENS_REGISTRY) {
      expect(entry.hideWhenUnavailable).toBeFalsy();
    }
  });

  it("tones lens is available with chord overlay only", () => {
    const entry = LENS_REGISTRY.find((e) => e.id === "tones")!;
    const ctx: LensAvailabilityContext = {
      hasChordOverlay: true,
      hasGuideTones: false,
      hasColorNotes: false,
      hasOutsideTones: false,
    };
    expect(entry.isAvailable(ctx)).toBe(true);
  });

  describe("tones lens", () => {
    const entry = LENS_REGISTRY.find((e) => e.id === "tones")!;

    it("is available when chord overlay is active", () => {
      const ctx: LensAvailabilityContext = {
        hasChordOverlay: true,
        hasGuideTones: false,
        hasColorNotes: false,
        hasOutsideTones: false,
      };
      expect(entry.isAvailable(ctx)).toBe(true);
      expect(entry.unavailableReason(ctx)).toBeNull();
    });

    it("is unavailable without chord overlay, reason explains why", () => {
      const ctx: LensAvailabilityContext = {
        hasChordOverlay: false,
        hasGuideTones: false,
        hasColorNotes: false,
        hasOutsideTones: false,
      };
      expect(entry.isAvailable(ctx)).toBe(false);
      expect(entry.unavailableReason(ctx)).toMatch(/chord overlay/i);
    });
  });

  describe("removed lenses", () => {
    it("color lens id does not exist in LENS_REGISTRY", () => {
      const entry = LENS_REGISTRY.find((e) => (e.id as string) === "color");
      expect(entry).toBeUndefined();
    });

    it("targets-color lens id does not exist in LENS_REGISTRY", () => {
      const entry = LENS_REGISTRY.find((e) => (e.id as string) === "targets-color");
      expect(entry).toBeUndefined();
    });

    it("targets lens id does not exist in LENS_REGISTRY", () => {
      const entry = LENS_REGISTRY.find((e) => (e.id as string) === "targets");
      expect(entry).toBeUndefined();
    });

    it("guide-tones lens id does not exist in LENS_REGISTRY", () => {
      const entry = LENS_REGISTRY.find((e) => (e.id as string) === "guide-tones");
      expect(entry).toBeUndefined();
    });

    it("tension lens id does not exist in LENS_REGISTRY", () => {
      const entry = LENS_REGISTRY.find((e) => (e.id as string) === "tension");
      expect(entry).toBeUndefined();
    });
  });

  describe("lead lens", () => {
    const entry = LENS_REGISTRY.find((e) => e.id === "lead")!;

    it("is available when chord overlay is active", () => {
      const ctx: LensAvailabilityContext = {
        hasChordOverlay: true,
        hasGuideTones: false,
        hasColorNotes: false,
        hasOutsideTones: true,
      };
      expect(entry.isAvailable(ctx)).toBe(true);
    });

    it("is unavailable without chord overlay", () => {
      const ctx: LensAvailabilityContext = {
        hasChordOverlay: false,
        hasGuideTones: true,
        hasColorNotes: false,
        hasOutsideTones: false,
      };
      expect(entry.isAvailable(ctx)).toBe(false);
      expect(entry.unavailableReason(ctx)).toMatch(/chord overlay/i);
    });
  });
});

describe("lensAvailabilityContextAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hasChordOverlay=false when chord overlay is off", () => {
    const store = makeStore();
    disableChordOverlay(store);
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasChordOverlay).toBe(false);
  });

  it("hasChordOverlay=true when chord type is set", () => {
    const store = makeStore();
    setChord(store, "C", "Major Triad");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasChordOverlay).toBe(true);
  });

  it("hasGuideTones=true for seventh chords (Dominant 7th has 3rd + b7)", () => {
    const store = makeStore();
    setChord(store, "G", "Dominant 7th");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasGuideTones).toBe(true);
  });

  it("hasGuideTones=false for power chord (no 3rd or 7th)", () => {
    const store = makeStore();
    setChord(store, "A", "Power Chord (5)");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasGuideTones).toBe(false);
  });

  it("hasGuideTones=true for triad with 3rd (Major Triad)", () => {
    const store = makeStore();
    setChord(store, "C", "Major Triad");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasGuideTones).toBe(true); // has major 3rd
  });

  it("hasColorNotes=false for C Major (reference scale, no divergent notes)", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    setChord(store, "C", "Major Triad");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasColorNotes).toBe(false);
  });

  it("hasColorNotes=true for D Dorian (B♮ diverges from D Natural Minor)", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "D");
    store.set(scaleNameAtom, "Dorian");
    setChord(store, "D", "Minor 7th");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasColorNotes).toBe(true);
  });

  it("hasOutsideTones=true when chord root is outside scale", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    setChord(store, "C#", "Minor Triad");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasOutsideTones).toBe(true);
  });

  it("hasOutsideTones=false when chord is fully in-scale", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    setChord(store, "C", "Major Triad");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasOutsideTones).toBe(false);
  });
});

describe("lensAvailabilityAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns two entries matching LENS_REGISTRY ids (tones + lead)", () => {
    const store = makeStore();
    const entries = store.get(lensAvailabilityAtom);
    expect(entries).toHaveLength(2);
    const ids = entries.map((e) => e.id);
    expect(ids).toContain("tones");
    expect(ids).toContain("lead");
  });

  it("all entries unavailable when chord overlay is off", () => {
    const store = makeStore();
    disableChordOverlay(store);
    const entries = store.get(lensAvailabilityAtom);
    expect(entries.every((e) => !e.available)).toBe(true);
  });

  it("all entries have non-empty label and description", () => {
    const store = makeStore();
    const entries = store.get(lensAvailabilityAtom);
    for (const e of entries) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(0);
    }
  });

  it("both lenses unavailable when chord overlay is off (no hasChordOverlay)", () => {
    const store = makeStore();
    disableChordOverlay(store);
    const entries = store.get(lensAvailabilityAtom);
    expect(entries.every((e) => !e.available)).toBe(true);
  });

  it("lead lens available when chord has outside tones", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    setChord(store, "C#", "Minor Triad");
    const entries = store.get(lensAvailabilityAtom);
    const leadEntry = entries.find((e) => e.id === "lead");
    expect(leadEntry!.available).toBe(true);
    expect(leadEntry!.reason).toBeNull();
  });

  it("tones lens available for power chord (only requires chord overlay)", () => {
    const store = makeStore();
    setChord(store, "E", "Power Chord (5)");
    const entries = store.get(lensAvailabilityAtom);
    const tonesEntry = entries.find((e) => e.id === "tones");
    expect(tonesEntry!.available).toBe(true);
  });

  it("color and targets-color lenses are absent from resolved availability", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "D");
    store.set(scaleNameAtom, "Dorian");
    setChord(store, "D", "Minor 7th");
    const entries = store.get(lensAvailabilityAtom);
    expect(entries.find((e) => (e.id as string) === "color")).toBeUndefined();
    expect(entries.find((e) => (e.id as string) === "targets-color")).toBeUndefined();
  });

  it("reason is null for available lenses", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    setChord(store, "C", "Major Triad");
    store.set(practiceLensAtom, "tones");
    const entries = store.get(lensAvailabilityAtom);
    const tonesEntry = entries.find((e) => e.id === "tones");
    expect(tonesEntry!.available).toBe(true);
    expect(tonesEntry!.reason).toBeNull();
  });

  it("tones lens available for C Major (chord overlay is all that's required)", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    setChord(store, "C", "Major Triad");
    const entries = store.get(lensAvailabilityAtom);
    const tEntry = entries.find((e) => e.id === "tones");
    expect(tEntry!.available).toBe(true);
    expect(tEntry!.reason).toBeNull();
  });
});
