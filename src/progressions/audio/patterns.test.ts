import { describe, expect, it } from "vitest";
import {
  buildMetronomePattern,
  clipPatternToBeats,
  repeatPatternToBeats,
  sliceCellToBar,
  CHORD_PATTERNS,
  BASS_PATTERNS,
  DRUM_PATTERNS,
  DRUM_VARIATIONS,
  getChordPattern,
  getBassPattern,
  getDrumPattern,
  variationFiresOnBar,
  type DrumVariation,
} from "./patterns";

// The "pop-8ths" chord pattern is the canonical 4/4 strum fixture used to
// exercise the clip/repeat utilities below.
const POP_8THS = CHORD_PATTERNS.find((p) => p.id === "pop-8ths")!.hits;

describe("clipPatternToBeats", () => {
  it("returns an empty array when no beats are available", () => {
    expect(clipPatternToBeats(POP_8THS, 0)).toEqual([]);
    expect(clipPatternToBeats(POP_8THS, -1)).toEqual([]);
  });

  it("keeps every hit that falls inside the beat window", () => {
    const clipped = clipPatternToBeats(POP_8THS, 4);
    expect(clipped).toEqual(POP_8THS);
  });

  it("drops hits past the available beats", () => {
    const clipped = clipPatternToBeats(POP_8THS, 2);
    expect(clipped.every((h) => h.beat < 2)).toBe(true);
  });

  it("keeps a hit exactly on the boundary out — strict less-than", () => {
    // POP_8THS has hits at 0, 1, 1.5, 2.5, 3, 3.5.
    const clipped = clipPatternToBeats(POP_8THS, 3);
    expect(clipped.map((h) => h.beat)).toEqual([0, 1, 1.5, 2.5]);
  });
});

describe("repeatPatternToBeats", () => {
  it("repeats a one-bar strum pattern across a multi-bar step", () => {
    const repeated = repeatPatternToBeats(POP_8THS, 8, 4);

    expect(repeated.map((h) => h.beat)).toEqual([
      0, 1, 1.5, 2.5, 3, 3.5,
      4, 5, 5.5, 6.5, 7, 7.5,
    ]);
  });

  it("clips repeated pattern hits to partial final bars", () => {
    const repeated = repeatPatternToBeats(POP_8THS, 5, 4);

    expect(repeated.map((h) => h.beat)).toEqual([
      0, 1, 1.5, 2.5, 3, 3.5,
      4,
    ]);
  });

  it("uses the active meter as the repeat length", () => {
    const repeated = repeatPatternToBeats(POP_8THS, 6, 3);

    expect(repeated.map((h) => h.beat)).toEqual([
      0, 1, 1.5, 2.5,
      3, 4, 4.5, 5.5,
    ]);
  });
});

describe("buildMetronomePattern", () => {
  it("yields one click per beat", () => {
    expect(buildMetronomePattern(4)).toHaveLength(4);
    expect(buildMetronomePattern(3)).toHaveLength(3);
  });

  it("accents beat 1 only", () => {
    const ticks = buildMetronomePattern(4);
    expect(ticks[0].velocity).toBeGreaterThan(ticks[1].velocity);
    expect(ticks.slice(1).every((t) => t.velocity === ticks[1].velocity)).toBe(true);
  });

  it("returns an empty pattern for 0 beats", () => {
    expect(buildMetronomePattern(0)).toEqual([]);
  });
});

