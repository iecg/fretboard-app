import { memo, useLayoutEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAtomValue } from "jotai";
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from "@fretflow/core";
import { connectorRenderModeAtom, type ConnectorRenderMode } from "../../store/connectorPrototypeAtoms";
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
  /**
   * During playback the connector enters instantly (no fade-in) so it changes in
   * sync with the notes instead of trailing them by the fade duration. The exit
   * fade-out is kept so the outgoing voicing leaves gracefully.
   */
  playbackActive?: boolean;
}

const renderChordLayers = (
  chordPolylines: ChordConnectorVoicing[],
  pass: "below" | "above",
  mode: ConnectorRenderMode,
) => (
  <>
    {pass === "below" && chordPolylines.map((v) => renderChordPath(v, "halo", mode))}
    {pass === "below" && chordPolylines.map((v) => renderChordPath(v, "fill", mode))}
    {/* Center line / spine renders BELOW the notes so markers occlude it
        (lines never paint over the note circles). "tube" has no center line. */}
    {pass === "below" && mode !== "tube" &&
      chordPolylines.map((v) => renderChordPath(v, "spine", mode))}
    {/* Boundary edges render ABOVE. "ribbon" intentionally hides its edges. */}
    {pass === "above" && mode !== "ribbon" &&
      chordPolylines.map((v) => renderChordPath(v, "outline", mode))}
  </>
);

const renderStaticChordConnectorGroup = (
  chordPolylines: ChordConnectorVoicing[],
  connectorSource: "full-chord" | "generated",
  motionKey: string,
  pass: "below" | "above",
  mode: ConnectorRenderMode,
) => (
  <g
    key={motionKey}
    className={styles["chord-connectors"]}
    data-connector-source={connectorSource}
    data-connector-mode={mode}
    data-motion="none"
    data-render-path="static"
    aria-hidden="true"
    pointerEvents="none"
  >
    {renderChordLayers(chordPolylines, pass, mode)}
  </g>
);

const renderAnimatedChordConnectorGroup = (
  chordPolylines: ChordConnectorVoicing[],
  connectorSource: "full-chord" | "generated",
  motionKey: string,
  skipInitial: boolean,
  pass: "below" | "above",
  mode: ConnectorRenderMode,
) => (
  <motion.g
    key={motionKey}
    initial={skipInitial ? false : { opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
    className={styles["chord-connectors"]}
    data-connector-source={connectorSource}
    data-connector-mode={mode}
    data-motion="group"
    data-render-path="animated"
    data-enter={skipInitial ? "instant" : "fade"}
    aria-hidden="true"
    pointerEvents="none"
  >
    {renderChordLayers(chordPolylines, pass, mode)}
  </motion.g>
);

const renderChordPath = (
  v: ChordConnectorVoicing,
  layer: "halo" | "fill" | "outline" | "spine",
  mode: ConnectorRenderMode,
) => {
  let d: string;
  if (layer === "spine") {
    d = v.spinePath;
  } else if (mode === "tube" || mode === "ribbon" || mode === "edge-line") {
    // tube + ribbon + edge-line use the open-polyline band for halo/fill/outline.
    d = layer === "fill" ? v.paths.fill : v.paths.outline;
  } else {
    // region + hybrid both use the closed enclosing region for fill/outline.
    d = v.regionPath;
  }
  return (
    <path
      key={`${layer}-${v.voicingKey}`}
      className={layer === "halo" ? undefined : styles["chord-connector-path"]}
      d={d}
      data-layer={layer}
      data-caged-shape={v.shape}
      data-palette-index={v.paletteIndex + 1}
      data-fallback={v.isFallback ? "true" : undefined}
    />
  );
};

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
  playbackActive = false,
}: FretboardConnectorLayerProps) {
  const connectorRenderMode = useAtomValue(connectorRenderModeAtom);
  const [prevMode, setPrevMode] = useState(connectorMotionMode);
  // Skip the enter fade when first turning the group fades on (none → group) or
  // during playback (so the connector swaps in sync with the chord, not after).
  const skipInitial =
    (prevMode === "none" && connectorMotionMode === "group") || playbackActive;

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
            ? renderAnimatedChordConnectorGroup(chordPolylines, connectorSource, motionKey, skipInitial, pass, connectorRenderMode)
            : renderStaticChordConnectorGroup(chordPolylines, connectorSource, motionKey, pass, connectorRenderMode)
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
