import { memo, useLayoutEffect, useState } from "react";
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
  pass: "below" | "above";
}

const renderStaticChordConnectorGroup = (
  chordPolylines: ChordConnectorVoicing[],
  connectorSource: "full-chord" | "generated",
  motionKey: string,
  pass: "below" | "above",
) => (
  <g
    key={motionKey}
    className={styles["chord-connectors"]}
    data-connector-source={connectorSource}
    data-motion="none"
    data-render-path="static"
    aria-hidden="true"
    pointerEvents="none"
  >
    {pass === "below" && chordPolylines.map((v) => renderChordPath(v, "halo"))}
    {pass === "below" && chordPolylines.map((v) => renderChordPath(v, "fill"))}
    {pass === "above" && chordPolylines.map((v) => renderChordPath(v, "outline"))}
  </g>
);

const renderAnimatedChordConnectorGroup = (
  chordPolylines: ChordConnectorVoicing[],
  connectorSource: "full-chord" | "generated",
  motionKey: string,
  skipInitial: boolean,
  pass: "below" | "above",
) => (
  <motion.g
    key={motionKey}
    initial={skipInitial ? false : { opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
    className={styles["chord-connectors"]}
    data-connector-source={connectorSource}
    data-motion="group"
    data-render-path="animated"
    aria-hidden="true"
    pointerEvents="none"
  >
    {pass === "below" && chordPolylines.map((v) => renderChordPath(v, "halo"))}
    {pass === "below" && chordPolylines.map((v) => renderChordPath(v, "fill"))}
    {pass === "above" && chordPolylines.map((v) => renderChordPath(v, "outline"))}
  </motion.g>
);

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
    data-fallback={v.isFallback ? "true" : undefined}
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
  pass,
}: FretboardConnectorLayerProps) {
  const [prevMode, setPrevMode] = useState(connectorMotionMode);
  const skipInitial = prevMode === "none" && connectorMotionMode === "group";

  useLayoutEffect(() => {
    setPrevMode(connectorMotionMode);
  }, [connectorMotionMode]);

  const polylinesKey = chordPolylines.map((v) => v.voicingKey).sort().join(",");
  const motionKey = `chord-connectors-${pass}-${connectorSource}-${chordRoot}-${chordTones?.join("-") ?? "none"}-${polylinesKey}`;
  return (
    <g
      className={styles["fretboard-overlays"]}
      clipPath={clipPathUrl}
      aria-hidden="true"
      pointerEvents="none"
    >
      <AnimatePresence mode="sync">
        {showChordConnectors && chordPolylines.length > 0 && (
          connectorMotionMode === "group"
            ? renderAnimatedChordConnectorGroup(chordPolylines, connectorSource, motionKey, skipInitial, pass)
            : renderStaticChordConnectorGroup(chordPolylines, connectorSource, motionKey, pass)
        )}
      </AnimatePresence>
      {pass === "below" && intervalPolylines.length > 0 && (
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
