/**
 * THROWAWAY PROTOTYPE — marker-system spike (2026-06-03).
 *
 * Toggles the fretboard note markers between the current scheme and the
 * "tiered" recommendation so we can compare them live before committing.
 *
 *   current — today's mapping (squircle chord/root, circle scale, diamond
 *             outside, hexagon blue/color); chord & scale tones are ~same size,
 *             and circle vs squircle is indistinguishable at marker scale.
 *   tiered  — shape = membership tier (squircle chord · circle scale ·
 *             diamond outside), size = salience (chord big, scale small),
 *             color = identity (solid-orange root anchor). Hexagon dropped.
 *
 * Delete this file + getNoteVisuals' `system` branch + the dev probe pill once
 * a marker system is chosen.
 */
import { atomWithStorage } from "jotai/utils";
import { k, createStorage, enumValidator, GET_ON_INIT } from "../utils/storage";

export const MARKER_SYSTEMS = ["current", "tiered"] as const;
export type MarkerSystem = (typeof MARKER_SYSTEMS)[number];

const markerSystemStorage = createStorage<MarkerSystem>({
  validate: enumValidator(MARKER_SYSTEMS),
});

export const markerSystemAtom = atomWithStorage<MarkerSystem>(
  k("markerSystem"),
  "current",
  markerSystemStorage,
  GET_ON_INIT,
);
