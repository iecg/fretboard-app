
// Domain module re-exports: all public atoms flow through atoms.ts to maintain stable import paths.

export type { FingeringPattern } from "./fingeringAtoms";
export {
  fingeringPatternAtom,
  cagedShapesAtom,
  toggleCagedShapeAtom,
  selectSingleCagedShapeAtom,
  npsPositionAtom,
  npsOctaveAtom,
  clickedShapeAtom,
  recenterKeyAtom,
  oneStringIndexAtom,
  oneStringIntervalAtom,
  twoStringsPairAtom,
  twoStringsIntervalAtom,
  twoStringsActivePairTupleAtom,
} from "./fingeringAtoms";

export {
  rootNoteAtom,
  baseScaleNameAtom,
  scaleNameAtom,
  scaleBrowseModeAtom,
  accidentalModeAtom,
  useFlatsAtom,
  scaleNotesAtom,
  colorNotesAtom,
  activeBrowseOptionAtom,
  scaleLabelAtom,
  degreeChipsAtom,
  hiddenNotesAtom,
  toggleHiddenNoteAtom,
  scaleVisibleAtom,
  toggleScaleVisibleAtom,
  effectiveHiddenNotesAtom,
  effectiveColorNotesAtom,
  practiceBarColorNotesAtom,
} from "./scaleAtoms";

export {
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  chordFretSpreadAtom,
  fullChordsEnabledAtom,
  fullChordMatchesAtom,
  fullChordPositionsAtom,
  practiceLensAtom,
  chordTonesAtom,
  chordMembersAtom,
  chordLabelAtom,
  chordSummaryNotesAtom,
  chordMemberFactsAtom,
  chordDegreeAtom,
  chordOverlayModeAtom,
  chordRootOverrideAtom,
  chordQualityOverrideAtom,
  chordOverlayHiddenAtom,
  chordHiddenNotesAtom,
  toggleChordHiddenNoteAtom,
  toggleChordOverlayHiddenAtom,
  setChordDegreeAtom,
} from "./chordOverlayAtoms";

export {
  practiceBarColorNotesFilteredAtom,
  noteSemanticMapAtom,
  practiceCuesAtom,
  practiceBarChordGroupAtom,
  showChordPracticeBarAtom,
  practiceBarTitleAtom,
  practiceBarBadgeAtom,
  practiceBarLensLabelAtom,
  lensAvailabilityContextAtom,
  lensAvailabilityAtom,
  practiceBarLandOnGroupAtom,
} from "./practiceLensAtoms";

export {
  tuningNameAtom,
  fretZoomAtom,
  fretStartAtom,
  fretEndAtom,
  currentTuningAtom,
} from "./layoutAtoms";

export {
  displayFormatAtom,
  scaleDegreeColorsEnabledAtom,
  mobileTabAtom,
  settingsOverlayOpenAtom,
  compactDensityAtom,
  themeAtom,
} from "./uiAtoms";

export {
  enharmonicDisplayAtom,
  isMutedAtom,
  toggleMuteAtom,
  audioErrorAtom,
} from "./audioAtoms";

export {
  shapeDataAtom,
  effectiveShapeDataAtom,
  intervalPairsAtom,
  autoCenterTargetAtom,
  shapeHighlightedNoteSetAtom,
  type AutoCenterTarget,
} from "./shapeAtoms";

export {
  setRootNoteAtom,
  setScaleNameAtom,
  setFingeringPatternAtom,
  resetAtom,
} from "./actions";

export {
  hasOutsideChordMembersAtom,
  allChordMembersAtom,
  isChordMemberInScale,
  hasAnyChordToneOutsideScale,
  buildChordRowEntries,
} from "./composableSelectors";

export { languageAtom } from "./languageAtom";
