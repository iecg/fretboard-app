import { useAtomValue } from "jotai";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { showChordPracticeBarAtom } from "../../store/atoms";
import { useScaleState } from "../../hooks/useScaleState";
import { usePracticeBarState } from "../../hooks/usePracticeBarState";
import { useProgressionPlaybackLoop } from "../../hooks/useProgressionPlaybackLoop";
import { useProgressionState } from "../../hooks/useProgressionState";
import {
  findNextResolvableStepIndex,
  PROGRESSION_DURATION_LABELS,
} from "../../progressions/progressionDomain";
import { DegreeChipStrip } from "../DegreeChipStrip/DegreeChipStrip";
import { ChordPracticeBar } from "../ChordPracticeBar/ChordPracticeBar";
import shared from "../shared/shared.module.css";
import styles from "./TopBandSummary.module.css";

export function TopBandSummary() {
  useProgressionPlaybackLoop();

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
  const {
    progressionEnabled,
    activeProgressionStepIndex,
    activeResolvedProgressionStep,
    resolvedProgressionSteps,
    progressionPlaybackBlockedReason,
  } = useProgressionState();

  const colorNoteSet = colorNotes.length > 0 ? new Set<string>(colorNotes) : undefined;
  const nextProgressionStepIndex = findNextResolvableStepIndex(
    resolvedProgressionSteps,
    activeProgressionStepIndex,
    1,
    true,
  );
  const nextProgressionStep = nextProgressionStepIndex === null
    ? null
    : resolvedProgressionSteps[nextProgressionStepIndex] ?? null;
  const progressionPositionLabel = resolvedProgressionSteps.length === 0
    ? "No steps"
    : `Step ${activeProgressionStepIndex + 1} of ${resolvedProgressionSteps.length}`;
  const activeStepUnavailableReason = activeResolvedProgressionStep?.unavailable
    ? activeResolvedProgressionStep.unavailableReason
    : null;
  const progressionStatusNote = progressionPlaybackBlockedReason ?? activeStepUnavailableReason;

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
        {progressionEnabled && (
          <motion.div
            key="progression-status"
            className={styles["progression-section"]}
            initial={{ height: 0, overflow: "hidden", opacity: 0 }}
            animate={{ height: "auto", overflow: "visible", opacity: 1 }}
            exit={{ height: 0, overflow: "hidden", opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className={styles["progression-status"]} role="group" aria-label="Progression status">
              <span className={styles["progression-position"]}>
                {progressionPositionLabel}
              </span>
              <div className={styles["progression-status-grid"]}>
                <span className={styles["progression-status-label"]}>Current</span>
                <span className={styles["progression-status-value"]}>
                  {activeResolvedProgressionStep?.degree ?? "-"} · {activeResolvedProgressionStep?.resolvedChordLabel ?? "Unavailable"}
                </span>
                <span className={styles["progression-status-duration"]}>
                  {activeResolvedProgressionStep ? PROGRESSION_DURATION_LABELS[activeResolvedProgressionStep.duration] : ""}
                </span>
                <span className={styles["progression-status-label"]}>Next</span>
                <span className={styles["progression-status-value"]}>
                  {nextProgressionStep ? `${nextProgressionStep.degree} · ${nextProgressionStep.resolvedChordLabel ?? "Unavailable"}` : "End"}
                </span>
              </div>
              {progressionStatusNote ? (
                <span className={styles["progression-status-note"]}>{progressionStatusNote}</span>
              ) : null}
            </div>
          </motion.div>
        )}
        {showChordBar && (
          <motion.div
            key="chord-section"
            className={styles["chord-section"]}
            initial={{ height: 0, overflow: "hidden", opacity: 0 }}
            animate={{ height: "auto", overflow: "visible", opacity: 1 }}
            exit={{ height: 0, overflow: "hidden", opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
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
