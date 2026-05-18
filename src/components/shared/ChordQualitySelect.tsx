import { ChordTypeGrid } from "../Inspector/ChordTypeGrid";
import { buildQualityToggleOptions } from "./chordControlOptions";

export interface ChordQualitySelectProps {
  /** Currently selected quality value ("" when none/diatonic). */
  value: string;
  /** Selection handler. */
  onChange: (value: string) => void;
  /** Accessible name for the button group. */
  label: string;
  /** Prepend the diatonic/no-override sentinel as the first option. */
  includeSentinel?: boolean;
}

/**
 * Chord-quality picker shared by the Chord tab and the Progression editor.
 * Wraps `ChordTypeGrid` over `buildQualityToggleOptions` so both surfaces
 * render the identical quality grid without duplicating option construction.
 */
export function ChordQualitySelect({
  value,
  onChange,
  label,
  includeSentinel = false,
}: ChordQualitySelectProps) {
  return (
    <ChordTypeGrid
      label={label}
      options={buildQualityToggleOptions({ includeSentinel })}
      value={value}
      onChange={onChange}
    />
  );
}
