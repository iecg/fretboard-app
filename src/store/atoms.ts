

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
  practiceBarSharedMembersAtom,
  practiceBarOutsideMembersAtom,
  lensAvailabilityContextAtom,
  lensAvailabilityAtom,
  practiceBarLandOnGroupAtom,
  shapeLocalPracticeCuesAtom,
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
  mobileTabAtom,
  tabletTabAtom,
  landscapeNarrowTabAtom,
  settingsOverlayOpenAtom,
  themeAtom,
  type LandscapeNarrowTab,
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
  isShapeLocalContextAtom,
  shapeContextLabelAtom,
  shapeHighlightedNoteSetAtom,
  shapeLocalTargetMembersAtom,
  shapeLocalOutsideMembersAtom,
  shapeLocalColorNotesFilteredAtom,
  shapeLocalColorNotesAtom,
  type AutoCenterTarget,
} from "./shapeAtoms";

export {
  noteRoleMapAtom,
  summaryChordRowAtom,
  summaryLegendItemsAtom,
  summaryNotesAtom,
  chordMemberLabelsAtom,
  summaryHeaderLeftAtom,
  summaryHeaderRightAtom,
  summaryPrimaryModeAtom,
  sharedChordMembersAtom,
  outsideChordMembersAtom,
} from "./summaryAtoms";

export {
  setRootNoteAtom,
  resetAtom,
} from "./actions";
