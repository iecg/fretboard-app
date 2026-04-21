import { usePracticeBarState } from "../hooks/usePracticeBarState";
import { ChordPracticeBar } from "./ChordPracticeBar";
import styles from "./ChordOverlayDock.module.css";

/** Independent chord practice dock — shows coaching cues for the active lens. */
export function ChordOverlayDock() {
  const {
    showChordPracticeBar,
    practiceBarTitle,
    practiceBarBadge,
    practiceBarLensLabel,
    chordGroup,
    landOnGroup,
  } = usePracticeBarState();

  if (!showChordPracticeBar) return null;

  return (
    <div className={styles["chord-overlay-dock"]}>
      <ChordPracticeBar
        title={practiceBarTitle}
        badge={practiceBarBadge}
        lensLabel={practiceBarLensLabel}
        chordGroup={chordGroup}
        landOnGroup={landOnGroup}
      />
    </div>
  );
}
