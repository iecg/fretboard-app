import { type MobileSheetSnap } from "../../store/uiAtoms";

/**
 * vaul snap points for the mobile bottom sheet.
 * The 96px in SNAP_POINTS[0] must be kept in sync with the
 * var(--mobile-sheet-peek, 96px) fallback in MobileShell.module.css.
 * NOTE: vaul computes snap offsets against the full window height, so
 * MobileSheet.module.css keeps the drawer at 100dvh — px/fraction values here
 * are literally the visible sheet height.
 */
export const SNAP_POINTS = ["96px", 0.45, 0.85] as const;

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
