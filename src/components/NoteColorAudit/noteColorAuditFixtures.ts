import { DEGREE_COLORS } from "../../core/degrees";
import type { PracticeLens } from "../../core/theory";

export type AuditTheme = {
  id: "light" | "dark";
  label: string;
  dataTheme: "modern-light" | "modern-dark";
};

export type AuditLens = {
  id: PracticeLens | "none";
  label: string;
  dataPracticeLens?: PracticeLens;
};

export type AuditDegreeMode = {
  id: "degree-off" | "degree-on";
  label: string;
  enabled: boolean;
};

export interface DegreeChipAuditSwatch {
  id: string;
  label: string;
  display: string;
  interval: string;
  inScale?: boolean;
  isTonic?: boolean;
  isColorNote?: boolean;
  isHidden?: boolean;
  degreeColorEligible?: boolean;
  auditDegreeModes?: readonly string[];
}

export type DegreeRampAuditSwatch = {
  id: string;
  label: string;
  display: string;
  interval: string;
  degreeId: string;
  degreeColor: string;
  isTonic?: boolean;
  isColorNote?: boolean;
};

export type FretboardAuditSwatch = {
  id: string;
  label: string;
  noteClass: string;
  display: string;
  isGuideTone?: boolean;
  isTension?: boolean;
  degreeColorEligible?: boolean;
};

export interface PracticePillAuditSwatch {
  id: string;
  label: string;
  noteClass?: string;
  display?: string;
  interval?: string;
  isChordRoot?: boolean;
  isInScale?: boolean;
  isGuideTone?: boolean;
  isTension?: boolean;
  isHidden?: boolean;
  degreeColorEligible?: boolean;
  auditDegreeModes?: readonly string[];
}

export type FretboardAuditCase = {
  id: string;
  label?: string;
  swatchId: FretboardAuditSwatch["id"];
  isGuideTone?: boolean;
  isTension?: boolean;
};

export type FretboardAuditGroup = {
  id: AuditLens["id"];
  label: string;
  dataPracticeLens?: PracticeLens;
  cases: readonly FretboardAuditCase[];
};

export const AUDIT_THEMES = [
  { id: "light", label: "Light", dataTheme: "modern-light" },
  { id: "dark", label: "Dark", dataTheme: "modern-dark" },
] as const satisfies readonly AuditTheme[];

export const AUDIT_LENSES = [
  { id: "none", label: "Base" },
  { id: "guide-tones", label: "Guide Tones", dataPracticeLens: "guide-tones" },
  { id: "tension", label: "Tension", dataPracticeLens: "tension" },
] as const satisfies readonly AuditLens[];

export const AUDIT_DEGREE_MODES = [
  { id: "degree-off", label: "Degrees off", enabled: false },
  { id: "degree-on", label: "Degrees on", enabled: true },
] as const satisfies readonly AuditDegreeMode[];

export const AUDIT_DEGREE_ID = "III";
export const AUDIT_DEGREE_COLOR = DEGREE_COLORS[AUDIT_DEGREE_ID as keyof typeof DEGREE_COLORS];

export const FRETBOARD_NOTE_SWATCHES: FretboardAuditSwatch[] = [
  {
    id: "key-tonic",
    label: "Key tonic",
    noteClass: "key-tonic",
    display: "1",
    degreeColorEligible: true,
  },
  {
    id: "note-active",
    label: "Note active",
    noteClass: "note-active",
    display: "2",
    degreeColorEligible: true,
  },
  {
    id: "scale-only",
    label: "Scale only",
    noteClass: "scale-only",
    display: "3",
    degreeColorEligible: true,
  },
  {
    id: "note-blue",
    label: "Blue note",
    noteClass: "note-blue",
    display: "b5",
    degreeColorEligible: true,
  },
  {
    id: "color-tone",
    label: "Color tone",
    noteClass: "color-tone",
    display: "6",
    degreeColorEligible: false,
  },
  {
    id: "chord-root",
    label: "Chord root",
    noteClass: "chord-root",
    display: "1",
    degreeColorEligible: false,
  },
  {
    id: "chord-root-tension",
    label: "Chord root + tension",
    noteClass: "chord-root",
    display: "1",
    isTension: true,
    degreeColorEligible: false,
  },
  {
    id: "chord-tone-in-scale",
    label: "Chord tone",
    noteClass: "chord-tone-in-scale",
    display: "3",
    degreeColorEligible: false,
  },
  {
    id: "note-diatonic-chord",
    label: "Diatonic chord",
    noteClass: "note-diatonic-chord",
    display: "5",
    degreeColorEligible: false,
  },
  {
    id: "chord-tone-outside-scale",
    label: "Outside chord",
    noteClass: "chord-tone-outside-scale",
    display: "b7",
    degreeColorEligible: false,
  },
];

