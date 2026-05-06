import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  fingeringPatternAtom,
  cagedShapesAtom,
  toggleCagedShapeAtom,
  selectSingleCagedShapeAtom,
  npsPositionAtom,
  npsOctaveAtom,
  clickedShapeAtom,
  recenterKeyAtom,
  shapeDataAtom,
  autoCenterTargetAtom,
  oneStringIndexAtom,
  twoStringsPairAtom,
  doubleStopsIntervalAtom,
  box2x4StartFretAtom,
  box2x4PairAtom,
  box3x3StartFretAtom,
  box3x3TrioAtom,
  stackStartFretAtom,
} from "../store/atoms";
import { type CagedShape } from "../shapes";

export function useShapeState() {
  const [fingeringPattern, setFingeringPattern] = useAtom(fingeringPatternAtom);
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const toggleCagedShape = useSetAtom(toggleCagedShapeAtom);
  const selectSingleCagedShape = useSetAtom(selectSingleCagedShapeAtom);
  const [npsPosition, setNpsPosition] = useAtom(npsPositionAtom);
  const [npsOctave, setNpsOctave] = useAtom(npsOctaveAtom);
  const [clickedShape, setClickedShape] = useAtom(clickedShapeAtom);
  const [recenterKey, setRecenterKey] = useAtom(recenterKeyAtom);
  const [oneStringIndex, setOneStringIndex] = useAtom(oneStringIndexAtom);
  const [twoStringsPair, setTwoStringsPair] = useAtom(twoStringsPairAtom);
  const [doubleStopsInterval, setDoubleStopsInterval] = useAtom(doubleStopsIntervalAtom);
  const [box2x4StartFret, setBox2x4StartFret] = useAtom(box2x4StartFretAtom);
  const [box2x4Pair, setBox2x4Pair] = useAtom(box2x4PairAtom);
  const [box3x3StartFret, setBox3x3StartFret] = useAtom(box3x3StartFretAtom);
  const [box3x3Trio, setBox3x3Trio] = useAtom(box3x3TrioAtom);
  const [stackStartFret, setStackStartFret] = useAtom(stackStartFretAtom);

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
    twoStringsPair,
    setTwoStringsPair,
    doubleStopsInterval,
    setDoubleStopsInterval,
    box2x4StartFret,
    setBox2x4StartFret,
    box2x4Pair,
    setBox2x4Pair,
    box3x3StartFret,
    setBox3x3StartFret,
    box3x3Trio,
    setBox3x3Trio,
    stackStartFret,
    setStackStartFret,
  };
}
