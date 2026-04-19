import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  fingeringPatternAtom,
  cagedShapesAtom,
  toggleCagedShapeAtom,
  selectSingleCagedShapeAtom,
  npsPositionAtom,
  clickedShapeAtom,
  recenterKeyAtom,
  shapeDataAtom,
  autoCenterTargetAtom,
  isShapeLocalContextAtom,
  shapeContextLabelAtom,
} from "../store/atoms";
import { type CagedShape } from "../shapes";

export function useShapeState() {
  const [fingeringPattern, setFingeringPattern] = useAtom(fingeringPatternAtom);
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const toggleCagedShape = useSetAtom(toggleCagedShapeAtom);
  const selectSingleCagedShape = useSetAtom(selectSingleCagedShapeAtom);
  const [npsPosition, setNpsPosition] = useAtom(npsPositionAtom);
  const [clickedShape, setClickedShape] = useAtom(clickedShapeAtom);
  const [recenterKey, setRecenterKey] = useAtom(recenterKeyAtom);

  const { highlightNotes, boxBounds, shapePolygons, wrappedNotes } =
    useAtomValue(shapeDataAtom);
  const autoCenterTarget = useAtomValue(autoCenterTargetAtom);
  const isShapeLocalContext = useAtomValue(isShapeLocalContextAtom);
  const shapeContextLabel = useAtomValue(shapeContextLabelAtom);

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
    clickedShape,
    setClickedShape,
    recenterKey,
    highlightNotes,
    boxBounds,
    shapePolygons,
    wrappedNotes,
    autoCenterTarget,
    isShapeLocalContext,
    shapeContextLabel,
    onShapeClick,
    onRecenter,
  };
}
