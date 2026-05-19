import { startTransition } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, CopyPlus, Plus, Trash2 } from "lucide-react";
import {
  BEATS_PER_BAR_OPTIONS,
  MIN_PROGRESSION_STEP_DURATION_VALUE,
  MAX_PROGRESSION_STEP_DURATION_VALUE,
  MIN_PROGRESSION_TEMPO_BPM,
  MAX_PROGRESSION_TEMPO_BPM,
  formatProgressionDurationLabel,
  getAvailableProgressionPresets,
} from "../../progressions/progressionDomain";
import { generateCommonProgressions } from "../../progressions/progressionGeneration";
import { useProgressionState } from "../../hooks/useProgressionState";
import { useScaleState } from "../../hooks/useScaleState";
import { useTranslation } from "../../hooks/useTranslation";
import type { ProgressionPresetCategory } from "../../progressions/progressionDomain";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { Switch } from "../Switch/Switch";
import { StepperControl } from "../StepperControl/StepperControl";
import { LabeledSelect, type LabeledSelectGroup } from "../LabeledSelect/LabeledSelect";
import { PropGrid, Prop, GroupHeader } from "../Inspector/InspectorGrid";
import { DegreeSelect } from "../shared/DegreeSelect";
import { ChordQualitySelect } from "../shared/ChordQualitySelect";
import { BackingTrackControls } from "./BackingTrackControls";
import shared from "../shared/shared.module.css";
import { CHORD_QUALITY_DIATONIC_VALUE } from "../shared/chordControlOptions";
import { CUSTOM_PRESET_ID } from "../../store/atoms";
import styles from "./ProgressionControls.module.css";

const CATEGORY_LABELS: Record<ProgressionPresetCategory, string> = {
  "pop-rock": "Pop / Rock",
  blues: "Blues",
  jazz: "Jazz",
  folk: "Folk / Country",
  modal: "Modal",
  minor: "Minor",
};

