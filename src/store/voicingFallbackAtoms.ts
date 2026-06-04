/**
 * Atoms that compute close-voicing fallbacks for CAGED / 3NPS positions
 * lacking a full-chord template. Surfaced in Full mode only — does not
 * displace the connector source for positions where a full match exists.
 * See docs/superpowers/specs/2026-06-03-full-voicing-fallback-design.md.
 *
 * Architecture (post systematic-debug 2026-05-26):
 *
 *   fallbackPolygonsAtom    fallback3NpsBoxBoundsAtom
 *           \                       /
 *            \                     /
 *             v                   v
 *         hasFallbackPositionsAtom        <-- picker visibility (STABLE)
 *
 *   fallbackPolygonsAtom + closeCandidatesAllStringSetsAtom +
 *   effectiveStringSetAtom  ->  fallbackVoicingMatchesAtom    <-- render list
 *
 * Splitting these means changing the string-set pick no longer collapses
 * the picker — only the rendered connector list changes. Otherwise picking
 * a string set with no in-polygon fit would unmount the picker and trap
 * the user.
 *
 * Position-less path (Phase 2): in Full mode with no full-chord template and
 * no active position (Scale None / multi-shape CAGED / string modes),
 * `neckSpreadFallbackActiveAtom` routes `closeCandidatesAllStringSetsAtom`
 * through `selectNeckSpread` to produce a non-overlapping neck spread —
 * mutually exclusive with the polygon/box paths above.
 */
import { atom } from "jotai";
import type { ShapePolygon, Voicing } from "@fretflow/core";
import { selectNeckSpread } from "@fretflow/core";
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
import type { BoxBound } from "../components/FretboardSVG/utils/semantics";
import {
  selectCloseFallbacksForCagedPosition,
  selectCloseFallbacksForThreeNpsPosition,
  hasCloseFallbackForCagedPosition,
  hasCloseFallbackForThreeNpsPosition,
  scoreFullChordForCagedPosition,
  scoreFullChordForThreeNpsPosition,
} from "../hooks/voicingSelection";

const EMPTY_POLYGONS: readonly ShapePolygon[] = Object.freeze([]);

/**
 * Internal guard: are we currently in a state where fallbacks are even
 * considered? (Full mode, chord overlay visible, caged/3nps pattern, active
 * position present.) Shared by the polygon + boxBounds atoms so they return
 * stable empties when the answer is no.
 */
const fallbackContextActiveAtom = atom((get): boolean => {
  if (get(voicingAtom) !== "full") return false;
  if (get(chordOverlayHiddenAtom)) return false;
  const pattern = get(fingeringPatternAtom);
  if (pattern !== "caged" && pattern !== "3nps") return false;
  if (!get(activePositionAtom)) return false;
  return true;
});

/**
 * Phase 2: the position-less fallback path. Active in Full mode when the active
 * chord has NO full-chord template (voicingMatchesAtom empty) AND there is no
 * single active CAGED/3NPS position to scope to (Scale None, multi-shape CAGED,
 * one-string / two-strings modes). Mutually exclusive with the polygon/box
 * paths, which require an active position.
 */
const neckSpreadFallbackActiveAtom = atom((get): boolean => {
  if (get(voicingAtom) !== "full") return false;
  if (get(chordOverlayHiddenAtom)) return false;
  if (get(activePositionAtom)) return false;
  if (get(voicingMatchesAtom).length > 0) return false;
  return true;
});

/**
 * CAGED polygons that have NO full-chord template match AND at least one
 * close voicing (across any string set) that fits inside them. Independent
 * of the user's `voicingStringSetAtom` pick — that's what
 * keeps `hasFallbackPositionsAtom` sticky across string-set changes.
 *
 * Polygons that lack both a full match and any fitting close voicing are
 * excluded — there is nothing to show even with picker help, so the picker
 * shouldn't appear for them.
 *
 * Returns the shared `EMPTY_POLYGONS` reference when context is inactive or
 * the pattern is 3NPS, so callers get reference-stable empties.
 */
export const fallbackPolygonsAtom = atom((get): readonly ShapePolygon[] => {
  if (!get(fallbackContextActiveAtom)) return EMPTY_POLYGONS;
  if (get(fingeringPatternAtom) !== "caged") return EMPTY_POLYGONS;

  const { shapePolygons } = get(shapeDataAtom);
  const cagedShapes = get(cagedShapesAtom);
  const fulls = get(voicingMatchesAtom);
  const allCloses = get(closeCandidatesAllStringSetsAtom);

  const needing: ShapePolygon[] = [];
  for (const polygon of shapePolygons) {
    if (polygon.shape !== undefined && !cagedShapes.has(polygon.shape)) continue;
    // Truncated polygons (e.g. the open D-shape clipped at the nut) always
    // route through the fallback path. `scoreFullChordForCagedPosition` can
    // still return a non-null score for them (the open C 5-note voicing
    // scores against the truncated D-shape with outsideCount=2 within
    // tolerance), but the upstream selector
    // `selectFullChordMatchesForCagedPosition` explicitly skips truncated
    // polygons — it would never actually select that match. Without this
    // `!polygon.truncated` guard, hasFull=true would block the fallback
    // and the user would see neither a full voicing nor a close fallback
    // at the truncated polygon's visible portion.
    const hasFull = !polygon.truncated && fulls.some(
      (m) => scoreFullChordForCagedPosition(m, polygon, cagedShapes) !== null,
    );
    if (hasFull) continue;
    // Only register as "needing" if some close voicing can actually fill it —
    // otherwise the picker would surface a position the user can't recover.
    const anyCloseFits = hasCloseFallbackForCagedPosition(allCloses, polygon);
    if (anyCloseFits) needing.push(polygon);
  }
  return needing.length === 0 ? EMPTY_POLYGONS : needing;
});

