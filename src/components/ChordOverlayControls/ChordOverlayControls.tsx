import { startTransition, useEffect } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { NOTES, LENS_REGISTRY } from "@fretflow/core";
import { lensAvailabilityAtom, fingeringPatternAtom } from "../../store/atoms";
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

  return (
    <div
      className={clsx(theoryStyles["theory-chord-content"], isPatternDisabled && panelStyles["panel-disabled"])}
      data-disabled={isPatternDisabled ? "true" : undefined}
    >
      {isPatternDisabled && (
        <p className={shared["field-hint"]} aria-live="polite">
          Chord overlay disabled for single/two-string patterns.
        </p>
      )}
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Chord Mode</span>
        <ToggleBar
          options={[
            { value: "degree", label: isPatternDisabled ? "Disabled" : "Degree", disabled: isPatternDisabled },
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
              ? "Picks a chord by scale degree — diatonic to the key."
              : "Sets any chord type and root — independent of the key."}
          </p>
        )}
      </div>

      {!isPatternDisabled && chordOverlayMode === "degree" && (
        <>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>Degree</span>
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
              <span className={shared["section-label"]}>Chord Type</span>
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
                  ? "Custom chord type — not the diatonic default."
                  : "Switching degrees picks the diatonic default automatically."}
              </p>
            </div>
          ) : null}
        </>
      )}

      {!isPatternDisabled && chordOverlayMode === "manual" && (
        <>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>Chord Type</span>
            <ToggleBar
              label="Chord Type"
              options={buildQualityToggleOptions({ diatonicLabel: "Off" })}
              value={chordQualityOverride ?? CHORD_NONE_VALUE}
              onChange={handleChordTypeChange}
              compact={compact}
              overflow="scroll"
            />
          </div>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>Root</span>
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
          <span className={shared["section-label"]}>Lens</span>
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