export function ProgressionControls() {
  const { t } = useTranslation();
  const { scaleName, rootNote } = useScaleState();
  const {
    progressionEnabled,
    setProgressionEnabled,
    progressionSteps,
    resolvedProgressionSteps,
    activeProgressionStepIndex,
    activeResolvedProgressionStep,
    loadProgressionPreset,
    loadProgressionSteps,
    setActiveProgressionStepIndex,
    addProgressionStep,
    duplicateProgressionStep,
    removeProgressionStep,
    moveProgressionStep,
    updateProgressionStepDegree,
    updateProgressionStepDuration,
    updateProgressionStepQuality,
    beatsPerBar,
    setBeatsPerBar,
    progressionTempoBpm,
    setProgressionTempoBpm,
    currentProgressionPresetId,
    totalProgressionBars,
  } = useProgressionState();

  const activeStep = progressionSteps[activeProgressionStepIndex] ?? null;
  const availablePresets = getAvailableProgressionPresets(scaleName);
  const groupedPresets = (Object.keys(CATEGORY_LABELS) as ProgressionPresetCategory[])
    .map((cat) => ({
      cat,
      label: CATEGORY_LABELS[cat],
      presets: availablePresets.filter((p) => p.category === cat),
    }))
    .filter((g) => g.presets.length > 0);
  const suggestedPresets = generateCommonProgressions(scaleName, rootNote);
  const presetGroups: LabeledSelectGroup[] = [
    {
      options: [
        {
          value: CUSTOM_PRESET_ID,
          label: "Custom",
          disabled: currentProgressionPresetId !== CUSTOM_PRESET_ID,
        },
      ],
    },
    ...groupedPresets.map((group) => ({
      groupLabel: group.label,
      options: group.presets.map((preset) => ({
        value: preset.id,
        label: preset.label,
      })),
    })),
    ...(suggestedPresets.length > 0
      ? [
          {
            groupLabel: `Suggested for ${scaleName}`,
            options: suggestedPresets.map((preset) => ({
              value: preset.id,
              label: preset.label,
            })),
          },
        ]
      : []),
  ];
  const handlePresetChange = (id: string) => {
    if (id === CUSTOM_PRESET_ID) return;
    const suggested = suggestedPresets.find((p) => p.id === id);
    if (suggested) {
      startTransition(() => loadProgressionSteps(suggested.steps));
      return;
    }
    startTransition(() => loadProgressionPreset(id));
  };
  const qualityValue = activeStep?.qualityOverride ?? CHORD_QUALITY_DIATONIC_VALUE;
  // totalProgressionBars is fractional (beats / beatsPerBar); round up to whole
  // bars for the read-only Length readout and clamp to a 1-bar minimum.
  const lengthLabel = formatProgressionDurationLabel({
    value: Math.ceil(Math.max(1, totalProgressionBars)),
    unit: "bar",
  });

  return (
    <PropGrid columns={6}>
      {/* ── METER ────────────────────────────────────────────────────────── */}
      {/* One uniform 6-column row: Mode · Beats/Bar · Tempo · Length · Preset. */}
      <GroupHeader>{t("inspector.groupMeter")}</GroupHeader>
      <Prop label={t("inspector.progressionMode")} span={1}>
        <Switch
          label="Progression mode"
          checked={progressionEnabled}
          onChange={setProgressionEnabled}
        />
      </Prop>
      <Prop label={t("inspector.meterBeats")} span={1}>
        <StepperControl
          label="Beats per bar"
          hideLabel
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
        />
      </Prop>
      <Prop label={t("inspector.meterTempo")} span={1}>
        <StepperControl
          label="Tempo"
          hideLabel
          value={progressionTempoBpm}
          min={MIN_PROGRESSION_TEMPO_BPM}
          max={MAX_PROGRESSION_TEMPO_BPM}
          step={5}
          formatValue={(bpm) => `${bpm} BPM`}
          onChange={setProgressionTempoBpm}
        />
      </Prop>
      <Prop label={t("inspector.meterLength")} span={1}>
        <span className={styles["length-readout"]}>{lengthLabel}</span>
      </Prop>
      <Prop label={t("inspector.meterPreset")} span={2}>
        <LabeledSelect
          label="Preset"
          hideLabel
          value={currentProgressionPresetId}
          groups={presetGroups}
          onChange={handlePresetChange}
        />
      </Prop>

      {/* ── CHORDS ───────────────────────────────────────────────────────── */}
      <GroupHeader
        right={
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
              onClick={() => activeStep && duplicateProgressionStep(activeStep.id)}
              disabled={!activeStep}
              aria-label="Duplicate chord"
            >
              <CopyPlus size={16} aria-hidden="true" />
              <span>Duplicate</span>
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
        }
      >
        {t("inspector.groupChords")}
      </GroupHeader>
      <Prop span={3}>
        <div className={styles["chords-cell"]}>
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
      </Prop>
      <Prop span={3}>
        {activeStep ? (
          <div className={styles["editor-cell"]}>
            <span className={styles["editor-selected"]}>
              Selected — {activeStep.degree} ·{" "}
              {activeResolvedProgressionStep?.resolvedChordLabel ?? "—"}
            </span>
            <div className={shared["control-section"]}>
              <span className={styles["field-label"]}>Degree</span>
              <DegreeSelect
                scaleName={scaleName}
                label="Progression degree"
                value={activeStep.degree}
                onChange={(degree) => updateProgressionStepDegree({ id: activeStep.id, degree })}
                activeDegree={activeStep.degree}
                qualityOverridden={qualityValue !== CHORD_QUALITY_DIATONIC_VALUE}
              />
            </div>
            <div className={shared["control-section"]}>
              <span className={styles["field-label"]}>Duration</span>
              <div className={styles["duration-row"]}>
                <StepperControl
                  label="Duration value"
                  hideLabel
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
                />
                <div className={styles["duration-unit"]}>
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
                  />
                </div>
              </div>
            </div>
            <div className={shared["control-section"]}>
              <span className={styles["field-label"]}>Quality</span>
              <ChordQualitySelect
                label="Chord quality"
                value={qualityValue === CHORD_QUALITY_DIATONIC_VALUE ? "" : qualityValue}
                onChange={(quality) =>
                  updateProgressionStepQuality({
                    id: activeStep.id,
                    qualityOverride: quality === qualityValue ? null : quality,
                  })
                }
              />
              <p className={shared["field-hint"]}>
                {activeResolvedProgressionStep?.qualityOverrideApplied
                  ? "Custom quality on a degree-derived root."
                  : "No quality selected uses the diatonic chord from the active scale."}
              </p>
            </div>
          </div>
        ) : (
          <p className={shared["field-hint"]}>Select a chord to edit its degree, duration, and quality.</p>
        )}
      </Prop>

      {/* ── BACKING TRACK ────────────────────────────────────────────────── */}
      <BackingTrackControls />
    </PropGrid>
  );
}
