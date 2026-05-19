import useLayoutMode from "../../hooks/useLayoutMode";
import { TopBandSummary } from "../TopBandSummary/TopBandSummary";
import styles from "./FretboardLensOverlay.module.css";

/**
 * The scale/chord lens, rendered as a slim inline strip at the top of the
 * fretboard container, above the SVG (Always-On DAW Phase C). It reads "like a
 * quiet legend, not a popover" — no absolute positioning, no backdrop blur.
 *
 * Always rendered (Phase B): the lens is visible regardless of the active
 * Inspector tab. It keeps the layout-attribute wiring so the strip can adapt
 * its wrap behavior per tier (mobile especially).
 */
export function FretboardLensOverlay() {
  const layout = useLayoutMode();
  return (
    <div
      className={styles.strip}
      data-layout-tier={layout.tier}
      data-layout-variant={layout.variant}
      data-testid="fretboard-lens-overlay"
    >
      <TopBandSummary />
    </div>
  );
}
