/** Lead margin as a fraction of the container width: the active block is kept
 *  at least this far from the leading/trailing edge so the next chord is
 *  partially visible. */
export const AUTO_SCROLL_LEAD_FRACTION = 0.15;

interface ViewBox {
  left: number;
  width: number;
}

interface BlockBox {
  left: number;
  right: number;
}

/**
 * Returns the horizontal scroll delta (px) needed to bring `block` inside the
 * lead-inset visible range of `view`, or null when it is already in view.
 * Negative = scroll left, positive = scroll right.
 */
export function computeAutoScrollDelta(
  view: ViewBox,
  block: BlockBox,
  leadFraction: number,
): number | null {
  const lead = view.width * leadFraction;
  const leftEdge = block.left - view.left;
  const rightEdge = block.right - view.left;

  if (leftEdge < lead) return leftEdge - lead;
  if (rightEdge > view.width - lead) return rightEdge - (view.width - lead);
  return null;
}
