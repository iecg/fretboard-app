export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const INTERVAL_NAMES = [
  "1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7",
] as const;

export const ENHARMONICS: Record<string, string> = {
  'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
  'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
};

// Keys that natively prefer flats for cleaner display
export const FLAT_KEYS = ['F', 'Bb', 'A#', 'Eb', 'D#', 'Ab', 'G#', 'Db', 'C#', 'Gb'];

export const SCALES: Record<string, number[]> = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
  'Minor Pentatonic': [0, 3, 5, 7, 10],
  'Major Pentatonic': [0, 2, 4, 7, 9],
  'Minor Blues': [0, 3, 5, 6, 7, 10],
  'Major Blues': [0, 2, 3, 4, 7, 9],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Lydian': [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Locrian': [0, 1, 3, 5, 6, 8, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
};

export const CHORDS: Record<string, number[]> = {
  'Major Triad': [0, 4, 7],
  'Minor Triad': [0, 3, 7],
  'Diminished Triad': [0, 3, 6],
  'Major 7th': [0, 4, 7, 11],
  'Minor 7th': [0, 3, 7, 10],
  'Dominant 7th': [0, 4, 7, 10],
  'Power Chord (5)': [0, 7]
};

// Circle of fifths order anchored in root notes (sharps default)
export const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];

export function getNoteIndex(noteName: string): number {
  const norm = ENHARMONICS[noteName] && noteName.includes('b') ? ENHARMONICS[noteName] : noteName;
  return NOTES.indexOf(norm);
}

export function getNoteDisplay(noteName: string, activeRoot: string, useFlats?: boolean): string {
  const normNote = ENHARMONICS[noteName] && noteName.includes('b') ? ENHARMONICS[noteName] : noteName;
  const flats = useFlats ?? FLAT_KEYS.includes(activeRoot);

  if (flats && normNote.includes('#')) return ENHARMONICS[normNote] || normNote;
  if (!flats && normNote.includes('b')) return ENHARMONICS[normNote] || normNote;
  return normNote;
}

