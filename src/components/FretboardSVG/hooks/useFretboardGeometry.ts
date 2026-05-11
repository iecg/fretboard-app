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
   * Full SVG height (`stringsBoxHeight + 2 * verticalInsetPx`). Used for the
   * taper geometry so the wood backdrop and taper-clipped wood stack cover
   * the entire SVG box, including the inset zones above the top string and
   * below the bottom string.
   */
  neckHeight: number;
  /**
   * Playable region height (`tuning.length * stringRowPx`). Strings are
   * positioned within this box, then offset by `verticalInsetPx`.
   */
  stringsBoxHeight: number;
  /**
   * Padding above the top string (and below the bottom string) that lets
   * chord-connector capsules overshoot the outermost strings without being
   * clipped at the SVG edge.
   */
  verticalInsetPx: number;
  noteBubblePx: number;
  numStrings: number;
}

export function useFretboardGeometry({
  startFret,
  endFret,
  maxFret,
  neckWidthPx,
  neckHeight,
  stringsBoxHeight,
  verticalInsetPx,
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
      getStringY(
        s,
        x,
        numStrings,
        neckWidthPx,
        stringsBoxHeight,
        verticalInsetPx,
      ),
    [numStrings, neckWidthPx, stringsBoxHeight, verticalInsetPx]
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
