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
 * Calculates the total semitone distance between two arrays of notes.
 * Assumes arrays are the same length. If not, it pads the shorter one
 * with the last note or slices the longer one.
 */
function calculateDistance(notesA: string[], notesB: string[]): number {
  let totalDistance = 0;
  const len = Math.max(notesA.length, notesB.length);
  
  for (let i = 0; i < len; i++) {
    const a = notesA[i] || notesA[notesA.length - 1];
    const b = notesB[i] || notesB[notesB.length - 1];
    
    const midiA = getMidi(a);
    const midiB = getMidi(b);
    
    if (midiA !== null && midiB !== null) {
      totalDistance += Math.abs(midiA - midiB);
    }
  }
  
  return totalDistance;
}

/**
 * Returns the inversion of the target chord that minimizes total semitone
 * distance from the previous notes.
 */
export function getNearestInversion(prevNotes: string[], baseNotes: string[], rootOctave: number = 3): string[] {
  if (baseNotes.length === 0) return [];

  
  // If no previous notes, just stack from rootOctave
  if (prevNotes.length === 0) {
    return baseNotes.map((n) => {
      // Very naive stacking for the root position
      // Realistically we want to stack them upward
      return n + rootOctave; 
    });
  }

  // To build proper inversions, we need a baseline set of pitches
  // We'll generate a few inversions around the prevNotes' average octave
  
  let sumMidi = 0;
  let count = 0;
  for (const n of prevNotes) {
    const m = getMidi(n);
    if (m !== null) {
      sumMidi += m;
      count++;
    }
  }
  
  const avgMidi = count > 0 ? sumMidi / count : 60; // default to middle C
  const targetOctave = Math.floor(avgMidi / 12) - 1; 

  // Generate candidates
  const candidates: string[][] = [];
  
  // Root position in targetOctave and targetOctave+1
  for (let oct = targetOctave - 1; oct <= targetOctave + 1; oct++) {
    for (let inv = 0; inv < baseNotes.length; inv++) {
      const candidate: string[] = [];
      let currentOctave = oct;
      for (let i = 0; i < baseNotes.length; i++) {
        const noteIndex = (inv + i) % baseNotes.length;
        // If we wrap around, increment octave
        if (i > 0) {
          const currChroma = getChroma(baseNotes[noteIndex]);
          const prevChroma = getChroma(baseNotes[(noteIndex - 1 + baseNotes.length) % baseNotes.length]);
          if (currChroma !== null && prevChroma !== null && currChroma < prevChroma) {
            currentOctave++;
          }
        }
        candidate.push(baseNotes[noteIndex] + currentOctave);
      }
      candidates.push(candidate);
    }
  }

  let bestCandidate = candidates[0];
  let minDistance = Infinity;

  for (const candidate of candidates) {
    const dist = calculateDistance(prevNotes, candidate);
    if (dist < minDistance) {
      minDistance = dist;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}
