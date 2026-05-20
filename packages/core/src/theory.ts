import {
  normalizeScaleName,
  SCALES,
  SCALE_TO_PARENT_MAJOR_OFFSET,
} from "./theoryCatalog";
import { getDegreesForScale, getQualityForDegree, type DegreeId } from "./degrees";
import * as Note from "@tonaljs/note";
import * as Interval from "@tonaljs/interval";
import * as Scale from "@tonaljs/scale";
import * as Key from "@tonaljs/key";
import { scaleNameToTonal, tonalChordSymbol } from "./lib/tonal";
import * as Chord from "@tonaljs/chord";

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

// Keys preferring flats for cleaner display
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

export type ChordMemberName = "root" | "2" | "b3" | "3" | "4" | "b5" | "#5" | "5" | "6" | "b7" | "7" | "bb7";
export type ChordQuality = "triad" | "seventh" | "power" | "sixth" | "suspended";

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

// Shared note-role model for fretboard rendering and summary strip
export type NoteRole =
  | "key-tonic"
  | "chord-root"
  | "note-diatonic-chord"
  | "chord-tone-in-scale"
  | "chord-tone-outside-scale"
  | "color-tone"
  | "scale-only"
  | "note-active"
  | "note-blue";

// Color note entry for practice bar
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
  scaleDegree?: DegreeId;
  scaleInterval?: string;
}

// Practice lenses replace raw viewMode
export type PracticeLens =
  | "targets"       // chord root + active chord tones
  | "guide-tones"   // 3rd/7th — for strong chord definition
  | "tension";      // outside/altered tones

// Composable note semantics
export interface NoteSemantics {
  isScaleRoot: boolean;
  isChordRoot: boolean;
  isChordTone: boolean;
  isInScale: boolean;
  isColorTone: boolean;
  isGuideTone: boolean; // 3rd or 7th of the chord
  isTension: boolean;   // chord tone that is outside the scale
  memberName?: ChordMemberName;
  /** Scale degree of this note (e.g. "I", "iii", "V"). Defined only when the note is in the active scale. */
  scaleDegree?: DegreeId;
  /** True when the active chord (chordRoot + chordType) exactly matches the diatonic chord for the active scale degree. False in manual mode or when qualityOverride diverges. */
  isDiatonicChord?: boolean;
  isFullChordMode?: boolean;
}

// Pure chord member fact (no scale context)
export interface ChordMemberFact {
  internalNote: string;
  /** Formatted using chord-root-relative accidentals — scale-independent. */
  displayNote: string;
  /** "1", "♭3", "3", "♭5", "5", "♭7", "7" */
  memberName: string;
  semitone: number;
  isChordRoot: boolean;
}

// Context for lens availability predicates
export interface LensAvailabilityContext {
  hasChordOverlay: boolean;
  /** Chord definition includes a 3rd or 7th member. */
  hasGuideTones: boolean;
  /** Scale has characteristic/divergent color notes. */
  hasColorNotes: boolean;
  /** At least one active chord tone falls outside the scale. */
  hasOutsideTones: boolean;
}

// Practice lens registry entry
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

// Composable semantic flags for practice bar notes
export interface PracticeBarNote {
  internalNote: string;
  displayNote: string;
  intervalName?: string;
  isChordRoot: boolean;
  isGuideTone: boolean;
  isTension: boolean;
  isInScale: boolean;
  resolvesTo?: { internalNote: string; displayNote: string };
  scaleDegree?: DegreeId;
  degreeColor?: string;
}