export const PRACTICE_PILL_SWATCHES: PracticePillAuditSwatch[] = [
  {
    id: "inactive",
    label: "Inactive",
    display: "C",
  },
  {
    id: "in-scale",
    label: "In-scale",
    noteClass: "in-scale",
    display: "D",
    isInScale: true,
    degreeColorEligible: true,
  },
  {
    id: "chord-root",
    label: "Chord root",
    noteClass: "chord-root",
    display: "G",
    interval: "1",
    isChordRoot: true,
  },
  {
    id: "guide-tone",
    label: "Guide tone",
    noteClass: "guide-tone",
    isGuideTone: true,
    display: "B",
    interval: "3",
  },
  {
    id: "in-scale-guide-tone",
    label: "In-scale guide",
    noteClass: "in-scale",
    isGuideTone: true,
    display: "F",
    interval: "4",
    isInScale: true,
    degreeColorEligible: true,
  },
  {
    id: "tension",
    label: "Tension",
    noteClass: "tension",
    isTension: true,
    display: "Bb",
    interval: "b7",
  },
  {
    id: "root-tension",
    label: "Root + tension",
    noteClass: "chord-root",
    isTension: true,
    display: "Eb",
    interval: "1",
  },
  {
    id: "hidden",
    label: "Hidden",
    isHidden: true,
    display: "A",
  },
  {
    id: "degree-colored-in-scale",
    label: "Degree colored",
    noteClass: "in-scale",
    display: "E",
    isInScale: true,
    degreeColorEligible: true,
    auditDegreeModes: ["degree-on"],
  },
];

export const DEGREE_CHIP_SWATCHES: DegreeChipAuditSwatch[] = [
  {
    id: "inactive",
    label: "Inactive",
    display: "C",
    interval: "1",
  },
  {
    id: "in-scale",
    label: "In-scale",
    display: "D",
    interval: "2",
    inScale: true,
  },
  {
    id: "tonic",
    label: "Tonic",
    display: "G",
    interval: "1",
    inScale: true,
    isTonic: true,
  },
  {
    id: "color-note",
    label: "Color note",
    display: "F#",
    interval: "b5",
    inScale: true,
    isColorNote: true,
  },
  {
    id: "hidden",
    label: "Hidden",
    display: "A",
    interval: "6",
    isHidden: true,
  },
  {
    id: "degree-colored",
    label: "Degree colored",
    display: "E",
    interval: "3",
    inScale: true,
    degreeColorEligible: true,
    auditDegreeModes: ["degree-on"],
  },
  {
    id: "degree-colored-color-note",
    label: "Colored color note",
    display: "Bb",
    interval: "b7",
    inScale: true,
    isColorNote: true,
    degreeColorEligible: true,
    auditDegreeModes: ["degree-on"],
  },
  {
    id: "hidden-degree-colored",
    label: "Hidden colored",
    display: "F",
    interval: "4",
    inScale: true,
    isHidden: true,
    degreeColorEligible: true,
    auditDegreeModes: ["degree-on"],
  },
];