describe("pattern catalog", () => {
  it("has 10 chord patterns with unique IDs", () => {
    expect(CHORD_PATTERNS).toHaveLength(10);
    const ids = CHORD_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 7 bass patterns with unique IDs", () => {
    expect(BASS_PATTERNS).toHaveLength(7);
    const ids = BASS_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 7 drum patterns with unique IDs", () => {
    expect(DRUM_PATTERNS).toHaveLength(7);
    const ids = DRUM_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 6 drum variations with unique IDs", () => {
    expect(DRUM_VARIATIONS).toHaveLength(6);
    const ids = DRUM_VARIATIONS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all pattern beats are in range [0, bars * 4)", () => {
    for (const p of CHORD_PATTERNS) {
      const maxBeat = (p.bars ?? 1) * 4;
      for (const h of p.hits) {
        expect(h.beat).toBeGreaterThanOrEqual(0);
        expect(h.beat).toBeLessThan(maxBeat);
      }
    }
    for (const p of BASS_PATTERNS) {
      const maxBeat = (p.bars ?? 1) * 4;
      for (const h of p.hits) {
        expect(h.beat).toBeGreaterThanOrEqual(0);
        expect(h.beat).toBeLessThan(maxBeat);
      }
    }
    const drumPatterns = [
      ...DRUM_PATTERNS,
      ...DRUM_VARIATIONS.map((v) => v.pattern),
    ];
    for (const p of drumPatterns) {
      const maxBeat = (p.bars ?? 1) * 4;
      const lanes = [p.kicks, p.snares, p.hats, p.openHats, p.ride, p.crossStick];
      for (const lane of lanes) {
        for (const h of lane ?? []) {
          expect(h.beat).toBeGreaterThanOrEqual(0);
          expect(h.beat).toBeLessThan(maxBeat);
        }
      }
    }
  });

  it("lookups return correct patterns", () => {
    expect(getChordPattern("pop-8ths")).toBeDefined();
    expect(getBassPattern("root-fifth")).toBeDefined();
    expect(getDrumPattern("rock")).toBeDefined();
  });
});

describe("funk-syncopated bass pattern", () => {
  const funk = getBassPattern("funk-syncopated")!;

  it("anchors a strong staccato root on the one", () => {
    const one = funk.hits[0];
    expect(one).toMatchObject({ beat: 0, note: "root", velocity: 1, articulation: "staccato" });
  });

  it("uses ghost notes, an octave pop, the fifth, and a b7 color note", () => {
    expect(funk.hits.map((h) => h.beat)).toEqual([0, 0.75, 1.5, 2.5, 3.5]);
    expect(funk.hits.map((h) => h.note)).toEqual([
      "root", "root", "octave", "fifth", "flat-seventh",
    ]);
  });

  it("plays every hit staccato", () => {
    expect(funk.hits.every((h) => h.articulation === "staccato")).toBe(true);
  });

  it("ghost notes are quieter than accents", () => {
    const byBeat = new Map(funk.hits.map((h) => [h.beat, h.velocity]));
    expect(byBeat.get(0.75)!).toBeLessThan(byBeat.get(0)!);
    expect(byBeat.get(2.5)!).toBeLessThan(byBeat.get(1.5)!);
  });
});

