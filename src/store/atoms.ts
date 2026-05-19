
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
  chordShortLabelAtom,
  chordSummaryNotesAtom,
  chordMemberFactsAtom,
  chordDegreeAtom,
  chordOverlayModeAtom,
  chordRootOverrideAtom,
  chordQualityOverrideAtom,
  effectiveChordDegreeAtom,
  effectiveChordOverlayModeAtom,
  effectiveChordQualityOverrideAtom,
  chordSourceIsProgressionAtom,
  chordOverlayHiddenAtom,
  chordHiddenNotesAtom,
  toggleChordHiddenNoteAtom,
  toggleChordOverlayHiddenAtom,
  setChordDegreeAtom,
  voicingTypeAtom,
  voicingInversionAtom,
  voicingStringSetAtom,
  voicingConnectorsAtom,
  availableInversionsAtom,
  voicingMatchesAtom,
  stringSetOptionsAtom,
  effectiveStringSetAtom,
} from "./chordOverlayAtoms";

export { buildStringSetOptions } from "./voicingStringSets";
export type { StringSetOption } from "./voicingStringSets";

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
  settingsOverlayOpenAtom,
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
  progressionStepsAtom,
  progressionTempoBpmAtom,
  progressionLoopEnabledAtom,
  progressionStrumEnabledAtom,
  progressionChordEnabledAtom,
  progressionGenreStyleAtom,
  progressionChordInstrumentAtom,
  progressionChordPatternAtom,
  progressionBassPatternAtom,
  progressionDrumPatternAtom,
  progressionDrumVariationsAtom,
  progressionSwingAtom,
  applyGenreStyleAtom,
  progressionBassEnabledAtom,
  progressionDrumsEnabledAtom,
  progressionMetronomeEnabledAtom,
  activeProgressionStepIndexAtom,
  activeProgressionStepAtom,
  activeResolvedProgressionStepAtom,
  resolvedProgressionStepsAtom,
  progressionStepDurationMsAtom,
  progressionPlaybackBlockedReasonAtom,
  progressionPlayingAtom,
  progressionStepDeadlineAtom,
  setProgressionActiveStepIndexAtom,
  setProgressionPlayingAtom,
  loadProgressionPresetAtom,
  loadProgressionStepsAtom,
  remapProgressionStepsForScaleAtom,
  addProgressionStepAtom,
  duplicateProgressionStepAtom,
  removeProgressionStepAtom,
  moveProgressionStepAtom,
  updateProgressionStepDegreeAtom,
  updateProgressionStepDurationAtom,
  updateProgressionStepQualityAtom,
  advanceProgressionPlaybackAtom,
  previousProgressionStepAtom,
  resetProgressionAtomsAtom,
  beatsPerBarAtom,
  totalProgressionBarsAtom,
  currentProgressionBarAtom,
  currentProgressionPresetIdAtom,
  CUSTOM_PRESET_ID,
} from "./progressionAtoms";

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
