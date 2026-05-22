import { memo } from "react";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from "@fretflow/core";
import type { ChordConnectorVoicing } from "./hooks/useChordConnectorPolylines";
import type { IntervalConnectorPolyline } from "./hooks/useIntervalConnectorPolylines";
import type { FretboardMotionPolicy } from "./motionPolicy";
import styles from "./FretboardSVG.module.css";

interface FretboardConnectorLayerProps {
  chordPolylines: ChordConnectorVoicing[];
  intervalPolylines: IntervalConnectorPolyline[];
  connectorSource: "full-chord" | "generated";
  chordRoot?: string;
  chordTones: string[];
  /**
   * Identifier of the user-selected Close voicing. When non-null, the polyline
   * whose `voicingKey` matches renders as primary (full opacity) and the rest
   * render as secondary candidates (dimmed). When null, every polyline
   * renders as primary — used for Full voicing mode and single-polyline cases
   * where there is nothing to disambiguate.
   */
  selectedVoicingKey?: string | null;
  showChordConnectors: boolean;
  connectorMotionMode: FretboardMotionPolicy["connectorMode"];
  clipPathUrl: string;
}

const renderChordPath = (
  v: ChordConnectorVoicing,
  layer: "halo" | "fill" | "outline",
  isPrimary: boolean,
) => (
  <path
    key={`${layer}-${v.voicingKey}`}
    className={clsx(
      layer !== "halo" && styles["chord-connector-path"],
      isPrimary
        ? styles["chord-connector--primary"]
        : styles["chord-connector--secondary"],
    )}
    d={layer === "fill" ? v.paths.fill : v.paths.outline}
    data-layer={layer}
    data-caged-shape={v.shape}
    data-palette-index={v.paletteIndex + 1}
    data-voicing-role={isPrimary ? "primary" : "secondary"}
  />
);

const renderIntervalPath = (
  l: IntervalConnectorPolyline,
  layer: "halo" | "fill" | "outline",
) => (
  <path
    key={`iv-${layer}-${l.key}`}
    d={layer === "fill" ? l.paths.fill : l.paths.outline}
    data-layer={layer}
    data-palette-index={l.paletteIndex}
  />
);

export const FretboardConnectorLayer = memo(function FretboardConnectorLayer({
  chordPolylines,
  intervalPolylines,
  connectorSource,
  chordRoot,
  chordTones,
  selectedVoicingKey = null,
  showChordConnectors,
  connectorMotionMode,
  clipPathUrl,
}: FretboardConnectorLayerProps) {
  const motionKey = `chord-connectors-${connectorSource}-${chordRoot}-${chordTones?.join("-") ?? "none"}`;
  // When no selection is supplied (null), every polyline is treated as primary
  // — this covers the Full voicing branch (single rendered match per polygon)
  // and any case where dimming would be misleading. When a selection IS
  // supplied but matches none of the rendered polylines, the comparison falls
  // through and every polyline gets the secondary role; that's acceptable
  // because in practice `selectedCloseVoicingAtom` always resolves to one of
  // the current candidates (falls back to candidates[0] when stale).
  const isPrimary = (v: ChordConnectorVoicing): boolean =>
    selectedVoicingKey === null || v.voicingKey === selectedVoicingKey;
  return (
    <g
      className={styles["fretboard-overlays"]}
      clipPath={clipPathUrl}
      aria-hidden="true"
      pointerEvents="none"
    >
      <AnimatePresence mode="wait">
        {showChordConnectors && chordPolylines.length > 0 && (
          connectorMotionMode === "group" ? (
            <motion.g
              key={motionKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
              className={styles["chord-connectors"]}
              data-connector-source={connectorSource}
              data-motion="group"
              aria-hidden="true"
              pointerEvents="none"
            >
              {chordPolylines.map((v) => renderChordPath(v, "halo", isPrimary(v)))}
              {chordPolylines.map((v) => renderChordPath(v, "fill", isPrimary(v)))}
              {chordPolylines.map((v) => renderChordPath(v, "outline", isPrimary(v)))}
            </motion.g>
          ) : (
            <g
              key={motionKey}
              className={styles["chord-connectors"]}
              data-connector-source={connectorSource}
              data-motion="none"
              aria-hidden="true"
              pointerEvents="none"
            >
              {chordPolylines.map((v) => renderChordPath(v, "halo", isPrimary(v)))}
              {chordPolylines.map((v) => renderChordPath(v, "fill", isPrimary(v)))}
              {chordPolylines.map((v) => renderChordPath(v, "outline", isPrimary(v)))}
            </g>
          )
        )}
      </AnimatePresence>
      {intervalPolylines.length > 0 && (
        <g
          className={styles["interval-connectors"]}
          aria-hidden="true"
          pointerEvents="none"
        >
          {intervalPolylines.map((l) => renderIntervalPath(l, "halo"))}
          {intervalPolylines.map((l) => renderIntervalPath(l, "fill"))}
          {intervalPolylines.map((l) => renderIntervalPath(l, "outline"))}
        </g>
      )}
    </g>
  );
});