describe("pedal bass pattern", () => {
  const pedal = getBassPattern("pedal")!;

  it("is a staccato eighth-note pulse on the root", () => {
    expect(pedal.hits.map((h) => h.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    expect(pedal.hits.every((h) => h.note === "root")).toBe(true);
    expect(pedal.hits.every((h) => h.articulation === "staccato")).toBe(true);
  });

  it("accents beat 1 hardest and the and-of-3 push softly", () => {
    const byBeat = new Map(pedal.hits.map((h) => [h.beat, h.velocity]));
    expect(byBeat.get(0)).toBe(1);
    expect(byBeat.get(2)!).toBeGreaterThan(byBeat.get(2.5)!);
    expect(byBeat.get(0)!).toBeGreaterThan(byBeat.get(0.5)!);
  });
});

describe("walking bass pattern", () => {
  const walking = getBassPattern("walking")!;

  it("keeps its root→third→fifth→approach note selection", () => {
    expect(walking.hits.map((h) => h.note)).toEqual([
      "root", "third", "fifth", "chromatic-approach",
    ]);
  });

  it("plays every note legato so the line connects", () => {
    expect(walking.hits.every((h) => h.articulation === "legato")).toBe(true);
  });
});

describe("jazz-ride drum pattern", () => {
  const jazz = getDrumPattern("jazz-ride")!;
  const vAt = (hits: readonly { beat: number; velocity: number }[], beat: number) =>
    hits.find((h) => h.beat === beat)?.velocity;

  it("keeps the spang-a-lang ride rhythm", () => {
    expect(jazz.ride!.map((h) => h.beat)).toEqual([0, 1, 1.5, 2, 3, 3.5]);
  });

  it("accents the ride on musical beats 2 and 4, skip-notes softest", () => {
    expect(vAt(jazz.ride!, 1)!).toBeGreaterThan(vAt(jazz.ride!, 0)!);
    expect(vAt(jazz.ride!, 3)!).toBeGreaterThan(vAt(jazz.ride!, 2)!);
    expect(vAt(jazz.ride!, 1.5)!).toBeLessThan(vAt(jazz.ride!, 1)!);
    expect(vAt(jazz.ride!, 3.5)!).toBeLessThan(vAt(jazz.ride!, 3)!);
  });

  it("feathers a soft four-on-the-floor kick", () => {
    expect(jazz.kicks.map((h) => h.beat)).toEqual([0, 1, 2, 3]);
    expect(jazz.kicks.every((h) => h.velocity <= 0.18)).toBe(true);
  });

  it("plays foot-chick hats on 2 and 4 and audible soft brush taps", () => {
    expect(jazz.hats.map((h) => h.beat)).toEqual([1, 3]);
    // Brush taps on the backbeat (musical 2 & 4) plus the ghost — present
    // enough to read under the ride, still soft (all <= 0.3).
    expect(jazz.snares.map((h) => h.beat)).toEqual([1, 2.5, 3]);
    expect(jazz.snares.every((h) => h.velocity <= 0.3)).toBe(true);
    expect(jazz.snares.length).toBeGreaterThanOrEqual(3);
  });
});

describe("jazz-comp chord pattern", () => {
  const jazz = getChordPattern("jazz-comp")!;

  it("is a sparse Charleston-plus-anticipation figure", () => {
    expect(jazz.hits.map((h) => h.beat)).toEqual([0, 1.5, 3.5]);
  });

  it("plays every hit as a staccato stab", () => {
    expect(jazz.hits.every((h) => h.style === "staccato")).toBe(true);
  });

  it("accents the downbeat stab over the inner comp", () => {
    const byBeat = new Map(jazz.hits.map((h) => [h.beat, h.velocity]));
    expect(byBeat.get(0)!).toBeGreaterThan(byBeat.get(1.5)!);
  });
});

describe("bass articulation polish", () => {
  it("plays the arpeggiated (ballad) bass legato so notes connect", () => {
    const arp = getBassPattern("arpeggiated")!;
    expect(arp.hits.every((h) => h.articulation === "legato")).toBe(true);
  });

  it("keeps the shuffle (blues) bass legato so the upright stays audible", () => {
    // Regression guard: the shuffle runs on the sustain:0 bass-upright patch.
    // Staccato clips the note so short it is effectively silent. It must stay
    // non-staccato (legato) — swing provides the bounce.
    const shuffle = getBassPattern("shuffle")!;
    expect(shuffle.hits.every((h) => h.articulation === "legato")).toBe(true);
  });
});

describe("funk drum ghost snares", () => {
  const funk = getDrumPattern("funk")!;

  it("preserves the backbeat at full velocity", () => {
    const byBeat = new Map(funk.snares.map((h) => [h.beat, h.velocity]));
    expect(byBeat.get(1)).toBe(1);
    expect(byBeat.get(3)).toBe(1);
  });

  it("adds at least three low-velocity (<=0.2) ghost snares", () => {
    const ghosts = funk.snares.filter((h) => h.velocity <= 0.2);
    expect(ghosts.length).toBeGreaterThanOrEqual(3);
  });

  it("places snares on the expected 16th-subdivision grid", () => {
    expect(funk.snares.map((h) => h.beat)).toEqual([1, 1.5, 2.25, 3, 3.5]);
  });

  it("locks the kick to a syncopated in-the-pocket funk groove", () => {
    // The funk kick should anchor the one hardest and add a syncopated push
    // (the 'and' of beats) rather than a plain 4-on-the-floor feel.
    const byBeat = new Map(funk.kicks.map((h) => [h.beat, h.velocity]));
    expect(funk.kicks.map((h) => h.beat)).toEqual([0, 0.75, 2.5]);
    expect(byBeat.get(0)).toBe(1); // the one is the hardest
    expect(byBeat.get(0.75)!).toBeLessThan(byBeat.get(0)!); // syncopated push is softer
  });
});

describe("funk-16th chord comp pattern", () => {
  const funk = getChordPattern("funk-16th")!;

  it("exists and is a syncopated 16th-note scratch comp", () => {
    expect(funk).toBeDefined();
    // Dense 16th-note grid with the characteristic funk syncopation — far more
    // hits than the reggae offbeat-skank it replaces (which had 4 upbeats).
    expect(funk.hits.length).toBeGreaterThanOrEqual(8);
  });

  it("accents the downbeat over the scratchy inner 16ths", () => {
    const byBeat = new Map(funk.hits.map((h) => [h.beat, h.velocity]));
    expect(byBeat.get(0)!).toBeGreaterThan(0.8); // strong downbeat stab
    const ghosts = funk.hits.filter((h) => h.velocity <= 0.4);
    expect(ghosts.length).toBeGreaterThanOrEqual(3); // soft scratch strokes
  });

  it("alternates strum direction for the 16th scratch feel", () => {
    expect(funk.hits.some((h) => h.direction === "up")).toBe(true);
    expect(funk.hits.some((h) => h.direction === "down")).toBe(true);
  });
});

describe("funk-scratch chord comp", () => {
  const funk = getChordPattern("funk-scratch")!;

  it("accents the one hardest", () => {
    const byBeat = new Map(funk.hits.map((h) => [h.beat, h.velocity]));
    const one = byBeat.get(0)!;
    for (const h of funk.hits) {
      if (h.beat !== 0) expect(h.velocity).toBeLessThan(one);
    }
  });

  it("anchors the one with a single root note (not a strummed chord)", () => {
    const byBeat = new Map(funk.hits.map((h) => [h.beat, h]));
    expect(byBeat.get(0)!.articulation).toBe("root");
    expect(byBeat.get(0)!.direction).toBe("down");
  });

  it("has one plain stab and two color-stabs as down-strummed offbeat accents", () => {
    const stabs = funk.hits.filter((h) => h.articulation === "stab");
    const colors = funk.hits.filter((h) => h.articulation === "color-stab");
    expect(stabs).toHaveLength(1);
    expect(colors).toHaveLength(2);
    expect(colors.map((c) => c.beat).sort((a, b) => a - b)).toEqual([2.5, 3.5]);
    for (const c of colors) {
      expect(c.beat % 1).toBeCloseTo(0.5); // syncopated upbeats (the "&")
      expect(c.direction).toBe("down"); // down-strummed, not up
      expect(c.velocity).toBeLessThan(stabs[0].velocity); // sit under the main stab
    }
  });

  it("fills the rest with muted ghost scratches", () => {
    expect(funk.hits.some((h) => h.articulation === "muted")).toBe(true);
  });
});

describe("funk groove locks on the one", () => {
  it("funk-syncopated bass anchors beat 1 as the velocity-1 root", () => {
    const bass = getBassPattern("funk-syncopated")!;
    const one = bass.hits.find((h) => h.beat === 0)!;
    expect(one.velocity).toBe(1);
    expect(one.note).toBe("root");
  });

  it("funk drums put the hardest kick on the one", () => {
    const funk = getDrumPattern("funk")!;
    const kickOne = funk.kicks.find((h) => h.beat === 0)!;
    expect(kickOne.velocity).toBe(1);
    for (const k of funk.kicks) {
      if (k.beat !== 0) expect(k.velocity).toBeLessThanOrEqual(kickOne.velocity);
    }
  });
});

describe("variationFiresOnBar", () => {
  const v = (barInterval: number, barPhase?: number): DrumVariation => ({
    id: "t",
    label: "t",
    barInterval,
    barPhase,
    pattern: { id: "p", label: "p", kicks: [], snares: [], hats: [] },
  });

  it("fires every bar at interval 1, phase 0", () => {
    for (let b = 0; b < 8; b++) expect(variationFiresOnBar(v(1, 0), b)).toBe(true);
  });

  it("fires on the turnaround (interval 4, phase 3): bars 3 and 7", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((b) => variationFiresOnBar(v(4, 3), b)))
      .toEqual([false, false, false, true, false, false, false, true]);
  });

  it("fires on phrase start (interval 4, phase 0): bars 0 and 4", () => {
    expect([0, 1, 2, 3, 4].map((b) => variationFiresOnBar(v(4, 0), b)))
      .toEqual([true, false, false, false, true]);
  });

  it("defaults barPhase to 0 when omitted", () => {
    expect(variationFiresOnBar(v(2), 0)).toBe(true);
    expect(variationFiresOnBar(v(2), 1)).toBe(false);
    expect(variationFiresOnBar(v(2), 2)).toBe(true);
  });

  it("never fires for a non-positive interval (total/guarded)", () => {
    expect(variationFiresOnBar(v(0, 0), 0)).toBe(false);
    expect(variationFiresOnBar(v(-4, 0), 0)).toBe(false);
  });
});

