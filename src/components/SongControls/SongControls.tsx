import { startTransition, useMemo } from "react";
import { useAtomValue } from "jotai";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { SCALE_FAMILIES, NOTES, getChordDisplayLabel, getNoteDisplay, type ScaleFamily, type ScaleFamilyId } from "@fretflow/core";
import {
  MIN_PROGRESSION_STEP_DURATION_VALUE,
  MAX_PROGRESSION_STEP_DURATION_VALUE,
  MIN_PROGRESSION_TEMPO_BPM,
  MAX_PROGRESSION_TEMPO_BPM,
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
import { PropGrid, Prop } from "../Inspector/InspectorGrid";
import { InspectorCard } from "../Inspector/InspectorCard";
import { TimeSignaturePicker } from "../shared/TimeSignaturePicker";
import { BackingTrackControls } from "./BackingTrackControls";
import { buildChordRootGroups, classifyRoot } from "./chordRootOptions";
import { buildQualityGroupsWithDiatonic } from "./qualityGroups";
import { ProgressionStepList } from "./ProgressionStepList";
import { ChordTonesReadout } from "./ChordTonesReadout";
import shared from "../shared/shared.module.css";
import { CUSTOM_PRESET_ID, progressionPlayingAtom } from "../../store/progressionAtoms";
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
      { groupLabel: t("inspector.scaleGroupHarmonicMinor"), options: familyOptions(harmonicMinorFamily) },
      { groupLabel: t("inspector.scaleGroupMelodicMinor"), options: familyOptions(melodicMinorFamily) },
    ],
    [t],
  );

  const {
    progressionSteps,
    resolvedProgressionSteps,
    activeProgressionStepIndex,
    activeResolvedProgressionStep,
    loadProgressionPreset,
    loadProgressionSteps,
    addProgressionStep,
    duplicateProgressionStep,
    removeProgressionStep,
    moveProgressionStep,
    updateProgressionStepDuration,
    updateProgressionStepQuality,
    selectProgressionStepRoot,
    qualityLock,
    setQualityLock,
    progressionTempoBpm,
    setProgressionTempoBpm,
    currentProgressionPresetId,
    setActiveProgressionStepIndex,
  } = useProgressionState();

  const activeRoot = activeResolvedProgressionStep?.root ?? rootNote;
  const qualityGroups: LabeledSelectGroup[] = useMemo(
    () =>
      buildQualityGroupsWithDiatonic(scaleName, rootNote, activeRoot, {
        diatonic: t("controls.qualityGroupDiatonic"),
        triads: t("controls.qualityGroupTriads"),
        sus: t("controls.qualityGroupSus"),
        sixths: t("controls.qualityGroupSixths"),
        sevenths: t("controls.qualityGroupSevenths"),
      }),
    [scaleName, rootNote, activeRoot, t],
  );
  // When the quality lock is engaged, the root dropdown previews the *locked*
  // quality for every root (and the Roman-numeral case follows it) — so the
  // list reads "pick any root, it stays <locked quality>", making the lock's
  // effect visible before you act. Unlocked → per-root diatonic default.
  const lockedQuality = qualityLock ? (activeResolvedProgressionStep?.quality ?? null) : null;
  const chordRootGroups: LabeledSelectGroup[] = useMemo(
    () => buildChordRootGroups(scaleName, rootNote, preferFlats, {
      diatonic: t("controls.chordRootGroupDiatonic"),
      borrowed: t("controls.chordRootGroupBorrowed"),
      chromatic: t("controls.chordRootGroupChromatic"),
    }, lockedQuality),
    [scaleName, rootNote, preferFlats, t, lockedQuality],
  );

  const editsLocked = useAtomValue(progressionPlayingAtom);

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

  // List caption summary: chord count + total bars (beats don't count as bars).
  const stepCount = progressionSteps.length;
  const totalBars = resolvedProgressionSteps.reduce(
    (sum, step) => sum + (step.duration.unit === "bar" ? step.duration.value : 0),
    0,
  );
  const listMeta = `${stepCount} ${t("controls.chordsWord")} · ${totalBars} ${t("controls.barsWord")}`;

  // Editor identity, stated once: note (text) + quality word (dimmed).
  const editorNote = getNoteDisplay(activeResolvedProgressionStep?.root ?? rootNote, rootNote, preferFlats);
  const editorQualityWord = activeResolvedProgressionStep?.quality != null
    ? getChordDisplayLabel(activeResolvedProgressionStep.quality)
    : "";

  // Quality-lock hint, mirroring the dropdown's selected label so the copy and
  // the control never disagree: unlocked adopts the diatonic default; locked
  // pins the current quality across root changes.
  const activeQualityValue =
    activeStep?.qualityOverride
    ?? activeResolvedProgressionStep?.quality
    ?? activeResolvedProgressionStep?.diatonicQuality
    ?? "";
  const activeQualityLabel =
    qualityGroups.flatMap((g) => g.options).find((o) => o.value === activeQualityValue)?.label
    ?? activeQualityValue;
  const lockHint = qualityLock
    ? `${t("controls.lockHintPinnedPrefix")} ${activeQualityLabel} ${t("controls.lockHintPinnedSuffix")}`
    : t("controls.lockHintAdapts");

  // Pager wraps around the progression (matches the chord-list ordering).
  const goToStep = (delta: number) => {
    if (stepCount === 0) return;
    setActiveProgressionStepIndex((activeProgressionStepIndex + delta + stepCount) % stepCount);
  };

  return (
    <div className={styles.sections}>
      {/* ── KEY + TIME flex composer ──────────────────────────────────────── */}
      <div className={styles.groupRow}>
        <div className={styles.groupColumn}>
          <InspectorCard
            name={t("inspector.groupKey")}
            description={t("inspector.groupKeyDesc")}
            labelledById="song-key-heading"
            locked={editsLocked}
            lockedHint={t("controls.lockedHint")}
          >
            <PropGrid columns={5}>
              <Prop label={t("controls.root")} span={2}>
                <LabeledSelect
                  label={t("controls.root")}
                  hideLabel
                  width="fill"
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
            </PropGrid>
          </InspectorCard>
        </div>
        <div className={styles.groupColumn}>
          <InspectorCard
            name={t("inspector.groupTime")}
            description={t("inspector.groupTimeDesc")}
            labelledById="song-time-heading"
          >
            <PropGrid columns={5}>
              <Prop label={t("inspector.timeSignature")} span={1}>
                <TimeSignaturePicker />
              </Prop>
              <Prop label={t("inspector.meterTempo")} span={4}>
                <StepperControl
                  label={t("inspector.meterTempo")}
                  hideLabel
                  value={progressionTempoBpm}
                  min={MIN_PROGRESSION_TEMPO_BPM}
                  max={MAX_PROGRESSION_TEMPO_BPM}
                  step={5}
                  formatValue={(bpm) => `${bpm} BPM`}
                  onChange={setProgressionTempoBpm}
                  width="fill"
                />
              </Prop>
            </PropGrid>
          </InspectorCard>
        </div>
      </div>

      {/* ── PROGRESSION ──────────────────────────────────────────────────── */}
      <InspectorCard
        name={t("inspector.groupProgression")}
        description={t("inspector.groupProgressionDesc")}
        labelledById="song-progression-heading"
        locked={editsLocked}
        lockedHint={t("controls.lockedHint")}
        headClassName={styles["progression-card-head"]}
        actions={
          <div className={styles["progression-toolbar"]}>
            <LabeledSelect
              label={t("inspector.progressionPreset")}
              hideLabel
              value={currentProgressionPresetId}
              groups={presetGroups}
              onChange={handlePresetChange}
            />

            <div className={styles["toolbar-divider"]} />

            <button
              type="button"
              className={styles["toolbar-button"]}
              onClick={() => addProgressionStep()}
              aria-label="Add chord"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Add</span>
            </button>

            <div className={styles["toolbar-divider"]} />

            <div className={styles["button-group"]}>
              <button
                type="button"
                className={styles["grouped-button"]}
                onClick={() => activeStep && moveProgressionStep({ id: activeStep.id, direction: -1 })}
                disabled={!activeStep || activeProgressionStepIndex === 0}
                aria-label="Move chord up"
              >
                <ArrowUp size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles["grouped-button"]}
                onClick={() => activeStep && moveProgressionStep({ id: activeStep.id, direction: 1 })}
                disabled={!activeStep || activeProgressionStepIndex === progressionSteps.length - 1}
                aria-label="Move chord down"
              >
                <ArrowDown size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles["grouped-button"]}
                onClick={() => activeStep && duplicateProgressionStep(activeStep.id)}
                disabled={!activeStep}
                aria-label="Duplicate chord"
              >
                <Copy size={16} aria-hidden="true" />
              </button>
            </div>

            <div className={styles["toolbar-divider"]} />

            <button
              type="button"
              className={styles["delete-button"]}
              onClick={() => activeStep && removeProgressionStep(activeStep.id)}
              disabled={!activeStep}
              aria-label="Remove chord"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        }
      >
        <PropGrid columns={6}>
          <Prop span={6}>
            {activeStep ? (
              <div className={styles["progression-master-detail"]}>
                <ProgressionStepList
                  steps={resolvedProgressionSteps}
                  activeIndex={activeProgressionStepIndex}
                  onSelect={setActiveProgressionStepIndex}
                  label={t("controls.progressionNavigation")}
                  caption={t("controls.stepsLabel")}
                  meta={listMeta}
                />
                <div className={styles["editor-panel"]}>
                  <header className={styles["editor-panel-header"]}>
                    <span className={styles["editor-degree-badge"]} aria-hidden="true">
                      {activeStep.degree}
                    </span>
                    <span className={styles["editor-title"]}>
                      <span className={styles["editor-eyebrow"]}>{t("controls.editingChord")}</span>
                      <span className={styles["editor-chord-name"]}>
                        {editorNote}{" "}
                        <span className={styles["editor-quality-word"]}>{editorQualityWord}</span>
                      </span>
                    </span>
                    <div className={styles["editor-pager"]}>
                      <button
                        type="button"
                        className={styles["pager-button"]}
                        onClick={() => goToStep(-1)}
                        disabled={stepCount <= 1}
                        aria-label={t("controls.prevChord")}
                      >
                        <ChevronLeft size={14} aria-hidden="true" />
                      </button>
                      <span className={styles["editor-position"]}>
                        <b>{activeProgressionStepIndex + 1}</b> / {stepCount}
                      </span>
                      <button
                        type="button"
                        className={styles["pager-button"]}
                        onClick={() => goToStep(1)}
                        disabled={stepCount <= 1}
                        aria-label={t("controls.nextChord")}
                      >
                        <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </header>
                  {activeResolvedProgressionStep?.root && activeResolvedProgressionStep?.quality ? (
                    <ChordTonesReadout
                      root={activeResolvedProgressionStep.root}
                      quality={activeResolvedProgressionStep.quality}
                      displayRoot={rootNote}
                      preferFlats={preferFlats}
                      label={t("inspector.notes")}
                    />
                  ) : null}
                  <div className={styles["editor-grid"]}>
                    <div className={shared["control-section"]}>
                      <div className={styles["field-label-row"]}>
                        <span className={styles["field-label"]}>{t("controls.chordRootLabel")}</span>
                      </div>
                      <LabeledSelect
                        label={t("controls.chordRootLabel")}
                        hideLabel
                        width="fixed"
                        widthValue="9rem"
                        value={activeResolvedProgressionStep?.root ?? rootNote}
                        groups={chordRootGroups}
                        onChange={(note) => {
                          const { inScale, numeral } = classifyRoot(scaleName, rootNote, note, preferFlats);
                          selectProgressionStepRoot({ id: activeStep.id, root: note, numeral, inScale });
                        }}
                        data-testid="chord-root-select"
                      />
                    </div>
                    <div className={shared["control-section"]}>
                      <div className={styles["field-label-row"]}>
                        <span className={styles["field-label"]}>{t("controls.quality")}</span>
                      </div>
                      <div className={styles["quality-row"]}>
                        <LabeledSelect
                          label={t("controls.quality")}
                          hideLabel
                          width="fixed"
                          widthValue="7rem"
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
                        <button
                          type="button"
                          className={clsx(
                            shared["surface--control"],
                            styles["lock-toggle"],
                            { [styles["lock-toggle--on"]]: qualityLock },
                          )}
                          aria-pressed={qualityLock}
                          aria-label={t("controls.lockQuality")}
                          title={t("controls.lockQualityHint")}
                          onClick={() => setQualityLock(!qualityLock)}
                          data-testid="quality-lock-toggle"
                        >
                          {qualityLock
                            ? <Lock size={13} aria-hidden="true" />
                            : <LockOpen size={13} aria-hidden="true" />}
                          <span className={styles["lock-label"]}>
                            {qualityLock ? t("controls.lockLocked") : t("controls.lockAdapts")}
                          </span>
                        </button>
                      </div>
                      <p className={styles["lock-hint"]}>{lockHint}</p>
                    </div>
                    <div className={shared["control-section"]}>
                      <div className={styles["field-label-row"]}>
                        <span className={styles["field-label"]}>Duration</span>
                      </div>
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
                  </div>
                </div>
              </div>
        ) : (
          <p className={shared["field-hint"]}>Select a chord to edit its degree, duration, and quality.</p>
        )}
          </Prop>
        </PropGrid>
      </InspectorCard>

      {/* ── BACKING TRACK ────────────────────────────────────────────────── */}
      <InspectorCard
        name={t("inspector.groupBackingTrack")}
        description={t("inspector.groupBackingTrackDesc")}
        labelledById="song-backing-heading"
      >
        <PropGrid columns={6}>
          <BackingTrackControls hideHeader />
        </PropGrid>
      </InspectorCard>
    </div>
  );
}
