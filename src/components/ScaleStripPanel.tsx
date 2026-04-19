import { useAtom } from "jotai";
import { useScaleState } from "../hooks/useScaleState";
import { DegreeChipStrip } from "./DegreeChipStrip";
import { ToggleBar } from "./ToggleBar";
import { scaleVisibilityModeAtom, type ScaleVisibilityMode } from "../store/atoms";

const VISIBILITY_OPTIONS: readonly { value: ScaleVisibilityMode; label: string }[] = [
  { value: "all", label: "All" },
  { value: "custom", label: "Custom" },
  { value: "off", label: "Off" },
] as const;

/** Scale surface: degree chips + visibility toggle. No chord concerns. */
export function ScaleStripPanel() {
  const { scaleLabel, hiddenNotes, toggleHiddenNote, degreeChips } = useScaleState();
  const [scaleVisibilityMode, setScaleVisibilityMode] = useAtom(scaleVisibilityModeAtom);

  return (
    <DegreeChipStrip
      scaleName={scaleLabel}
      chips={degreeChips}
      hiddenNotes={scaleVisibilityMode === "custom" ? hiddenNotes : undefined}
      onChipToggle={scaleVisibilityMode === "custom" ? toggleHiddenNote : undefined}
      aria-label="Scale degrees"
      mode={scaleVisibilityMode}
      headerAction={
        <ToggleBar
          options={VISIBILITY_OPTIONS}
          value={scaleVisibilityMode}
          onChange={setScaleVisibilityMode}
          label="Scale visibility"
        />
      }
    />
  );
}