export const DEGREE_RAMP_SWATCHES = [
  {
    id: "I",
    label: "I",
    display: "I",
    interval: "1",
    degreeId: "I",
    degreeColor: DEGREE_COLORS.I,
    isTonic: true,
  },
  {
    id: "II",
    label: "II",
    display: "II",
    interval: "2",
    degreeId: "II",
    degreeColor: DEGREE_COLORS.II,
  },
  {
    id: "III",
    label: "III",
    display: "III",
    interval: "3",
    degreeId: "III",
    degreeColor: DEGREE_COLORS.III,
  },
  {
    id: "IV",
    label: "IV",
    display: "IV",
    interval: "4",
    degreeId: "IV",
    degreeColor: DEGREE_COLORS.IV,
  },
  {
    id: "V",
    label: "V",
    display: "V",
    interval: "5",
    degreeId: "V",
    degreeColor: DEGREE_COLORS.V,
  },
  {
    id: "VI",
    label: "VI",
    display: "VI",
    interval: "6",
    degreeId: "VI",
    degreeColor: DEGREE_COLORS.VI,
  },
  {
    id: "VII",
    label: "VII",
    display: "VII",
    interval: "7",
    degreeId: "VII",
    degreeColor: DEGREE_COLORS.VII,
  },
  {
    id: "b5",
    label: "b5",
    display: "b5",
    interval: "b5",
    degreeId: "b5",
    degreeColor: DEGREE_COLORS.b5,
    isColorNote: true,
  },
] as const satisfies readonly DegreeRampAuditSwatch[];

export const FRETBOARD_AUDIT_GROUPS = [
  {
    id: "none",
    label: "Base roles",
    cases: [
      { id: "key-tonic", swatchId: "key-tonic" },
      { id: "note-active", swatchId: "note-active" },
      { id: "scale-only", swatchId: "scale-only" },
      { id: "note-blue", swatchId: "note-blue" },
      { id: "color-tone", swatchId: "color-tone" },
      { id: "chord-root", swatchId: "chord-root" },
      { id: "chord-root-tension", swatchId: "chord-root-tension" },
      { id: "chord-tone-in-scale", swatchId: "chord-tone-in-scale" },
      { id: "note-diatonic-chord", swatchId: "note-diatonic-chord" },
      { id: "chord-tone-outside-scale", swatchId: "chord-tone-outside-scale" },
    ],
  },
  {
    id: "guide-tones",
    label: "Guide Tone deltas",
    dataPracticeLens: "guide-tones",
    cases: [
      {
        id: "guide-tone-emphasis",
        label: "Guide emphasis",
        swatchId: "chord-tone-in-scale",
        isGuideTone: true,
      },
      {
        id: "root-guide-deemphasis",
        label: "Root de-emphasis",
        swatchId: "chord-root",
        isGuideTone: false,
      },
      {
        id: "chord-tone-guide-deemphasis",
        label: "Chord de-emphasis",
        swatchId: "chord-tone-in-scale",
        isGuideTone: false,
      },
      {
        id: "diatonic-guide-deemphasis",
        label: "Diatonic de-emphasis",
        swatchId: "note-diatonic-chord",
        isGuideTone: false,
      },
      {
        id: "color-tone-guide-deemphasis",
        label: "Color de-emphasis",
        swatchId: "color-tone",
      },
    ],
  },
  {
    id: "tension",
    label: "Tension deltas",
    dataPracticeLens: "tension",
    cases: [
      {
        id: "outside-tension-emphasis",
        label: "Outside tension",
        swatchId: "chord-tone-outside-scale",
        isTension: true,
      },
      {
        id: "root-tension-emphasis",
        label: "Root + tension",
        swatchId: "chord-root-tension",
        isTension: true,
      },
      {
        id: "root-tension-deemphasis",
        label: "Root de-emphasis",
        swatchId: "chord-root",
        isTension: false,
      },
      {
        id: "chord-tone-tension-deemphasis",
        label: "Chord de-emphasis",
        swatchId: "chord-tone-in-scale",
      },
      {
        id: "diatonic-tension-deemphasis",
        label: "Diatonic de-emphasis",
        swatchId: "note-diatonic-chord",
      },
      {
        id: "color-tone-tension-deemphasis",
        label: "Color de-emphasis",
        swatchId: "color-tone",
      },
    ],
  },
] as const satisfies readonly FretboardAuditGroup[];

