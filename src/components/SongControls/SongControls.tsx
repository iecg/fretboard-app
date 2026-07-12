import { useAtomValue } from "jotai";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, Lock, LockOpen, Plus, Trash2, Volume2 } from "lucide-react";
import clsx from "clsx";
import { SCALE_FAMILIES, NOTES, getChordDisplayLabel, getNoteDisplay, getScaleDisplayLabel, type ScaleFamily, type ScaleFamilyId } from "@fretflow/core";
import {
  MIN_PROGRESSION_STEP_DURATION_VALUE,
  MAX_PROGRESSION_STEP_DURATION_VALUE,
  MIN_PROGRESSION_TEMPO_BPM,
  MAX_PROGRESSION_TEMPO_BPM,
  PROGRESSION_PRESETS,
} from "@fretflow/fretboard/progressions/progressionDomain";
import { generateCommonProgressions, type SuggestionFeel } from "@fretflow/fretboard/progressions/progressionGeneration";
import { useProgressionState } from "@fretflow/fretboard/hooks/useProgressionState";
import { useScaleState } from "@fretflow/fretboard/hooks/useScaleState";
import { useTranslation } from "../../hooks/useTranslation";
import useLayoutMode from "../../hooks/useLayoutMode";
import type { ProgressionPresetCategory } from "@fretflow/fretboard/progressions/progressionDomain";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { StepperControl } from "../StepperControl/StepperControl";
import { LabeledSelect, type LabeledSelectGroup } from "../LabeledSelect/LabeledSelect";
import {
  PresetMenu,
  type PresetMenuCategory,
  type PresetMenuSuggestionGroup,
} from "../PresetMenu/PresetMenu";
import { PropGrid, Prop } from "../Inspector/InspectorGrid";
import { InspectorCard } from "../Inspector/InspectorCard";
import { TimeSignaturePicker } from "../shared/TimeSignaturePicker";
import { BackingTrackControls } from "./BackingTrackControls";
import { buildChordRootGroups, classifyRoot } from "./chordRootOptions";
import { buildQualityGroupsWithDiatonic } from "./qualityGroups";
import { ProgressionStepList } from "./ProgressionStepList";
import { ChordTonesReadout } from "./ChordTonesReadout";
import { ChordSuggestions } from "./ChordSuggestions";
import { TEMPO_STEPPER_ID } from "./progressionFocusIds";
import shared from "../shared/shared.module.css";
import { CUSTOM_PRESET_ID } from "@fretflow/fretboard/store/progressionAtoms";
import { progressionPlayingAtom } from "@fretflow/fretboard/store/progressionAtoms";
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

// Preset categories in display order; labels resolve through i18n at render so
// the preset menu stays localized (the keys, not the copy, live here).
const PRESET_CATEGORY_LABEL_KEYS: Record<ProgressionPresetCategory, string> = {
  "pop-rock": "controls.presetCategoryPopRock",
  blues: "controls.presetCategoryBlues",
  jazz: "controls.presetCategoryJazz",
  folk: "controls.presetCategoryFolk",
  modal: "controls.presetCategoryModal",
  minor: "controls.presetCategoryMinor",
};

const SUGGESTION_FEEL_LABEL_KEYS: Record<SuggestionFeel, string> = {
  cadential: "controls.suggestionFeelCadential",
  vamp: "controls.suggestionFeelVamp",
  modal: "controls.suggestionFeelModal",
};

