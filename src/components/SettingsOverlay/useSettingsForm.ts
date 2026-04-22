import { useAtom } from "jotai";
import {
  fretZoomAtom,
  fretStartAtom,
  fretEndAtom,
  tuningNameAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
  chordFretSpreadAtom,
} from "../../store/atoms";

export function useSettingsForm() {
  const [fretZoom, setFretZoom] = useAtom(fretZoomAtom);
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);
  const [tuningName, setTuningName] = useAtom(tuningNameAtom);
  const [accidentalMode, setAccidentalMode] = useAtom(accidentalModeAtom);
  const [enharmonicDisplay, setEnharmonicDisplay] = useAtom(enharmonicDisplayAtom);
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
    accidentalMode,
    setAccidentalMode,
    enharmonicDisplay,
    setEnharmonicDisplay,
    chordFretSpread,
    setChordFretSpread,
  };
}
