import { describe, expect, it } from "vitest";
import { buildAllLayers } from "./buildAllLayers";
import type { ResolvedProgressionStep } from "../progressionDomain";

const step = (over: Partial<ResolvedProgressionStep> = {}): ResolvedProgressionStep => ({
  id: "x",
  index: 0,
  degree: "I",
  duration: { value: 1, unit: "bar" },
  qualityOverride: null,
  qualityOverrideApplied: false,
  invalidQualityOverride: false,
  manualRoot: null,
  root: "C",
  quality: "M",
  diatonicQuality: "M",
  label: "I",
  resolvedChordLabel: "C major",
  shortChordLabel: "C",
  unavailable: false,
  unavailableReason: null,
  ...over,
});

describe("buildAllLayers", () => {
  const baseInput = {
    tempoBpm: 60, // 1 beat = 1s, 1 bar (4 beats) = 4s
    beatsPerBar: 4,
    swing: 0,
    chordPatternId: "ballad-whole", // single sustained hit on beat 0
    bassPatternId: "root-fifth",
    drumPatternId: "rock",
    drumVariations: [] as string[],
    loop: true,
  };

  it("expands a 2-bar step into 2 chord-onset events with isFirstBar/isLastBar markers", () => {
    const out = buildAllLayers({
      ...baseInput,
      steps: [
        step({ id: "a", duration: { value: 1, unit: "bar" } }),
        step({ id: "b", index: 1, root: "G", duration: { value: 2, unit: "bar" } }),
      ],
    });
    expect(out.chordOnsets).toHaveLength(3);
    expect(out.chordOnsets[0]).toMatchObject({
      time: 0,
      value: { stepIndex: 0, isFirstBar: true, isLastBar: true, beats: 4 },
    });
    expect(out.chordOnsets[1]).toMatchObject({
      time: 4,
      value: { stepIndex: 1, isFirstBar: true, isLastBar: false, beats: 4 },
    });
    expect(out.chordOnsets[2]).toMatchObject({
      time: 8,
      value: { stepIndex: 1, isFirstBar: false, isLastBar: true, beats: 4 },
    });
    expect(out.totalDurationSec).toBe(12);
  });

  it("drops unresolvable steps from all layers but still consumes their time", () => {
    const out = buildAllLayers({
      ...baseInput,
      steps: [
        step({ id: "a" }),
        step({ id: "b", index: 1, unavailable: true, root: null, quality: null }),
        step({ id: "c", index: 2, root: "G" }),
      ],
    });
    expect(out.chordOnsets.map((e) => e.value.stepIndex)).toEqual([0, 2]);
    expect(out.chordOnsets[1].time).toBe(8);
    expect(out.totalDurationSec).toBe(12);
  });

  it("emits chord-strum events for each strum-pattern hit per bar", () => {
    const out = buildAllLayers({
      ...baseInput,
      steps: [step({ id: "a", duration: { value: 1, unit: "bar" } })],
    });
    expect(out.chordStrums.length).toBeGreaterThan(0);
    expect(out.chordStrums[0].time).toBe(0);
    expect(out.chordStrums[0].value.voicing.length).toBeGreaterThan(0);
  });

  it("emits bass events with notes resolved per chord (root on beat 1)", () => {
    const out = buildAllLayers({
      ...baseInput,
      steps: [step({ id: "a", root: "C", quality: "M" })],
    });
    expect(out.bass.length).toBeGreaterThan(0);
    const firstBass = out.bass[0];
    expect(firstBass.time).toBe(0);
    expect(firstBass.value.note.startsWith("C")).toBe(true);
  });

  it("emits drum events for every kit hit in the pattern per bar (kick on beat 1, snare on beat 2)", () => {
    const out = buildAllLayers({
      ...baseInput,
      steps: [step({ id: "a", duration: { value: 1, unit: "bar" } })],
    });
    expect(out.drums.length).toBeGreaterThan(0);
    const kickAt0 = out.drums.find((e) => e.time === 0 && e.value.type === "kick");
    expect(kickAt0).toBeDefined();
    // Rock pattern: snare on beat 1 → time 1s @ 60bpm.
    const snareAt1 = out.drums.find((e) => e.time === 1 && e.value.type === "snare");
    expect(snareAt1).toBeDefined();
  });

  it("passes nextChordRoot for chromatic-approach bass only on the LAST bar of a step", () => {
    const out = buildAllLayers({
      ...baseInput,
      bassPatternId: "walking", // has chromatic-approach on beat 3
      steps: [
        step({ id: "a", root: "C", duration: { value: 2, unit: "bar" } }),
        step({ id: "b", index: 1, root: "G" }),
      ],
    });
    // Bar 1 (not last): approach should target same chord (C → B).
    // Bar 2 (last): approach should target next chord G (→ F#).
    const approachBar1 = out.bass.find((e) => e.time === 3);
    const approachBar2 = out.bass.find((e) => e.time === 7);
    expect(approachBar1).toBeDefined();
    expect(approachBar2).toBeDefined();
    expect(approachBar2?.value.note).not.toBe(approachBar1?.value.note);
  });
});
