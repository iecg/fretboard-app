import { useAtom } from "jotai";
import { usePracticeBarState } from "../../hooks/usePracticeBarState";
import { scaleDegreeColorsEnabledAtom } from "../../store/atoms";
import { ChordPracticeBar } from "../ChordPracticeBar/ChordPracticeBar";
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

  const [degreeColorsEnabled] = useAtom(scaleDegreeColorsEnabledAtom);

  if (!showChordPracticeBar) return null;

  return (
    <div className={styles["chord-overlay-dock"]}>
      <ChordPracticeBar
        title={practiceBarTitle}
        badge={practiceBarBadge}
        lensLabel={practiceBarLensLabel}
        chordGroup={chordGroup}
        landOnGroup={landOnGroup}
        degreeColorsEnabled={degreeColorsEnabled}
      />
    </div>
  );
}
