import { useAtomValue, useSetAtom } from "jotai";
import {
  chordSourceIsProgressionAtom,
  activeResolvedProgressionStepAtom,
  progressionStepsAtom,
  duplicateProgressionStepAtom,
  removeProgressionStepAtom,
} from "../../store/atoms";
import { useChordState } from "../../hooks/useChordState";
import { useTranslation } from "../../hooks/useTranslation";
import { formatProgressionDurationLabel } from "../../progressions/progressionDomain";
import shared from "../shared/shared.module.css";
import styles from "./ChordSelectionCallout.module.css";

/**
 * Contextual readout above the Chord tab's ChordOverlayControls.
 * - Progression is the chord source -> shows the active progression step,
 *   with Duplicate/Remove actions.
 * - Otherwise -> shows the standalone chord overlay.
 * The cyan/orange accent is supplied by ChordTab via the --chord-accent vars.
 */
export function ChordSelectionCallout() {
  const { t } = useTranslation();
  const isProgressionSource = useAtomValue(chordSourceIsProgressionAtom);
  const activeStep = useAtomValue(activeResolvedProgressionStepAtom);
  const steps = useAtomValue(progressionStepsAtom);
  const duplicateStep = useSetAtom(duplicateProgressionStepAtom);
  const removeStep = useSetAtom(removeProgressionStepAtom);
  const { chordLabel, chordTones } = useChordState();

  if (isProgressionSource && activeStep) {
    return (
      <section className={styles.callout} data-callout-variant="progression">
        <span className={shared["section-label"]}>
          {t("inspector.chordCalloutProgressionTitle")}
        </span>
        <p className={styles.readout}>
          <span className={styles.degree}>{activeStep.label}</span>
          <span className={styles.chordName}>
            {activeStep.resolvedChordLabel ??
              t("inspector.chordCalloutUnavailable")}
          </span>
        </p>
        <p className={shared["field-hint"]}>
          {t("inspector.chordCalloutStep")} {activeStep.index + 1} / {steps.length}
          {" · "}
          {formatProgressionDurationLabel(activeStep.duration)}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            onClick={() => duplicateStep(activeStep.id)}
          >
            {t("inspector.chordCalloutDuplicate")}
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={() => removeStep(activeStep.id)}
            disabled={steps.length <= 1}
          >
            {t("inspector.chordCalloutRemove")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.callout} data-callout-variant="overlay">
      <span className={shared["section-label"]}>
        {t("inspector.chordCalloutOverlayTitle")}
      </span>
      <p className={styles.readout}>
        <span className={styles.chordName}>{chordLabel}</span>
      </p>
      <p className={shared["field-hint"]}>{chordTones.join(" · ")}</p>
    </section>
  );
}