export function SongControls() {
  const { t } = useTranslation();
  const { tier, useSheetShell } = useLayoutMode();
  const {
    scaleName,
    rootNote,
    setRootNote,
    setScaleName,
    preferFlats,
  } = useScaleState();

  // Discrete user selections write Jotai atoms directly (no startTransition —
  // a single click commits fine synchronously, and wrapping tripped React's
  // ">10 fibers inside startTransition" subscription warning).
  const handleRootNote = (note: string) => setRootNote(note);
  const handleScaleName = (name: string) => setScaleName(name);

  // Plain derivations — the React Compiler memoizes these automatically; manual
  // useMemo is unnecessary here and only added dependency-array bookkeeping.
  const scaleGroups: LabeledSelectGroup[] = [
    { groupLabel: t("inspector.scaleGroupMajorModes"), options: familyOptions(majorFamily) },
    { groupLabel: t("inspector.scaleGroupPentatonics"), options: familyOptions(pentatonicFamily) },
    { groupLabel: t("inspector.scaleGroupBlues"), options: familyOptions(bluesFamily) },
    { groupLabel: t("inspector.scaleGroupHarmonicMinor"), options: familyOptions(harmonicMinorFamily) },
    { groupLabel: t("inspector.scaleGroupMelodicMinor"), options: familyOptions(melodicMinorFamily) },
  ];

  const {
    progressionSteps,
    resolvedProgressionSteps,
    activeProgressionStepIndex,
    displayedProgressionStepIndex,
    activeResolvedProgressionStep,
    loadProgressionPreset,
    loadProgressionSuggestion,
    addProgressionStep,
    duplicateProgressionStep,
    removeProgressionStep,
    moveProgressionStep,
    reorderProgressionSteps,
    previousProgressionStep,
    advanceProgressionPlayback,
    updateProgressionStepDuration,
    updateProgressionStepQuality,
    selectProgressionStepRoot,
    qualityLock,
    setQualityLock,
    progressionTempoBpm,
    setProgressionTempoBpm,
    currentProgressionPresetId,
    setActiveProgressionStepIndex,
    requestAudition,
    auditionActive,
  } = useProgressionState();

  const isProgressionPlaying = useAtomValue(progressionPlayingAtom);

  const activeRoot = activeResolvedProgressionStep?.root ?? rootNote;
  const qualityGroups: LabeledSelectGroup[] = buildQualityGroupsWithDiatonic(
    scaleName,
    rootNote,
    activeRoot,
    {
      diatonic: t("controls.qualityGroupDiatonic"),
      triads: t("controls.qualityGroupTriads"),
      sus: t("controls.qualityGroupSus"),
      sixths: t("controls.qualityGroupSixths"),
      sevenths: t("controls.qualityGroupSevenths"),
      extensions: t("controls.qualityGroupExtensions"),
    },
  );
  // When the quality lock is engaged, the root dropdown previews the *locked*
  // quality for every root (and the Roman-numeral case follows it) — so the
  // list reads "pick any root, it stays <locked quality>", making the lock's
  // effect visible before you act. Unlocked → per-root diatonic default.
  const lockedQuality = qualityLock ? (activeResolvedProgressionStep?.quality ?? null) : null;
  const chordRootGroups: LabeledSelectGroup[] = buildChordRootGroups(
    scaleName,
    rootNote,
    preferFlats,
    {
      diatonic: t("controls.chordRootGroupDiatonic"),
      borrowed: t("controls.chordRootGroupBorrowed"),
      chromatic: t("controls.chordRootGroupChromatic"),
    },
    lockedQuality,
  );

  const editsLocked = useAtomValue(progressionPlayingAtom);

  const activeStep = progressionSteps[activeProgressionStepIndex] ?? null;

  // Preset picker data (PresetMenu): catalog presets grouped by category +
  // key-aware suggestions grouped by feel.
  const groupedPresets = (Object.keys(PRESET_CATEGORY_LABEL_KEYS) as ProgressionPresetCategory[])
    .map((cat) => ({
      cat,
      label: t(PRESET_CATEGORY_LABEL_KEYS[cat]),
      presets: PROGRESSION_PRESETS.filter((p) => p.category === cat),
    }))
    .filter((g) => g.presets.length > 0);
  const suggestedPresets = generateCommonProgressions(scaleName, rootNote);
  const categories: PresetMenuCategory[] = groupedPresets.map((group) => ({
    label: group.label,
    options: group.presets.map((preset) => ({ id: preset.id, label: preset.label })),
  }));
  const suggestionGroups: PresetMenuSuggestionGroup[] = Object.entries(
    suggestedPresets.reduce<Record<string, typeof suggestedPresets>>((acc, p) => {
      (acc[p.feel] ??= []).push(p);
      return acc;
    }, {}),
  ).map(([feel, presets]) => ({
    feel: feel as SuggestionFeel,
    label: t(SUGGESTION_FEEL_LABEL_KEYS[feel as SuggestionFeel]) ?? feel,
    options: presets.map((p) => ({ id: p.id, label: p.label })),
  }));
  const handlePresetChange = (id: string) => {
    if (id === CUSTOM_PRESET_ID) return;
    const suggested = suggestedPresets.find((p) => p.id === id);
    if (suggested) {
      loadProgressionSuggestion(suggested);
      return;
    }
    loadProgressionPreset(id);
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
      {/* ── PRESET + KEY + TIME flex composer ─────────────────────────────── */}
      <div className={styles.groupRow}>
        <div className={styles.groupColumn}>
          <InspectorCard
            name={t("inspector.groupPreset")}
            description={t("inspector.groupPresetDesc")}
            labelledById="song-preset-heading"
            locked={editsLocked}
          >
            <PropGrid columns={1}>
              <Prop label={t("inspector.progressionLabel")}>
                <PresetMenu
                  triggerLabel={t("inspector.progressionLabel")}
                  customLabel={t("controls.presetCustom")}
                  scaleLabel={getScaleDisplayLabel(scaleName)}
                  currentId={currentProgressionPresetId}
                  categories={categories}
                  suggestionGroups={suggestionGroups}
                  compact={tier === "mobile"}
                  width="fill"
                  onSelect={handlePresetChange}
                />
              </Prop>
            </PropGrid>
          </InspectorCard>
        </div>
        <div className={styles.groupColumn}>
          <InspectorCard
            name={t("inspector.groupKey")}
            description={t("inspector.groupKeyDesc")}
            labelledById="song-key-heading"
            locked={editsLocked}
          >
            <PropGrid columns={4} className={styles["mobile-paired-grid"]}>
              <Prop label={t("controls.root")} span={1}>
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
            <PropGrid columns={5} className={styles["mobile-paired-grid"]}>
              <Prop label={t("inspector.timeSignature")} span={2}>
                <TimeSignaturePicker />
              </Prop>
              <Prop label={t("inspector.meterTempo")} span={3}>
                <StepperControl
                  label={t("inspector.meterTempo")}
                  hideLabel
                  value={progressionTempoBpm}
                  min={MIN_PROGRESSION_TEMPO_BPM}
                  max={MAX_PROGRESSION_TEMPO_BPM}
                  step={5}
                  formatValue={(bpm) => `${bpm} BPM`}
                  onChange={setProgressionTempoBpm}
                  width="auto"
                  groupId={TEMPO_STEPPER_ID}
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
        headClassName={styles["progression-card-head"]}
        actions={
          <div className={styles["progression-toolbar"]}>
            <button
              type="button"
              className={styles["toolbar-button"]}
              onClick={() => addProgressionStep()}
              aria-label={t("controls.addChord")}
            >
              <Plus size={16} aria-hidden="true" />
              <span>{t("controls.add")}</span>
            </button>

            <div className={styles["toolbar-divider"]} />

            <div className={styles["button-group"]}>
              <button
                type="button"
                className={styles["grouped-button"]}
                onClick={() => activeStep && moveProgressionStep({ id: activeStep.id, direction: -1 })}
                disabled={!activeStep || activeProgressionStepIndex === 0}
                aria-label={t("controls.moveChordUp")}
              >
                <ArrowUp size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles["grouped-button"]}
                onClick={() => activeStep && moveProgressionStep({ id: activeStep.id, direction: 1 })}
                disabled={!activeStep || activeProgressionStepIndex === progressionSteps.length - 1}
                aria-label={t("controls.moveChordDown")}
              >
                <ArrowDown size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles["grouped-button"]}
                onClick={() => activeStep && duplicateProgressionStep(activeStep.id)}
                disabled={!activeStep}
                aria-label={t("controls.duplicateChord")}
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
              aria-label={t("controls.removeChord")}
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
                  onReorder={(from, to) => reorderProgressionSteps({ from, to })}
                  onNavigate={(direction) => {
                    if (isProgressionPlaying) return;
                    if (direction < 0) previousProgressionStep();
                    else advanceProgressionPlayback();
                  }}
                  enableDrag={!useSheetShell}
                  label={t("controls.progressionNavigation")}
                  caption={t("controls.stepsLabel")}
                  meta={listMeta}
                />
                <div className={styles["editor-panel"]}>
                  <header className={styles["editor-panel-header"]}>
                    <span className={styles["editor-degree-badge"]} aria-hidden="true">
                      {activeResolvedProgressionStep?.degree ?? activeStep.degree}
                    </span>
                    <span className={styles["editor-title"]}>
                      <span className={styles["editor-eyebrow"]}>
                        {editsLocked ? t("controls.playingChord") : t("controls.editingChord")}
                      </span>
                      <span className={styles["editor-chord-name"]}>
                        {editorNote}{" "}
                        <span className={styles["editor-quality-word"]}>{editorQualityWord}</span>
                      </span>
                    </span>
                    <button
                      type="button"
                      className={styles["audition-button"]}
                      onClick={() => requestAudition()}
                      disabled={editsLocked || stepCount === 0 || auditionActive}
                      aria-label={t("controls.auditionChord")}
                      title={t("controls.auditionChord")}
                    >
                      <Volume2 size={14} aria-hidden="true" />
                      <span className={styles["audition-label"]}>{t("controls.auditionChord")}</span>
                    </button>
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
                        <b>{displayedProgressionStepIndex + 1}</b> / {stepCount}
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
                    <div className={styles["root-quality-row"]}>
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
                            accentValue={qualityLock}
                            data-testid="quality-select"
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
                    </div>
                    <div className={shared["control-section"]}>
                      <div className={styles["field-label-row"]}>
                        <span className={styles["field-label"]}>{t("controls.duration")}</span>
                      </div>
                      <div className={styles["duration-row"]}>
                        <StepperControl
                          label={t("controls.durationValue")}
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
                            label={t("controls.durationUnit")}
                            value={activeStep.duration.unit}
                            options={[
                              { value: "beat", label: t("controls.durationBeat") },
                              { value: "bar", label: t("controls.durationBar") },
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
                  <ChordSuggestions disabled={editsLocked} />
                </div>
              </div>
            ) : progressionSteps.length === 0 ? (
              <p className={styles.progressionHint}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => addProgressionStep()}
                >
                  {t("controls.emptyProgressionCta")}
                </button>{" "}
                {t("controls.emptyProgressionSuffix")}
              </p>
            ) : (
              <p className={styles.progressionHint}>
                {t("controls.emptySelectChord")}
              </p>
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