describe("DRUM_VARIATIONS definitions are truthful", () => {
  const byId = (id: string) => {
    const found = DRUM_VARIATIONS.find((v) => v.id === id);
    if (!found) throw new Error(`missing variation ${id}`);
    return found;
  };

  it("fill-every-4 lands on the 4th bar (turnaround), not the 1st", () => {
    const fill = byId("fill-every-4");
    expect(fill.barInterval).toBe(4);
    expect(variationFiresOnBar(fill, 0)).toBe(false);
    expect(variationFiresOnBar(fill, 3)).toBe(true);
    expect(variationFiresOnBar(fill, 7)).toBe(true);
  });

  it("crash-bar-1 lands on the 1st bar of each 4-bar group", () => {
    const crash = byId("crash-bar-1");
    expect(crash.barInterval).toBe(4);
    expect(variationFiresOnBar(crash, 0)).toBe(true);
    expect(variationFiresOnBar(crash, 1)).toBe(false);
    expect(variationFiresOnBar(crash, 4)).toBe(true);
  });

  it("open-hat-and-of-4 still fires every bar (unchanged)", () => {
    const oh = byId("open-hat-and-of-4");
    expect(oh.barInterval).toBe(1);
    expect([0, 1, 2, 3].every((b) => variationFiresOnBar(oh, b))).toBe(true);
  });

  it("funk-fill-4 fires on the turnaround bar with snare buildup hits", () => {
    const fill = byId("funk-fill-4");
    expect(fill.barInterval).toBe(4);
    expect(fill.barPhase).toBe(3);
    expect(variationFiresOnBar(fill, 3)).toBe(true);
    expect(variationFiresOnBar(fill, 0)).toBe(false);
    expect(fill.pattern.snares.length).toBeGreaterThan(0);
  });

  it("jazz-turnaround-4 fires on the turnaround bar with a ride accent", () => {
    const turn = byId("jazz-turnaround-4");
    expect(turn.barInterval).toBe(4);
    expect(turn.barPhase).toBe(3);
    expect(variationFiresOnBar(turn, 3)).toBe(true);
    expect(variationFiresOnBar(turn, 0)).toBe(false);
    expect(turn.pattern.ride).toBeDefined();
    expect(turn.pattern.ride!.length).toBeGreaterThan(0);
  });

  it("blues-fill-4 fires on the turnaround bar with a snare buildup", () => {
    const fill = byId("blues-fill-4");
    expect(fill.barInterval).toBe(4);
    expect(fill.barPhase).toBe(3);
    expect(variationFiresOnBar(fill, 3)).toBe(true);
    expect(variationFiresOnBar(fill, 7)).toBe(true);
    expect(fill.pattern.snares.length).toBeGreaterThan(0);
  });
});

