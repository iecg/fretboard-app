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

  // The differing window [lo, hi] is consistent with at most two candidate
  // single-element moves. Validate each by replaying it before returning, so a
  // non-single-move permutation (e.g. a middle-section reversal) can't be
  // misclassified as a valid move.
  const isMove = (from: number, to: number) => {
    const replayed = [...prev];
    const [moved] = replayed.splice(from, 1);
    replayed.splice(to, 0, moved!);
    return replayed.every((id, i) => id === next[i]);
  };
  if (next[hi] === prev[lo] && isMove(lo, hi)) return { from: lo, to: hi };
  if (next[lo] === prev[hi] && isMove(hi, lo)) return { from: hi, to: lo };
  return null;
}
