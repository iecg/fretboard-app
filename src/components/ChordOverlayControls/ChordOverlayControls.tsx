import { startTransition, useEffect } from "react";
import { useAtomValue } from "jotai";
import { NOTES, LENS_REGISTRY, CHORD_DEFINITIONS } from "../../core/theory";
import { getDegreesForScale } from "../../core/degrees";
import { lensAvailabilityAtom } from "../../store/atoms";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import styles from "../TheoryControls/TheoryControls.module.css";
import shared from "../shared/shared.module.css";

// Derive the dropdown options from the canonical chord-definition catalogue so
// the UI never drifts when new types are added. Object.keys preserves insertion
// order on string keys (ES2015+), and CHORD_DEFINITIONS in src/core/theory.ts
// is declared in family order (triads → 6 → 7ths → sus → power).
const CHORD_OPTIONS: string[] = Object.keys(CHORD_DEFINITIONS);

// UI-only shorthand label map — maps CHORD_DEFINITIONS keys to chord-symbol
// shorthand for display in the toggle bar. Canonical keys are unchanged.
const CHORD_TYPE_SHORT_LABELS: Record<string, string> = {
  "Major Triad": "Maj",
  "Minor Triad": "min",
  "Diminished Triad": "dim",
  "Major 6th": "6",
  "Major 7th": "M7",
  "Minor 7th": "m7",
  "Dominant 7th": "7",
  "Sus4": "sus4",
  "Power Chord (5)": "5",
};

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

  const degreeSelectOptions = [
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

  const handleChordTypeChange = (value: string) => {
    startTransition(() => {
      setChordQualityOverride(value === CHORD_NONE_VALUE ? null : value);
    });
  };

  return (
    <div className={styles["theory-chord-content"]}>
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Chord Mode</span>
        <ToggleBar
          options={[
            { value: "degree", label: "Degree" },
            { value: "manual", label: "Manual" },
          ]}
          value={chordOverlayMode}
          onChange={setChordOverlayMode}
          label="Chord overlay mode"
          compact={compact}
        />
        <p className={shared["field-hint"]}>
          {chordOverlayMode === "degree"
            ? "Picks a chord by scale degree — diatonic to the key."
            : "Sets any chord type and root — independent of the key."}
        </p>
      </div>

      {chordOverlayMode === "degree" && (
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
                options={[
                  { value: CHORD_NONE_VALUE, label: "Off" },
                  ...CHORD_OPTIONS.map((key) => ({
                    value: key,
                    label: CHORD_TYPE_SHORT_LABELS[key] ?? key,
                  })),
                ]}
                value={chordQualityOverride ?? CHORD_NONE_VALUE}
                onChange={handleChordTypeChange}
                compact={compact}
              />
              <p className={shared["field-hint"]}>
                Off uses the diatonic default for this degree. Picking a quality
                pins it for the active degree only — switching degrees resets to
                the new degree's diatonic default.
              </p>
            </div>
          ) : null}
        </>
      )}

      {chordOverlayMode === "manual" && (
        <>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>Chord Type</span>
            <ToggleBar
              label="Chord Type"
              options={[
                { value: CHORD_NONE_VALUE, label: "Off" },
                ...CHORD_OPTIONS.map((key) => ({
                  value: key,
                  label: CHORD_TYPE_SHORT_LABELS[key] ?? key,
                })),
              ]}
              value={chordQualityOverride ?? CHORD_NONE_VALUE}
              onChange={handleChordTypeChange}
              compact={compact}
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

      {chordType ? (
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
