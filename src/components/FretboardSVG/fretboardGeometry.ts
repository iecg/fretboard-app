import {
  NUT_WIDTH,
  NECK_TAPER_SCALE,
  STRING_SPREAD_LEFT_FRAC,
  STRING_OCCUPY_FRAC,
} from "../../core/constants";

export function getFretboardScale(
  startFret: number,
  endFret: number,
  neckWidthPx: number,
  noteBubblePx: number
): { openColumnWidth: number; scaleLeftAnchor: number; scalePx: number } {
  const openColumnWidth =
    startFret === 0 ? Math.max(noteBubblePx + 12, NUT_WIDTH + 4) : 0;
  const scaleLeftAnchor =
    startFret === 0 ? 1 : Math.pow(2, -(startFret - 1) / 12);
  const rightAnchor = Math.pow(2, -endFret / 12);
  const range = scaleLeftAnchor - rightAnchor || 1;
  const scalePx = (neckWidthPx - openColumnWidth) / range;
  return { openColumnWidth, scaleLeftAnchor, scalePx };
}

export function getWireX(
  wireIndex: number,
  startFret: number,
  openColumnWidth: number,
  scalePx: number,
  scaleLeftAnchor: number
): number {
  if (startFret === 0 && wireIndex === 0) {
    return openColumnWidth;
  }
  return (
    openColumnWidth + scalePx * (scaleLeftAnchor - Math.pow(2, -wireIndex / 12))
  );
}

export function getFretCenterX(
  fret: number,
  startFret: number,
  openColumnWidth: number,
  scalePx: number,
  scaleLeftAnchor: number
): number {
  if (startFret === 0 && fret === 0) {
    return openColumnWidth / 2;
  }
  const leftWire =
    fret === 0
      ? 0
      : getWireX(
          fret - 1,
          startFret,
          openColumnWidth,
          scalePx,
          scaleLeftAnchor
        );
  const rightWire = getWireX(
    fret,
    startFret,
    openColumnWidth,
    scalePx,
    scaleLeftAnchor
  );
  return (leftWire + rightWire) / 2;
}

export function getFretColumnWidth(
  fret: number,
  startFret: number,
  openColumnWidth: number,
  scalePx: number,
  scaleLeftAnchor: number
): number {
  if (startFret === 0 && fret === 0) return openColumnWidth;
  const leftWire =
    fret === 0
      ? 0
      : getWireX(
          fret - 1,
          startFret,
          openColumnWidth,
          scalePx,
          scaleLeftAnchor
        );
  const rightWire = getWireX(
    fret,
    startFret,
    openColumnWidth,
    scalePx,
    scaleLeftAnchor
  );
  return rightWire - leftWire;
}

export function getTaperGeometry(
  startFret: number,
  endFret: number,
  maxFret: number,
  neckWidthPx: number,
  neckHeight: number
): { taperYLeft: number; taperPath: string; cornerR: number } {
  const fretDistRatio = (wireIdx: number) => 1 - Math.pow(2, -wireIdx / 12);
  const pLeft = startFret === 0 ? 0 : fretDistRatio(startFret - 1);
  const pRight = fretDistRatio(endFret);
  const neckWidthAt = (p: number) => 1 + NECK_TAPER_SCALE * p;
  const leftHeightRatio = neckWidthAt(pLeft) / neckWidthAt(pRight);
  const yLeft = Math.round((neckHeight * (1 - leftHeightRatio)) / 2);

  const cornerR =
    endFret === maxFret ? Math.min(Math.round(neckHeight * 0.08), 22) : 0;
  const taperPath = cornerR > 0
    ? `M 0 ${yLeft} ` +
      `L ${neckWidthPx - cornerR} 0 ` +
      `Q ${neckWidthPx} 0 ${neckWidthPx} ${cornerR} ` +
      `L ${neckWidthPx} ${neckHeight - cornerR} ` +
      `Q ${neckWidthPx} ${neckHeight} ${neckWidthPx - cornerR} ${neckHeight} ` +
      `L 0 ${neckHeight - yLeft} Z`
    : `M 0 ${yLeft} ` +
      `L ${neckWidthPx} 0 ` +
      `L ${neckWidthPx} ${neckHeight} ` +
      `L 0 ${neckHeight - yLeft} Z`;

  return { taperYLeft: yLeft, taperPath, cornerR };
}

export function getStringY(
  stringIndex: number,
  x: number,
  numStrings: number,
  neckWidthPx: number,
  neckHeight: number
): number {
  const xFrac =
    neckWidthPx > 0 ? Math.max(0, Math.min(1, x / neckWidthPx)) : 0;
  const localSpread =
    (STRING_SPREAD_LEFT_FRAC + (1 - STRING_SPREAD_LEFT_FRAC) * xFrac) *
    neckHeight *
    STRING_OCCUPY_FRAC;
  const t = numStrings > 1 ? stringIndex / (numStrings - 1) : 0.5;
  return neckHeight / 2 - localSpread / 2 + t * localSpread;
}
