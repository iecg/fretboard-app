import { getNoteDisplayInScale, formatAccidental } from "./theory";
import * as Note from "@tonaljs/note";

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
    // Use Tonal to resolve the enharmonic spelling
    const enh = Note.enharmonic(display);
    // Guard: if resolution yields the same as primary (e.g. naturals), suppress duplicate
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
    const enh = Note.enharmonic(note);
    // Guard: if Tonal returns the same note (no true enharmonic), suppress
    const formatted = enh && enh !== note ? formatAccidental(enh) : null;
    return { primary: formatAccidental(note), enharmonic: formatted };
  }
  return { primary: formatAccidental(note), enharmonic: null };
}
