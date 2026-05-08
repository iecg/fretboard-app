import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  buildChordRowEntries,
  chordMemberRole,
  hasAnyChordToneOutsideScale,
  hasOutsideChordMembersAtom,
  isChordMemberInScale,
  allChordMembersAtom,
} from "./composableSelectors";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import {
  chordOverlayModeAtom,
  chordRootOverrideAtom,
  chordQualityOverrideAtom,
} from "./chordOverlayAtoms";
import type { ResolvedChordMember } from "../core/theory";

describe("pure predicates", () => {
  it("isChordMemberInScale: true when the note is in the set", () => {
    expect(isChordMemberInScale("C", new Set(["C", "E", "G"]))).toBe(true);
    expect(isChordMemberInScale("F#", new Set(["C", "E", "G"]))).toBe(false);
  });

  it("isChordMemberInScale: accepts an array (converted internally)", () => {
    expect(isChordMemberInScale("E", ["C", "E", "G"])).toBe(true);
  });

  it("hasAnyChordToneOutsideScale: false when all chord notes are in scale", () => {
    expect(hasAnyChordToneOutsideScale(["C", "E", "G"], ["C", "D", "E", "F", "G", "A", "B"]))
      .toBe(false);
  });

  it("hasAnyChordToneOutsideScale: true when any chord note is outside", () => {
    expect(hasAnyChordToneOutsideScale(["C", "Eb", "G"], ["C", "D", "E", "F", "G", "A", "B"]))
      .toBe(true);
  });

  it("chordMemberRole: returns chord-root for the root member regardless of scale", () => {
    const member: ResolvedChordMember = { name: "root", semitone: 0, note: "F#" };
    expect(chordMemberRole(member, new Set([]))).toBe("chord-root");
  });

  it("chordMemberRole: distinguishes in-scale vs outside-scale chord tones", () => {
    const inMember: ResolvedChordMember = { name: "3", semitone: 4, note: "E" };
    const outMember: ResolvedChordMember = { name: "b3", semitone: 3, note: "Eb" };
    const scale = new Set(["C", "D", "E", "F", "G", "A", "B"]);
    expect(chordMemberRole(inMember, scale)).toBe("chord-tone-in-scale");
    expect(chordMemberRole(outMember, scale)).toBe("chord-tone-outside-scale");
  });

  it("buildChordRowEntries: tags inScale and assigns degree info for in-scale tones", () => {
    const members: ResolvedChordMember[] = [
      { name: "root", semitone: 0, note: "C" },
      { name: "3", semitone: 4, note: "E" },
      { name: "5", semitone: 7, note: "G" },
    ];
    const entries = buildChordRowEntries(members, "C", "C", "Major", false);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      internalNote: "C",
      role: "chord-root",
      inScale: true,
    });
    expect(entries[1].inScale).toBe(true);
    expect(entries[1].role).toBe("chord-tone-in-scale");
    expect(entries[1].scaleInterval).toBeDefined();
  });

  it("buildChordRowEntries: marks outside-scale tones without scale degree info", () => {
    const members: ResolvedChordMember[] = [
      { name: "root", semitone: 0, note: "C" },
      { name: "b3", semitone: 3, note: "D#" }, // not in C major
    ];
    const entries = buildChordRowEntries(members, "C", "C", "Major", false);
    expect(entries[1].inScale).toBe(false);
    expect(entries[1].role).toBe("chord-tone-outside-scale");
    expect(entries[1].scaleDegree).toBeUndefined();
  });
});

describe("cross-domain derived atoms", () => {
  function setupManualChord(root: string, quality: string) {
    const store = createStore();
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootOverrideAtom, root);
    store.set(chordQualityOverrideAtom, quality);
    return store;
  }

  it("hasOutsideChordMembersAtom: false for diatonic C major triad in C major", () => {
    const store = setupManualChord("C", "Major Triad");
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    expect(store.get(hasOutsideChordMembersAtom)).toBe(false);
  });

  it("hasOutsideChordMembersAtom: true for D major triad in C major (F# is outside)", () => {
    const store = setupManualChord("D", "Major Triad");
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    expect(store.get(hasOutsideChordMembersAtom)).toBe(true);
  });

  it("hasOutsideChordMembersAtom: false when no chord type is set", () => {
    const store = setupManualChord("C", "");
    store.set(chordQualityOverrideAtom, null);
    expect(store.get(hasOutsideChordMembersAtom)).toBe(false);
  });

  it("allChordMembersAtom: returns ChordRowEntry[] composed from chord + scale", () => {
    const store = setupManualChord("C", "Major Triad");
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    const rows = store.get(allChordMembersAtom);
    expect(rows.map((r) => r.internalNote)).toEqual(["C", "E", "G"]);
    expect(rows.every((r) => r.inScale)).toBe(true);
  });

  it("allChordMembersAtom: empty when no chord type", () => {
    const store = setupManualChord("C", "");
    store.set(chordQualityOverrideAtom, null);
    expect(store.get(allChordMembersAtom)).toEqual([]);
  });
});
