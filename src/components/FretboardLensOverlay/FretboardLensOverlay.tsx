import { useAtomValue } from "jotai";
import { progressionEnabledAtom } from "../../store/atoms";
import useLayoutMode from "../../hooks/useLayoutMode";
import { TopBandSummary } from "../TopBandSummary/TopBandSummary";
import styles from "./FretboardLensOverlay.module.css";

/**
 * The scale-mode lens, rendered as a panel that floats over the top of the
 * fretboard (DAW Shell Phase 13a). On the desktop and tablet tiers the panel
 * is absolutely positioned within `.main-fretboard`; on the mobile tier it
 * falls back to a static stacked placement so it never occludes the board.
 *
 * Renders nothing in progression mode — the progression DAW track is rendered
 * by `ProgressionSummarySlot` in the stacked summary band instead. This mirrors
 * the behavior `TopBandSummary` had before Phase 13: visible whenever the app
 * is in scale mode, regardless of the active Inspector tab.
 */
export function FretboardLensOverlay() {
  const progressionEnabled = useAtomValue(progressionEnabledAtom);
  const layout = useLayoutMode();
  if (progressionEnabled) return null;
  return (
    <div
      className={styles.overlay}
      data-layout-tier={layout.tier}
      data-layout-variant={layout.variant}
      data-testid="fretboard-lens-overlay"
    >
      <TopBandSummary />
    </div>
  );
}
