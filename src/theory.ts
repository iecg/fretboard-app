import {
  normalizeScaleName,
  SCALES,
  SCALE_TO_PARENT_MAJOR_OFFSET,
} from "./theoryCatalog";

export const NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export const INTERVAL_NAMES = [
  "1",
  "b2",
  "2",
  "b3",
  "3",
  "4",
  "b5",
  "5",
  "b6",
  "6",
  "b7",
  "7",
] as const;

export const ENHARMONICS: Record<string, string> = {
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb",
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

// Keys that natively prefer flats for cleaner display
export const FLAT_KEYS = [
  "F",
  "Bb",
  "A#",
  "Eb",
  "D#",
  "Ab",
  "G#",
  "Db",
  "C#",
  "Gb",
];

export { normalizeScaleName, SCALES, SCALE_TO_PARENT_MAJOR_OFFSET };

// Chord overlay types
export type ChordMemberName = "root" | "b3" | "3" | "b5" | "5" | "b7" | "7";
export type ChordQuality = "triad" | "seventh" | "power";

export interface ChordMember {
  name: ChordMemberName;
  semitone: number;
}

export interface ChordDefinition {
  quality: ChordQuality;
  members: ChordMember[];
}

export interface ResolvedChordMember extends ChordMember {
  note: string;
}

// Shared note-role model — consumed by both fretboard rendering and summary strip.
export type NoteRole =
  | "key-tonic"
  | "chord-root"
  | "chord-tone-in-scale"
  | "chord-tone-outside-scale"
  | "color-tone"
  | "scale-only"
  | "note-active"
  | "note-blue";

// Color/characteristic note entry for the practice bar Color group
export interface PracticeBarColorNote {
  internalNote: string;
  displayNote: string;
  intervalName: string;
}

export interface ChordRowEntry {
  internalNote: string;
  displayNote: string;
  memberName: string;
  role: "chord-root" | "chord-tone-in-scale" | "chord-tone-outside-scale";
  inScale: boolean;
}

export interface LegendItem {
  role: NoteRole;
  label: string;
}

// ---------------------------------------------------------------------------
// Practice lenses — user-facing practice model replacing raw viewMode
// ---------------------------------------------------------------------------

export type PracticeLens =
  | "targets"       // chord root + active chord tones — for landing and outlining harmony
  | "guide-tones"   // 3rd/7th — for voice-leading and strong chord definition
  | "tension";      // outside/altered tones — secondary/advanced lens

// Composable note semantics — multiple properties can coexist on one note.
// A note can be simultaneously a chord root and outside the scale (isTension),
// which the old single-role enum could not represent correctly.
export interface NoteSemantics {
  isScaleRoot: boolean;
  isChordRoot: boolean;
  isChordTone: boolean;
  isInScale: boolean;
  isColorTone: boolean;
  isGuideTone: boolean; // 3rd or 7th of the chord
  isTension: boolean;   // chord tone that is outside the scale
  memberName?: ChordMemberName;
}

// Pure chord member fact — no scale context.
// Separates what the chord defines (notes, intervals, root) from what the scale
// adds (in-scale membership, tension roles).
export interface ChordMemberFact {
  internalNote: string;
  /** Formatted using chord-root-relative accidentals — scale-independent. */
  displayNote: string;
  /** "1", "♭3", "3", "♭5", "5", "♭7", "7" */
  memberName: string;
  semitone: number;
  isChordRoot: boolean;
}

// Context supplied to lens availability predicates.
export interface LensAvailabilityContext {
  hasChordOverlay: boolean;
  /** Chord definition includes a 3rd or 7th member. */
  hasGuideTones: boolean;
  /** Scale has characteristic/divergent color notes. */
  hasColorNotes: boolean;
  /** At least one active chord tone falls outside the scale. */
  hasOutsideTones: boolean;
}

// Registry entry for a practice lens: description + availability contract.
export interface LensRegistryEntry {
  id: PracticeLens;
  label: string;
  description: string;
  isAvailable: (ctx: LensAvailabilityContext) => boolean;
  /** Returns a human-readable reason when the lens is unavailable, or null. */
  unavailableReason: (ctx: LensAvailabilityContext) => string | null;
  /** When true, hide this lens from the picker instead of showing it disabled. */
  hideWhenUnavailable?: boolean;
}

export const LENS_REGISTRY: readonly LensRegistryEntry[] = [
  {
    id: "targets",
    label: "Chord Tones",
    description: "Shows chord tones — for landing and outlining harmony",
    isAvailable: (ctx) => ctx.hasChordOverlay,
    unavailableReason: (ctx) =>
      ctx.hasChordOverlay ? null : "Requires an active chord overlay",
  },
  {
    id: "guide-tones",
    label: "Guide Tones",
    description: "Highlights 3rd and 7th — the voice-leading tones that define chord quality",
    isAvailable: (ctx) => ctx.hasChordOverlay && ctx.hasGuideTones,
    unavailableReason: (ctx) => {
      if (!ctx.hasChordOverlay) return "Requires an active chord overlay";
      if (!ctx.hasGuideTones) return "Chord has no guide tones (3rd or 7th)";
      return null;
    },
  },
  {
    id: "tension",
    label: "Tension",
    description: "Highlights chord tones outside the scale — tones that create tension and need resolution",
    isAvailable: (ctx) => ctx.hasChordOverlay && ctx.hasOutsideTones,
    unavailableReason: (ctx) => {
      if (!ctx.hasChordOverlay) return "Requires an active chord overlay";
      if (!ctx.hasOutsideTones)
        return "Chord is fully within the scale — no outside tones";
      return null;
    },
    hideWhenUnavailable: true,
  },
];

// Practice bar coaching cue types
export type PracticeCueKind = "land-on" | "guide-tones" | "color-note" | "tension";

export interface PracticeCueNote {
  internalNote: string;
  displayNote: string;
  intervalName?: string;
  /** Visual role for pill styling — mirrors ChordRowEntry roles plus guide/color variants */
  role?: "chord-root" | "chord-tone-in-scale" | "chord-tone-outside-scale" | "color-tone" | "guide-tone";
  /** Nearest in-scale resolution target for tension/outside notes */
  resolvesTo?: { internalNote: string; displayNote: string };
}

export interface PracticeCue {
  kind: PracticeCueKind;
  /** Coaching label shown to the player: "Land on", "Guide tones", "Color note", "Tension" */
  label: string;
  notes: PracticeCueNote[];
}

export const CHORD_DEFINITIONS: Record<string, ChordDefinition> = {
  "Major Triad": {
    quality: "triad",
    members: [
      { name: "root", semitone: 0 },
      { name: "3", semitone: 4 },
      { name: "5", semitone: 7 },
    ],
  },
  "Minor Triad": {
    quality: "triad",
    members: [
      { name: "root", semitone: 0 },
      { name: "b3", semitone: 3 },
      { name: "5", semitone: 7 },
    ],
  },
  "Diminished Triad": {
    quality: "triad",
    members: [
      { name: "root", semitone: 0 },
      { name: "b3", semitone: 3 },
      { name: "b5", semitone: 6 },
    ],
  },
  "Major 7th": {
    quality: "seventh",
    members: [
      { name: "root", semitone: 0 },
      { name: "3", semitone: 4 },
      { name: "5", semitone: 7 },
      { name: "7", semitone: 11 },
    ],
  },
  "Minor 7th": {
    quality: "seventh",
    members: [
      { name: "root", semitone: 0 },
      { name: "b3", semitone: 3 },
      { name: "5", semitone: 7 },
      { name: "b7", semitone: 10 },
    ],
  },
  "Dominant 7th": {
    quality: "seventh",
    members: [
      { name: "root", semitone: 0 },
      { name: "3", semitone: 4 },
      { name: "5", semitone: 7 },
      { name: "b7", semitone: 10 },
    ],
  },
  "Power Chord (5)": {
    quality: "power",
    members: [
      { name: "root", semitone: 0 },
      { name: "5", semitone: 7 },
    ],
  },
};

// Derived from CHORD_DEFINITIONS for backward compatibility
export const CHORDS: Record<string, number[]> = Object.fromEntries(
  Object.entries(CHORD_DEFINITIONS).map(([name, def]) => [
    name,
    def.members.map((m) => m.semitone),
  ]),
);


// Circle of fifths order anchored in root notes (sharps default)
export const CIRCLE_OF_FIFTHS = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "C#",
  "G#",
  "D#",
  "A#",
  "F",
];

