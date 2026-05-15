import { useAtom } from "jotai";
import {
  fretZoomAtom,
  fretStartAtom,
  fretEndAtom,
  tuningNameAtom,
  chordFretSpreadAtom,
} from "../../store/atoms";

export function useSettingsForm() {
  const [fretZoom, setFretZoom] = useAtom(fretZoomAtom);
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);
  const [tuningName, setTuningName] = useAtom(tuningNameAtom);
  const [chordFretSpread, setChordFretSpread] = useAtom(chordFretSpreadAtom);

  return {
    fretZoom,
    setFretZoom,
    fretStart,
    setFretStart,
    fretEnd,
    setFretEnd,
    tuningName,
    setTuningName,
    chordFretSpread,
    setChordFretSpread,
  };
}
