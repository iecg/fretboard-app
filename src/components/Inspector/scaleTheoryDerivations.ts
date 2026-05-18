import {
  CIRCLE_OF_FIFTHS,
  SCALES,
  formatAccidental,
  getKeySignatureForDisplay,
  getNoteDisplayInScale,
  getScaleCatalogEntry,
} from "@fretflow/core";

/** Maps a parent-major semitone offset to its step count on the circle of fifths. */
const SEMITONES_TO_CIRCLE_STEPS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

export interface ScaleKeyInfo {
  /** Key-signature readout — "♮", "2♯", "3♭", etc. */
  keySignature: string;
  /** Label for the related key — "Relative" for major/minor, "Parent" for modes. */
  relativeLabel: string;
  /** Display value for the related key — e.g. "Am", "C". */
  relativeValue: string;
}

/**
 * Derives the key-signature and related-key readouts for the Scale tab's
 * Theory column. Extracted from CircleOfFifths so the circle renders only the
 * wheel and the Theory column owns these textual facts.
 */
export function getScaleKeyInfo(
  rootNote: string,
  scaleName: string,
  useFlats: boolean,
): ScaleKeyInfo {
  const rootIndex = CIRCLE_OF_FIFTHS.indexOf(rootNote);
  const scaleIntervals = SCALES[scaleName] ?? [];
  const rootDisplayLabel = getNoteDisplayInScale(
    rootNote,
    rootNote,
    scaleIntervals,
    useFlats,
  );
  const keySig = getKeySignatureForDisplay(rootDisplayLabel, scaleName, useFlats);
  const keySignature =
    keySig === 0 ? "♮" : keySig > 0 ? `${keySig}♯` : `${Math.abs(keySig)}♭`;

  const parentMajorOffset =
    getScaleCatalogEntry(scaleName)?.member.parentMajorOffset ?? 0;

  let relativeLabel = "Relative";
  let relativeScale = "Natural Minor";
  let relativeIndex = (rootIndex + 3) % 12;
  let relativeSuffix = "m";

  if (scaleName === "Natural Minor" || scaleName === "Minor") {
    relativeScale = "Major";
    relativeIndex = (rootIndex + 9) % 12;
    relativeSuffix = "";
  } else if (scaleName !== "Major") {
    relativeLabel = "Parent";
    relativeScale = "Major";
    relativeIndex =
      (rootIndex + (SEMITONES_TO_CIRCLE_STEPS[parentMajorOffset] ?? 0)) % 12;
    relativeSuffix = "";
  }

  const relativeNote = CIRCLE_OF_FIFTHS[relativeIndex];
  const relativeDisplay = getNoteDisplayInScale(
    relativeNote,
    relativeNote,
    SCALES[relativeScale] ?? [],
    useFlats,
  );

  return {
    keySignature,
    relativeLabel,
    relativeValue: `${formatAccidental(relativeDisplay)}${relativeSuffix}`,
  };
}
