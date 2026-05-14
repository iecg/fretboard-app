import { useAtomValue } from "jotai";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from "@fretflow/core";
import { showChordPracticeBarAtom } from "../../store/atoms";
import { useScaleState } from "../../hooks/useScaleState";
import { usePracticeBarState } from "../../hooks/usePracticeBarState";
import { useProgressionPlaybackLoop } from "../../hooks/useProgressionPlaybackLoop";
import { useProgressionState } from "../../hooks/useProgressionState";
import {
  findNextResolvableStepIndex,
  formatProgressionDurationLabel,
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
    totalProgressionBars,
    currentProgressionBar,
    setProgressionEnabled,
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
  const totalBars = Math.max(1, Math.round(totalProgressionBars));
  const positionLabel = resolvedProgressionSteps.length === 0
    ? "No chords"
    : `Bar ${currentProgressionBar} of ${totalBars}`;
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
            <div className={styles["progression-status"]} role="group" aria-label="Progression status" data-testid="progression-status">
              <div className={styles["progression-status-header"]}>
                <button
                  type="button"
                  className={shared["eye-toggle"]}
                  aria-label={progressionEnabled ? "Hide progression" : "Show progression"}
                  aria-pressed={!progressionEnabled}
                  onClick={() => setProgressionEnabled(!progressionEnabled)}
                >
                  <span className={shared["flex-center"]}>
                    {progressionEnabled
                      ? <Eye size={18} aria-hidden="true" />
                      : <EyeOff size={18} aria-hidden="true" />}
                  </span>
                </button>
                <span className={styles["progression-title"]}>Progression</span>
                <span className={styles["progression-position"]}>{positionLabel}</span>
              </div>
              <div
                className={styles["progression-status-row"]}
                data-progression-status-row
              >
                <span className={styles["progression-status-cell"]}>
                  <span className={styles["progression-status-label"]}>Current</span>
                  <span className={styles["progression-status-value"]}>
                    {activeResolvedProgressionStep
                      ? `${activeResolvedProgressionStep.degree} · ${activeResolvedProgressionStep.resolvedChordLabel ?? "Unavailable"}`
                      : "—"}
                    {activeResolvedProgressionStep ? (
                      <span className={styles["progression-status-meta"]}>
                        {" "}({formatProgressionDurationLabel(activeResolvedProgressionStep.duration)})
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className={styles["progression-status-cell"]}>
                  <span className={styles["progression-status-label"]}>Next</span>
                  <span className={styles["progression-status-value"]}>
                    {nextProgressionStep
                      ? `${nextProgressionStep.degree} · ${nextProgressionStep.resolvedChordLabel ?? "Unavailable"}`
                      : "End"}
                  </span>
                </span>
              </div>
              {progressionStatusNote ? (
                <span className={styles["progression-status-note"]}>{progressionStatusNote}</span>
              ) : null}
            </div>
          </motion.div>
        )}
        {!progressionEnabled && showChordBar && (
          <motion.div
            key="chord-section"
            className={styles["chord-section"]}
            initial={{ height: 0, overflow: "hidden", opacity: 0 }}
            animate={{ height: "auto", overflow: "visible", opacity: 1 }}
            exit={{ height: 0, overflow: "hidden", opacity: 0 }}
            transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
            data-testid="chord-practice-bar"
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
