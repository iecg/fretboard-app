import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  rootNoteAtom,
  scaleNameAtom,
  scaleBrowseModeAtom,
  scaleNotesAtom,
  colorNotesAtom,
  activeBrowseOptionAtom,
  scaleLabelAtom,
  setRootNoteAtom,
  setScaleNameAtom,
  useFlatsAtom,
  hiddenNotesAtom,
  toggleHiddenNoteAtom,
  degreeChipsAtom,
  scaleVisibleAtom,
  toggleScaleVisibleAtom,
} from "../store/atoms";

export function useScaleState() {
  const rootNote = useAtomValue(rootNoteAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  // Use the action wrapper so that switching modes (e.g. Ionian → Dorian)
  // remaps the active chord degree by semitone-equivalence instead of leaving
  // the user with an invalid Roman numeral that doesn't exist in the new mode.
  const setScaleName = useSetAtom(setScaleNameAtom);
  const [scaleBrowseMode, setScaleBrowseMode] = useAtom(scaleBrowseModeAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);

  const scaleNotes = useAtomValue(scaleNotesAtom);
  const colorNotes = useAtomValue(colorNotesAtom);
  const activeBrowseOption = useAtomValue(activeBrowseOptionAtom);
  const scaleLabel = useAtomValue(scaleLabelAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const [hiddenNotes, setHiddenNotes] = useAtom(hiddenNotesAtom);
  const toggleHiddenNote = useSetAtom(toggleHiddenNoteAtom);
  const degreeChips = useAtomValue(degreeChipsAtom);
  const scaleVisible = useAtomValue(scaleVisibleAtom);
  const toggleScaleVisible = useSetAtom(toggleScaleVisibleAtom);

  return {
    rootNote,
    scaleName,
    setScaleName,
    scaleBrowseMode,
    setScaleBrowseMode,
    setRootNote,
    scaleNotes,
    colorNotes,
    activeBrowseOption,
    scaleLabel,
    useFlats,
    hiddenNotes,
    setHiddenNotes,
    toggleHiddenNote,
    degreeChips,
    scaleVisible,
    toggleScaleVisible,
  };
}
