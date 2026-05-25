import { getFretboardNotes } from '../guitar';
import { CHORD_DEFINITIONS, NOTES } from '../theory';

import { type CagedShape, FULL_CHORD_TEMPLATES, type FullChordQuality } from './templates';

export interface FullChordMatchNote {
  stringIndex: number;
  fretIndex: number;
  noteName: string;
}

export interface FullChordMatch {
  shape: CagedShape;
  quality: FullChordQuality;
  rootFret: number;
  positionKeys: string[];
  notes: FullChordMatchNote[];
}

interface GetFullChordShapeMatchesParams {
  chordRoot: string;
  chordType: string;
  tuning: string[];
  maxFret: number;
}

const FULL_CHORD_QUALITIES = new Set<FullChordQuality>([
  'M',
  'm',
  '7',
]);

export function getFullChordShapeMatches({
  chordRoot,
  chordType,
  tuning,
  maxFret,
}: GetFullChordShapeMatchesParams): FullChordMatch[] {
  if (!FULL_CHORD_QUALITIES.has(chordType as FullChordQuality)) {
    return [];
  }

  if (tuning.length !== 6) {
    return [];
  }

  const rootIndex = NOTES.indexOf(chordRoot);
  const chordDefinition = CHORD_DEFINITIONS[chordType];
  if (rootIndex < 0 || !chordDefinition) {
    return [];
  }

  const chordNotes = new Set(
    chordDefinition.members.map(({ semitone }) => NOTES[(rootIndex + semitone) % NOTES.length]),
  );
  const fretboard = getFretboardNotes([...tuning], maxFret);
  const quality = chordType as FullChordQuality;
  const matches: FullChordMatch[] = [];

  for (const template of FULL_CHORD_TEMPLATES) {
    if (template.quality !== quality) {
      continue;
    }

    const anchorNotes = fretboard[template.anchorString];
    if (!anchorNotes) {
      continue;
    }

    for (let anchorFret = 0; anchorFret < anchorNotes.length; anchorFret += 1) {
      if (anchorNotes[anchorFret] !== chordRoot) {
        continue;
      }

      const notes: FullChordMatchNote[] = [];
      const positionKeys: string[] = [];

      for (let stringIndex = 0; stringIndex < template.fretsHighToLow.length; stringIndex += 1) {
        const fret = template.fretsHighToLow[stringIndex];
        if (fret === null) {
          continue;
        }

        const fretIndex = fret + anchorFret - template.anchorFretOffset;
        if (fretIndex < 0 || fretIndex > maxFret) {
          continue;
        }

        const noteName = fretboard[stringIndex]?.[fretIndex];
        if (!noteName) {
          continue;
        }

        notes.push({ stringIndex, fretIndex, noteName });
        positionKeys.push(`${stringIndex}-${fretIndex}`);
      }

      if (notes.length >= 4 && notes.every((note) => chordNotes.has(note.noteName))) {
        matches.push({
          shape: template.shape,
          quality: template.quality,
          rootFret: anchorFret,
          positionKeys,
          notes,
        });
      }
    }
  }

  // Deduplicate matches that have the exact same set of physical coordinates (positionKeys)
  const uniqueMatchesMap = new Map<string, FullChordMatch>();

  for (const match of matches) {
    const key = match.positionKeys.slice().sort().join('|');
    const existing = uniqueMatchesMap.get(key);
    if (!existing) {
      uniqueMatchesMap.set(key, match);
    } else {
      // Prefer standard E-shape barre chord over G-shape for minor triads
      if (match.shape === 'E' && existing.shape === 'G') {
        uniqueMatchesMap.set(key, match);
      }
    }
  }

  return Array.from(uniqueMatchesMap.values());
}
