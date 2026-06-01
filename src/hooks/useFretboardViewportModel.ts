import React from "react";
import { useAtomValue } from "jotai";
import { currentTuningAtom, fretEndAtom, fretStartAtom, fretZoomAtom } from "../store/layoutAtoms";
import { autoCenterTargetAtom } from "../store/shapeAtoms";
import { recenterKeyAtom } from "../store/fingeringAtoms";

export function useFretboardViewportModel() {
  const currentTuning = useAtomValue(currentTuningAtom);
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);
  const fretZoom = useAtomValue(fretZoomAtom);
  const autoCenterTarget = useAtomValue(autoCenterTargetAtom);
  const recenterKey = useAtomValue(recenterKeyAtom);

  return React.useMemo(() => ({
    currentTuning,
    startFret,
    endFret,
    fretZoom,
    autoCenterTarget,
    recenterKey,
  }), [
    currentTuning, startFret, endFret, fretZoom, autoCenterTarget, recenterKey
  ]);
}
