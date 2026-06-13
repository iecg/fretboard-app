import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { setRootNoteAtom, setScaleNameAtom } from "../store/actions";
import { rootNoteAtom, scaleNameAtom, scaleNotesAtom, colorNotesAtom, scaleLabelAtom, preferFlatsAtom, hiddenNotesAtom, toggleHiddenNoteAtom, scaleVisibleAtom, toggleScaleVisibleAtom } from "../store/scaleAtoms";

export function useScaleState() {
  const rootNote = useAtomValue(rootNoteAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  // Use the action wrapper so that switching modes (e.g. Ionian → Dorian)
  // remaps the active chord degree by semitone-equivalence instead of leaving
  // the user with an invalid Roman numeral that doesn't exist in the new mode.
  const setScaleName = useSetAtom(setScaleNameAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);

  const scaleNotes = useAtomValue(scaleNotesAtom);
  const colorNotes = useAtomValue(colorNotesAtom);
  const scaleLabel = useAtomValue(scaleLabelAtom);
  const preferFlats = useAtomValue(preferFlatsAtom);
  const [hiddenNotes, setHiddenNotes] = useAtom(hiddenNotesAtom);
  const toggleHiddenNote = useSetAtom(toggleHiddenNoteAtom);
  const scaleVisible = useAtomValue(scaleVisibleAtom);
  const toggleScaleVisible = useSetAtom(toggleScaleVisibleAtom);

  return {
    rootNote,
    scaleName,
    setScaleName,
    setRootNote,
    scaleNotes,
    colorNotes,
    scaleLabel,
    preferFlats,
    hiddenNotes,
    setHiddenNotes,
    toggleHiddenNote,
    scaleVisible,
    toggleScaleVisible,
  };
}
