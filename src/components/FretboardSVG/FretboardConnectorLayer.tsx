import { memo } from "react";
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
  showChordConnectors: boolean;
  connectorMotionMode: FretboardMotionPolicy["connectorMode"];
  clipPathUrl: string;
}

const renderChordPath = (
  v: ChordConnectorVoicing,
  layer: "halo" | "fill" | "outline",
) => (
  <path
    key={`${layer}-${v.voicingKey}`}
    className={layer === "halo" ? undefined : styles["chord-connector-path"]}
    d={layer === "fill" ? v.paths.fill : v.paths.outline}
    data-layer={layer}
    data-caged-shape={v.shape}
    data-palette-index={v.paletteIndex + 1}
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
  showChordConnectors,
  connectorMotionMode,
  clipPathUrl,
}: FretboardConnectorLayerProps) {
  const motionKey = `chord-connectors-${connectorSource}-${chordRoot}-${chordTones?.join("-") ?? "none"}`;
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
              {chordPolylines.map((v) => renderChordPath(v, "halo"))}
              {chordPolylines.map((v) => renderChordPath(v, "fill"))}
              {chordPolylines.map((v) => renderChordPath(v, "outline"))}
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
              {chordPolylines.map((v) => renderChordPath(v, "halo"))}
              {chordPolylines.map((v) => renderChordPath(v, "fill"))}
              {chordPolylines.map((v) => renderChordPath(v, "outline"))}
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
