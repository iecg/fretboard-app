import { usePracticeBarState } from "../../hooks/usePracticeBarState";
import { ChordPracticeBar } from "../ChordPracticeBar/ChordPracticeBar";
import styles from "./ChordOverlayDock.module.css";

/** Independent chord practice dock — shows coaching cues for the active lens. */
export function ChordOverlayDock() {
  const {
    practiceBarTitle,
    practiceBarBadge,
    practiceBarLensLabel,
    chordGroup,
    landOnGroup,
  } = usePracticeBarState();

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
