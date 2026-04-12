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
    // Normalize display back to sharp form for ENHARMONICS lookup
    const normalized = display.includes('b') && ENHARMONICS[display] ? ENHARMONICS[display] : display;
    const enh = ENHARMONICS[normalized];
    return { primary, enharmonic: enh ? formatAccidental(enh) : null };
  }

  // mode === "auto": preserve existing logic exactly
  if (display !== note) {
    return { primary: formatAccidental(display), enharmonic: formatAccidental(note) };
  }
  if (note.includes('#')) {
    const enh = ENHARMONICS[note] ?? null;
    return { primary: formatAccidental(note), enharmonic: enh ? formatAccidental(enh) : null };
  }
  return { primary: note, enharmonic: null };
}
