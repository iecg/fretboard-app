import { type MobileSheetSnap } from "../../store/uiAtoms";

/**
 * vaul snap points for the mobile bottom sheet.
 * The 96px in SNAP_POINTS[0] must be kept in sync with the
 * --mobile-sheet-peek CSS token (defined in src/styles/semantic.css ←
 * --token-mobile-sheet-peek in tokens.css). JS can't read a CSS var, so this
 * literal is the manual counterpart to that token.
 * NOTE: vaul computes snap offsets against the full window height, so
 * MobileSheet.module.css keeps the drawer at 100dvh — px/fraction values here
 * are literally the visible sheet height. The full snap is 1 (the sheet
 * reaches the viewport top); the drawer content pads for the top safe area.
 */
export const SNAP_POINTS = ["96px", 0.45, 1] as const;

const SNAP_BY_ID: Record<MobileSheetSnap, (typeof SNAP_POINTS)[number]> = {
  peek: SNAP_POINTS[0],
  half: SNAP_POINTS[1],
  full: SNAP_POINTS[2],
};

export function snapIdToPoint(id: MobileSheetSnap): string | number {
  return SNAP_BY_ID[id];
}

export function pointToSnapId(point: string | number | null): MobileSheetSnap {
  if (point === SNAP_POINTS[2]) return "full";
  if (point === SNAP_POINTS[1]) return "half";
  return "peek";
}
