import { startTransition } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  BEATS_PER_BAR_OPTIONS,
  MIN_PROGRESSION_STEP_DURATION_VALUE,
  MAX_PROGRESSION_STEP_DURATION_VALUE,
  formatProgressionDurationLabel,
  getAvailableProgressionPresets,
} from "../../progressions/progressionDomain";
import { useProgressionState } from "../../hooks/useProgressionState";
import { useScaleState } from "../../hooks/useScaleState";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { Switch } from "../Switch/Switch";
import { StepperControl } from "../StepperControl/StepperControl";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import shared from "../shared/shared.module.css";
import { buildDegreeToggleOptions, buildQualityToggleOptions, CHORD_QUALITY_DIATONIC_VALUE } from "../shared/chordControlOptions";
import { CUSTOM_PRESET_ID } from "../../store/atoms";
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
    beatsPerBar,
    setBeatsPerBar,
    currentProgressionPresetId,
  } = useProgressionState();

  const activeStep = progressionSteps[activeProgressionStepIndex] ?? null;
  const availablePresets = getAvailableProgressionPresets(scaleName);
  const qualityValue = activeStep?.qualityOverride ?? CHORD_QUALITY_DIATONIC_VALUE;
  const degreeOptions = buildDegreeToggleOptions({
    scaleName,
    qualityOverridden: qualityValue !== CHORD_QUALITY_DIATONIC_VALUE,
    activeDegree: activeStep?.degree ?? null,
  });

  return (
    <div className={styles["progression-controls"]} data-compact={compact ? "true" : undefined}>
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Progression Mode</span>
        <Switch
          label="Progression mode"
          checked={progressionEnabled}
          onChange={setProgressionEnabled}
        />
      </div>

      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Meter</span>
        <StepperControl
          label="Beats per bar"
          value={beatsPerBar}
          min={BEATS_PER_BAR_OPTIONS[0]}
          max={BEATS_PER_BAR_OPTIONS[BEATS_PER_BAR_OPTIONS.length - 1]}
          step={1}
          onChange={(next) => {
            // Cycle through the allowed set directionally
            const current = beatsPerBar;
            const idx = BEATS_PER_BAR_OPTIONS.indexOf(current as 3 | 4 | 6 | 8);
            const dir = next > current ? 1 : -1;
            const nextIdx = Math.max(0, Math.min(BEATS_PER_BAR_OPTIONS.length - 1, idx + dir));
            setBeatsPerBar(BEATS_PER_BAR_OPTIONS[nextIdx]);
          }}
          compact={compact}
        />
      </div>

      <div className={shared["control-section"]}>
        <LabeledSelect
          label="Preset"
          value={currentProgressionPresetId}
          onChange={(id) => {
            if (id === CUSTOM_PRESET_ID) return;
            startTransition(() => loadProgressionPreset(id));
          }}
          options={[
            { value: CUSTOM_PRESET_ID, label: "Custom", disabled: currentProgressionPresetId !== CUSTOM_PRESET_ID },
            ...availablePresets.map((preset) => ({ value: preset.id, label: preset.label })),
          ]}
          compact={compact}
        />
      </div>

      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Chords</span>
        {resolvedProgressionSteps.length === 0 ? (
          <p className={shared["field-hint"]}>Add a chord or load a preset.</p>
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
                  <span className={styles["step-index"]}>{index + 1}</span>
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
        <button type="button" className={shared["control-button"]} onClick={() => addProgressionStep()} aria-label="Add chord">
          <Plus size={16} aria-hidden="true" />
          <span>Add</span>
        </button>
        <button
          type="button"
          className={shared["control-button"]}
          onClick={() => activeStep && moveProgressionStep({ id: activeStep.id, direction: -1 })}
          disabled={!activeStep || activeProgressionStepIndex === 0}
          aria-label="Move chord up"
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={shared["control-button"]}
          onClick={() => activeStep && moveProgressionStep({ id: activeStep.id, direction: 1 })}
          disabled={!activeStep || activeProgressionStepIndex === progressionSteps.length - 1}
          aria-label="Move chord down"
        >
          <ArrowDown size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={shared["control-button"]}
          onClick={() => activeStep && removeProgressionStep(activeStep.id)}
          disabled={!activeStep}
          aria-label="Remove chord"
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
            <div className={styles["duration-row"]}>
              <StepperControl
                label="Duration value"
                value={activeStep.duration.value}
                min={MIN_PROGRESSION_STEP_DURATION_VALUE}
                max={MAX_PROGRESSION_STEP_DURATION_VALUE}
                step={1}
                onChange={(next) =>
                  updateProgressionStepDuration({
                    id: activeStep.id,
                    duration: { ...activeStep.duration, value: next },
                  })
                }
                compact={compact}
              />
              <ToggleBar
                label="Duration unit"
                value={activeStep.duration.unit}
                options={[
                  { value: "beat", label: "Beat" },
                  { value: "bar", label: "Bar" },
                ]}
                onChange={(unit) =>
                  updateProgressionStepDuration({
                    id: activeStep.id,
                    duration: { ...activeStep.duration, unit: unit as "beat" | "bar" },
                  })
                }
                compact={compact}
              />
            </div>
          </div>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>Quality</span>
            <ToggleBar
              label="Chord quality"
              options={buildQualityToggleOptions({ diatonicLabel: "Diatonic" })}
              value={qualityValue}
              onChange={(quality) => updateProgressionStepQuality({
                id: activeStep.id,
                qualityOverride: quality === CHORD_QUALITY_DIATONIC_VALUE ? null : quality,
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
