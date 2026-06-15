/**
 * Collapse a full reordered id array (as handed back by motion's Reorder.Group)
 * into the single `{ from, to }` move it represents. Returns null when the arrays
 * are identical or differ by more than one contiguous move.
 */
export function singleMoveDiff(prev: string[], next: string[]): { from: number; to: number } | null {
  if (prev.length !== next.length) return null;
  let lo = 0;
  while (lo < prev.length && prev[lo] === next[lo]) lo++;
  let hi = prev.length - 1;
  while (hi >= 0 && prev[hi] === next[hi]) hi--;
  if (lo > hi) return null;
  if (next[hi] === prev[lo]) return { from: lo, to: hi };
  if (next[lo] === prev[hi]) return { from: hi, to: lo };
  return null;
}
