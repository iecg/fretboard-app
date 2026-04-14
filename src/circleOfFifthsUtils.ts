import { ENHARMONICS, getNoteDisplayInScale, formatAccidental } from "./theory";

/** Computes the primary + enharmonic label pair for a Circle of Fifths slice.
 *  Exported for testability. */
export function getCircleNoteLabels(
  note: string,
  rootNote: string,
  useFlats: boolean,
  scaleIntervals: number[],
  mode: "auto" | "on" | "off" = "auto",
): { primary: string; enharmonic: string | null } {
  const display = getNoteDisplayInScale(note, rootNote, scaleIntervals, useFlats);

  if (mode === "off") {
    return { primary: formatAccidental(display), enharmonic: null };
  }

  if (mode === "on") {
    const primary = formatAccidental(display);
    // Look up the opposite spelling directly from ENHARMONICS
    const enh = ENHARMONICS[display];
    // Guard: if resolution yields the same as primary, suppress duplicate
    if (!enh || formatAccidental(enh) === primary) {
      return { primary, enharmonic: null };
    }
    return { primary, enharmonic: formatAccidental(enh) };
  }

  // mode === "auto": preserve existing logic exactly
  if (display !== note) {
    return { primary: formatAccidental(display), enharmonic: formatAccidental(note) };
  }
  if (note.includes('#')) {
    const enh = ENHARMONICS[note] ?? null;
    return { primary: formatAccidental(note), enharmonic: enh ? formatAccidental(enh) : null };
  }
  return { primary: formatAccidental(note), enharmonic: null };
}
