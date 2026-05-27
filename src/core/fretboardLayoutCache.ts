import { getFretboardNotes } from "@fretflow/core";

export function getCachedFretboardLayout(
  tuning: readonly string[],
  maxFret: number,
): string[][] {
  return getFretboardNotes([...tuning], maxFret);
}

export function clearFretboardLayoutCache(): void {
  // Compatibility no-op: @fretflow/core owns the fretboard layout cache.
}
