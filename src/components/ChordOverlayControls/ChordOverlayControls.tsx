import { startTransition, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { NOTES, LENS_REGISTRY } from "../../core/theory";
import { getAdjacentDegree, getDegreesForScale } from "../../core/degrees";
import { lensAvailabilityAtom } from "../../store/atoms";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import {
  StepperSelect,
  type StepperSelectOption,
} from "../StepperSelect/StepperSelect";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { FieldHelpHeader } from "../shared/FieldHelpHeader";
import { useHelpPopover } from "../shared/useHelpPopover";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import styles from "../TheoryControls/TheoryControls.module.css";
import shared from "../shared/shared.module.css";

type ChordHelpId = "chord-mode" | "lens";

const CHORD_OPTIONS: string[] = [
  "Major Triad",
  "Minor Triad",
  "Diminished Triad",
  "Major 7th",
  "Minor 7th",
  "Dominant 7th",
  "Power Chord (5)",
];

const CHORD_NONE_VALUE = "__none__";

const CHORD_SELECT_OPTIONS: StepperSelectOption[] = [
  { value: CHORD_NONE_VALUE, label: "Off" },
  ...CHORD_OPTIONS.map((option) => ({
    value: option,
    label: option,
  })),
];

const CHORD_MODE_HELP = {
  id: "chord-mode",
  content:
    "Degree: diatonic chord that follows the active scale. Manual: free chord root and quality that escapes the scale.",
};

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

  const { activeHelpField, handleHelpToggle, registerHelpContainer } =
    useHelpPopover<ChordHelpId>();

  const lensAvailability = useAtomValue(lensAvailabilityAtom);

  const [isChordOverlayOpen, setChordOverlayOpen] = useState(Boolean(chordType));

  const degreeSelectOptions: StepperSelectOption[] = [
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

  const handleStepDegree = (direction: -1 | 1) => {
    startTransition(() => {
      setChordDegree(getAdjacentDegree(chordDegree, scaleName, direction));
    });
  };

  const handleChordTypeChange = (value: string) => {
    startTransition(() => {
      setChordQualityOverride(value === CHORD_NONE_VALUE ? null : value);
    });
  };

  const handleStepChordType = (direction: -1 | 1) => {
    const currentIndex =
      chordQualityOverride === null ? -1 : CHORD_OPTIONS.indexOf(chordQualityOverride);
    const nextIndex =
      currentIndex < 0
        ? direction === 1
          ? 0
          : CHORD_OPTIONS.length - 1
        : (currentIndex + direction + CHORD_OPTIONS.length) % CHORD_OPTIONS.length;
    startTransition(() => {
      setChordQualityOverride(CHORD_OPTIONS[nextIndex]);
    });
  };

  const chordSummary = chordType ?? "Off";
  const chordOverlayOpen = isChordOverlayOpen || Boolean(chordType);

  return (
    <div className={styles["theory-chord-section"]}>
      <button
        type="button"
        className={clsx(styles["theory-disclosure-btn"], {
          [styles["theory-disclosure-btn--open"]]: chordOverlayOpen,
        })}
        aria-expanded={chordOverlayOpen}
        onClick={() => setChordOverlayOpen((v) => !v)}
      >
        <span className={styles["theory-disclosure-title"]}>Chord Overlay</span>
        <span className={styles["theory-disclosure-summary"]}>{chordSummary}</span>
      </button>

      {chordOverlayOpen ? (
        <div className={styles["theory-chord-content"]}>
          <div className={shared["control-section"]}>
            <FieldHelpHeader
              label="Chord Mode"
              help={CHORD_MODE_HELP}
              isHelpOpen={activeHelpField === "chord-mode"}
              onToggleHelp={() => handleHelpToggle("chord-mode")}
              helpContainerRef={(node) => registerHelpContainer("chord-mode", node)}
            />
            <ToggleBar
              options={[
                { value: "degree", label: "Degree" },
                { value: "manual", label: "Manual" },
              ]}
              value={chordOverlayMode}
              onChange={setChordOverlayMode}
              label="Chord overlay mode"
            />
          </div>

          {chordOverlayMode === "degree" && (
            <div className={shared["control-section"]}>
              <span className={shared["section-label"]}>Degree</span>
              <StepperSelect
                selectLabel="Chord Degree"
                groupLabel="Browse chord degrees"
                previousLabel="Previous chord degree"
                nextLabel="Next chord degree"
                value={chordDegree ?? CHORD_NONE_VALUE}
                options={degreeSelectOptions}
                onChange={handleDegreeChange}
                onPrevious={() => handleStepDegree(-1)}
                onNext={() => handleStepDegree(1)}
              />
            </div>
          )}

          {chordOverlayMode === "manual" && (
            <>
              <div className={shared["control-section"]}>
                <span className={shared["section-label"]}>Chord Type</span>
                <StepperSelect
                  selectLabel="Chord Type"
                  groupLabel="Browse chord types"
                  previousLabel="Previous chord type"
                  nextLabel="Next chord type"
                  value={chordQualityOverride ?? CHORD_NONE_VALUE}
                  options={CHORD_SELECT_OPTIONS}
                  onChange={handleChordTypeChange}
                  onPrevious={() => handleStepChordType(-1)}
                  onNext={() => handleStepChordType(1)}
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
                />
              </div>
            </>
          )}

          {chordType ? (
            <div className={shared["control-section"]}>
              <FieldHelpHeader
                label="Lens"
                help={
                  activeLensDescription
                    ? { id: "lens", content: activeLensDescription }
                    : undefined
                }
                isHelpOpen={activeHelpField === "lens"}
                onToggleHelp={() => handleHelpToggle("lens")}
                helpContainerRef={(node) => registerHelpContainer("lens", node)}
              />
              <ToggleBar
                options={lensOptions}
                value={practiceLens}
                onChange={setPracticeLens}
                label="Practice lens"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
