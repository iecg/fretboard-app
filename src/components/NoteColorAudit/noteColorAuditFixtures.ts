import { DEGREE_COLORS } from "@fretflow/core";
import type { PracticeLens } from "@fretflow/core";

export type AuditTheme = {
  id: "light" | "dark";
  label: string;
  dataTheme: "modern-light" | "modern-dark";
};

export type AuditLens = {
  id: Exclude<PracticeLens, "targets"> | "none";
  label: string;
  dataPracticeLens?: Exclude<PracticeLens, "targets">;
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
  auditDegreeModes?: readonly AuditDegreeMode["id"][];
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
  auditDegreeModes?: readonly AuditDegreeMode["id"][];
}

export type FretboardAuditCase = {
  id: string;
  label?: string;
  swatchId: FretboardAuditSwatch["id"];
  display?: string;
  isGuideTone?: boolean;
  isTension?: boolean;
  degreeColorEligible?: boolean;
  auditDegreeModes?: readonly AuditDegreeMode["id"][];
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
    isInScale: true,
    degreeColorEligible: true,
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

export type CagedShapeAuditSwatch = {
  id: string;
  label: string;
  shapeKey: string;
  noteClass: string;
  display: string;
};

export const CAGED_SHAPE_SWATCHES = [
  { id: "caged-e", label: "E shape", shapeKey: "E", noteClass: "chord-tone-in-scale", display: "E" },
  { id: "caged-d", label: "D shape", shapeKey: "D", noteClass: "chord-tone-in-scale", display: "D" },
  { id: "caged-c", label: "C shape", shapeKey: "C", noteClass: "chord-tone-in-scale", display: "C" },
  { id: "caged-a", label: "A shape", shapeKey: "A", noteClass: "chord-tone-in-scale", display: "A" },
  { id: "caged-g", label: "G shape", shapeKey: "G", noteClass: "chord-tone-in-scale", display: "G" },
] as const satisfies readonly CagedShapeAuditSwatch[];

export type AuditSurface =
  | "fretboard"
  | "caged-shape"
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
  return AUDIT_THEMES.flatMap((theme) => [
    ...FRETBOARD_AUDIT_GROUPS.flatMap((group) =>
      AUDIT_DEGREE_MODES.flatMap((degreeMode) =>
        getFretboardAuditSwatchesForDegreeMode(group, degreeMode).map((swatch) => ({
          auditId: getAuditId(theme, "fretboard", group.id, degreeMode, swatch.id),
          contextId: group.id,
          degreeMode,
          surface: "fretboard" as const,
          swatchId: swatch.id,
          theme,
        })),
      ),
    ),
    ...AUDIT_DEGREE_MODES.flatMap((degreeMode) =>
      getPracticePillSwatchesForDegreeMode(degreeMode).map((swatch) => ({
        auditId: getAuditId(theme, "practice-pill", "none", degreeMode, swatch.id),
        contextId: "none" as const,
        degreeMode,
        surface: "practice-pill" as const,
        swatchId: swatch.id,
        theme,
      })),
    ),
    ...AUDIT_DEGREE_MODES.flatMap((degreeMode) =>
      getDegreeChipSwatchesForDegreeMode(degreeMode).map((swatch) => ({
        auditId: getAuditId(theme, "degree-chip", "none", degreeMode, swatch.id),
        contextId: "none" as const,
        degreeMode,
        surface: "degree-chip" as const,
        swatchId: swatch.id,
        theme,
      })),
    ),
    ...DEGREE_RAMP_SWATCHES.map((swatch) => ({
      auditId: getAuditId(theme, "degree-ramp", "none", AUDIT_DEGREE_MODES[1], swatch.id),
      contextId: "none" as const,
      degreeMode: AUDIT_DEGREE_MODES[1],
      surface: "degree-ramp" as const,
      swatchId: swatch.id,
      theme,
    })),
    ...CAGED_SHAPE_SWATCHES.map((swatch) => ({
      auditId: getAuditId(theme, "caged-shape", "none", AUDIT_DEGREE_MODES[0], swatch.id),
      contextId: "none" as const,
      degreeMode: AUDIT_DEGREE_MODES[0],
      surface: "caged-shape" as const,
      swatchId: swatch.id,
      theme,
    })),
  ]);
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

function isAuditSwatchRenderedForDegreeMode(
  swatch: {
    auditDegreeModes?: readonly AuditDegreeMode["id"][];
    degreeColorEligible?: boolean;
  },
  degreeMode: AuditDegreeMode,
) {
  if (swatch.auditDegreeModes) {
    return swatch.auditDegreeModes.includes(degreeMode.id);
  }

  return degreeMode.enabled ? swatch.degreeColorEligible === true : true;
}

export function getFretboardAuditSwatch(auditCase: FretboardAuditCase): FretboardAuditSwatch {
  const base: FretboardAuditSwatch | undefined = FRETBOARD_NOTE_SWATCHES.find(
    (swatch) => swatch.id === auditCase.swatchId,
  );
  if (!base) {
    throw new Error(`Unknown fretboard audit swatch: ${auditCase.swatchId}`);
  }

  return {
    id: auditCase.id,
    label: auditCase.label ?? base.label,
    noteClass: base.noteClass,
    display: auditCase.display ?? base.display,
    isGuideTone: auditCase.isGuideTone ?? base.isGuideTone,
    isTension: auditCase.isTension ?? base.isTension,
    degreeColorEligible: auditCase.degreeColorEligible ?? base.degreeColorEligible,
  };
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
  group: FretboardAuditGroup,
  degreeMode: AuditDegreeMode,
) {
  return group.cases
    .filter((auditCase) => {
      const swatch = getFretboardAuditSwatch(auditCase);
      return isAuditSwatchRenderedForDegreeMode(
        { ...swatch, auditDegreeModes: auditCase.auditDegreeModes },
        degreeMode,
      );
    })
    .map(getFretboardAuditSwatch);
}
