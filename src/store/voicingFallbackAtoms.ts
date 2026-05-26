/**
 * Atoms that compute close-voicing fallbacks for CAGED / 3NPS positions
 * lacking a full-chord template. Surfaced in Full mode only — does not
 * displace the connector source for positions where a full match exists.
 * See docs/superpowers/specs/2026-05-26-close-voicing-fallback-design.md.
 */
import { atom } from "jotai";
import type { Voicing } from "@fretflow/core";
import {
  voicingAtom,
  voicingMatchesAtom,
  closeCandidatesAllStringSetsAtom,
  effectiveStringSetAtom,
  chordOverlayHiddenAtom,
} from "./chordOverlayAtoms";
import { shapeDataAtom } from "./shapeAtoms";
import { fingeringPatternAtom, cagedShapesAtom } from "./fingeringAtoms";
import { activePositionAtom } from "./chordScope";
import {
  selectCloseFallbacksForCagedPosition,
  selectCloseFallbacksForThreeNpsPosition,
  scoreFullChordForCagedPosition,
  scoreFullChordForThreeNpsPosition,
} from "../hooks/voicingSelection";

/**
 * For each active polygon / 3NPS position that has NO full-chord match,
 * the close voicings (already snap-to-scale + string-set filtered) that
 * fit inside it. Empty when voicing !== "full" or chord-overlay is hidden.
 */
export const fallbackVoicingMatchesAtom = atom((get): Voicing[] => {
  const voicing = get(voicingAtom);
  if (voicing !== "full") return [];
  if (get(chordOverlayHiddenAtom)) return [];

  const pattern = get(fingeringPatternAtom);
  if (pattern !== "caged" && pattern !== "3nps") return [];

  const activePosition = get(activePositionAtom);
  if (!activePosition) return [];

  const allCloses = get(closeCandidatesAllStringSetsAtom);
  const stringSet = new Set(get(effectiveStringSetAtom));
  const closes =
    stringSet.size === 6
      ? allCloses
      : allCloses.filter((v) =>
          v.notes.every((n) => stringSet.has(n.stringIndex)),
        );
  if (closes.length === 0) return [];

  const fulls = get(voicingMatchesAtom);
  const result: Voicing[] = [];

  if (pattern === "caged") {
    const { shapePolygons } = get(shapeDataAtom);
    const cagedShapes = get(cagedShapesAtom);
    for (const polygon of shapePolygons) {
      if (polygon.shape !== undefined && !cagedShapes.has(polygon.shape)) continue;
      if (polygon.truncated) continue;

      const hasFull = fulls.some(
        (m) => scoreFullChordForCagedPosition(m, polygon, cagedShapes) !== null,
      );
      if (hasFull) continue;

      const fallbacks = selectCloseFallbacksForCagedPosition(closes, polygon);
      for (const fb of fallbacks) {
        result.push({ ...fb, shape: polygon.shape });
      }
    }
    return result;
  }

  // 3NPS
  const { boxBounds } = get(shapeDataAtom);
  if (boxBounds.length === 0) return [];
  const hasFull = fulls.some(
    (m) => scoreFullChordForThreeNpsPosition(m, boxBounds, 0) !== null,
  );
  if (hasFull) return [];
  return selectCloseFallbacksForThreeNpsPosition(closes, boxBounds);
});

/**
 * True when at least one active position uses a close-voicing fallback.
 * Drives the string-set dropdown visibility gate in ChordOverlayControls.
 */
export const hasFallbackPositionsAtom = atom((get): boolean => {
  return get(fallbackVoicingMatchesAtom).length > 0;
});