export function getNoteIndex(noteName: string): number {
  const norm =
    ENHARMONICS[noteName] && noteName.includes("b")
      ? ENHARMONICS[noteName]
      : noteName;
  return NOTES.indexOf(norm);
}

export function getNoteDisplay(
  noteName: string,
  activeRoot: string,
  useFlats?: boolean,
): string {
  const normNote =
    ENHARMONICS[noteName] && noteName.includes("b")
      ? ENHARMONICS[noteName]
      : noteName;
  const flats = useFlats ?? FLAT_KEYS.includes(activeRoot);

  if (flats && normNote.includes("#")) return ENHARMONICS[normNote] || normNote;
  if (!flats && normNote.includes("b"))
    return ENHARMONICS[normNote] || normNote;
  return normNote;
}

export function formatAccidental(s: string): string {
  return s
    .replace(/##/g, "𝄪")
    .replace(/#/g, "♯")
    .replace(/bb/g, "𝄫")
    .replace(/b/g, "♭");
}


const LETTER_NAMES = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PITCHES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function getNoteDisplayInScale(
  noteName: string,
  rootNote: string,
  scaleIntervals: number[],
  useFlats?: boolean,
): string {
  // Only apply scale-aware spelling for 7-note scales
  if (scaleIntervals.length !== 7) {
    return getNoteDisplay(noteName, rootNote, useFlats);
  }

  // Normalize inputs to sharp representation for internal lookup
  const normNote =
    noteName.includes("b") && ENHARMONICS[noteName]
      ? ENHARMONICS[noteName]
      : noteName;
  const rootNorm =
    rootNote.includes("b") && ENHARMONICS[rootNote]
      ? ENHARMONICS[rootNote]
      : rootNote;

  const rootIdx = NOTES.indexOf(rootNorm);
  const noteIdx = NOTES.indexOf(normNote);
  if (rootIdx === -1 || noteIdx === -1)
    return getNoteDisplay(noteName, rootNote, useFlats);

  const interval = (noteIdx - rootIdx + 12) % 12;

  // Check if this note is in the scale
  const degreeIndex = scaleIntervals.indexOf(interval);
  if (degreeIndex === -1) {
    // Note is not in the scale — use standard display
    return getNoteDisplay(noteName, rootNote, useFlats);
  }

  // Determine the root's letter name
  const rootDisplay = getNoteDisplay(rootNote, rootNote, useFlats);
  const rootLetter = rootDisplay.charAt(0);
  const rootLetterIdx = LETTER_NAMES.indexOf(rootLetter);
  if (rootLetterIdx === -1) return getNoteDisplay(noteName, rootNote, useFlats);

  // Expected letter for this scale degree
  const expectedLetter = LETTER_NAMES[(rootLetterIdx + degreeIndex) % 7];
  const expectedBasePitch = LETTER_PITCHES[expectedLetter];
  const targetPitch = (rootIdx + interval) % 12;

  // Compute accidental needed
  const diff = (targetPitch - expectedBasePitch + 12) % 12;

  if (diff === 0) {
    return expectedLetter; // Natural
  } else if (diff === 1) {
    return expectedLetter + "#"; // Sharp
  } else if (diff === 11) {
    return expectedLetter + "b"; // Flat
  } else if (diff === 2) {
    return expectedLetter + "##"; // Double sharp (rare)
  } else if (diff === 10) {
    return expectedLetter + "bb"; // Double flat (rare)
  }

  // Fallback
  return getNoteDisplay(noteName, rootNote, useFlats);
}

export function getIntervalNotes(
  rootNote: string,
  intervals: number[],
): string[] {
  const rootIndex = getNoteIndex(rootNote);
  if (rootIndex === -1) return [];

  return intervals.map((interval) => {
    return NOTES[(rootIndex + interval) % 12];
  });
}

export function getScaleNotes(rootNote: string, scaleName: string): string[] {
  const intervals = SCALES[normalizeScaleName(scaleName)];
  if (!intervals) return [];
  return getIntervalNotes(rootNote, intervals);
}

export function getChordNotes(rootNote: string, chordName: string): string[] {
  const intervals = CHORDS[chordName];
  if (!intervals) return [];
  return getIntervalNotes(rootNote, intervals);
}

/**
 * Returns notes in the current scale that diverge from the reference scale.
 * Reference: Major for major-quality modes, Natural Minor for minor-quality modes.
 * Blues scales use their existing blue note logic instead.
 */
export function getDivergentNotes(
  rootNote: string,
  scaleName: string,
): string[] {
  const resolvedScaleName = normalizeScaleName(scaleName);
  const intervals = SCALES[resolvedScaleName];
  if (!intervals || resolvedScaleName.includes("Blues")) return [];

  // Pentatonic scales are subsets, not modes — no divergence to show
  if (
    resolvedScaleName === "Major Pentatonic" ||
    resolvedScaleName === "Minor Pentatonic"
  )
    return [];
  // Major and Natural Minor are the references themselves
  if (resolvedScaleName === "Major" || resolvedScaleName === "Natural Minor")
    return [];

  const isMajorQuality = intervals.includes(4); // contains major 3rd
  const refIntervals = isMajorQuality
    ? SCALES["Major"]
    : SCALES["Natural Minor"];

  const rootIdx = NOTES.indexOf(rootNote);
  if (rootIdx === -1) return [];

  const refSet = new Set(refIntervals);
  return intervals
    .filter((interval) => !refSet.has(interval))
    .map((interval) => NOTES[(rootIdx + interval) % 12]);
}

// Key signature accidental counts (positive = sharps, negative = flats)
export const KEY_SIGNATURES: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  "F#": 6,
  F: -1,
  Bb: -2,
  "A#": -2,
  Eb: -3,
  "D#": -3,
  Ab: -4,
  "G#": -4,
  Db: -5,
  "C#": 7,
  Gb: -6,
};

export function getKeySignature(rootNote: string): number {
  return KEY_SIGNATURES[rootNote] ?? 0;
}

export function getKeySignatureForDisplay(
  rootNote: string,
  scaleName: string,
  useFlats: boolean,
): number {
  const offset = SCALE_TO_PARENT_MAJOR_OFFSET[normalizeScaleName(scaleName)] ?? 0;

  // Normalize rootNote to sharp index
  const sharpRoot =
    rootNote.includes("b") && ENHARMONICS[rootNote]
      ? ENHARMONICS[rootNote]
      : rootNote;
  const rootIdx = NOTES.indexOf(sharpRoot);
  if (rootIdx === -1) return KEY_SIGNATURES[rootNote] ?? 0;

  const parentIdx = (rootIdx + offset) % 12;
  const parentSharp = NOTES[parentIdx];

  // When the originally-selected root is sharp-spelled, always return the
  // sharp-side key signature regardless of the useFlats auto-resolution.
  // This preserves the user's intended root spelling (e.g., G# Major → sharps).
  const originalIsSharp = rootNote.includes("#");
  if (!originalIsSharp && useFlats && ENHARMONICS[parentSharp]) {
    const flatName = ENHARMONICS[parentSharp];
    if (KEY_SIGNATURES[flatName] !== undefined) {
      return KEY_SIGNATURES[flatName];
    }
  }
  const sig = KEY_SIGNATURES[parentSharp] ?? 0;
  // When the root is sharp-spelled, a negative signature means the KEY_SIGNATURES
  // table only stores the flat-equivalent (e.g. G#=-4 same as Ab=-4).
  // Convert to the enharmonic sharp count: 12 + sig (e.g. -4 → 8 sharps).
  if (originalIsSharp && sig < 0) {
    return 12 + sig;
  }
  return sig;
}

export type AccidentalMode = "sharps" | "flats" | "auto";

/**
 * Resolve the user-facing accidental mode into a concrete useFlats boolean for
 * downstream display code. Natural roots fall back to the historical default
 * (FLAT_KEYS membership). Enharmonic roots in "auto" mode compare the scale
 * spellings generated from the sharp and flat equivalents, pick the one with
 * fewer total accidentals, and break ties toward sharps.
 */
export function resolveAccidentalMode(
  rootNote: string,
  scaleName: string,
  mode: AccidentalMode,
): boolean {
  if (mode === "sharps") return false;
  if (mode === "flats") return true;
  // auto
  const isNatural = !rootNote.includes("#") && !rootNote.includes("b");
  if (isNatural) return FLAT_KEYS.includes(rootNote);

  // Enharmonic root in "auto" mode — pick spelling with fewer accidentals
  const sharpRoot =
    rootNote.includes("b") && ENHARMONICS[rootNote]
      ? ENHARMONICS[rootNote]
      : rootNote;
  const flatRoot =
    rootNote.includes("#") && ENHARMONICS[rootNote]
      ? ENHARMONICS[rootNote]
      : rootNote;

  const resolvedScaleName = normalizeScaleName(scaleName);
  const intervals = SCALES[resolvedScaleName];
  if (!intervals) return FLAT_KEYS.includes(rootNote);

  const countAccidentals = (displays: string[]): number =>
    displays.reduce((sum, s) => {
      if (s.includes("##") || s.includes("bb")) return sum + 2;
      if (s.includes("#") || s.includes("b")) return sum + 1;
      return sum;
    }, 0);

  const sharpNotes = getScaleNotes(sharpRoot, resolvedScaleName);
  const flatNotes = getScaleNotes(flatRoot, resolvedScaleName);

  const sharpDisplays = sharpNotes.map((n) =>
    getNoteDisplayInScale(n, sharpRoot, intervals, false),
  );
  const flatDisplays = flatNotes.map((n) =>
    getNoteDisplayInScale(n, flatRoot, intervals, true),
  );

  const sharpCount = countAccidentals(sharpDisplays);
  const flatCount = countAccidentals(flatDisplays);

  return flatCount < sharpCount; // strict less; tie → sharps (false)
}

// Circle of fifths display labels
export const CIRCLE_DISPLAY_LABELS: Record<string, string> = {
  C: "C",
  G: "G",
  D: "D",
  A: "A",
  E: "E",
  B: "B",
  "F#": "F#/Gb",
  "C#": "Db",
  "G#": "Ab",
  "D#": "Eb",
  "A#": "Bb",
  F: "F",
};