describe("sliceCellToBar", () => {
  // A 2-bar cell in 4/4: beats 0..7.99. Bar 1 = [0,4), bar 2 = [4,8).
  const CELL = [
    { beat: 0, velocity: 0.8 },
    { beat: 1.5, velocity: 0.7 },
    { beat: 3, velocity: 0.75 },
    { beat: 5, velocity: 0.7 },
    { beat: 6, velocity: 0.8 },
  ];

  it("returns bar 1 hits with original beats for cellBarIndex 0", () => {
    expect(sliceCellToBar(CELL, 0, 4)).toEqual([
      { beat: 0, velocity: 0.8 },
      { beat: 1.5, velocity: 0.7 },
      { beat: 3, velocity: 0.75 },
    ]);
  });

  it("returns bar 2 hits shifted back by beatsPerBar for cellBarIndex 1", () => {
    expect(sliceCellToBar(CELL, 1, 4)).toEqual([
      { beat: 1, velocity: 0.7 },
      { beat: 2, velocity: 0.8 },
    ]);
  });

  it("returns an empty array for an out-of-range cellBarIndex", () => {
    expect(sliceCellToBar(CELL, 2, 4)).toEqual([]);
  });

  it("preserves extra hit fields (only the beat is shifted)", () => {
    const typed = [{ beat: 5, velocity: 0.5, type: "crossStick" as const }];
    expect(sliceCellToBar(typed, 1, 4)).toEqual([
      { beat: 1, velocity: 0.5, type: "crossStick" },
    ]);
  });
});

