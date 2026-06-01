import { memo } from "react";
import { FretboardNote } from "./FretboardNote";
import type { NoteAnimationMode } from "./motionPolicy";
import type { RenderedFretboardNote } from "./hooks/useAnimatedFretboardView";

interface FretboardNoteLayerProps {
  notes: RenderedFretboardNote[];
  noteBubblePx: number;
  displayFormat: "notes" | "degrees" | "none";
  degreeColorsEnabled?: boolean;
  onNoteClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
  animationMode?: NoteAnimationMode;
}

export const FretboardNoteLayer = memo(({
  notes,
  noteBubblePx,
  displayFormat,
  degreeColorsEnabled,
  onNoteClick,
  animationMode = "css",
}: FretboardNoteLayerProps) => (
  // NOTE: reading a new render-affecting field in FretboardNote? Also add it to
  // `renderedNoteSignature` in useAnimatedFretboardView.ts, or cached notes will
  // render stale (and the per-note memo below will skip the update).
  <g data-motion={animationMode}>
    {notes.map((note) => (
      <FretboardNote
        key={`note-${note.stringIndex}-${note.fretIndex}`}
        note={note}
        noteBubblePx={noteBubblePx}
        displayFormat={displayFormat}
        degreeColorsEnabled={degreeColorsEnabled}
        onNoteClick={onNoteClick}
      />
    ))}
  </g>
));
FretboardNoteLayer.displayName = "FretboardNoteLayer";
