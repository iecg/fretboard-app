import { describe, it, expect } from "vitest";
import { buildVoicing, STRUM_PRESET } from "./voicingEngine";
import { CHORD_DEFINITIONS, NOTES } from "@fretflow/core";
import { calculateDistance } from "./voiceLeading";
import {
  buildFunkColorVoicing,
  buildBossaColorVoicing,
} from "./progressionAudio";

describe("buildVoicing — golden voicings (no prevVoicing)", () => {
  it("C6 voices as C3 E3 G3 A4 (the 6th lifts off the 5th — no low major 2nd)", () => {
    expect(buildVoicing("C", "6", undefined, STRUM_PRESET)).toEqual([
      "C3", "E3", "G3", "A4",
    ]);
  });

  it("returns [] for an unknown quality", () => {
    expect(buildVoicing("C", "not-a-chord", undefined, STRUM_PRESET)).toEqual([]);
  });

  it("returns [] for an unrecognized root", () => {
    expect(buildVoicing("H", "M", undefined, STRUM_PRESET)).toEqual([]);
  });
});

function chromaSet(voicing: string[]): Set<number> {
  return new Set(
    voicing.map((n) => {
      const name = n.replace(/-?\d+$/, "");
      return NOTES.indexOf(name);
    }),
  );
}

function absOf(note: string): number {
  const name = note.replace(/-?\d+$/, "");
  const oct = parseInt(note.replace(/[^-\d]/g, ""), 10);
  return oct * 12 + NOTES.indexOf(name);
}

describe("buildVoicing — extended qualities", () => {
  const present = (q: string) => Boolean(CHORD_DEFINITIONS[q]);
  const has13ths = ["13", "maj13", "m13"].some(present);

  it("m6 keeps all four tones, top <= C5", () => {
    const v = buildVoicing("C", "m6", undefined, STRUM_PRESET);
    expect(chromaSet(v)).toEqual(new Set([0, 3, 7, 9])); // C, D#(Eb), G, A
    expect(Math.max(...v.map(absOf))).toBeLessThanOrEqual(STRUM_PRESET.ceilAbs);
  });

  it.runIf(has13ths)("13th chords drop the 5th to a five-note grip, top <= C5", () => {
    for (const q of ["13", "maj13", "m13"]) {
      if (!present(q)) continue;
      const v = buildVoicing("C", q, undefined, STRUM_PRESET);
      expect(v.length).toBe(5);
      expect(chromaSet(v).has(7)).toBe(false); // no perfect 5th (G)
      expect(Math.max(...v.map(absOf))).toBeLessThanOrEqual(STRUM_PRESET.ceilAbs);
    }
  });
});

describe("buildVoicing — invariants (all qualities x several roots)", () => {
  const roots = ["C", "G", "A#", "F", "B"];
  const qualities = Object.keys(CHORD_DEFINITIONS);

  it("no interval smaller than 3 semitones below C4, and top <= C5", () => {
    for (const root of roots) {
      for (const q of qualities) {
        const v = buildVoicing(root, q, undefined, STRUM_PRESET);
        if (v.length === 0) continue;
        const abs = v.map(absOf).sort((a, b) => a - b);
        expect(abs[abs.length - 1]).toBeLessThanOrEqual(STRUM_PRESET.ceilAbs);
        for (let i = 1; i < abs.length; i++) {
          if (abs[i] < STRUM_PRESET.lilThresholdAbs) {
            expect(abs[i] - abs[i - 1]).toBeGreaterThanOrEqual(
              STRUM_PRESET.minLowIntervalSemitones,
            );
          }
        }
      }
    }
  });

  it("keeps each quality's guide tone(s): a 3rd-or-b3rd is always present", () => {
    for (const root of roots) {
      for (const q of qualities) {
        const def = CHORD_DEFINITIONS[q];
        const hasThird = def.members.some((m) => m.name === "3" || m.name === "b3");
        if (!hasThird) continue;
        const v = buildVoicing(root, q, undefined, STRUM_PRESET);
        if (v.length === 0) continue;
        const rootIndex = NOTES.indexOf(root);
        const third = def.members.find((m) => m.name === "3" || m.name === "b3")!;
        const thirdChroma = (rootIndex + third.semitone) % 12;
        expect(chromaSet(v).has(thirdChroma)).toBe(true);
      }
    }
  });
});

describe("buildVoicing — voice leading", () => {
  it("with a prevVoicing, returns a spacing-valid voicing nearest to it", () => {
    const prev = buildVoicing("C", "M", undefined, STRUM_PRESET); // C3 E3 G3
    const next = buildVoicing("G", "M", prev, STRUM_PRESET);

    const abs = next.map(absOf).sort((a, b) => a - b);
    for (let i = 1; i < abs.length; i++) {
      if (abs[i] < STRUM_PRESET.lilThresholdAbs) {
        expect(abs[i] - abs[i - 1]).toBeGreaterThanOrEqual(
          STRUM_PRESET.minLowIntervalSemitones,
        );
      }
    }

    const defaultFloor = buildVoicing("G", "M", undefined, STRUM_PRESET);
    expect(calculateDistance(prev, next)).toBeLessThanOrEqual(
      calculateDistance(prev, defaultFloor),
    );
  });
});

describe("funk/bossa builders are untouched by the engine work", () => {
  const set: Array<[string, string]> = [
    ["C", "M"],
    ["G", "M"],
    ["A", "m"],
    ["F", "M"],
  ];

  it("funk color voicings match their known outputs", () => {
    expect(set.map(([r, q]) => buildFunkColorVoicing(r, q))).toMatchSnapshot();
  });

  it("bossa color voicings match their known outputs", () => {
    expect(set.map(([r, q]) => buildBossaColorVoicing(r, q))).toMatchSnapshot();
  });
});
