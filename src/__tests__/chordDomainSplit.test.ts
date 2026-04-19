// @vitest-environment jsdom
/**
 * Tests for the chord-overlay domain split:
 * 1. chordMemberFactsAtom — chord facts independent of scale
 * 2. lensAvailabilityAtom / lensAvailabilityContextAtom — registry-backed availability
 * 3. Renderer composability — noteSemantics data attributes on FretboardSVG
 *    (renderer tests live in FretboardSVG.test.tsx; atom tests here)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import {
  LENS_REGISTRY,
  type LensAvailabilityContext,
} from "../theory";
import {
  chordMemberFactsAtom,
  chordRootAtom,
  chordTypeAtom,
  rootNoteAtom,
  scaleNameAtom,
  practiceLensAtom,
  lensAvailabilityContextAtom,
  lensAvailabilityAtom,
} from "../store/atoms";

function makeStore() {
  return createStore();
}

// ---------------------------------------------------------------------------
// chordMemberFactsAtom — scale-independent chord member facts
// ---------------------------------------------------------------------------

describe("chordMemberFactsAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when no chord type is set", () => {
    const store = makeStore();
    store.set(chordTypeAtom, null);
    expect(store.get(chordMemberFactsAtom)).toHaveLength(0);
  });

  it("returns all members for a triad regardless of scale", () => {
    const store = makeStore();
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    const facts = store.get(chordMemberFactsAtom);
    expect(facts).toHaveLength(3);
  });

  it("root member has isChordRoot=true, others false", () => {
    const store = makeStore();
    store.set(chordRootAtom, "G");
    store.set(chordTypeAtom, "Dominant 7th");
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
    store.set(chordRootAtom, "G");
    store.set(chordTypeAtom, "Dominant 7th");
    const facts = store.get(chordMemberFactsAtom);
    const semitones = facts.map((f) => f.semitone).sort((a, b) => a - b);
    expect(semitones).toEqual([0, 4, 7, 10]); // root, 3, 5, b7
  });

  it("exposes correct internal notes for C Minor Triad", () => {
    const store = makeStore();
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Minor Triad");
    const facts = store.get(chordMemberFactsAtom);
    const notes = facts.map((f) => f.internalNote);
    expect(notes).toContain("C");
    expect(notes).toContain("D#"); // b3
    expect(notes).toContain("G");
  });

  it("does NOT depend on scale — same result regardless of rootNoteAtom/scaleNameAtom", () => {
    // Scale A Major
    const storeA = makeStore();
    storeA.set(chordRootAtom, "C");
    storeA.set(chordTypeAtom, "Major Triad");
    storeA.set(rootNoteAtom, "A");
    storeA.set(scaleNameAtom, "Major");

    // Scale F# Dorian (very different from C major)
    const storeB = makeStore();
    storeB.set(chordRootAtom, "C");
    storeB.set(chordTypeAtom, "Major Triad");
    storeB.set(rootNoteAtom, "F#");
    storeB.set(scaleNameAtom, "Dorian");

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
    store.set(chordRootAtom, "G");
    store.set(chordTypeAtom, "Minor 7th");
    const facts = store.get(chordMemberFactsAtom);
    const names = facts.map((f) => f.memberName);
    expect(names).toContain("1");
    expect(names).toContain("♭3");
    expect(names).toContain("5");
    expect(names).toContain("♭7");
  });
});

// ---------------------------------------------------------------------------
// LENS_REGISTRY — pure data, no atoms
// ---------------------------------------------------------------------------

describe("LENS_REGISTRY", () => {
  it("contains all five practice lenses", () => {
    const ids = LENS_REGISTRY.map((e) => e.id);
    expect(ids).toContain("targets");
    expect(ids).toContain("guide-tones");
    expect(ids).toContain("color");
    expect(ids).toContain("targets-color");
    expect(ids).toContain("tension");
  });

  it("every entry has a non-empty label and description", () => {
    for (const entry of LENS_REGISTRY) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  describe("targets lens", () => {
    const entry = LENS_REGISTRY.find((e) => e.id === "targets")!;

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

  describe("guide-tones lens", () => {
    const entry = LENS_REGISTRY.find((e) => e.id === "guide-tones")!;

    it("is available when chord overlay + guide tones both present", () => {
      const ctx: LensAvailabilityContext = {
        hasChordOverlay: true,
        hasGuideTones: true,
        hasColorNotes: false,
        hasOutsideTones: false,
      };
      expect(entry.isAvailable(ctx)).toBe(true);
    });

    it("is unavailable when chord has no guide tones", () => {
      const ctx: LensAvailabilityContext = {
        hasChordOverlay: true,
        hasGuideTones: false,
        hasColorNotes: false,
        hasOutsideTones: false,
      };
      expect(entry.isAvailable(ctx)).toBe(false);
      expect(entry.unavailableReason(ctx)).toMatch(/guide tones/i);
    });

    it("is unavailable without chord overlay, reason mentions overlay not guide tones", () => {
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

  describe("color lens", () => {
    const entry = LENS_REGISTRY.find((e) => e.id === "color")!;

    it("is available when chord overlay + color notes both present", () => {
      const ctx: LensAvailabilityContext = {
        hasChordOverlay: true,
        hasGuideTones: false,
        hasColorNotes: true,
        hasOutsideTones: false,
      };
      expect(entry.isAvailable(ctx)).toBe(true);
    });

    it("is unavailable when scale has no color notes", () => {
      const ctx: LensAvailabilityContext = {
        hasChordOverlay: true,
        hasGuideTones: false,
        hasColorNotes: false,
        hasOutsideTones: false,
      };
      expect(entry.isAvailable(ctx)).toBe(false);
      expect(entry.unavailableReason(ctx)).toMatch(/color notes/i);
    });
  });

  describe("tension lens", () => {
    const entry = LENS_REGISTRY.find((e) => e.id === "tension")!;

    it("is available when chord has outside tones", () => {
      const ctx: LensAvailabilityContext = {
        hasChordOverlay: true,
        hasGuideTones: false,
        hasColorNotes: false,
        hasOutsideTones: true,
      };
      expect(entry.isAvailable(ctx)).toBe(true);
    });

    it("is unavailable when chord is fully in-scale", () => {
      const ctx: LensAvailabilityContext = {
        hasChordOverlay: true,
        hasGuideTones: true,
        hasColorNotes: false,
        hasOutsideTones: false,
      };
      expect(entry.isAvailable(ctx)).toBe(false);
      expect(entry.unavailableReason(ctx)).toMatch(/fully within the scale/i);
    });
  });
});

// ---------------------------------------------------------------------------
// lensAvailabilityContextAtom — computes context from live atom state
// ---------------------------------------------------------------------------

describe("lensAvailabilityContextAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hasChordOverlay=false when no chord type", () => {
    const store = makeStore();
    store.set(chordTypeAtom, null);
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasChordOverlay).toBe(false);
  });

  it("hasChordOverlay=true when chord type is set", () => {
    const store = makeStore();
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasChordOverlay).toBe(true);
  });

  it("hasGuideTones=true for seventh chords (Dominant 7th has 3rd + b7)", () => {
    const store = makeStore();
    store.set(chordRootAtom, "G");
    store.set(chordTypeAtom, "Dominant 7th");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasGuideTones).toBe(true);
  });

  it("hasGuideTones=false for power chord (no 3rd or 7th)", () => {
    const store = makeStore();
    store.set(chordRootAtom, "A");
    store.set(chordTypeAtom, "Power Chord (5)");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasGuideTones).toBe(false);
  });

  it("hasGuideTones=true for triad with 3rd (Major Triad)", () => {
    const store = makeStore();
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasGuideTones).toBe(true); // has major 3rd
  });

  it("hasColorNotes=false for C Major (reference scale, no divergent notes)", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasColorNotes).toBe(false);
  });

  it("hasColorNotes=true for D Dorian (B♮ diverges from D Natural Minor)", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "D");
    store.set(scaleNameAtom, "Dorian");
    store.set(chordRootAtom, "D");
    store.set(chordTypeAtom, "Minor 7th");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasColorNotes).toBe(true);
  });

  it("hasOutsideTones=true when chord root is outside scale", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C#");
    store.set(chordTypeAtom, "Minor Triad");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasOutsideTones).toBe(true);
  });

  it("hasOutsideTones=false when chord is fully in-scale", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    const ctx = store.get(lensAvailabilityContextAtom);
    expect(ctx.hasOutsideTones).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// lensAvailabilityAtom — resolved registry entries with available + reason
// ---------------------------------------------------------------------------

describe("lensAvailabilityAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns five entries matching LENS_REGISTRY ids", () => {
    const store = makeStore();
    const entries = store.get(lensAvailabilityAtom);
    expect(entries).toHaveLength(5);
    const ids = entries.map((e) => e.id);
    expect(ids).toContain("targets");
    expect(ids).toContain("tension");
  });

  it("all entries unavailable when no chord overlay", () => {
    const store = makeStore();
    store.set(chordTypeAtom, null);
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

  it("tension lens unavailable when chord fully in-scale (C Major + CMaj triad)", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    const entries = store.get(lensAvailabilityAtom);
    const tensionEntry = entries.find((e) => e.id === "tension");
    expect(tensionEntry!.available).toBe(false);
    expect(tensionEntry!.reason).toMatch(/fully within the scale/i);
  });

  it("tension lens available when chord has outside tones", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C#");
    store.set(chordTypeAtom, "Minor Triad");
    const entries = store.get(lensAvailabilityAtom);
    const tensionEntry = entries.find((e) => e.id === "tension");
    expect(tensionEntry!.available).toBe(true);
    expect(tensionEntry!.reason).toBeNull();
  });

  it("guide-tones lens unavailable for power chord", () => {
    const store = makeStore();
    store.set(chordRootAtom, "E");
    store.set(chordTypeAtom, "Power Chord (5)");
    const entries = store.get(lensAvailabilityAtom);
    const gtEntry = entries.find((e) => e.id === "guide-tones");
    expect(gtEntry!.available).toBe(false);
    expect(gtEntry!.reason).toMatch(/guide tones/i);
  });

  it("color lens unavailable for C Major (no color notes)", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    const entries = store.get(lensAvailabilityAtom);
    const colorEntry = entries.find((e) => e.id === "color");
    expect(colorEntry!.available).toBe(false);
  });

  it("color lens available for D Dorian (has color notes)", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "D");
    store.set(scaleNameAtom, "Dorian");
    store.set(chordRootAtom, "D");
    store.set(chordTypeAtom, "Minor 7th");
    const entries = store.get(lensAvailabilityAtom);
    const colorEntry = entries.find((e) => e.id === "color");
    expect(colorEntry!.available).toBe(true);
  });

  it("reason is null for available lenses", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    store.set(practiceLensAtom, "targets");
    const entries = store.get(lensAvailabilityAtom);
    const targetsEntry = entries.find((e) => e.id === "targets");
    expect(targetsEntry!.available).toBe(true);
    expect(targetsEntry!.reason).toBeNull();
  });
});