export function formatAccidental(s: string): string {
  return s.replace(/##/g, '𝄪').replace(/#/g, '♯').replace(/bb/g, '𝄫').replace(/b/g, '♭');
}

// For interval labels like b3, b5, b7 — keep lowercase 'b' which reads better
// inline with small digits. Only replace # with ♯.
export function formatIntervalAccidental(s: string): string {
  return s.replace(/##/g, '𝄪').replace(/#/g, '♯');
}

const LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PITCHES: Record<string, number> = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

export function getNoteDisplayInScale(
  noteName: string,
  rootNote: string,
  scaleIntervals: number[],
  useFlats?: boolean
): string {
  // Only apply scale-aware spelling for 7-note scales
  if (scaleIntervals.length !== 7) {
    return getNoteDisplay(noteName, rootNote, useFlats);
  }

  // Normalize inputs to sharp representation for internal lookup
  const normNote = noteName.includes('b') && ENHARMONICS[noteName] ? ENHARMONICS[noteName] : noteName;
  const rootNorm = rootNote.includes('b') && ENHARMONICS[rootNote] ? ENHARMONICS[rootNote] : rootNote;

  const rootIdx = NOTES.indexOf(rootNorm);
  const noteIdx = NOTES.indexOf(normNote);
  if (rootIdx === -1 || noteIdx === -1) return getNoteDisplay(noteName, rootNote, useFlats);

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
    return expectedLetter + '#'; // Sharp
  } else if (diff === 11) {
    return expectedLetter + 'b'; // Flat
  } else if (diff === 2) {
    return expectedLetter + '##'; // Double sharp (rare)
  } else if (diff === 10) {
    return expectedLetter + 'bb'; // Double flat (rare)
  }

  // Fallback
  return getNoteDisplay(noteName, rootNote, useFlats);
}

export function getIntervalNotes(rootNote: string, intervals: number[]): string[] {
  const rootIndex = getNoteIndex(rootNote);
  if (rootIndex === -1) return [];

  return intervals.map(interval => {
    return NOTES[(rootIndex + interval) % 12];
  });
}

export function getScaleNotes(rootNote: string, scaleName: string): string[] {
  const intervals = SCALES[scaleName];
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
export function getDivergentNotes(rootNote: string, scaleName: string): string[] {
  const intervals = SCALES[scaleName];
  if (!intervals || scaleName.includes('Blues')) return [];

  // Pentatonic scales are subsets, not modes — no divergence to show
  if (scaleName === 'Major Pentatonic' || scaleName === 'Minor Pentatonic') return [];
  // Major and Natural Minor are the references themselves
  if (scaleName === 'Major' || scaleName === 'Natural Minor') return [];

  const isMajorQuality = intervals.includes(4); // contains major 3rd
  const refIntervals = isMajorQuality ? SCALES['Major'] : SCALES['Natural Minor'];

  const rootIdx = NOTES.indexOf(rootNote);
  if (rootIdx === -1) return [];

  const refSet = new Set(refIntervals);
  return intervals
    .filter(interval => !refSet.has(interval))
    .map(interval => NOTES[(rootIdx + interval) % 12]);
}

// Key signature accidental counts (positive = sharps, negative = flats)
export const KEY_SIGNATURES: Record<string, number> = {
  'C': 0,
  'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6,
  'F': -1, 'Bb': -2, 'A#': -2, 'Eb': -3, 'D#': -3,
  'Ab': -4, 'G#': -4, 'Db': -5, 'C#': 7, 'Gb': -6,
};

export function getKeySignature(rootNote: string): number {
  return KEY_SIGNATURES[rootNote] ?? 0;
}

export function getKeySignatureForDisplay(
  rootNote: string,
  scaleName: string,
  useFlats: boolean,
): number {
  const offset = SCALE_TO_PARENT_MAJOR_OFFSET[scaleName] ?? 0;

  // Normalize rootNote to sharp index
  const sharpRoot = rootNote.includes("b") && ENHARMONICS[rootNote]
    ? ENHARMONICS[rootNote] : rootNote;
  const rootIdx = NOTES.indexOf(sharpRoot);
  if (rootIdx === -1) return KEY_SIGNATURES[rootNote] ?? 0;

  const parentIdx = (rootIdx + offset) % 12;
  const parentSharp = NOTES[parentIdx];

  // When the originally-selected root is sharp-spelled, always return the
  // sharp-side key signature regardless of the useFlats auto-resolution.
  // This preserves the user's intended root spelling (e.g., G# Major → sharps).
  const originalIsSharp = rootNote.includes('#');
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
 * (FLAT_KEYS membership). Enharmonic roots in "auto" mode pick the spelling
 * with the fewer total accidentals (ties break to sharps). The full auto-mode
 * algorithm lands in Task 2; Task 1 scaffolds the signature + pass-through.
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
  const sharpRoot = rootNote.includes("b") && ENHARMONICS[rootNote]
    ? ENHARMONICS[rootNote] : rootNote;
  const flatRoot = rootNote.includes("#") && ENHARMONICS[rootNote]
    ? ENHARMONICS[rootNote] : rootNote;

  const intervals = SCALES[scaleName];
  if (!intervals) return FLAT_KEYS.includes(rootNote);

  const countAccidentals = (displays: string[]): number =>
    displays.reduce((sum, s) => {
      if (s.includes("##") || s.includes("bb")) return sum + 2;
      if (s.includes("#") || s.includes("b")) return sum + 1;
      return sum;
    }, 0);

  const sharpNotes = getScaleNotes(sharpRoot, scaleName);
  const flatNotes = getScaleNotes(flatRoot, scaleName);

  const sharpDisplays = sharpNotes.map(n =>
    getNoteDisplayInScale(n, sharpRoot, intervals, false),
  );
  const flatDisplays = flatNotes.map(n =>
    getNoteDisplayInScale(n, flatRoot, intervals, true),
  );

  const sharpCount = countAccidentals(sharpDisplays);
  const flatCount = countAccidentals(flatDisplays);

  return flatCount < sharpCount; // strict less; tie → sharps (false)
}

// Semitone offset from a scale's root to its parent major key.
// Used to derive the correct key signature for modal and minor scales.
export const SCALE_TO_PARENT_MAJOR_OFFSET: Record<string, number> = {
  'Major': 0,
  'Dorian': 10,
  'Phrygian': 8,
  'Lydian': 7,
  'Mixolydian': 5,
  'Natural Minor': 3,
  'Locrian': 1,
  'Harmonic Minor': 3,
  'Major Pentatonic': 0,
  'Minor Pentatonic': 3,
  'Major Blues': 0,
  'Minor Blues': 3,
};

// Circle of fifths display labels
export const CIRCLE_DISPLAY_LABELS: Record<string, string> = {
  'C': 'C', 'G': 'G', 'D': 'D', 'A': 'A', 'E': 'E', 'B': 'B',
  'F#': 'F#/Gb',
  'C#': 'Db', 'G#': 'Ab', 'D#': 'Eb', 'A#': 'Bb',
  'F': 'F',
};
