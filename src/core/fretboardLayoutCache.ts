import { getFretboardNotes } from "@fretflow/core";

const layoutCache = new Map<string, string[][]>();

function makeLayoutKey(tuning: readonly string[], maxFret: number): string {
  return `${tuning.join("|")}::${maxFret}`;
}

export function getCachedFretboardLayout(
  tuning: readonly string[],
  maxFret: number,
): string[][] {
  const key = makeLayoutKey(tuning, maxFret);
  const cached = layoutCache.get(key);
  if (cached) return cached;
  const next = getFretboardNotes([...tuning], maxFret);
  layoutCache.set(key, next);
  return next;
}

export function clearFretboardLayoutCache(): void {
  layoutCache.clear();
}
