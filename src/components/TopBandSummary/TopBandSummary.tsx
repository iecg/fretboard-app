import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from "@fretflow/core";
import { showChordPracticeBarAtom } from "../../store/practiceLensAtoms";
import { useScaleState } from "../../hooks/useScaleState";
import { usePracticeBarState } from "../../hooks/usePracticeBarState";
import { DegreeChipStrip } from "../DegreeChipStrip/DegreeChipStrip";
import { ChordPracticeBar } from "../ChordPracticeBar/ChordPracticeBar";
import { abbreviateMusicName } from "../../utils/abbreviateMusicName";
import shared from "../shared/shared.module.css";
import styles from "./TopBandSummary.module.css";

/**
 * The lens content — a single horizontal row: the scale section (label +
 * degree pills), a hairline divider, then the chord section (label + tone
 * pills). Rendered inside the inline FretboardLensStrip (Always-On DAW
 * Phase C).
 */
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

  // The strip shows terse names — drop parentheticals like "(Ionian)" and
  // abbreviate long words ("Major" -> "Maj") so the inline labels stay compact.
  const stripScaleName = abbreviateMusicName(
    scaleLabel.replace(/\s*\([^)]*\)/g, "").trim(),
  );
  const stripChordTitle = abbreviateMusicName(practiceBarTitle);

  return (
    <div className={styles["top-band-summary"]} data-testid="top-band-summary">
      <DegreeChipStrip
        scaleName={stripScaleName}
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
                ? <Eye size={14} aria-hidden="true" />
                : <EyeOff size={14} aria-hidden="true" />}
            </span>
          </button>
        }
      />
      <AnimatePresence initial={false}>
        {showChordBar && (
          <motion.div
            key="chord-section"
            className={styles["chord-section"]}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
            data-testid="chord-practice-bar"
          >
            <ChordPracticeBar
              title={stripChordTitle}
              badge={practiceBarBadge}
              lensLabel={practiceBarLensLabel}
              chordGroup={chordGroup}
              landOnGroup={landOnGroup}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
