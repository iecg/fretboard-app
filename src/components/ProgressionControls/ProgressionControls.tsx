import { startTransition } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { getDegreeSequence } from "@fretflow/core";
import {
  PROGRESSION_PRESETS,
  BEATS_PER_BAR_OPTIONS,
  formatProgressionDurationLabel,
  type ProgressionStepDuration,
} from "../../progressions/progressionDomain";
import { useProgressionState } from "../../hooks/useProgressionState";
import { useScaleState } from "../../hooks/useScaleState";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { StepperControl } from "../StepperControl/StepperControl";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import shared from "../shared/shared.module.css";
import {
  CHORD_NONE_VALUE,
  CHORD_TYPE_DISPLAY_ORDER,
  CHORD_TYPE_SHORT_LABELS,
} from "../ChordOverlayControls/chordTypeOptions";
import { CUSTOM_PRESET_ID } from "../../store/atoms";
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
    beatsPerBar,
    setBeatsPerBar,
    currentProgressionPresetId,
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
            ...PROGRESSION_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
          ]}
          compact={compact}
        />
      </div>

      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Chords</span>
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