describe("bossa patterns", () => {
  it("rewrites the bossa drum pattern as a 2-bar cell with a bossa-clave cross-stick", () => {
    const bossa = getDrumPattern("bossa")!;
    expect(bossa.bars).toBe(2);
    expect(bossa.snares).toEqual([]); // cross-stick carries the rhythm
    // Authentic 3-2 bossa clave: 2-side's last note on "3&" (6.5), not son's "3" (6).
    expect(bossa.crossStick?.map((h) => h.beat)).toEqual([0, 1.5, 3, 5, 6.5]);
  });

  it("adds a 1-bar root-fifth bossa bass pattern", () => {
    const bass = getBassPattern("bossa")!;
    expect(bass.bars ?? 1).toBe(1);
    expect(bass.hits.map((h) => h.note)).toEqual(["root", "fifth"]);
  });

  it("adds a 2-bar bossa comp: LH bass + RH chords that intensify in the second bar", () => {
    const comp = getChordPattern("bossa-comp")!;
    expect(comp.bars).toBe(2);
    expect(comp.voicing).toBe("rootless-jazz");
    expect(comp.hits.map((h) => h.beat)).toEqual([0, 1.5, 2, 3.5, 4, 4.5, 5.5, 6, 7.5]);
    expect(comp.hits.map((h) => h.voiceRole)).toEqual([
      "bass-root", "chord", "bass-fifth", "chord",
      "bass-root", "chord", "chord", "bass-fifth", "chord",
    ]);
    // The RH chords get busier in the second bar (the authentic 2-bar arc):
    // bar 1 has 2 chord stabs, bar 2 has 3 anticipated off-beat stabs.
    const chordBeats = comp.hits.filter((h) => h.voiceRole === "chord").map((h) => h.beat);
    expect(chordBeats.filter((b) => b < 4)).toEqual([1.5, 3.5]);
    expect(chordBeats.filter((b) => b >= 4)).toEqual([4.5, 5.5, 7.5]);
    // Every hit is short — no sustain anywhere in the comp.
    expect(comp.hits.every((h) => h.style === undefined)).toBe(true);
  });
});
