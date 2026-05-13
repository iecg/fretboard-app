import { useAtomValue } from "jotai";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from "@fretflow/core";
import { showChordPracticeBarAtom } from "../../store/atoms";
import { useScaleState } from "../../hooks/useScaleState";
import { usePracticeBarState } from "../../hooks/usePracticeBarState";
import { DegreeChipStrip } from "../DegreeChipStrip/DegreeChipStrip";
import { ChordPracticeBar } from "../ChordPracticeBar/ChordPracticeBar";
import shared from "../shared/shared.module.css";
import styles from "./TopBandSummary.module.css";

export function TopBandSummary() {
  const {
    scaleLabel,
    hiddenNotes,
    toggleHiddenNote,
    degreeChips,
    colorNotes,
    scaleVisible,
    toggleScaleVisible,
  } = useScaleState();

  const showChordBar = useAtomValue(showChordPracticeBarAtom);
  const {
    practiceBarTitle,
    practiceBarBadge,
    practiceBarLensLabel,
    chordGroup,
    landOnGroup,
  } = usePracticeBarState();

  const colorNoteSet = colorNotes.length > 0 ? new Set<string>(colorNotes) : undefined;

  return (
    <MotionConfig reducedMotion="user">
    <div className={styles["top-band-summary"]} data-testid="top-band-summary">
      <DegreeChipStrip
        scaleName={scaleLabel}
        chips={degreeChips}
        hiddenNotes={scaleVisible ? hiddenNotes : undefined}
        onChipToggle={scaleVisible ? toggleHiddenNote : undefined}
        colorNotes={colorNoteSet}
        visible={scaleVisible}
        aria-label="Scale degrees"
        headerAction={
          <button
            type="button"
            className={shared["eye-toggle"]}
            aria-label={scaleVisible ? "Hide scale" : "Show scale"}
            aria-pressed={!scaleVisible}
            onClick={toggleScaleVisible}
          >
            <span className={shared["flex-center"]}>
              {scaleVisible
                ? <Eye size={18} aria-hidden="true" />
                : <EyeOff size={18} aria-hidden="true" />}
            </span>
          </button>
        }
      />
      <AnimatePresence initial={false}>
        {showChordBar && (
          <motion.div
            key="chord-section"
            className={styles["chord-section"]}
            initial={{ height: 0, overflow: "hidden", opacity: 0 }}
            animate={{ height: "auto", overflow: "visible", opacity: 1 }}
            exit={{ height: 0, overflow: "hidden", opacity: 0 }}
            transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
          >
            <ChordPracticeBar
              title={practiceBarTitle}
              badge={practiceBarBadge}
              lensLabel={practiceBarLensLabel}
              chordGroup={chordGroup}
              landOnGroup={landOnGroup}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