/**
 * The 3NPS box bounds when the active 3NPS position has no full-chord match
 * and therefore wants a close-voicing fallback. `null` when context is
 * inactive, pattern is CAGED, or the position has a full match.
 */
export const fallback3NpsBoxBoundsAtom = atom((get): BoxBound[] | null => {
  if (!get(fallbackContextActiveAtom)) return null;
  if (get(fingeringPatternAtom) !== "3nps") return null;

  const { boxBounds, highlightNotes } = get(shapeDataAtom);
  if (boxBounds.length === 0) return null;
  const patternPositions = new Set(highlightNotes.filter((n) => n.includes("-")));
  const fulls = get(voicingMatchesAtom);
  const hasFull = fulls.some(
    (m) => scoreFullChordForThreeNpsPosition(m, patternPositions, 0) !== null,
  );
  if (hasFull) return null;
  // Same recoverability constraint as the CAGED path: only surface the
  // picker when at least one close voicing can actually fill the box.
  const anyCloseFits = hasCloseFallbackForThreeNpsPosition(
    get(closeCandidatesAllStringSetsAtom),
    patternPositions,
  );
  return anyCloseFits ? boxBounds : null;
});

/**
 * For each active polygon / 3NPS position that has NO full-chord match,
 * the close voicings (string-set filtered) that fit inside it. May be empty
 * even when `hasFallbackPositionsAtom` is true
 * — happens when the user picks a string set with no in-polygon fits.
 * Connector vanishes in that case; picker stays mounted (driven by
 * `hasFallbackPositionsAtom`).
 */
// Module-scoped cache for fallbackVoicingMatchesAtom. See chordOverlayAtoms
// `memoizeVoicings` for the rationale — same fingerprint scheme so two
// invocations that produce a value-equal voicing list yield the same array
// reference, allowing downstream React Compiler memos to short-circuit.
let cachedFallbackVoicings: Voicing[] = [];
let cachedFallbackVoicingsKey = "<uninitialized>";

function memoizeFallbackVoicings(next: readonly Voicing[]): Voicing[] {
  const fingerprint = next
    .map((voicing) => `${voicing.shape ?? "none"}:${voicing.positionKeys.join(",")}`)
    .join("|");

  if (fingerprint === cachedFallbackVoicingsKey) {
    return cachedFallbackVoicings;
  }

  cachedFallbackVoicingsKey = fingerprint;
  cachedFallbackVoicings = [...next];
  return cachedFallbackVoicings;
}

export const fallbackVoicingMatchesAtom = atom((get): Voicing[] => {
  const polygons = get(fallbackPolygonsAtom);
  const boxBounds = get(fallback3NpsBoxBoundsAtom);

  if (polygons.length === 0 && boxBounds === null) {
    // Phase 2: no active position — spread best grips across the neck instead.
    if (!get(neckSpreadFallbackActiveAtom)) return memoizeFallbackVoicings([]);
    // Full mode always uses all six strings (effectiveStringSetAtom), so the
    // neck-spread candidate set is simply every close voicing — no string-set
    // narrowing applies here (unlike the position-scoped path below).
    const closes = get(closeCandidatesAllStringSetsAtom);
    if (closes.length === 0) return memoizeFallbackVoicings([]);
    const spread = selectNeckSpread(closes).map((v) => ({ ...v, isFallback: true }));
    return memoizeFallbackVoicings(spread);
  }

  const allCloses = get(closeCandidatesAllStringSetsAtom);
  const stringSet = new Set(get(effectiveStringSetAtom));
  const closes =
    stringSet.size === 6
      ? allCloses
      : allCloses.filter((v) =>
          v.notes.every((n) => stringSet.has(n.stringIndex)),
        );
  if (closes.length === 0) return memoizeFallbackVoicings([]);

  let result: Voicing[];
  if (boxBounds !== null) {
    const { highlightNotes } = get(shapeDataAtom);
    const patternPositions = new Set(highlightNotes.filter((n) => n.includes("-")));
    result = selectCloseFallbacksForThreeNpsPosition(closes, patternPositions)
      .slice(0, 1)
      .map((v) => ({ ...v, isFallback: true }));
  } else {
    result = [];
    for (const polygon of polygons) {
      const ranked = selectCloseFallbacksForCagedPosition(closes, polygon);
      if (ranked.length > 0) {
        result.push({ ...ranked[0], shape: polygon.shape, isFallback: true });
      }
    }
  }
  return memoizeFallbackVoicings(result);
});

/**
 * True when at least one active position needs a close-voicing fallback —
 * regardless of whether the user's current string-set pick yields a fit.
 * Drives the string-set dropdown visibility gate in ChordOverlayControls;
 * MUST stay sticky across `voicingStringSetAtom` changes so users aren't
 * trapped after a dead-end pick.
 */
export const hasFallbackPositionsAtom = atom((get): boolean => {
  return get(fallbackPolygonsAtom).length > 0 ||
    get(fallback3NpsBoxBoundsAtom) !== null;
});
