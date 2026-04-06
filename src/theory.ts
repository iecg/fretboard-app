export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11]
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

export function getNoteDisplay(noteName: string, activeRoot: string): string {
  const normNote = ENHARMONICS[noteName] && noteName.includes('b') ? ENHARMONICS[noteName] : noteName;
  const usesFlats = FLAT_KEYS.includes(activeRoot);
  
  if (usesFlats && normNote.includes('#')) return ENHARMONICS[normNote] || normNote;
  if (!usesFlats && normNote.includes('b')) return ENHARMONICS[normNote] || normNote;
  return normNote;
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

// Key signature accidental counts (positive = sharps, negative = flats)
export const KEY_SIGNATURES: Record<string, number> = {
  'C': 0,
  'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6,
  'F': -1, 'Bb': -2, 'A#': -2, 'Eb': -3, 'D#': -3,
  'Ab': -4, 'G#': -4, 'Db': -5, 'C#': -7, 'Gb': -6,
};

export function getKeySignature(rootNote: string): number {
  return KEY_SIGNATURES[rootNote] ?? 0;
}

// Circle of fifths display labels
export const CIRCLE_DISPLAY_LABELS: Record<string, string> = {
  'C': 'C', 'G': 'G', 'D': 'D', 'A': 'A', 'E': 'E', 'B': 'B',
  'F#': 'F#/Gb',
  'C#': 'Db', 'G#': 'Ab', 'D#': 'Eb', 'A#': 'Bb',
  'F': 'F',
};
