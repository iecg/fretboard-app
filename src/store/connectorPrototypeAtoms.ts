/**
 * THROWAWAY PROTOTYPE — connector grouping-model spike (2026-06-03).
 *
 * Lets us flip the chord-connector render between three grouping models live
 * on the real fretboard so we can pick a direction before committing to a
 * design. Delete this file (and the ConnectorModeDevProbe + the
 * regionPath/spinePath branches it drives) once the grouping model is chosen.
 *
 *   tube      — current: open rounded band, drawn as its two boundary edges.
 *   ribbon    — soft translucent band + a single solid center line.
 *   edge-line — tube boundary edges + a solid center line (A* — keeps the
 *               edge definition that anchors against CAGED shading).
 *   hybrid    — closed enclosing region for grouping + faint dotted spine.
 *
 * All center lines / spines render in the "below" pass so the note markers
 * occlude them (lines never paint over the note circles).
 */
import { atomWithStorage } from "jotai/utils";
import { k, createStorage, enumValidator, GET_ON_INIT } from "../utils/storage";

export const CONNECTOR_RENDER_MODES = ["tube", "ribbon", "edge-line", "hybrid"] as const;
export type ConnectorRenderMode = (typeof CONNECTOR_RENDER_MODES)[number];

const connectorRenderModeStorage = createStorage<ConnectorRenderMode>({
  validate: enumValidator(CONNECTOR_RENDER_MODES),
});

export const connectorRenderModeAtom = atomWithStorage<ConnectorRenderMode>(
  k("connectorRenderMode"),
  "tube",
  connectorRenderModeStorage,
  GET_ON_INIT,
);
