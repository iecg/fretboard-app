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
  useFlatsAtom,
} from "../store/atoms";

export function useScaleState() {
  const rootNote = useAtomValue(rootNoteAtom);
  const [scaleName, setScaleName] = useAtom(scaleNameAtom);
  const [scaleBrowseMode, setScaleBrowseMode] = useAtom(scaleBrowseModeAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);

  const scaleNotes = useAtomValue(scaleNotesAtom);
  const colorNotes = useAtomValue(colorNotesAtom);
  const activeBrowseOption = useAtomValue(activeBrowseOptionAtom);
  const scaleLabel = useAtomValue(scaleLabelAtom);
  const useFlats = useAtomValue(useFlatsAtom);

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
  };
}
