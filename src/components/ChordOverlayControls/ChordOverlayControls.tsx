import { startTransition, useEffect } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { NOTES, LENS_REGISTRY } from "@fretflow/core";
import { lensAvailabilityAtom, fingeringPatternAtom } from "../../store/atoms";
import { useTranslation } from "../../hooks/useTranslation";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import theoryStyles from "../TheoryControls/TheoryControls.module.css";
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

export interface ChordOverlayControlsProps {
  compact?: boolean;
}

export function ChordOverlayControls({ compact }: ChordOverlayControlsProps) {
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

  const { t } = useTranslation();

  return (
    <div
      className={clsx(theoryStyles["theory-chord-content"], isPatternDisabled && panelStyles["panel-disabled"])}
      data-disabled={isPatternDisabled ? "true" : undefined}
    >
      {isPatternDisabled && (
        <p className={shared["field-hint"]} aria-live="polite">
          {t("controls.chordOverlayDisabled")}
        </p>
      )}
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>{t("controls.chordMode")}</span>
        <ToggleBar
          options={[
            { value: "degree", label: isPatternDisabled ? t("controls.disabled") : t("controls.degree"), disabled: isPatternDisabled },
            { value: "manual", label: t("controls.manual"), disabled: isPatternDisabled },
          ]}
          value={chordOverlayMode}
          onChange={isPatternDisabled ? () => undefined : setChordOverlayMode}
          label="Chord overlay mode"
          compact={compact}
        />
        {!isPatternDisabled && (
          <p className={shared["field-hint"]}>
            {chordOverlayMode === "degree"
              ? t("controls.degreeModeHint")
              : t("controls.manualModeHint")}
          </p>
        )}
      </div>

      {!isPatternDisabled && chordOverlayMode === "degree" && (
        <>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>{t("controls.degree")}</span>
            <ToggleBar
              options={degreeSelectOptions}
              value={chordDegree ?? CHORD_NONE_VALUE}
              onChange={handleDegreeChange}
              label="Chord degree"
              compact={compact}
            />
          </div>
          {chordDegree ? (
            <div className={shared["control-section"]}>
              <span className={shared["section-label"]}>{t("controls.chordType")}</span>
              <ToggleBar
                label="Chord Type"
                options={buildQualityToggleOptions({ includeSentinel: false })}
                value={chordType ?? ""}
                onChange={handleChordTypeChange}
                compact={compact}
                overflow="scroll"
              />
              <p className={shared["field-hint"]}>
                {hasQualityOverride
                  ? t("controls.customChordHint")
                  : t("controls.diatonicDefaultHint")}
              </p>
            </div>
          ) : null}
        </>
      )}

      {!isPatternDisabled && chordOverlayMode === "manual" && (
        <>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>{t("controls.chordType")}</span>
            <ToggleBar
              label="Chord Type"
              options={buildQualityToggleOptions({ diatonicLabel: t("controls.off") })}
              value={chordQualityOverride ?? CHORD_NONE_VALUE}
              onChange={handleChordTypeChange}
              compact={compact}
              overflow="scroll"
            />
          </div>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>{t("controls.root")}</span>
            <NoteGrid
              notes={NOTES}
              selected={chordRootOverride}
              onSelect={(note) => {
                startTransition(() => {
                  setChordRootOverride(note);
                });
              }}
              useFlats={useFlats}
              compact={compact}
            />
          </div>
        </>
      )}

      {!isPatternDisabled && chordType ? (
        <div className={shared["control-section"]}>
          <span className={shared["section-label"]}>Full Chords</span>
          <ToggleBar
            options={[
              { value: "off", label: "Off" },
              { value: "on", label: "On", disabled: !fullChordsSupported },
            ]}
            value={fullChordsEnabled ? "on" : "off"}
            onChange={(value) => setFullChordsEnabled(value === "on")}
            label="Full Chords"
            compact={compact}
          />
          <p className={shared["field-hint"]}>
            {fullChordsSupported
              ? "Show canonical CAGED voicings instead of scattered chord tones."
              : currentTuning.length !== 6
                ? "Full Chords currently supports 6-string tunings only."
                : "Full Chords currently supports Major Triad, Minor Triad, and Dominant 7th."}
          </p>
        </div>
      ) : null}

      {!isPatternDisabled && chordType ? (
        <div className={shared["control-section"]}>
          <span className={shared["section-label"]}>{t("controls.lens")}</span>
          <ToggleBar
            options={lensOptions}
            value={practiceLens}
            onChange={setPracticeLens}
            label="Practice lens"
            compact={compact}
          />
          {activeLensDescription ? (
            <p className={shared["field-hint"]}>{activeLensDescription}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
