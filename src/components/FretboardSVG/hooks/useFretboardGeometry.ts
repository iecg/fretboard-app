import { useMemo, useCallback } from "react";
import {
  getFretboardScale,
  getWireX,
  getFretCenterX,
  getFretColumnWidth,
  getTaperGeometry,
  getStringY,
} from "../fretboardGeometry";

export interface FretboardGeometryParams {
  startFret: number;
  endFret: number;
  maxFret: number;
  neckWidthPx: number;
  /**
   * Playable neck height (`tuning.length * stringRowPx`). Strings, frets,
   * inlays, and shape polygons are positioned within this box. The
   * connector-overshoot padding above and below the wood is provided by
   * the outer HTML wrapper, not by the SVG itself.
   */
  neckHeight: number;
  noteBubblePx: number;
  numStrings: number;
}

export function useFretboardGeometry({
  startFret,
  endFret,
  maxFret,
  neckWidthPx,
  neckHeight,
  noteBubblePx,
  numStrings,
}: FretboardGeometryParams) {
  const { openColumnWidth, scaleLeftAnchor, scalePx } = useMemo(() => {
    return getFretboardScale(startFret, endFret, neckWidthPx, noteBubblePx);
  }, [startFret, endFret, neckWidthPx, noteBubblePx]);

  const wireXRel = useCallback(
    (wireIndex: number) =>
      getWireX(wireIndex, startFret, openColumnWidth, scalePx, scaleLeftAnchor),
    [startFret, openColumnWidth, scalePx, scaleLeftAnchor]
  );

  const fretToX = useCallback(
    (fret: number) =>
      getFretCenterX(
        fret,
        startFret,
        openColumnWidth,
        scalePx,
        scaleLeftAnchor
      ),
    [startFret, openColumnWidth, scalePx, scaleLeftAnchor]
  );

  const fretColumnWidth = useCallback(
    (fret: number) =>
      getFretColumnWidth(
        fret,
        startFret,
        openColumnWidth,
        scalePx,
        scaleLeftAnchor
      ),
    [startFret, openColumnWidth, scalePx, scaleLeftAnchor]
  );

  const fretCenterX = fretToX;

  const { taperYLeft, taperPath, cornerR } = useMemo(() => {
    return getTaperGeometry(
      startFret,
      endFret,
      maxFret,
      neckWidthPx,
      neckHeight
    );
  }, [startFret, endFret, maxFret, neckWidthPx, neckHeight]);

  const stringYAt = useCallback(
    (s: number, x: number) =>
      getStringY(s, x, numStrings, neckWidthPx, neckHeight),
    [numStrings, neckWidthPx, neckHeight]
  );

  return {
    openColumnWidth,
    scaleLeftAnchor,
    scalePx,
    wireXRel,
    fretToX,
    fretCenterX,
    fretColumnWidth,
    taperYLeft,
    taperPath,
    cornerR,
    stringYAt,
  };
}
