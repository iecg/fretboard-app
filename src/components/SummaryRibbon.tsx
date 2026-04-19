import { useAtom } from "jotai";
import { useScaleState } from "../hooks/useScaleState";
import { useChordState } from "../hooks/useChordState";
import { usePracticeBarState } from "../hooks/usePracticeBarState";
import { DegreeChipStrip } from "./DegreeChipStrip";
import { ChordPracticeBar } from "./ChordPracticeBar";
import { ToggleBar } from "./ToggleBar";
import { scaleVisibilityModeAtom, type ScaleVisibilityMode } from "../store/atoms";

const VISIBILITY_OPTIONS: readonly { value: ScaleVisibilityMode; label: string }[] =
  [
    { value: "all", label: "All" },
    { value: "custom", label: "Custom" },
    { value: "off", label: "Off" },
  ] as const;

export function SummaryRibbon() {
  const {
    scaleLabel,
    hiddenNotes,
    toggleHiddenNote,
    degreeChips,
  } = useScaleState();

  const [scaleVisibilityMode, setScaleVisibilityMode] = useAtom(scaleVisibilityModeAtom);

  const { chordType } = useChordState();

  const {
    showChordPracticeBar,
    practiceBarTitle,
    practiceBarBadge,
    isShapeLocalContext,
    shapeContextLabel,
    practiceCues,
    shapeLocalPracticeCues,
  } = usePracticeBarState();

  const visibilityControl = (
    <ToggleBar
      options={VISIBILITY_OPTIONS}
      value={scaleVisibilityMode}
      onChange={setScaleVisibilityMode}
      label="Scale visibility"
    />
  );

  const scaleStrip = (
    <DegreeChipStrip
      scaleName={scaleLabel}
      chips={degreeChips}
      hiddenNotes={scaleVisibilityMode === "custom" ? hiddenNotes : undefined}
      onChipToggle={scaleVisibilityMode === "custom" ? toggleHiddenNote : undefined}
      aria-label="Scale degrees"
      mode={scaleVisibilityMode}
      headerAction={visibilityControl}
    />
  );

  if (!chordType) {
    return scaleStrip;
  }

  return (
    <div className="summary-ribbon">
      {scaleStrip}
      {showChordPracticeBar && (
        <ChordPracticeBar
          title={practiceBarTitle}
          badge={practiceBarBadge}
          cues={practiceCues}
          isShapeLocal={isShapeLocalContext}
          shapeContextLabel={shapeContextLabel}
          shapeLocalCues={shapeLocalPracticeCues}
        />
      )}
    </div>
  );
}
