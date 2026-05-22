import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { setFingeringPatternAtom } from "../store/actions";
import { fingeringPatternAtom, cagedShapesAtom, cagedOctaveAtom, toggleCagedShapeAtom, selectSingleCagedShapeAtom, npsPositionAtom, npsOctaveAtom, clickedShapeAtom, recenterKeyAtom, oneStringIndexAtom, oneStringIntervalAtom, twoStringsPairAtom, twoStringsIntervalAtom } from "../store/fingeringAtoms";
import { shapeDataAtom, autoCenterTargetAtom } from "../store/shapeAtoms";
import { type CagedShape } from "@fretflow/core";

export function useShapeState() {
  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const setFingeringPattern = useSetAtom(setFingeringPatternAtom);
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const [cagedOctave, setCagedOctave] = useAtom(cagedOctaveAtom);
  const toggleCagedShape = useSetAtom(toggleCagedShapeAtom);
  const selectSingleCagedShape = useSetAtom(selectSingleCagedShapeAtom);
  const [npsPosition, setNpsPosition] = useAtom(npsPositionAtom);
  const [npsOctave, setNpsOctave] = useAtom(npsOctaveAtom);
  const [clickedShape, setClickedShape] = useAtom(clickedShapeAtom);
  const [recenterKey, setRecenterKey] = useAtom(recenterKeyAtom);
  const [oneStringIndex, setOneStringIndex] = useAtom(oneStringIndexAtom);
  const [oneStringInterval, setOneStringInterval] = useAtom(oneStringIntervalAtom);
  const [twoStringsPair, setTwoStringsPair] = useAtom(twoStringsPairAtom);
  const [twoStringsInterval, setTwoStringsInterval] = useAtom(twoStringsIntervalAtom);

  const { highlightNotes, boxBounds, shapePolygons, wrappedNotes } =
    useAtomValue(shapeDataAtom);
  const autoCenterTarget = useAtomValue(autoCenterTargetAtom);

  const onShapeClick = (shape: CagedShape | null) => {
    setClickedShape(shape);
  };

  const onRecenter = () => {
    setRecenterKey((k) => k + 1);
  };

  return {
    fingeringPattern,
    setFingeringPattern,
    cagedShapes,
    setCagedShapes,
    cagedOctave,
    setCagedOctave,
    toggleCagedShape,
    selectSingleCagedShape,
    npsPosition,
    setNpsPosition,
    npsOctave,
    setNpsOctave,
    clickedShape,
    setClickedShape,
    recenterKey,
    highlightNotes,
    boxBounds,
    shapePolygons,
    wrappedNotes,
    autoCenterTarget,
    onShapeClick,
    onRecenter,
    oneStringIndex,
    setOneStringIndex,
    oneStringInterval,
    setOneStringInterval,
    twoStringsPair,
    setTwoStringsPair,
    twoStringsInterval,
    setTwoStringsInterval,
  };
}
