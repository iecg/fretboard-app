
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
  practiceLensAtom,
  chordTonesAtom,
  chordMembersAtom,
  hasOutsideChordMembersAtom,
  chordLabelAtom,
  chordSummaryNotesAtom,
  allChordMembersAtom,
  chordMemberFactsAtom,
  chordDegreeAtom,
  chordOverlayModeAtom,
  chordRootOverrideAtom,
  chordQualityOverrideAtom,
  chordOverlayHiddenAtom,
  chordHiddenNotesAtom,
  toggleChordHiddenNoteAtom,
  toggleChordOverlayHiddenAtom,
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
} from "./audioAtoms";

export {
  shapeDataAtom,
  effectiveShapeDataAtom,
  autoCenterTargetAtom,
  shapeHighlightedNoteSetAtom,
  type AutoCenterTarget,
} from "./shapeAtoms";

export {
  setRootNoteAtom,
  resetAtom,
} from "./actions";