export interface PracticeBarGroup {
  label: string;
  notes: PracticeBarNote[];
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
  "Major 6th": {
    quality: "sixth",
    members: [
      { name: "root", semitone: 0 },
      { name: "3", semitone: 4 },
      { name: "5", semitone: 7 },
      { name: "6", semitone: 9 },
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
  "Sus4": {
    quality: "suspended",
    members: [
      { name: "root", semitone: 0 },
      { name: "4", semitone: 5 },
      { name: "5", semitone: 7 },
    ],
  },
  "Power Chord (5)": {
    quality: "power",
    members: [
      { name: "root", semitone: 0 },
      { name: "5", semitone: 7 },
    ],
  },
  "Augmented Triad": {
    quality: "triad",
    members: [
      { name: "root", semitone: 0 },
      { name: "3", semitone: 4 },
      { name: "#5", semitone: 8 },
    ],
  },
  "Sus2": {
    quality: "suspended",
    members: [
      { name: "root", semitone: 0 },
      { name: "2", semitone: 2 },
      { name: "5", semitone: 7 },
    ],
  },
  "Minor 6th": {
    quality: "sixth",
    members: [
      { name: "root", semitone: 0 },
      { name: "b3", semitone: 3 },
      { name: "5", semitone: 7 },
      { name: "6", semitone: 9 },
    ],
  },
  "Diminished 7th": {
    quality: "seventh",
    members: [
      { name: "root", semitone: 0 },
      { name: "b3", semitone: 3 },
      { name: "b5", semitone: 6 },
      { name: "bb7", semitone: 9 },
    ],
  },
  "Half-Diminished 7th": {
    quality: "seventh",
    members: [
      { name: "root", semitone: 0 },
      { name: "b3", semitone: 3 },
      { name: "b5", semitone: 6 },
      { name: "b7", semitone: 10 },
    ],
  },
  "Minor-Major 7th": {
    quality: "seventh",
    members: [
      { name: "root", semitone: 0 },
      { name: "b3", semitone: 3 },
      { name: "5", semitone: 7 },
      { name: "7", semitone: 11 },
    ],
  },
};

// Backward compatibility mapping from CHORD_DEFINITIONS
export const CHORDS: Record<string, number[]> = Object.fromEntries(
  Object.entries(CHORD_DEFINITIONS).map(([name, def]) => [
    name,
    def.members.map((m) => m.semitone),
  ]),
);


// Circle of fifths root order (defaults to sharps)
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
  const chroma = Note.chroma(noteName);
  return typeof chroma === "number" && !isNaN(chroma) ? chroma : -1;
}

export function getNoteDisplay(
  noteName: string,
  activeRoot: string,
  useFlats?: boolean,
): string {
  const wantsFlats = useFlats ?? FLAT_KEYS.includes(activeRoot);
  if (wantsFlats && noteName.includes("#")) {
    return Note.enharmonic(noteName);
  }
  if (!wantsFlats && noteName.includes("b")) {
    return Note.enharmonic(noteName);
  }
  return noteName;
}

export function formatAccidental(s: string): string {
  return s
    .replace(/##/g, "𝄪")
    .replace(/#/g, "♯")
    .replace(/bb/g, "𝄫")
    .replace(/b/g, "♭");
}


export function getNoteDisplayInScale(
  noteName: string,
  rootNote: string,
  scaleIntervals: number[],
  useFlats?: boolean,
): string {
  if (scaleIntervals.length !== 7) {
    return getNoteDisplay(noteName, rootNote, useFlats);
  }

  // Use Tonal for chroma calculation; matches the legacy NOTES.indexOf behavior.
  const rootChroma = Note.chroma(rootNote);
  const noteChroma = Note.chroma(noteName);
  if (
    typeof rootChroma !== "number" || isNaN(rootChroma) ||
    typeof noteChroma !== "number" || isNaN(noteChroma)
  ) {
    return getNoteDisplay(noteName, rootNote, useFlats);
  }

  const interval = (noteChroma - rootChroma + 12) % 12;
  const degreeIndex = scaleIntervals.indexOf(interval);
  if (degreeIndex === -1) {
    return getNoteDisplay(noteName, rootNote, useFlats);
  }

  const spelledRoot = getNoteDisplay(rootNote, rootNote, useFlats);

  // Heptatonic letter cycle — used only for scale-aware spelling, scoped to this function.
  const letterNames = ["C", "D", "E", "F", "G", "A", "B"];
  const letterPitches: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  const rootLetter = spelledRoot.charAt(0);
  const rootLetterIdx = letterNames.indexOf(rootLetter);
  if (rootLetterIdx === -1) return getNoteDisplay(noteName, rootNote, useFlats);

  const expectedLetter = letterNames[(rootLetterIdx + degreeIndex) % 7];
  const expectedBasePitch = letterPitches[expectedLetter];
  const targetPitch = (rootChroma + interval) % 12;
  const diff = (targetPitch - expectedBasePitch + 12) % 12;

  if (diff === 0) return expectedLetter;
  if (diff === 1) return expectedLetter + "#";
  if (diff === 11) return expectedLetter + "b";
  if (diff === 2) return expectedLetter + "##";
  if (diff === 10) return expectedLetter + "bb";
  return getNoteDisplay(noteName, rootNote, useFlats);
}

export function getIntervalNotes(
  rootNote: string,
  intervals: number[],
): string[] {
  if (getNoteIndex(rootNote) === -1) return [];
  return intervals.map((semitones) => {
    const t = Note.transpose(rootNote, Interval.fromSemitones(semitones));
    // Force sharps-form for chromatic semitone-based operations (matches legacy NOTES contract).
    const simplified = Note.simplify(t);
    return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
  });
}

export function getScaleNotes(rootNote: string, scaleName: string): string[] {
  const tonalName = scaleNameToTonal(normalizeScaleName(scaleName));
  if (!tonalName) return [];
  if (getNoteIndex(rootNote) === -1) return [];
  const tonalScale = Scale.get(`${rootNote} ${tonalName}`);
  // Tonal returns spelled notes. Normalize to sharps-form to maintain the
  // legacy contract (consumers do NOTES.indexOf on the result).
  return tonalScale.notes.map((n) => {
    const simplified = Note.simplify(n);
    return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
  });
}

/**
 * Returns the chromatic semitone offsets (0-11) of a scale's notes within the
 * NOTES array. Convenience wrapper over getScaleNotes that filters out any
 * note names not found in NOTES (defensive against typos / unsupported scales).
 *
 * Order matches getScaleNotes (root first, then ascending intervals).
 */
export function getScaleSemitones(rootNote: string, scaleName: string): number[] {
  return getScaleNotes(rootNote, scaleName)
    .map((n) => NOTES.indexOf(n))
    .filter((i) => i !== -1);
}

export function getChordNotes(rootNote: string, chordName: string): string[] {
  if (Note.chroma(rootNote) === undefined || Number.isNaN(Note.chroma(rootNote))) return [];
  const symbol = tonalChordSymbol(rootNote, chordName);
  if (!symbol) return [];
  const tonalChord = Chord.get(symbol);
  if (tonalChord.empty) return [];
  // Same sharps-form normalization as getIntervalNotes.
  return tonalChord.notes.map((n) => {
    const simplified = Note.simplify(n);
    return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
  });
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
  if (resolvedScaleName.includes("Blues")) return [];
  if (resolvedScaleName === "Major Pentatonic" || resolvedScaleName === "Minor Pentatonic") return [];
  if (resolvedScaleName === "Major" || resolvedScaleName === "Natural Minor") return [];

  const semis = getScaleSemitones(rootNote, scaleName);
  if (semis.length === 0) return [];

  const rootIdx = NOTES.indexOf(rootNote);
  if (rootIdx === -1) return [];

  // Convert absolute NOTES indices to relative semitone intervals from root
  const relativeIntervals = semis.map((s) => (s - rootIdx + 12) % 12);
  const isMajorQuality = relativeIntervals.includes(4); // contains major 3rd
  const refName = isMajorQuality ? "Major" : "Natural Minor";
  const refSemis = new Set(getScaleSemitones(rootNote, refName));

  return semis
    .filter((semitone) => !refSemis.has(semitone))
    .map((semitone) => NOTES[semitone]);
}

// Key signature accidental counts (+ sharps, - flats)
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
  const tonalKey = Key.majorKey(rootNote);
  // Tonal returns `alteration` as a positive integer for sharps, negative for flats.
  if (typeof tonalKey.alteration === "number") return tonalKey.alteration;
  // Fallback for inputs Tonal does not recognize (rare; preserves legacy behavior).
  return KEY_SIGNATURES[rootNote] ?? 0;
}

export function getKeySignatureForDisplay(
  rootNote: string,
  scaleName: string,
  useFlats: boolean,
): number {
  const offset = SCALE_TO_PARENT_MAJOR_OFFSET[normalizeScaleName(scaleName)] ?? 0;
  const rootChroma = Note.chroma(rootNote);
  if (typeof rootChroma !== "number" || isNaN(rootChroma)) {
    return KEY_SIGNATURES[rootNote] ?? 0;
  }

  // The "parent major" is the major key whose tonic is `offset` semitones above the current root.
  const parentMajorRoot = Note.transpose(rootNote, Interval.fromSemitones(offset));
  const parentSimplified = Note.simplify(parentMajorRoot);
  const parentSharp = parentSimplified.includes("b") ? Note.enharmonic(parentSimplified) : parentSimplified;

  const originalIsSharp = rootNote.includes("#");

  // When root is not sharp-spelled, prefer the flat enharmonic for any parent key that is
  // naturally on the flat side (alteration < 0). This covers both useFlats=true and the case
  // where the root itself is flat-spelled (e.g. Ab → parent G# → prefer Ab key sig -4).
  if (!originalIsSharp) {
    const flatName = Note.enharmonic(parentSharp);
    const flatKey = Key.majorKey(flatName);
    if (typeof flatKey.alteration === "number" && flatKey.alteration < 0) {
      // Only return the flat sig if: useFlats is true, OR the root itself is flat-spelled
      // (meaning the user's intent is a flat-side key even when useFlats=false).
      const rootIsFlat = rootNote.includes("b");
      if (useFlats || rootIsFlat || flatName === parentMajorRoot) {
        return flatKey.alteration;
      }
    }
  }

  const tonalKey = Key.majorKey(parentSharp);
  const sig = typeof tonalKey.alteration === "number" ? tonalKey.alteration : (KEY_SIGNATURES[parentSharp] ?? 0);

  if (originalIsSharp && sig < 0) {
    return 12 + sig;
  }
  return sig;
}

export type AccidentalMode = "sharps" | "flats" | "auto";

/**
 * Resolve accidental mode to useFlats. Auto mode picks the spelling with fewer accidentals.
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

  return flatCount < sharpCount; // tie → sharps (false)
}

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

/**
 * Returns the absolute root note and diatonic triad quality for a given scale degree.
 *
 * @param degreeId   - Roman numeral string (e.g., "I", "ii", "vii°")
 * @param scaleName  - Scale name (e.g., "Major", "Harmonic Minor")
 * @param tonicNote  - The tonic note of the scale in sharps-form (e.g., "C", "A", "C#")
 * @returns `{ root, quality }` where root is always a sharps-form note and quality is a
 *          chord-name key (e.g., "Major Triad"), or undefined for any unrecognised input.
 */
export function getDiatonicChord(
  degreeId: string,
  scaleName: string,
  tonicNote: string,
): { root: string; quality: string } | undefined {
  const degreesMap = getDegreesForScale(scaleName);

  // Find the semitone offset for this degree
  const semitoneEntry = Object.entries(degreesMap).find(
    ([, roman]) => roman === degreeId,
  );
  if (!semitoneEntry) return undefined;
  const semitone = Number(semitoneEntry[0]);

  // Compute the absolute root note via Tonal transposition.
  const tonicChroma = Note.chroma(tonicNote);
  if (typeof tonicChroma !== "number" || isNaN(tonicChroma)) return undefined;
  const transposed = Note.transpose(tonicNote, Interval.fromSemitones(semitone));
  const simplified = Note.simplify(transposed);
  const root = simplified.includes("b") ? Note.enharmonic(simplified) : simplified;

  // Resolve chord quality via the degree quality table
  const quality = getQualityForDegree(degreeId, scaleName);
  if (quality === undefined) return undefined;

  return { root, quality };
}
