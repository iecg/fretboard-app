import { startTransition, useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NOTES } from "../../core/theory";
import { getAdjacentDegree, getDegreesForScale } from "../../core/degrees";
import { lensAvailabilityAtom, advanceProgression, regressProgression } from "../../store/atoms";
import { LabeledSelect, type LabeledSelectOption } from "../LabeledSelect/LabeledSelect";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import styles from "../TheoryControls/TheoryControls.module.css";
import shared from "../shared/shared.module.css";

const CHORD_OPTIONS: (string | { divider: string })[] = [
  { divider: "Triads" },
  "Major Triad",
  "Minor Triad",
  "Diminished Triad",
  { divider: "Seventh Chords" },
  "Major 7th",
  "Minor 7th",
  "Dominant 7th",
  { divider: "Other" },
  "Power Chord (5)",
];

const CHORD_NONE_VALUE = "__none__";

export function ChordOverlayControls() {
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

  const advanceProgressionAtom = useSetAtom(advanceProgression);
  const regressProgressionAtom = useSetAtom(regressProgression);

  const [isChordOverlayOpen, setChordOverlayOpen] = useState(Boolean(chordType));

  const chordSelectOptions: LabeledSelectOption[] = [
    { value: CHORD_NONE_VALUE, label: "Off" },
    ...CHORD_OPTIONS.filter(
      (option): option is string => typeof option === "string",
    ).map((option) => ({
      value: option,
      label: option,
    })),
  ];

  const degreeSelectOptions: LabeledSelectOption[] = [
    { value: CHORD_NONE_VALUE, label: "Off" },
    ...Object.values(getDegreesForScale(scaleName)).map((deg) => ({
      value: deg,
      label: deg,
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

  const handleStepDegree = (direction: -1 | 1) => {
    startTransition(() => {
      setChordDegree(getAdjacentDegree(chordDegree, scaleName, direction));
    });
  };

  const handleQualityOverrideChange = (value: string) => {
    startTransition(() => {
      setChordQualityOverride(value === CHORD_NONE_VALUE ? null : value);
    });
  };

  const chordSummary = chordType ?? "Off";
  const chordOverlayOpen = isChordOverlayOpen || Boolean(chordType);

  return (
    <div className={clsx(styles["theory-chord-section"], "panel-surface panel-surface--compact")}>
      <button
        type="button"
        className={clsx(styles["theory-disclosure-btn"], {
          [styles["theory-disclosure-btn--open"]]: chordOverlayOpen,
        })}
        aria-expanded={chordOverlayOpen}
        onClick={() => setChordOverlayOpen((value) => !value)}
      >
        <span className={styles["theory-disclosure-title"]}>Chord Overlay</span>
        <span className={styles["theory-disclosure-summary"]}>{chordSummary}</span>
      </button>

      {chordOverlayOpen ? (
        <div className={styles["theory-chord-content"]}>
          {/* Mode toggle: Degree | Manual */}
          <ToggleBar
            options={[
              { value: "degree", label: "Degree" },
              { value: "manual", label: "Manual" },
            ]}
            value={chordOverlayMode}
            onChange={setChordOverlayMode}
            label="Chord overlay mode"
          />

          {/* Degree mode: theory-browser-pattern picker */}
          {chordOverlayMode === "degree" && (
            <div
              role="group"
              aria-label="Browse chord degrees"
              className={clsx(
                styles["theory-mode-browser"],
                "panel-surface",
                "panel-surface--compact",
              )}
            >
              <div className={styles["theory-browser-main"]}>
                <button
                  type="button"
                  className={styles["theory-nav-btn"]}
                  aria-label="Previous chord degree"
                  onClick={() => handleStepDegree(-1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <div className={styles["theory-browser-selector"]}>
                  <LabeledSelect
                    label="Chord Degree"
                    value={chordDegree ?? CHORD_NONE_VALUE}
                    options={degreeSelectOptions}
                    onChange={handleDegreeChange}
                    hideLabel
                  />
                </div>
                <button
                  type="button"
                  className={styles["theory-nav-btn"]}
                  aria-label="Next chord degree"
                  onClick={() => handleStepDegree(1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Progression stepper — visible in degree mode only */}
          {chordOverlayMode === "degree" && (
            <div
              role="group"
              aria-label="Step through progression"
              className={clsx(
                styles["theory-mode-browser"],
                "panel-surface",
                "panel-surface--compact",
              )}
            >
              <div className={styles["theory-browser-main"]}>
                <button
                  type="button"
                  className={styles["theory-nav-btn"]}
                  aria-label="Previous chord"
                  onClick={() => startTransition(() => { regressProgressionAtom(); })}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className={styles["theory-browser-selector"]}>Progression</span>
                <button
                  type="button"
                  className={styles["theory-nav-btn"]}
                  aria-label="Next chord"
                  onClick={() => startTransition(() => { advanceProgressionAtom(); })}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Manual mode: chord-type selector + root picker */}
          {chordOverlayMode === "manual" && (
            <div
              role="group"
              aria-label="Browse chord types"
              className={clsx(
                styles["theory-mode-browser"],
                "panel-surface",
                "panel-surface--compact",
              )}
            >
              <div className={styles["theory-browser-main"]}>
                <div className={styles["theory-browser-selector"]}>
                  <LabeledSelect
                    label="Chord Type"
                    value={chordQualityOverride ?? CHORD_NONE_VALUE}
                    options={chordSelectOptions}
                    onChange={handleQualityOverrideChange}
                    hideLabel
                  />
                </div>
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
                />
              </div>
            </div>
          )}

          {/* Lens picker — shown when a chord is active */}
          {chordType ? (
            <div className={shared["control-section"]}>
              <span className={shared["section-label"]}>Lens</span>
              <ToggleBar
                options={lensOptions}
                value={practiceLens}
                onChange={setPracticeLens}
                label="Practice lens"
              />
              {currentLensEntry?.description ? (
                <p className={shared["lens-hint"]}>{currentLensEntry.description}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

