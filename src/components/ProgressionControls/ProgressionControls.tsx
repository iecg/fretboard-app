import { startTransition } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { getDegreeSequence } from "@fretflow/core";
import {
  PROGRESSION_PRESETS,
  formatProgressionDurationLabel,
  type ProgressionStepDuration,
} from "../../progressions/progressionDomain";
import { useProgressionState } from "../../hooks/useProgressionState";
import { useScaleState } from "../../hooks/useScaleState";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import shared from "../shared/shared.module.css";
import {
  CHORD_NONE_VALUE,
  CHORD_TYPE_DISPLAY_ORDER,
  CHORD_TYPE_SHORT_LABELS,
} from "../ChordOverlayControls/chordTypeOptions";
import { ProgressionPlaybackBar } from "../ProgressionPlaybackBar/ProgressionPlaybackBar";
import styles from "./ProgressionControls.module.css";

export interface ProgressionControlsProps {
  compact?: boolean;
}

export function ProgressionControls({ compact = false }: ProgressionControlsProps) {
  const { scaleName } = useScaleState();
  const {
    progressionEnabled,
    setProgressionEnabled,
    progressionSteps,
    resolvedProgressionSteps,
    activeProgressionStepIndex,
    activeResolvedProgressionStep,
    loadProgressionPreset,
    setActiveProgressionStepIndex,
    addProgressionStep,
    removeProgressionStep,
    moveProgressionStep,
    updateProgressionStepDegree,
    updateProgressionStepDuration,
    updateProgressionStepQuality,
  } = useProgressionState();

  const activeStep = progressionSteps[activeProgressionStepIndex] ?? null;
  const degreeOptions = getDegreeSequence(scaleName).map((degree) => ({
    value: degree,
    label: degree,
  }));
  const qualityValue = activeStep?.qualityOverride ?? CHORD_NONE_VALUE;

  return (
    <div className={styles["progression-controls"]} data-compact={compact ? "true" : undefined}>
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Progression Mode</span>
        <ToggleBar
          label="Progression mode"
          value={progressionEnabled ? "on" : "off"}
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
          onChange={(value) => setProgressionEnabled(value === "on")}
          compact={compact}
        />
      </div>

      <ProgressionPlaybackBar />

      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Presets</span>
        <div className={styles["preset-row"]}>
          {PROGRESSION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={shared["control-button"]}
              onClick={() => startTransition(() => loadProgressionPreset(preset.id))}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Steps</span>
        {resolvedProgressionSteps.length === 0 ? (
          <p className={shared["field-hint"]}>Add a step or load a preset.</p>
        ) : (
          <ol className={styles["step-list"]}>
            {resolvedProgressionSteps.map((step, index) => (
              <li key={step.id}>
                <button
                  type="button"
                  className={clsx(styles["step-row"], index === activeProgressionStepIndex && styles["step-row--active"])}
                  data-unavailable={step.unavailable ? "true" : undefined}
                  onClick={() => setActiveProgressionStepIndex(index)}
                >
                  <span className={styles["step-index"]}>Step {index + 1}</span>
                  <span className={styles["step-degree"]}>{step.degree}</span>
                  <span className={styles["step-chord"]}>
                    {step.resolvedChordLabel ?? step.unavailableReason}
                  </span>
                  <span className={styles["step-duration"]}>
                    {formatProgressionDurationLabel(step.duration)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className={styles["step-actions"]}>
        <button type="button" className={shared["control-button"]} onClick={() => addProgressionStep()} aria-label="Add step">
          <Plus size={16} aria-hidden="true" />
          <span>Add</span>
        </button>
        <button
          type="button"
          className={shared["control-button"]}
          onClick={() => activeStep && moveProgressionStep({ id: activeStep.id, direction: -1 })}
          disabled={!activeStep || activeProgressionStepIndex === 0}
          aria-label="Move step up"
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={shared["control-button"]}
          onClick={() => activeStep && moveProgressionStep({ id: activeStep.id, direction: 1 })}
          disabled={!activeStep || activeProgressionStepIndex === progressionSteps.length - 1}
          aria-label="Move step down"
        >
          <ArrowDown size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={shared["control-button"]}
          onClick={() => activeStep && removeProgressionStep(activeStep.id)}
          disabled={!activeStep}
          aria-label="Remove step"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      {activeStep ? (
        <>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>Degree</span>
            <ToggleBar
              label="Progression degree"
              options={degreeOptions}
              value={activeStep.degree}
              onChange={(degree) => updateProgressionStepDegree({ id: activeStep.id, degree })}
              compact={compact}
              overflow="scroll"
            />
          </div>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>Duration</span>
            <ToggleBar
              label="Step duration"
              options={[
                { value: "1-beat", label: "1 beat" },
                { value: "2-beats", label: "2 beats" },
                { value: "1-bar", label: "1 bar" },
                { value: "2-bars", label: "2 bars" },
              ]}
              value={
                activeStep.duration.value === 1 && activeStep.duration.unit === "beat" ? "1-beat"
                : activeStep.duration.value === 2 && activeStep.duration.unit === "beat" ? "2-beats"
                : activeStep.duration.value === 1 && activeStep.duration.unit === "bar" ? "1-bar"
                : "2-bars"
              }
              onChange={(s) => {
                const duration: ProgressionStepDuration =
                  s === "1-beat" ? { value: 1, unit: "beat" }
                  : s === "2-beats" ? { value: 2, unit: "beat" }
                  : s === "1-bar" ? { value: 1, unit: "bar" }
                  : { value: 2, unit: "bar" };
                updateProgressionStepDuration({ id: activeStep.id, duration });
              }}
              compact={compact}
            />
          </div>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>Quality</span>
            <ToggleBar
              label="Step chord quality"
              options={[
                { value: CHORD_NONE_VALUE, label: "Diatonic" },
                ...CHORD_TYPE_DISPLAY_ORDER.map((quality) => ({
                  value: quality,
                  label: CHORD_TYPE_SHORT_LABELS[quality] ?? quality,
                })),
              ]}
              value={qualityValue}
              onChange={(quality) => updateProgressionStepQuality({
                id: activeStep.id,
                qualityOverride: quality === CHORD_NONE_VALUE ? null : quality,
              })}
              compact={compact}
              overflow="scroll"
            />
            <p className={shared["field-hint"]}>
              {activeResolvedProgressionStep?.qualityOverrideApplied
                ? "Custom quality on a degree-derived root."
                : "Diatonic uses the chord quality from the active scale."}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
