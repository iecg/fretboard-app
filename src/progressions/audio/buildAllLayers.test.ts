import { describe, expect, it, vi } from "vitest";
import { buildAllLayersAsync, articulationToDurationSec, articulationToStrumDurationSec } from "./buildAllLayers";
import type { ResolvedProgressionStep } from "../progressionDomain";

vi.mock("./humanize", () => ({
  applyJitter: (params: { time: number; velocity: number }) => ({ time: params.time, velocity: params.velocity })
}));

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

  it("expands a 2-bar step into 2 chord-onset events with isFirstBar/isLastBar markers", async () => {
    const out = await buildAllLayersAsync({
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

  it("drops unresolvable steps from all layers but still consumes their time", async () => {
    const out = await buildAllLayersAsync({
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

  it("emits chord-strum events for each strum-pattern hit per bar", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      steps: [step({ id: "a", duration: { value: 1, unit: "bar" } })],
    });
    expect(out.chordStrums.length).toBeGreaterThan(0);
    expect(out.chordStrums[0].time).toBe(0);
    expect(out.chordStrums[0].value.voicing.length).toBeGreaterThan(0);
  });

  it("emits bass events with notes resolved per chord (root on beat 1)", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      steps: [step({ id: "a", root: "C", quality: "M" })],
    });
    expect(out.bass.length).toBeGreaterThan(0);
    const firstBass = out.bass[0];
    expect(firstBass.time).toBe(0);
    expect(firstBass.value.note.startsWith("C")).toBe(true);
  });

  it("emits drum events for every kit hit in the pattern per bar (kick on beat 1, snare on beat 2)", async () => {
    const out = await buildAllLayersAsync({
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

  it("emits one metronome event per beat across totalDurationSec, with beatInBar 1-based and bar-cyclic (3/4)", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      beatsPerBar: 3,
      steps: [step({ id: "a", duration: { value: 1, unit: "bar" } })],
    });

    // 1 bar of 3/4 at 60 BPM = 3 seconds = 3 beats.
    expect(out.metronome).toHaveLength(3);
    expect(out.metronome[0]).toMatchObject({ time: 0, value: { beatInBar: 1 } });
    expect(out.metronome[1]).toMatchObject({ time: 1, value: { beatInBar: 2 } });
    expect(out.metronome[2]).toMatchObject({ time: 2, value: { beatInBar: 3 } });
  });

  it("metronome beatInBar wraps to 1 every beatsPerBar beats across multi-bar progressions", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      beatsPerBar: 3,
      steps: [step({ id: "a", duration: { value: 2, unit: "bar" } })],
    });

    expect(out.metronome).toHaveLength(6);
    expect(out.metronome.map((e) => e.value.beatInBar)).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it("bass events with no articulation have undefined durationSec", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      steps: [step({ id: "a", root: "C", quality: "M" })],
    });
    expect(out.bass.length).toBeGreaterThan(0);
    for (const ev of out.bass) {
      expect(ev.value.durationSec).toBeUndefined();
    }
  });

  it("staccato bass pattern produces a defined durationSec on every event", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      bassPatternId: "pedal",
      steps: [step({ id: "a", root: "C", quality: "M" })],
    });
    expect(out.bass.length).toBeGreaterThan(0);
    for (const ev of out.bass) {
      expect(typeof ev.value.durationSec).toBe("number");
      expect(Number.isFinite(ev.value.durationSec)).toBe(true);
      expect(ev.value.durationSec).toBeGreaterThan(0);
    }
  });

  it("passes nextChordRoot for chromatic-approach bass only on the LAST bar of a step", async () => {
    const out = await buildAllLayersAsync({
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

  describe("chord strum durationSec emission", () => {
    it("leaves durationSec undefined for a pattern with no muted hits", async () => {
      const layers = await buildAllLayersAsync({
        steps: [step({ id: "a", duration: { value: 1, unit: "bar" } })],
        tempoBpm: 120, beatsPerBar: 4, swing: 0,
        chordPatternId: "pop-8ths", bassPatternId: "root-fifth",
        drumPatternId: "pop", drumVariations: [], loop: false,
      });
      expect(layers.chordStrums.length).toBeGreaterThan(0);
      for (const s of layers.chordStrums) {
        expect(s.value.durationSec).toBeUndefined();
      }
    });
  });
});

describe("articulationToDurationSec", () => {
  const spb = 0.5; // 120 bpm → 0.5 s/beat

  it("maps staccato to a short fraction of the beat", () => {
    expect(articulationToDurationSec("staccato", spb)).toBeCloseTo(0.15, 5); // 0.3 * 0.5
  });

  it("maps legato to a near-full beat", () => {
    expect(articulationToDurationSec("legato", spb)).toBeCloseTo(0.45, 5); // 0.9 * 0.5
  });

  it("returns undefined for normal/omitted articulation (patch default)", () => {
    expect(articulationToDurationSec("normal", spb)).toBeUndefined();
    expect(articulationToDurationSec(undefined, spb)).toBeUndefined();
  });
});

describe("articulationToStrumDurationSec", () => {
  it("chokes a muted scratch stroke to a short fixed length", () => {
    expect(articulationToStrumDurationSec("muted", 1.8)).toBeCloseTo(0.06, 5);
  });

  it("lets an accent ring for the full patch note duration", () => {
    expect(articulationToStrumDurationSec("accent", 1.8)).toBeCloseTo(1.8, 5);
  });

  it("defaults (undefined) to the patch note duration — no behavior change", () => {
    expect(articulationToStrumDurationSec(undefined, 0.42)).toBeCloseTo(0.42, 5);
  });
});
