import { useAtomValue } from "jotai";
import { currentTuningAtom, fretEndAtom, fretStartAtom, fretZoomAtom } from "../store/layoutAtoms";
import { autoCenterTargetAtom } from "../store/shapeAtoms";
import { recenterKeyAtom } from "../store/fingeringAtoms";

export function useFretboardViewportModel() {
  return {
    currentTuning: useAtomValue(currentTuningAtom),
    startFret: useAtomValue(fretStartAtom),
    endFret: useAtomValue(fretEndAtom),
    fretZoom: useAtomValue(fretZoomAtom),
    autoCenterTarget: useAtomValue(autoCenterTargetAtom),
    recenterKey: useAtomValue(recenterKeyAtom),
  };
}
