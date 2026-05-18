import { NOTES } from "@fretflow/core";
import { NoteGrid } from "../NoteGrid/NoteGrid";

export interface RootNoteSelectProps {
  /** Currently selected root note (sharps-form, e.g. "C", "F#"). */
  value: string;
  /** Selection handler. */
  onSelect: (note: string) => void;
  /** Render flat spellings when true. */
  useFlats: boolean;
}

/**
 * Root-note picker shared by the Scale tab and the Chord tab — the full
 * 12-note chromatic grid. Wraps `NoteGrid` with the `NOTES` set baked in so
 * both surfaces select a root from one component and never drift apart.
 */
export function RootNoteSelect({ value, onSelect, useFlats }: RootNoteSelectProps) {
  return (
    <NoteGrid
      notes={NOTES}
      selected={value}
      onSelect={onSelect}
      useFlats={useFlats}
    />
  );
}