export type AuditSurface =
  | "fretboard"
  | "practice-pill"
  | "degree-chip"
  | "degree-ramp";

export type RenderedAuditCase = {
  auditId: string;
  contextId: AuditLens["id"];
  degreeMode: AuditDegreeMode;
  surface: AuditSurface;
  swatchId: string;
  theme: AuditTheme;
};

export function getRenderedAuditCases(): RenderedAuditCase[] {
  const cases: RenderedAuditCase[] = [];

  for (const theme of AUDIT_THEMES) {
    for (const group of FRETBOARD_AUDIT_GROUPS) {
      for (const mode of AUDIT_DEGREE_MODES) {
        for (const auditCase of group.cases) {
          cases.push({
            auditId: getAuditId(theme, "fretboard", group.id, mode, auditCase.id),
            contextId: group.id,
            degreeMode: mode,
            surface: "fretboard",
            swatchId: auditCase.swatchId,
            theme,
          });
        }
      }
    }

    for (const mode of AUDIT_DEGREE_MODES) {
      for (const swatch of PRACTICE_PILL_SWATCHES) {
        cases.push({
          auditId: getAuditId(theme, "practice-pill", "none", mode, swatch.id),
          contextId: "none",
          degreeMode: mode,
          surface: "practice-pill",
          swatchId: swatch.id,
          theme,
        });
      }
    }

    for (const mode of AUDIT_DEGREE_MODES) {
      for (const swatch of DEGREE_CHIP_SWATCHES) {
        cases.push({
          auditId: getAuditId(theme, "degree-chip", "none", mode, swatch.id),
          contextId: "none",
          degreeMode: mode,
          surface: "degree-chip",
          swatchId: swatch.id,
          theme,
        });
      }
    }

    for (const swatch of DEGREE_RAMP_SWATCHES) {
      cases.push({
        auditId: getAuditId(theme, "degree-ramp", "none", AUDIT_DEGREE_MODES[1], swatch.id),
        contextId: "none",
        degreeMode: AUDIT_DEGREE_MODES[1],
        surface: "degree-ramp",
        swatchId: swatch.id,
        theme,
      });
    }
  }

  return cases;
}

export function getAuditId(
  theme: AuditTheme,
  surface: AuditSurface,
  contextId: AuditLens["id"],
  degreeMode: AuditDegreeMode,
  swatchId: string,
) {
  return `${theme.id}:${surface}:${contextId}:${degreeMode.id}:${swatchId}`;
}

export function getDegreeChipSwatchesForDegreeMode(degreeMode: AuditDegreeMode) {
  return DEGREE_CHIP_SWATCHES.filter(
    (swatch) =>
      !swatch.auditDegreeModes || swatch.auditDegreeModes.includes(degreeMode.id),
  );
}

export function getPracticePillSwatchesForDegreeMode(degreeMode: AuditDegreeMode) {
  return PRACTICE_PILL_SWATCHES.filter(
    (swatch) =>
      !swatch.auditDegreeModes || swatch.auditDegreeModes.includes(degreeMode.id),
  );
}

export function getFretboardAuditSwatchesForDegreeMode(
  context: AuditLens,
) {
  return FRETBOARD_NOTE_SWATCHES.filter((swatch) => {
    // If context specifies a lens (e.g. guide-tones), only show relevant swatches
    if (context.dataPracticeLens) {
      const group = FRETBOARD_AUDIT_GROUPS.find((g) => g.id === context.id);
      if (!group?.cases.some((c) => c.swatchId === swatch.id)) return false;
    }

    // Filter by degree mode eligibility
    return true;
  });
}
