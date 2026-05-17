import { startTransition, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";
import { NOTES, LENS_REGISTRY } from "@fretflow/core";
import {
  lensAvailabilityAtom,
  fingeringPatternAtom,
  chordOverlayHiddenAtom,
} from "../../store/atoms";
import { useTranslation } from "../../hooks/useTranslation";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { Switch } from "../Switch/Switch";
import { PropGrid, Prop, GroupHeader } from "../Inspector/InspectorGrid";
import { ChordTypeGrid } from "../Inspector/ChordTypeGrid";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import panelStyles from "./ChordOverlayControls.module.css";
import shared from "../shared/shared.module.css";
import { CHORD_NONE_VALUE } from "./chordTypeOptions";
import {
  buildDegreeToggleOptions,
  buildQualityToggleOptions,
} from "../shared/chordControlOptions";

// Subset of chord types that have full-chord shape data on the fretboard.
// Used to gate the Full Chord overlay toggle in the UI.
const FULL_CHORD_SUPPORTED_TYPES = new Set([
  "Major Triad",
  "Minor Triad",
  "Dominant 7th",
]);

export function ChordOverlayControls() {
  const { t } = useTranslation();
  const { scaleName, useFlats } = useScaleState();
  const {
    chordType,
    currentTuning,
    fullChordsEnabled,
    setFullChordsEnabled,
    practiceLens,
    setPracticeLens,
    chordDegree,
    setChordDegree,
    chordOverlayMode,
    setChordOverlayMode,
    chordRootOverride,
    setChordRootOverride,
    chordQualityOverride,
    setChordQualityOverride,
  } = useChordState();
  const [chordOverlayHidden, setChordOverlayHidden] = useAtom(chordOverlayHiddenAtom);

  const lensAvailability = useAtomValue(lensAvailabilityAtom);
  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const isPatternDisabled =
    fingeringPattern === "one-string" || fingeringPattern === "two-strings";
  const fullChordsSupported =
    chordType != null &&
    FULL_CHORD_SUPPORTED_TYPES.has(chordType) &&
    currentTuning.length === 6;

  const hasQualityOverride = chordQualityOverride != null;
  const degreeSelectOptions = buildDegreeToggleOptions({
    scaleName,
    qualityOverridden: hasQualityOverride,
    activeDegree: chordDegree,
    includeOffSentinel: true,
  });

  // Hide tension lens when unavailable and not currently active.
  const lensOptions = lensAvailability.flatMap((entry) => {
    const { id } = entry;
    const isActive = id === practiceLens;
    const available = entry.available;
    const reason = entry.reason ?? undefined;

    if (!available && !isActive && entry?.hideWhenUnavailable) return [];

    return [
      {
        value: id,
        label: entry?.label ?? id,
        disabled: !isActive && !available,
        title: !isActive && reason ? reason : undefined,
        description: !isActive && reason ? reason : undefined,
      },
    ];
  });

  const currentLensEntry = lensAvailability.find((l) => l.id === practiceLens);
  const activeLensDescription =
    LENS_REGISTRY.find((l) => l.id === practiceLens)?.description ?? undefined;

  // Auto-exit unavailable lenses (except "targets").
  useEffect(() => {
    if (
      currentLensEntry &&
      !currentLensEntry.available &&
      currentLensEntry.id !== "targets"
    ) {
      const tAvailable = lensAvailability.find((l) => l.id === "targets")?.available;
      if (tAvailable) {
        setPracticeLens("targets");
      }
    }
  }, [currentLensEntry, lensAvailability, setPracticeLens]);

  const handleDegreeChange = (value: string) => {
    startTransition(() => {
      setChordDegree(value === CHORD_NONE_VALUE ? null : value);
    });
  };

  const handleChordTypeChange = (value: string) => {
    startTransition(() => {
      setChordQualityOverride(value === CHORD_NONE_VALUE ? null : value);
    });
  };

  // ── Visibility ────────────────────────────────────────────────────────
  const showDegree = !isPatternDisabled && chordOverlayMode === "degree";
  const showChordTypeGrid =
    !isPatternDisabled &&
    (chordOverlayMode === "manual" ||
      (chordOverlayMode === "degree" && Boolean(chordDegree)));
  const showRoot = !isPatternDisabled && chordOverlayMode === "manual";
  const showChordTypeGroup = showChordTypeGrid || showRoot;
  const showVoicing = !isPatternDisabled && Boolean(chordType);

  const fullChordsHint = fullChordsSupported
    ? "Show canonical CAGED voicings instead of scattered chord tones."
    : currentTuning.length !== 6
      ? "Full Chords currently supports 6-string tunings only."
      : "Full Chords currently supports Major Triad, Minor Triad, and Dominant 7th.";

  return (
    <div
      className={clsx(panelStyles.root, isPatternDisabled && panelStyles["panel-disabled"])}
      data-disabled={isPatternDisabled ? "true" : undefined}
    >
      {isPatternDisabled && (
        <p className={shared["field-hint"]} aria-live="polite">
          {t("controls.chordOverlayDisabled")}
        </p>
      )}
      <PropGrid columns={6}>
        {/* ── SOURCE ───────────────────────────────────────────────────── */}
        <GroupHeader>{t("inspector.groupSource")}</GroupHeader>
        <Prop
          label={t("controls.chordMode")}
          span={2}
          hint={
            isPatternDisabled
              ? undefined
              : chordOverlayMode === "degree"
                ? t("controls.degreeModeHint")
                : t("controls.manualModeHint")
          }
        >
          <ToggleBar
            options={[
              {
                value: "degree",
                label: isPatternDisabled
                  ? t("controls.disabled")
                  : t("controls.degree"),
                disabled: isPatternDisabled,
              },
              {
                value: "manual",
                label: t("controls.manual"),
                disabled: isPatternDisabled,
              },
            ]}
            value={chordOverlayMode}
            onChange={isPatternDisabled ? () => undefined : setChordOverlayMode}
            label="Chord overlay mode"
          />
        </Prop>
        {showDegree && (
          <Prop label={t("controls.degree")} span={4}>
            <ToggleBar
              options={degreeSelectOptions}
              value={chordDegree ?? CHORD_NONE_VALUE}
              onChange={handleDegreeChange}
              label="Chord degree"
            />
          </Prop>
        )}
        {showVoicing && (
          <Prop label={t("controls.lens")} span={6} hint={activeLensDescription}>
            <ToggleBar
              options={lensOptions}
              value={practiceLens}
              onChange={setPracticeLens}
              label="Practice lens"
            />
          </Prop>
        )}

        {/* ── CHORD TYPE ───────────────────────────────────────────────── */}
        {showChordTypeGroup && (
          <GroupHeader>{t("inspector.groupChordType")}</GroupHeader>
        )}
        {showChordTypeGrid && (
          <Prop
            label={t("controls.chordType")}
            span={6}
            hint={
              chordOverlayMode === "degree"
                ? hasQualityOverride
                  ? t("controls.customChordHint")
                  : t("controls.diatonicDefaultHint")
                : undefined
            }
          >
            <ChordTypeGrid
              label="Chord Type"
              options={
                chordOverlayMode === "degree"
                  ? buildQualityToggleOptions({ includeSentinel: false })
                  : buildQualityToggleOptions({ diatonicLabel: t("controls.off") })
              }
              value={
                chordOverlayMode === "degree"
                  ? chordType ?? ""
                  : chordQualityOverride ?? CHORD_NONE_VALUE
              }
              onChange={handleChordTypeChange}
            />
          </Prop>
        )}
        {showRoot && (
          <Prop label={t("controls.root")} span={2}>
            <NoteGrid
              notes={NOTES}
              selected={chordRootOverride}
              onSelect={(note) => {
                startTransition(() => {
                  setChordRootOverride(note);
                });
              }}
              useFlats={useFlats}
            />
          </Prop>
        )}

        {/* ── VOICING ──────────────────────────────────────────────────── */}
        {showVoicing && (
          <>
            <GroupHeader>{t("inspector.groupVoicing")}</GroupHeader>
            <Prop label="Full Chords" span={3} hint={fullChordsHint}>
              <Switch
                label="Full Chords"
                checked={fullChordsEnabled}
                onChange={setFullChordsEnabled}
                disabled={!fullChordsSupported}
              />
            </Prop>
            <Prop label={t("inspector.showOnBoard")} span={3}>
              <Switch
                label={t("inspector.showOnBoard")}
                checked={!chordOverlayHidden}
                onChange={(next) => setChordOverlayHidden(!next)}
              />
            </Prop>
          </>
        )}
      </PropGrid>
    </div>
  );
}
