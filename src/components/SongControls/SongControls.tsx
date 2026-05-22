import { startTransition, useMemo } from "react";
import clsx from "clsx";
import { useSetAtom } from "jotai";
import { ArrowDown, ArrowUp, CopyPlus, Plus, Trash2 } from "lucide-react";
import { SCALE_FAMILIES, NOTES, getNoteDisplay, type ScaleFamily, type ScaleFamilyId } from "@fretflow/core";
import {
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
import { StepperControl } from "../StepperControl/StepperControl";
import { LabeledSelect, type LabeledSelectGroup } from "../LabeledSelect/LabeledSelect";
import { PropGrid, Prop, GroupHeader } from "../Inspector/InspectorGrid";
import { DegreeGrid } from "../shared/DegreeGrid";
import { TimeSignaturePicker } from "../shared/TimeSignaturePicker";
import { BackingTrackControls } from "./BackingTrackControls";
import { buildQualitySelectGroups } from "./qualityGroups";
import shared from "../shared/shared.module.css";
import { CUSTOM_PRESET_ID, updateProgressionStepRootAtom } from "../../store/progressionAtoms";
import styles from "./SongControls.module.css";

// Look up a scale family by id; fail loudly at module init if the catalog id
// drifts. Prevents silent empty optgroups if `theoryCatalog.ts` is renamed.
function requireFamily(id: ScaleFamilyId): ScaleFamily {
  const family = SCALE_FAMILIES.find((f) => f.id === id);
  if (!family) {
    throw new Error(`theoryCatalog: scale family '${id}' not found`);
  }
  return family;
}

const majorFamily = requireFamily("major");
const pentatonicFamily = requireFamily("pentatonic");
const bluesFamily = requireFamily("blues");
const harmonicMinorFamily = requireFamily("harmonic-minor");
const melodicMinorFamily = requireFamily("melodic-minor");

function familyOptions(family: ScaleFamily) {
  return family.members.map((m) => ({
    value: m.scaleName,
    label: m.displayLabel,
  }));
}

const CATEGORY_LABELS: Record<ProgressionPresetCategory, string> = {
  "pop-rock": "Pop / Rock",
  blues: "Blues",
  jazz: "Jazz",
  folk: "Folk / Country",
  modal: "Modal",
  minor: "Minor",
};

export function SongControls() {
  const { t } = useTranslation();
  const {
    scaleName,
    rootNote,
    setRootNote,
    setScaleName,
    preferFlats,
  } = useScaleState();

  const handleRootNote = (note: string) => {
    startTransition(() => {
      setRootNote(note);
    });
  };

  const handleScaleName = (name: string) => {
    startTransition(() => {
      setScaleName(name);
    });
  };

  const scaleGroups: LabeledSelectGroup[] = useMemo(
    () => [
      { groupLabel: t("inspector.scaleGroupMajorModes"), options: familyOptions(majorFamily) },
      { groupLabel: t("inspector.scaleGroupPentatonics"), options: familyOptions(pentatonicFamily) },
      { groupLabel: t("inspector.scaleGroupBlues"), options: familyOptions(bluesFamily) },
      {
        groupLabel: t("inspector.scaleGroupHarmonicMelodic"),
        options: [
          ...familyOptions(harmonicMinorFamily),
          ...familyOptions(melodicMinorFamily),
        ],
      },
    ],
    [t],
  );

  const qualityGroups: LabeledSelectGroup[] = useMemo(
    () =>
      buildQualitySelectGroups({
        triads: t("controls.qualityGroupTriads"),
        sus: t("controls.qualityGroupSus"),
        sixths: t("controls.qualityGroupSixths"),
        sevenths: t("controls.qualityGroupSevenths"),
      }),
    [t],
  );

  const {
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
    progressionTempoBpm,
    setProgressionTempoBpm,
    currentProgressionPresetId,
  } = useProgressionState();

  const updateProgressionStepRoot = useSetAtom(updateProgressionStepRootAtom);

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
    // Show "Custom" only when it's the current value — the option is not
    // user-selectable; it just reflects an edited (non-preset) progression.
    ...(currentProgressionPresetId === CUSTOM_PRESET_ID
      ? [{ options: [{ value: CUSTOM_PRESET_ID, label: "Custom" }] }]
      : []),
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
  return (
    <PropGrid columns={6}>
      {/* ── KEY ──────────────────────────────────────────────────────────── */}
      <GroupHeader>
        {t("inspector.groupKey")}
      </GroupHeader>
      <Prop label={t("controls.root")} span={3}>
        <LabeledSelect
          label={t("controls.root")}
          hideLabel
          value={rootNote}
          onChange={handleRootNote}
          options={NOTES.map((note) => ({
            value: note,
            label: getNoteDisplay(note, rootNote, preferFlats),
          }))}
        />
      </Prop>
      <Prop label={t("inspector.scaleLabel")} span={3}>
        <LabeledSelect
          label={t("inspector.scaleLabel")}
          value={scaleName}
          groups={scaleGroups}
          onChange={handleScaleName}
          hideLabel
        />
      </Prop>

      {/* ── TIME ─────────────────────────────────────────────────────────── */}
      <GroupHeader>{t("inspector.groupTime")}</GroupHeader>
      <Prop label={t("inspector.timeSignature")} span={1}>
        <TimeSignaturePicker />
      </Prop>
      <Prop label={t("inspector.meterTempo")} span={5}>
        <StepperControl
          label={t("inspector.meterTempo")}
          hideLabel
          value={progressionTempoBpm}
          min={MIN_PROGRESSION_TEMPO_BPM}
          max={MAX_PROGRESSION_TEMPO_BPM}
          step={5}
          formatValue={(bpm) => `${bpm} BPM`}
          onChange={setProgressionTempoBpm}
        />
      </Prop>

      {/* ── PROGRESSION ──────────────────────────────────────────────────── */}
      <GroupHeader
        right={
          <div className={styles["progression-toolbar"]}>
            <LabeledSelect
              label={t("inspector.progressionPreset")}
              hideLabel
              value={currentProgressionPresetId}
              groups={presetGroups}
              onChange={handlePresetChange}
            />
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
          </div>
        }
      >
        {t("inspector.groupProgression")}
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
            <header className={styles["editor-header"]}>
              <span className={styles["editor-degree-pill"]} aria-hidden="true">
                {activeStep.degree}
              </span>
              <span className={styles["editor-chord-label"]}>
                {activeResolvedProgressionStep?.resolvedChordLabel ?? "—"}
              </span>
              <span className={styles["editor-position"]}>
                {`${t("controls.chordPositionLabel")} ${activeProgressionStepIndex + 1} / ${progressionSteps.length}`}
              </span>
            </header>
            <div className={shared["control-section"]}>
              <DegreeGrid
                scaleName={scaleName}
                tonicNote={rootNote}
                selectedNote={activeResolvedProgressionStep?.root ?? rootNote}
                onSelectInKey={(_note, degree) => {
                  updateProgressionStepRoot({ id: activeStep.id, manualRoot: null });
                  updateProgressionStepDegree({ id: activeStep.id, degree });
                }}
                onSelectBorrowed={(note) => {
                  updateProgressionStepRoot({ id: activeStep.id, manualRoot: note });
                }}
                preferFlats={preferFlats}
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
              <LabeledSelect
                label={t("controls.quality")}
                hideLabel
                value={
                  activeStep?.qualityOverride
                  ?? activeResolvedProgressionStep?.quality
                  ?? activeResolvedProgressionStep?.diatonicQuality
                  ?? ""
                }
                onChange={(quality) =>
                  updateProgressionStepQuality({
                    id: activeStep.id,
                    qualityOverride: quality,
                  })
                }
                groups={qualityGroups}
              />
            </div>
            <p className={shared["field-hint"]}>
              {t("controls.voicingLensCrossRef")}
            </p>
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
