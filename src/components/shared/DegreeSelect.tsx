import { ToggleBar } from "../ToggleBar/ToggleBar";
import { buildDegreeToggleOptions } from "./chordControlOptions";

export interface DegreeSelectProps {
  /** Active scale name — drives the degree sequence. */
  scaleName: string;
  /** Currently selected degree value. */
  value: string;
  /** Selection handler. */
  onChange: (value: string) => void;
  /** Accessible name for the button group. */
  label: string;
  /** Degree currently carrying a quality override (renders the `*` marker). */
  activeDegree?: string | null;
  /** When true, the active degree is marked with a trailing `*`. */
  qualityOverridden?: boolean;
  /** Prepend an "Off" sentinel as the first option. */
  includeOffSentinel?: boolean;
}

/**
 * Scale-degree picker shared by the Chord tab and the Progression editor.
 * Wraps `ToggleBar` over `buildDegreeToggleOptions` so both surfaces render
 * the identical degree control without duplicating option construction.
 */
export function DegreeSelect({
  scaleName,
  value,
  onChange,
  label,
  activeDegree = null,
  qualityOverridden = false,
  includeOffSentinel = false,
}: DegreeSelectProps) {
  const options = buildDegreeToggleOptions({
    scaleName,
    qualityOverridden,
    activeDegree,
    includeOffSentinel,
  });
  return (
    <ToggleBar
      options={options}
      value={value}
      onChange={onChange}
      label={label}
    />
  );
}
