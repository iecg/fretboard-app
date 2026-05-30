import { describe, expect, it } from "vitest";
import {
  buildMetronomePattern,
  clipPatternToBeats,
  repeatPatternToBeats,
  CHORD_PATTERNS,
  BASS_PATTERNS,
  DRUM_PATTERNS,
  DRUM_VARIATIONS,
  getChordPattern,
  getBassPattern,
  getDrumPattern,
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
  it("has 7 chord patterns with unique IDs", () => {
    expect(CHORD_PATTERNS).toHaveLength(7);
    const ids = CHORD_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 6 bass patterns with unique IDs", () => {
    expect(BASS_PATTERNS).toHaveLength(6);
    const ids = BASS_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 7 drum patterns with unique IDs", () => {
    expect(DRUM_PATTERNS).toHaveLength(7);
    const ids = DRUM_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 3 drum variations with unique IDs", () => {
    expect(DRUM_VARIATIONS).toHaveLength(3);
    const ids = DRUM_VARIATIONS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all pattern beats are in range [0, 4)", () => {
    for (const p of CHORD_PATTERNS) {
      for (const h of p.hits) {
        expect(h.beat).toBeGreaterThanOrEqual(0);
        expect(h.beat).toBeLessThan(4);
      }
    }
    for (const p of BASS_PATTERNS) {
      for (const h of p.hits) {
        expect(h.beat).toBeGreaterThanOrEqual(0);
        expect(h.beat).toBeLessThan(4);
      }
    }
    const drumPatterns = [
      ...DRUM_PATTERNS,
      ...DRUM_VARIATIONS.map((v) => v.pattern),
    ];
    for (const p of drumPatterns) {
      const lanes = [p.kicks, p.snares, p.hats, p.openHats, p.ride];
      for (const lane of lanes) {
        for (const h of lane ?? []) {
          expect(h.beat).toBeGreaterThanOrEqual(0);
          expect(h.beat).toBeLessThan(4);
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
    expect(funk.hits.map((h) => h.beat)).toEqual([0, 0.75, 1.5, 2, 2.75, 3.5]);
    expect(funk.hits.map((h) => h.note)).toEqual([
      "root", "root", "octave", "fifth", "flat-seventh", "root",
    ]);
  });

  it("plays every hit staccato", () => {
    expect(funk.hits.every((h) => h.articulation === "staccato")).toBe(true);
  });

  it("ghost notes are quieter than accents", () => {
    const byBeat = new Map(funk.hits.map((h) => [h.beat, h.velocity]));
    expect(byBeat.get(0.75)!).toBeLessThan(byBeat.get(0)!);
    expect(byBeat.get(2.75)!).toBeLessThan(byBeat.get(1.5)!);
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

  it("plays foot-chick hats on 2 and 4 and a single soft ghost snare", () => {
    expect(jazz.hats.map((h) => h.beat)).toEqual([1, 3]);
    expect(jazz.snares).toEqual([{ beat: 2.5, velocity: 0.2 }]);
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

  it("gives the shuffle (blues) bass a staccato bounce", () => {
    const shuffle = getBassPattern("shuffle")!;
    expect(shuffle.hits.every((h) => h.articulation === "staccato")).toBe(true);
  });
});
