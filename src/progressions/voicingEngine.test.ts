import { describe, it, expect } from "vitest";
import { buildVoicing, STRUM_PRESET, __testables } from "./voicingEngine";
import { CHORD_DEFINITIONS, NOTES } from "@fretflow/core";
import { calculateDistance } from "./voiceLeading";
import {
  buildFunkColorVoicing,
  buildBossaColorVoicing,
} from "./progressionAudio";

describe("buildVoicing — C6 (no prevVoicing)", () => {
  // The exact grip is NOT pinned — REGISTER_CENTER is a tunable register dial,
  // decided by ear after implementation. Assert the invariants that must hold
  // regardless of register tuning.
  it("voices C6 with the 6th internal and as a complete C6 chord", () => {
    const v = buildVoicing("C", "6", undefined, STRUM_PRESET);
    const pcs = new Set(v.map((n) => n.replace(/-?\d+$/, "")));
    expect(pcs).toEqual(new Set(["C", "E", "G", "A"])); // all four tones present
    const abs = v.map(absOf).sort((a, b) => a - b);
    // the 6th (A) is neither the lowest nor the highest voice
    const isA = (n: number) => ((n % 12) + 12) % 12 === NOTES.indexOf("A");
    expect(isA(abs[0])).toBe(false);
    expect(isA(abs[abs.length - 1])).toBe(false);
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

describe("buildVoicing — invariants (all qualities x several roots)", () => {
  const roots = ["C", "G", "A#", "F", "B"];
  const qualities = Object.keys(CHORD_DEFINITIONS);

  const COLOR = new Set(["6", "9", "13"]);
  function topBottomRoles(root: string, quality: string, voicing: string[]) {
    const def = CHORD_DEFINITIONS[quality];
    const rootIndex = NOTES.indexOf(root);
    const abs = voicing.map(absOf).sort((a, b) => a - b);
    const pcRole = (pc: number): string => {
      const m = def.members.find((mm) => (rootIndex + mm.semitone) % 12 === pc);
      return m ? m.name : "";
    };
    return {
      bottom: pcRole(((abs[0] % 12) + 12) % 12),
      top: pcRole(((abs[abs.length - 1] % 12) + 12) % 12),
    };
  }

  it("no sub-minor-third below C4, top <= C5", () => {
    for (const root of roots) {
      for (const q of qualities) {
        const v = buildVoicing(root, q, undefined, STRUM_PRESET);
        if (v.length === 0) continue;
        const abs = v.map(absOf).sort((a, b) => a - b);
        expect(abs[abs.length - 1]).toBeLessThanOrEqual(STRUM_PRESET.ceilAbs);
        for (let i = 1; i < abs.length; i++) {
          if (abs[i] < STRUM_PRESET.lilThresholdAbs) {
            expect(abs[i] - abs[i - 1]).toBeGreaterThanOrEqual(STRUM_PRESET.minLowIntervalSemitones);
          }
        }
      }
    }
  });

  it("a color tone (6/9/13) is never the top or bottom voice", () => {
    for (const root of roots) {
      for (const q of qualities) {
        const def = CHORD_DEFINITIONS[q];
        const hasColor = def.members.some((m) => COLOR.has(m.name));
        const hasNonColor = def.members.some((m) => !COLOR.has(m.name));
        if (!hasColor || !hasNonColor) continue;
        const v = buildVoicing(root, q, undefined, STRUM_PRESET);
        if (v.length === 0) continue;
        const { top, bottom } = topBottomRoles(root, q, v);
        expect(COLOR.has(top)).toBe(false);
        expect(COLOR.has(bottom)).toBe(false);
      }
    }
  });

  it("keeps each quality's 3rd-or-b3rd", () => {
    for (const root of roots) {
      for (const q of qualities) {
        const def = CHORD_DEFINITIONS[q];
        const third = def.members.find((m) => m.name === "3" || m.name === "b3");
        if (!third) continue;
        const v = buildVoicing(root, q, undefined, STRUM_PRESET);
        if (v.length === 0) continue;
        const rootIndex = NOTES.indexOf(root);
        expect(chromaSet(v).has((rootIndex + third.semitone) % 12)).toBe(true);
      }
    }
  });
});

describe("buildVoicing — voice leading", () => {
  it("with a prevVoicing, picks a filtered candidate nearest to it", () => {
    const prev = buildVoicing("C", "6", undefined, STRUM_PRESET); // E3 A3 C4 G4
    const next = buildVoicing("G", "M", prev, STRUM_PRESET);

    // still passes spacing
    const abs = next.map(absOf).sort((a, b) => a - b);
    for (let i = 1; i < abs.length; i++) {
      if (abs[i] < STRUM_PRESET.lilThresholdAbs) {
        expect(abs[i] - abs[i - 1]).toBeGreaterThanOrEqual(STRUM_PRESET.minLowIntervalSemitones);
      }
    }

    // and is at least as near as the no-prev choice
    const noLead = buildVoicing("G", "M", undefined, STRUM_PRESET);
    expect(calculateDistance(prev, next)).toBeLessThanOrEqual(calculateDistance(prev, noLead));
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

describe("voicing engine helpers", () => {
  const { roleOf, buildInversion, spreadFifth, normalizeRegister, passesSpacing, colorInternal } = __testables;

  it("roleOf classifies members", () => {
    expect(roleOf("root")).toBe("root");
    expect(roleOf("3")).toBe("guide");
    expect(roleOf("b7")).toBe("guide");
    expect(roleOf("5")).toBe("fifth");
    expect(roleOf("6")).toBe("color");
    expect(roleOf("9")).toBe("color");
    expect(roleOf("4")).toBe("other");
  });

  it("buildInversion stacks ascending from a chosen bass, wrapping octaves", () => {
    // C6 tones pcs: root0, guide4, fifth7, color9; bass = guide (idx1), floor 36
    const tones = [
      { pc: 0, role: "root" as const },
      { pc: 4, role: "guide" as const },
      { pc: 7, role: "fifth" as const },
      { pc: 9, role: "color" as const },
    ];
    const inv = buildInversion(tones, 1, 36); // bass E
    expect(inv.map((v) => v.abs)).toEqual([40, 43, 45, 48]); // E3 G3 A3 C4
  });

  it("spreadFifth raises the 5th just above the top voice", () => {
    const voices = [
      { abs: 40, role: "guide" as const }, // E3
      { abs: 43, role: "fifth" as const }, // G3
      { abs: 45, role: "color" as const }, // A3
      { abs: 48, role: "root" as const }, // C4
    ];
    const out = spreadFifth(voices);
    expect(out!.map((v) => v.abs)).toEqual([40, 45, 48, 55]); // E3 A3 C4 G4
  });

  it("colorInternal rejects a color tone on top or bottom", () => {
    const top = [
      { abs: 36, role: "root" as const },
      { abs: 40, role: "guide" as const },
      { abs: 45, role: "color" as const }, // top
    ];
    expect(colorInternal(top)).toBe(false);
    const internal = [
      { abs: 40, role: "guide" as const },
      { abs: 45, role: "color" as const },
      { abs: 48, role: "root" as const },
    ];
    expect(colorInternal(internal)).toBe(true);
  });

  it("passesSpacing rejects a sub-minor-third below C4", () => {
    const muddy = [
      { abs: 43, role: "fifth" as const }, // G3
      { abs: 45, role: "color" as const }, // A3 — 2 semis above, below C4
    ];
    expect(passesSpacing(muddy, 48, 3)).toBe(false);
    const clean = [
      { abs: 40, role: "guide" as const },
      { abs: 45, role: "color" as const }, // 5 semis
    ];
    expect(passesSpacing(clean, 48, 3)).toBe(true);
  });

  it("normalizeRegister drops octaves until the top fits the ceiling", () => {
    const high = [
      { abs: 64, role: "root" as const },
      { abs: 68, role: "guide" as const },
    ];
    expect(normalizeRegister(high, 60).map((v) => v.abs)).toEqual([52, 56]);
  });
});
