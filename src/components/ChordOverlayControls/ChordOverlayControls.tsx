import { startTransition, useEffect } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { NOTES, LENS_REGISTRY } from "@fretflow/core";
import { getDegreesForScale } from "@fretflow/core";
import { lensAvailabilityAtom, fingeringPatternAtom } from "../../store/atoms";
import { useTranslation } from "../../hooks/useTranslation";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import theoryStyles from "../TheoryControls/TheoryControls.module.css";
import panelStyles from "./ChordOverlayControls.module.css";
import shared from "../shared/shared.module.css";

// UI-only shorthand label map — maps CHORD_DEFINITIONS keys to chord-symbol
// shorthand for display in the toggle bar. Canonical keys are unchanged.
const CHORD_TYPE_SHORT_LABELS: Record<string, string> = {
  "Major Triad": "Maj",
  "Minor Triad": "min",
  "Diminished Triad": "dim",
  "Augmented Triad": "aug",
  "Sus2": "sus2",
  "Sus4": "sus4",
  "Power Chord (5)": "5",
  "Major 6th": "M6",
  "Minor 6th": "m6",
  "Major 7th": "M7",
  "Minor 7th": "m7",
  "Dominant 7th": "7",
  "Diminished 7th": "dim7",
  "Half-Diminished 7th": "m7♭5",
  "Minor-Major 7th": "mM7",
};

// Display order for the chord-type toggle bar: triads → suspended → power → 6ths → 7ths.
// This controls toggle-bar order exclusively; CHORD_DEFINITIONS key order in theory.ts
// is never reordered to match this.
const CHORD_TYPE_DISPLAY_ORDER: readonly string[] = [
  "Major Triad",
  "Minor Triad",
  "Diminished Triad",
  "Augmented Triad",
  "Sus2",
  "Sus4",
  "Power Chord (5)",
  "Major 6th",
  "Minor 6th",
  "Major 7th",
  "Minor 7th",
  "Dominant 7th",
  "Diminished 7th",
  "Half-Diminished 7th",
  "Minor-Major 7th",
];

const CHORD_NONE_VALUE = "__none__";

export interface ChordOverlayControlsProps {
  compact?: boolean;
}

export function ChordOverlayControls({ compact }: ChordOverlayControlsProps) {
  const { scaleName, useFlats } = useScaleState();
  const {
    chordType,
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

  const hasQualityOverride = chordQualityOverride != null;
  const degreeSelectOptions = [
    { value: CHORD_NONE_VALUE, label: "Off" },
    ...Object.values(getDegreesForScale(scaleName)).map((deg) => ({
      value: deg,
      label: hasQualityOverride && deg === chordDegree ? `${deg}*` : deg,
    })),
  ];

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
            { value: "manual", label: "Manual", disabled: isPatternDisabled },
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
                options={CHORD_TYPE_DISPLAY_ORDER.map((key) => ({
                  value: key,
                  label: CHORD_TYPE_SHORT_LABELS[key] ?? key,
                }))}
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
              options={[
                { value: CHORD_NONE_VALUE, label: t("controls.off") },
                ...CHORD_TYPE_DISPLAY_ORDER.map((key) => ({
                  value: key,
                  label: CHORD_TYPE_SHORT_LABELS[key] ?? key,
                })),
              ]}
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
