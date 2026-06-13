// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import { chordMemberFactsAtom } from "./chordOverlayAtoms";
import { progressionStepsAtom } from "./progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import { updateActiveChordAtom } from "./songStateAtoms";

function makeStore() {
  const store = createStore();
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
    setChord(store, "C", "M");
    const facts = store.get(chordMemberFactsAtom);
    expect(facts).toHaveLength(3);
  });

  it("root member has isChordRoot=true, others false", () => {
    const store = makeStore();
    setChord(store, "G", "7");
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
    setChord(store, "G", "7");
    const facts = store.get(chordMemberFactsAtom);
    const semitones = facts.map((f) => f.semitone).sort((a, b) => a - b);
    expect(semitones).toEqual([0, 4, 7, 10]); // root, 3, 5, b7
  });

  it("exposes correct internal notes for C Minor Triad", () => {
    const store = makeStore();
    setChord(store, "C", "m");
    const facts = store.get(chordMemberFactsAtom);
    const notes = facts.map((f) => f.internalNote);
    expect(notes).toContain("C");
    expect(notes).toContain("D#"); // b3
    expect(notes).toContain("G");
  });

  it("does NOT depend on scale — same result regardless of rootNoteAtom/scaleNameAtom", () => {
    const storeA = makeStore();
    storeA.set(rootNoteAtom, "A");
    storeA.set(scaleNameAtom, "major");
    setChord(storeA, "C", "M");

    // Scale F# Dorian (very different from A major)
    const storeB = makeStore();
    storeB.set(rootNoteAtom, "F#");
    storeB.set(scaleNameAtom, "dorian");
    setChord(storeB, "C", "M");

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
    setChord(store, "G", "m7");
    const facts = store.get(chordMemberFactsAtom);
    const names = facts.map((f) => f.memberName);
    expect(names).toContain("R");
    expect(names).toContain("♭3");
    expect(names).toContain("5");
    expect(names).toContain("♭7");
  });
});

describe("Focus removal", () => {
  it("chord domain is scale-free: chordMemberFactsAtom returns same facts for any scale", () => {
    const storeA = makeStore();
    storeA.set(rootNoteAtom, "A");
    storeA.set(scaleNameAtom, "major");
    setChord(storeA, "C", "M");

    const storeB = makeStore();
    storeB.set(rootNoteAtom, "F#");
    storeB.set(scaleNameAtom, "dorian");
    setChord(storeB, "C", "M");

    const factsA = storeA.get(chordMemberFactsAtom);
    const factsB = storeB.get(chordMemberFactsAtom);
    expect(factsA.map((f) => f.internalNote)).toEqual(factsB.map((f) => f.internalNote));
    expect(factsA.map((f) => f.semitone)).toEqual(factsB.map((f) => f.semitone));
  });
});

