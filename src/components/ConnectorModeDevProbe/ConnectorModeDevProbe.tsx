/**
 * THROWAWAY PROTOTYPE — overlay-redesign spike (2026-06-03).
 *
 * Dev-only floating panel (bottom-left) with two pills:
 *   1. chord-connector render mode (tube / ribbon / edge-line / hybrid)
 *   2. note marker system (current / tiered)
 * Lets us compare directions live on the real fretboard before committing.
 * Mounted in App.tsx behind `import.meta.env.DEV`. Delete this folder + the
 * connectorPrototypeAtoms + markerPrototypeAtoms + the render branches they
 * drive once the directions are chosen.
 */
import { useAtom } from "jotai";
import {
  CONNECTOR_RENDER_MODES,
  connectorRenderModeAtom,
  type ConnectorRenderMode,
} from "../../store/connectorPrototypeAtoms";
import {
  MARKER_SYSTEMS,
  markerSystemAtom,
  type MarkerSystem,
} from "../../store/markerPrototypeAtoms";

const CONNECTOR_LABEL: Record<ConnectorRenderMode, string> = {
  tube: "A · Tube edges (current)",
  ribbon: "A′ · Ribbon (band + center line)",
  "edge-line": "A* · Tube edges + center line",
  hybrid: "C · Hybrid (region + spine)",
};

const MARKER_LABEL: Record<MarkerSystem, string> = {
  current: "Current (squircle/circle/hex)",
  tiered: "Tiered (shape=tier, size=salience)",
};

const PILL: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(20,20,28,0.82)",
  color: "#e8e8f0",
  font: "600 12px ui-monospace, SFMono-Regular, Menlo, monospace",
  cursor: "pointer",
  backdropFilter: "blur(6px)",
  boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
  textAlign: "left",
};

export function ConnectorModeDevProbe() {
  const [connector, setConnector] = useAtom(connectorRenderModeAtom);
  const [marker, setMarker] = useAtom(markerSystemAtom);

  const cycleConnector = () => {
    const i = CONNECTOR_RENDER_MODES.indexOf(connector);
    setConnector(CONNECTOR_RENDER_MODES[(i + 1) % CONNECTOR_RENDER_MODES.length]!);
  };
  const cycleMarker = () => {
    const i = MARKER_SYSTEMS.indexOf(marker);
    setMarker(MARKER_SYSTEMS[(i + 1) % MARKER_SYSTEMS.length]!);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-start",
      }}
    >
      <button type="button" onClick={cycleConnector} title="Cycle chord-connector grouping model (prototype)" style={PILL}>
        connector: {CONNECTOR_LABEL[connector]} ↻
      </button>
      <button type="button" onClick={cycleMarker} title="Toggle note marker system (prototype)" style={PILL}>
        markers: {MARKER_LABEL[marker]} ↻
      </button>
    </div>
  );
}
