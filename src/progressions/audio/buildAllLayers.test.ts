import { describe, expect, it, vi } from "vitest";
import {
  buildAllLayersAsync,
  articulationToDurationSec,
  nextResolvableRoot,
  MUTED_STRUM_DURATION_SEC,
  STAB_STRUM_DURATION_SEC,
  ROOT_STRUM_DURATION_SEC,
} from "./buildAllLayers";
import { buildFunkColorVoicing } from "../progressionAudio";
import { buildVoicing, STRUM_PRESET } from "../voicingEngine";
import type { ResolvedProgressionStep } from "../progressionDomain";

vi.mock("./humanize", () => ({
  applyJitter: (params: { time: number; velocity: number }) => ({ time: params.time, velocity: params.velocity }),
  shouldDropHit: () => false,
  grooveLockTimeAmount: (_beat: number, full: number) => full,
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
    chordVariations: [] as string[],
    bassVariations: [] as string[],
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

  it("voices funk hits by articulation: root=1 note, stab=plain, color-stab=funk grip", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "funk-scratch",
      steps: [step({ root: "C", quality: "M", duration: { value: 1, unit: "bar" } })],
    });
    // tempo 60 => 1 beat = 1s, so hit time === beat.
    const at = (t: number) => out.chordStrums.find((s) => s.time === t)!;
    expect(at(0).value.voicing).toEqual(["C3"]); // root anchor on the one
    // plain stab on 2 → the default comp voicing (an inversion of the C triad);
    // assert the chord identity rather than an exact register.
    expect(new Set(at(1).value.voicing.map((n) => n.replace(/-?\d+$/, "")))).toEqual(
      new Set(["C", "E", "G"]),
    );
    // color-stab uses the rootless funk grip. "M" has a defined FUNK_COLOR_TONES
    // grip, so buildFunkColorVoicing ignores the threaded seed — the stab is the
    // same regardless of the previous voicing.
    expect(at(2.5).value.voicing).toEqual(buildFunkColorVoicing("C", "M"));
  });

  it("maps funk durations: root short, stab/color ring (no muted ghosts on piano)", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "funk-scratch",
      steps: [step({ duration: { value: 1, unit: "bar" } })],
    });
    const at = (t: number) => out.chordStrums.find((s) => s.time === t)!;
    expect(at(0).value.durationSec).toBe(ROOT_STRUM_DURATION_SEC);
    expect(at(1).value.durationSec).toBe(STAB_STRUM_DURATION_SEC);
    expect(at(2.5).value.durationSec).toBe(STAB_STRUM_DURATION_SEC);
    // The strum-era muted ghost 16ths were removed for piano (a 0.06s choke
    // reads as a click); no event carries the muted duration.
    expect(
      out.chordStrums.some((s) => s.value.durationSec === MUTED_STRUM_DURATION_SEC),
    ).toBe(false);
  });

  it("voice-leads funk color-stabs into the current chord's register (rootless grip)", async () => {
    // The colour grip is voice-led to the CURRENT bar's triad, so it sits with the
    // comp instead of jumping to a fixed root-position extension stack.
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "funk-scratch",
      steps: [
        step({ root: "C", quality: "M", duration: { value: 1, unit: "bar" } }),
        step({ id: "b", index: 1, root: "F", quality: "M", duration: { value: 1, unit: "bar" } }),
      ],
    });
    // Bar 2 starts at time 4; its color-stab on the "&" of 3 is at time 6.5.
    const bar2Color = out.chordStrums.find((s) => s.time === 6.5)!;
    // "F" "M" has a defined funk grip, so buildFunkColorVoicing ignores the
    // threaded seed — the color stab is identical regardless of the previous
    // voicing. (The grip-less threaded path is covered separately below.)
    expect(bar2Color.value.voicing).toEqual(buildFunkColorVoicing("F", "M"));
    // Rootless: the grip never contains the chord root pitch class.
    const pcs = new Set(bar2Color.value.voicing.map((n) => n.replace(/-?\d+$/, "")));
    expect(pcs.has("F")).toBe(false);
  });

  it("funk color-stab for a grip-less quality voice-leads against the engine's threaded voicing", async () => {
    // "6" has no FUNK_COLOR_TONES grip, so buildFunkColorVoicing falls back to a
    // voice-led grip seeded by `lastVoicing` — which is now the strum engine's
    // output. This locks that threaded path (the seed source changed from the old
    // root-stacked voicing to buildVoicing).
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "funk-scratch",
      steps: [
        step({ root: "C", quality: "M", duration: { value: 1, unit: "bar" } }),
        step({ id: "b", index: 1, root: "A", quality: "6", duration: { value: 1, unit: "bar" } }),
      ],
    });
    // Bar 2 (A6) starts at t=4; its color-stab on the "&" of 3 is at t=6.5.
    const a6Color = out.chordStrums.find((s) => s.time === 6.5)!;
    // The threaded seed is the A6 step's own engine voicing, voice-led from the C step.
    const vC = buildVoicing("C", "M", undefined, STRUM_PRESET);
    const vA6 = buildVoicing("A", "6", vC, STRUM_PRESET);
    expect(a6Color.value.voicing).toEqual(buildFunkColorVoicing("A", "6", vA6));
    expect(a6Color.value.voicing.length).toBeGreaterThan(0);
  });

  describe("chord strum durationSec emission", () => {
    it("leaves durationSec undefined for a pattern with no muted hits", async () => {
      const layers = await buildAllLayersAsync({
        steps: [step({ id: "a", duration: { value: 1, unit: "bar" } })],
        tempoBpm: 120, beatsPerBar: 4, swing: 0,
        chordPatternId: "pop-8ths", bassPatternId: "root-fifth",
        drumPatternId: "pop", drumVariations: [], chordVariations: [], bassVariations: [], loop: false,
      });
      expect(layers.chordStrums.length).toBeGreaterThan(0);
      for (const s of layers.chordStrums) {
        expect(s.value.durationSec).toBeUndefined();
      }
    });

    it("emits a short root anchor and ringing stabs (funk-scratch)", async () => {
      const layers = await buildAllLayersAsync({
        ...baseInput,
        chordPatternId: "funk-scratch",
        steps: [step({ duration: { value: 1, unit: "bar" } })],
      });
      const durs = layers.chordStrums.map((s) => s.value.durationSec);
      expect(durs.length).toBeGreaterThan(0);
      expect(durs.every((d) => typeof d === "number")).toBe(true);
      const min = Math.min(...(durs as number[]));
      const max = Math.max(...(durs as number[]));
      expect(min).toBeCloseTo(ROOT_STRUM_DURATION_SEC);
      expect(max).toBe(STAB_STRUM_DURATION_SEC);
    });

    it("rings the stab well above the muted choke (recurrence guard)", () => {
      // Root-cause guard: the prior pass had no ring/choke separation, so the
      // accent never read as a strummed chord. Keep a real margin.
      expect(STAB_STRUM_DURATION_SEC).toBeGreaterThan(MUTED_STRUM_DURATION_SEC * 4);
    });

    it("rings the ballad whole-note chord for the full bar (tempo-aware)", async () => {
      // 60 bpm → 1 beat = 1s; 4/4 bar = 4s. ballad-whole = one sustained hit on beat 0.
      const layers = await buildAllLayersAsync({
        ...baseInput,
        tempoBpm: 60,
        beatsPerBar: 4,
        chordPatternId: "ballad-whole",
        steps: [step({ duration: { value: 1, unit: "bar" } })],
      });
      expect(layers.chordStrums).toHaveLength(1);
      expect(layers.chordStrums[0]!.value.durationSec).toBeCloseTo(4, 6);
    });

    it("scales the ballad whole-note duration with tempo and meter", async () => {
      // 120 bpm → 1 beat = 0.5s; 3/4 bar = 1.5s.
      const layers = await buildAllLayersAsync({
        ...baseInput,
        tempoBpm: 120,
        beatsPerBar: 3,
        chordPatternId: "ballad-whole",
        steps: [step({ duration: { value: 1, unit: "bar" } })],
      });
      expect(layers.chordStrums).toHaveLength(1);
      expect(layers.chordStrums[0]!.value.durationSec).toBeCloseTo(1.5, 6);
    });
  });

  it("emits cross-stick drum events for the bossa clave pattern", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      drumPatternId: "bossa",
      chordPatternId: "ballad-whole",
      steps: [step({ duration: { value: 1, unit: "bar" } })],
    });
    const crossSticks = out.drums.filter((d) => d.value.type === "crossStick");
    // Bar 1 (3-side) of the son clave: beats 0, 1.5, 3 → times 0, 1.5, 3 at 60bpm.
    expect(crossSticks.map((d) => d.time)).toEqual([0, 1.5, 3]);
  });

  it("plays the bar-2 clave hits on the second bar of a 2-bar cell", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      drumPatternId: "bossa",
      chordPatternId: "ballad-whole",
      // One 2-bar step → absolute bars 0 and 1.
      steps: [step({ duration: { value: 2, unit: "bar" } })],
    });
    const crossSticks = out.drums
      .filter((d) => d.value.type === "crossStick")
      .map((d) => d.time);
    // Bar 1 @ 0,1.5,3 ; bar 2 starts at 4s, clave beats 5,6.5 → local 1,2.5 → 5,6.5.
    expect(crossSticks).toEqual([0, 1.5, 3, 5, 6.5]);
  });

  it("plays the bossa comp's bar-2 syncopations on the second bar", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      drumPatternId: "bossa",
      chordPatternId: "bossa-comp",
      bassPatternId: "bossa",
      steps: [step({ duration: { value: 2, unit: "bar" } })],
    });
    expect(out.chordStrums.map((s) => s.time)).toEqual([0, 1.5, 2, 3.5, 4, 4.5, 5.5, 6, 7.5]);
  });

  it("leaves a 1-bar pattern (rock) emitting identical hits on every bar", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      drumPatternId: "rock",
      chordPatternId: "ballad-whole",
      steps: [step({ duration: { value: 2, unit: "bar" } })],
    });
    const kicksBar1 = out.drums.filter((d) => d.value.type === "kick" && d.time < 4).map((d) => d.time);
    const kicksBar2 = out.drums.filter((d) => d.value.type === "kick" && d.time >= 4).map((d) => d.time - 4);
    // rock kicks at 0, 1.5, 2 — same in both bars (the bars-default path is untouched).
    expect(kicksBar1).toEqual([0, 1.5, 2]);
    expect(kicksBar2).toEqual([0, 1.5, 2]);
  });

  describe("drum variation gating (absolute bar)", () => {
    // Two 2-bar steps = 4 absolute bars (0..3). At 60bpm each bar is 4s.
    const fourBarSteps = [
      step({ id: "a", duration: { value: 2, unit: "bar" } }),
      step({ id: "b", index: 1, root: "G", duration: { value: 2, unit: "bar" } }),
    ];

    it("fires fill-every-4 only on the 4th absolute bar (turnaround), not every bar", async () => {
      const base = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: [] });
      const withFill = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: ["fill-every-4"] });

      const snares = (b: typeof base) => b.drums.filter((d) => d.value.type === "snare");
      // The fill adds its 4-snare flurry exactly ONCE (one firing bar), not 4×.
      expect(snares(withFill).length - snares(base).length).toBe(4);

      // …and those 4 extra snares all land inside bar 3 (absolute), i.e. [12,16)s.
      const inBar3 = (b: typeof base) => snares(b).filter((d) => d.time >= 12 && d.time < 16).length;
      expect(inBar3(withFill) - inBar3(base)).toBe(4);
      // Nothing added in bars 0..2 ([0,12)s).
      const before = (b: typeof base) => snares(b).filter((d) => d.time < 12).length;
      expect(before(withFill)).toBe(before(base));
    });

    it("keeps open-hat-and-of-4 firing every bar (backwards-compatible)", async () => {
      const base = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: [] });
      const withOpenHat = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: ["open-hat-and-of-4"] });
      const openHats = (b: typeof base) => b.drums.filter((d) => d.value.type === "openHat").length;
      // interval 1 → one open-hat per bar across all 4 bars.
      expect(openHats(withOpenHat) - openHats(base)).toBe(4);
    });

    it("adds nothing when no variations are assigned (no-op)", async () => {
      const a = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: [] });
      const b = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: [] });
      expect(a.drums).toEqual(b.drums);
    });

    it("is deterministic for the same input", async () => {
      const a = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: ["fill-every-4"] });
      const b = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: ["fill-every-4"] });
      expect(a.drums).toEqual(b.drums);
    });

  it("voices the bossa comp as LH bass (single notes) + RH rootless chords", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "bossa-comp",
      drumPatternId: "bossa",
      bassPatternId: "bossa",
      steps: [step({ duration: { value: 2, unit: "bar" } })], // C major
    });
    const at = (t: number) => out.chordStrums.find((s) => s.time === t)!;
    expect(at(0).value.voicing).toEqual(["C3"]); // bass-root (LH, octave 3)
    expect(at(2).value.voicing).toEqual(["G3"]); // bass-fifth (LH, octave 3)
    expect(at(1.5).value.voicing).toEqual(["B3", "D4", "E4", "G4"]); // RH rootless chord
    expect(out.chordStrums.every((s) => s.value.style === undefined)).toBe(true); // all short, no sustain
  });

  it("locks the bossa LH bass and upright bass to the same attack time (perfect unison)", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "bossa-comp",
      drumPatternId: "bossa",
      bassPatternId: "bossa",
      steps: [step({ duration: { value: 2, unit: "bar" } })], // 2-bar C major cell
    });
    // LH bass strums are single notes on beats 0, 2, 4, 6 (octave 3).
    const lhBass = out.chordStrums.filter((s) => s.value.voicing.length === 1);
    expect(lhBass.map((s) => s.time).sort((a, b) => a - b)).toEqual([0, 2, 4, 6]);
    // The upright bass plays the same beats one octave lower (octave 2).
    expect(out.bass.map((b) => b.time).sort((a, b) => a - b)).toEqual([0, 2, 4, 6]);
    // Both voices attack at the exact same time — grid-locked, no flam.
    for (const lh of lhBass) {
      expect(out.bass.some((b) => b.time === lh.time)).toBe(true);
    }
  });

  it("leaves a default-voicing comp (pop-8ths) using the standard rooted voicing", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "pop-8ths",
      steps: [step({ duration: { value: 1, unit: "bar" } })], // C major
    });
    // Default path: the engine's buildVoicing keeps the root present (in some
    // octave — the grip may be an inversion, so match the C pitch class).
    expect(
      out.chordStrums[0].value.voicing.some((n) => n.replace(/-?\d+$/, "") === "C"),
    ).toBe(true);
  });

  it("comps jazz rootless (Type-B via the bossa voicing builder)", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "jazz-comp",
      steps: [step({ duration: { value: 1, unit: "bar" } })], // C major
    });
    // jazz-comp sets voicing: "rootless-jazz" — the walking bass owns the root,
    // so the comp voicing must NOT contain the root pitch class.
    expect(out.chordStrums.length).toBeGreaterThan(0);
    expect(
      out.chordStrums[0].value.voicing.some((n) => n.replace(/-?\d+$/, "") === "C"),
    ).toBe(false);
  });

  it("is deterministic for the bossa 2-bar cell across a 4-bar span (drums, bass, comp)", async () => {
      const bossaInput = {
        ...baseInput,
        steps: fourBarSteps,
        drumPatternId: "bossa",
        bassPatternId: "bossa",
        chordPatternId: "bossa-comp",
        drumVariations: [] as string[],
      };
      const a = await buildAllLayersAsync(bossaInput);
      const b = await buildAllLayersAsync(bossaInput);
      expect(a.drums).toEqual(b.drums);
      expect(a.bass).toEqual(b.bass);
      expect(a.chordStrums).toEqual(b.chordStrums);
    });

    it("counts an unavailable bar toward the absolute index (turnaround stays aligned)", async () => {
      // [2-bar C][1-bar unavailable][1-bar G] → absolute bars 0,1,(2 rest),3.
      // fill-every-4 (phase 3) must fire on absolute bar 3 = the final G bar (12..16s).
      const steps = [
        step({ id: "a", duration: { value: 2, unit: "bar" } }),
        step({ id: "r", index: 1, unavailable: true, root: null, quality: null, duration: { value: 1, unit: "bar" } }),
        step({ id: "g", index: 2, root: "G", duration: { value: 1, unit: "bar" } }),
      ];
      const base = await buildAllLayersAsync({ ...baseInput, steps, drumVariations: [] });
      const withFill = await buildAllLayersAsync({ ...baseInput, steps, drumVariations: ["fill-every-4"] });
      const snares = (b: typeof base) => b.drums.filter((d) => d.value.type === "snare");
      const inBar3 = (b: typeof base) => snares(b).filter((d) => d.time >= 12 && d.time < 16).length;
      expect(snares(withFill).length - snares(base).length).toBe(4);
      expect(inBar3(withFill) - inBar3(base)).toBe(4);
    });
  });

  describe("end-of-phrase bass walk (§3.4)", () => {
    const cToG = [
      step({ root: "C" }),
      step({ id: "g", index: 1, root: "G" }),
    ];
    const bassAt = (out: Awaited<ReturnType<typeof buildAllLayersAsync>>, time: number) =>
      out.bass.find((e) => Math.abs(e.time - time) < 1e-6);
    const pitchClass = (note: string) => note.replace(/[0-9]/g, "");

    it("adds a chromatic approach on beat 3 of the turnaround bar (root-fifth, into G → F#)", async () => {
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToG, loop: false, bassPatternId: "root-fifth",
      });
      const approach = bassAt(out, 3);
      expect(approach).toBeDefined();
      expect(pitchClass(approach!.value.note)).toBe("F#");
      expect(bassAt(out, 2)).toBeDefined();
      expect(out.bass.filter((e) => e.time > 3 && e.time < 4)).toHaveLength(0);
    });

    it("does not fire on the final bar of a non-looping progression (no next chord)", async () => {
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToG, loop: false, bassPatternId: "root-fifth",
      });
      expect(bassAt(out, 7)).toBeUndefined();
    });

    it("loop-wraps the target on the last bar (G → C approach = B) when looping", async () => {
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToG, loop: true, bassPatternId: "root-fifth",
      });
      const approach = bassAt(out, 7);
      expect(approach).toBeDefined();
      expect(pitchClass(approach!.value.note)).toBe("B");
    });

    it("does not fire when the next chord shares the current root (no real change)", async () => {
      const cToC = [step({ root: "C" }), step({ id: "c2", index: 1, root: "C" })];
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToC, loop: false, bassPatternId: "root-fifth",
      });
      expect(bassAt(out, 3)).toBeUndefined();
    });

    it("leaves a non-flagged pattern unchanged (pedal keeps its own root on beat 3)", async () => {
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToG, loop: false, bassPatternId: "pedal",
      });
      const beat3 = bassAt(out, 3);
      expect(beat3).toBeDefined();
      expect(pitchClass(beat3!.value.note)).toBe("C");
    });

    it("applies to bossa too (into G → F# on beat 3)", async () => {
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToG, loop: false, bassPatternId: "bossa",
      });
      const approach = bassAt(out, 3);
      expect(approach).toBeDefined();
      expect(pitchClass(approach!.value.note)).toBe("F#");
    });

    it("is deterministic for the same input", async () => {
      const a = await buildAllLayersAsync({ ...baseInput, steps: cToG, loop: true, bassPatternId: "root-fifth" });
      const b = await buildAllLayersAsync({ ...baseInput, steps: cToG, loop: true, bassPatternId: "root-fifth" });
      expect(a.bass).toEqual(b.bass);
    });

    it("drops a flagged pattern's native last-beat hit and replaces it with the approach (arpeggiated beat-3 octave → F#)", async () => {
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cToG, loop: false, bassPatternId: "arpeggiated",
      });
      // Bar 0 (C) turnaround into G: beat-3 octave (C) is replaced by the F# approach.
      const beat3 = bassAt(out, 3);
      expect(beat3).toBeDefined();
      expect(pitchClass(beat3!.value.note)).toBe("F#");
      // The earlier hits survive (beats 0,1,2 = times 0,1,2).
      expect(bassAt(out, 1)).toBeDefined();
      expect(bassAt(out, 2)).toBeDefined();
    });

    it("fires only on a multi-bar step's final bar, not interior bars (isLast gate)", async () => {
      const twoBarCThenG = [
        step({ root: "C", duration: { value: 2, unit: "bar" } }),
        step({ id: "g", index: 1, root: "G" }),
      ];
      const out = await buildAllLayersAsync({
        ...baseInput, steps: twoBarCThenG, loop: false, bassPatternId: "arpeggiated",
      });
      // Bar 0 of the 2-bar C step ([0,4)s) is NOT the last bar → keeps its beat-3 octave (C).
      expect(pitchClass(bassAt(out, 3)!.value.note)).toBe("C");
      // Bar 1 ([4,8)s) IS the step's last bar before the change to G → F# approach at 7s.
      expect(pitchClass(bassAt(out, 7)!.value.note)).toBe("F#");
    });

    it("targets the next resolvable root across a rest, and loop-wraps (root-fifth, [C, rest, G])", async () => {
      const cRestG = [
        step({ root: "C" }),
        step({ id: "r", index: 1, unavailable: true, root: null, quality: null }),
        step({ id: "g", index: 2, root: "G" }),
      ];
      const out = await buildAllLayersAsync({
        ...baseInput, steps: cRestG, loop: true, bassPatternId: "root-fifth",
      });
      // C bar ([0,4)s): next resolvable root skips the rest → G → F# approach at 3s.
      expect(pitchClass(bassAt(out, 3)!.value.note)).toBe("F#");
      // G bar ([8,12)s): loop-wraps to C → B approach at 11s.
      expect(pitchClass(bassAt(out, 11)!.value.note)).toBe("B");
    });
  });

  describe("chord variation substitution", () => {
    it("replaces the base chord hits on a firing turnaround bar", async () => {
      const steps = Array.from({ length: 8 }, (_, i) =>
        step({ id: `s${i}`, index: i, root: i % 2 === 0 ? "C" : "G" }),
      );
      const out = await buildAllLayersAsync({
        ...baseInput,
        chordPatternId: "pop-8ths",
        chordVariations: ["funk-turnaround-chord"],
        bassPatternId: "root-fifth",
        steps,
      });
      const bar3 = out.chordStrums.filter((s) => s.time >= 12 && s.time < 16);
      const bar0 = out.chordStrums.filter((s) => s.time >= 0 && s.time < 4);
      expect(bar0).toHaveLength(6); // base pop-8ths
      expect(bar3).toHaveLength(4); // funk-turnaround-chord
    });

    it("leaves non-firing bars on the base pattern", async () => {
      const steps = Array.from({ length: 8 }, (_, i) => step({ id: `s${i}`, index: i }));
      const out = await buildAllLayersAsync({
        ...baseInput,
        chordPatternId: "pop-8ths",
        chordVariations: ["funk-turnaround-chord"],
        steps,
      });
      const bar1 = out.chordStrums.filter((s) => s.time >= 4 && s.time < 8);
      expect(bar1).toHaveLength(6); // base pop-8ths, untouched
    });
  });

  describe("bass variation substitution", () => {
    it("replaces the base bass hits on a firing turnaround bar", async () => {
      // funk-syncopated has 5 hits/bar; funk-turnaround-bass has 4. Bar 3 fires.
      const steps = Array.from({ length: 8 }, (_, i) =>
        step({ id: `s${i}`, index: i, root: i % 2 === 0 ? "C" : "G" }),
      );
      const out = await buildAllLayersAsync({
        ...baseInput,
        bassPatternId: "funk-syncopated",
        bassVariations: ["funk-turnaround-bass"],
        chordPatternId: "ballad-whole",
        steps,
      });
      const bar3 = out.bass.filter((b) => b.time >= 12 && b.time < 16);
      const bar0 = out.bass.filter((b) => b.time >= 0 && b.time < 4);
      expect(bar0).toHaveLength(5); // base funk-syncopated
      expect(bar3).toHaveLength(4); // funk-turnaround-bass
    });

    it("leaves non-firing bass bars on the base pattern", async () => {
      const steps = Array.from({ length: 8 }, (_, i) => step({ id: `s${i}`, index: i }));
      const out = await buildAllLayersAsync({
        ...baseInput,
        bassPatternId: "funk-syncopated",
        bassVariations: ["funk-turnaround-bass"],
        chordPatternId: "ballad-whole",
        steps,
      });
      const bar1 = out.bass.filter((b) => b.time >= 4 && b.time < 8);
      expect(bar1).toHaveLength(5); // base funk-syncopated untouched
    });

    it("variation + base-turnaround: no double fill (variation replaces base, §3.4 swap operates on variation hits only)", async () => {
      // root-fifth has turnaround:true (2 hits/bar normally). funk-turnaround-bass fires on
      // absolute bar 3 (barInterval=4, barPhase=3). With loop:true over [C,G,C,G], bar 3
      // is G with turnaround target C (loop-wrap) — so BOTH the variation fires AND the §3.4
      // turnaround is active simultaneously.
      //
      // Correct behavior: variation substitutes base first (patternHits = 4 variation hits),
      // then §3.4 tail-swaps: keeps beats < 3 (beats 0, 1.5, 2.5 = 3 hits) + adds one approach
      // note on beat 3 = 4 total. No double fill.
      // Bug indicator: if we saw 2 (base only) + 4 (variation) = 6, the base wasn't replaced.
      const steps = Array.from({ length: 4 }, (_, i) =>
        step({ id: `s${i}`, index: i, root: i % 2 === 0 ? "C" : "G" }),
      );
      const out = await buildAllLayersAsync({
        ...baseInput,
        bassPatternId: "root-fifth",
        bassVariations: ["funk-turnaround-bass"],
        chordPatternId: "ballad-whole",
        steps,
        loop: true,
      });
      const bar3 = out.bass.filter((b) => b.time >= 12 && b.time < 16);
      // §3.4 tail-swaps the variation's beat-3 hit for one approach note: 3 pre-tail hits + 1 = 4.
      expect(bar3).toHaveLength(4); // clean substitution — variation replaced base, no double fill
    });
  });

  describe("nextResolvableRoot", () => {
    it("returns the immediate next root", () => {
      const steps = [step({ root: "C" }), step({ id: "g", index: 1, root: "G" })];
      expect(nextResolvableRoot(steps, 0, false)).toBe("G");
    });

    it("skips an unavailable/rest step to the next real chord", () => {
      const steps = [
        step({ root: "C" }),
        step({ id: "r", index: 1, unavailable: true, root: null, quality: null }),
        step({ id: "g", index: 2, root: "G" }),
      ];
      expect(nextResolvableRoot(steps, 0, false)).toBe("G");
    });

    it("loop-wraps to the first root from the last step", () => {
      const steps = [step({ root: "C" }), step({ id: "g", index: 1, root: "G" })];
      expect(nextResolvableRoot(steps, 1, true)).toBe("C");
    });

    it("returns undefined at the end when not looping", () => {
      const steps = [step({ root: "C" }), step({ id: "g", index: 1, root: "G" })];
      expect(nextResolvableRoot(steps, 1, false)).toBeUndefined();
    });

    it("returns undefined when no later step is resolvable", () => {
      const steps = [
        step({ root: "C" }),
        step({ id: "r", index: 1, unavailable: true, root: null, quality: null }),
      ];
      expect(nextResolvableRoot(steps, 0, false)).toBeUndefined();
    });

    it("returns undefined for an empty progression", () => {
      expect(nextResolvableRoot([], 0, true)).toBeUndefined();
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

