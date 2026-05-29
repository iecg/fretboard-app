import { NOTES } from "@fretflow/core";

function getMidi(noteStr: string): number | null {
  const match = noteStr.match(/^([A-G][b#]?)(-?\d+)$/);
  if (!match) return null;
  const chroma = NOTES.indexOf(match[1]);
  if (chroma < 0) return null;
  const oct = parseInt(match[2], 10);
  return oct * 12 + chroma;
}

function getChroma(noteStr: string): number | null {
  const match = noteStr.match(/^([A-G][b#]?)/);
  if (!match) return null;
  const chroma = NOTES.indexOf(match[1]);
  return chroma >= 0 ? chroma : null;
}

/**
 * Resolves a note name to an absolute pitch within a given range (e.g. "E1" to "E3").
 * If multiple octaves are valid, it selects the one closest to `prevNote`.
 */
export function resolveBassNoteInRange(
  noteName: string, 
  minNote: string = "E1", 
  maxNote: string = "E3",
  prevNote?: string
): string {
  const minMidi = getMidi(minNote) || 40; // Default E1
  const maxMidi = getMidi(maxNote) || 64; // Default E3
  
  const chroma = getChroma(noteName);
  if (chroma === null || chroma === undefined) return `${noteName}2`; // fallback
  
  const validOctaves: string[] = [];
  
  // Check octaves 0 through 5 to see which fall in range
  for (let oct = 0; oct <= 5; oct++) {
    const candidate = `${noteName}${oct}`;
    const midi = getMidi(candidate);
    if (midi !== null && midi >= minMidi && midi <= maxMidi) {
      validOctaves.push(candidate);
    }
  }
  
  if (validOctaves.length === 0) {
    // If somehow none are valid (range too narrow), just return an arbitrary octave inside range, or fallback
    return `${noteName}2`;
  }
  
  if (!prevNote) {
    // Pick the lowest valid octave if no previous note is specified
    return validOctaves[0];
  }
  
  // Find the valid octave closest to prevNote
  const prevMidi = getMidi(prevNote);
  if (prevMidi === null) return validOctaves[0];
  
  let bestCandidate = validOctaves[0];
  let minDiff = Infinity;
  
  for (const candidate of validOctaves) {
    const midi = getMidi(candidate);
    if (midi !== null) {
      const diff = Math.abs(midi - prevMidi);
      if (diff < minDiff) {
        minDiff = diff;
        bestCandidate = candidate;
      }
    }
  }
  
  return bestCandidate;
}
