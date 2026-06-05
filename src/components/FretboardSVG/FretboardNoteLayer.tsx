import { memo } from "react";
import { FretboardNote } from "./FretboardNote";
import type { NoteAnimationMode } from "./motionPolicy";
import type { RenderedFretboardNote } from "./hooks/useAnimatedFretboardView";

interface FretboardNoteLayerProps {
  notes: RenderedFretboardNote[];
  noteBubblePx: number;
  displayFormat: "notes" | "degrees" | "none";
  animationMode?: NoteAnimationMode;
  /** Layout geometry for taper-aware sizing. Omitted → no shrink (scale 1). */
  neckWidthPx?: number;
  neckHeight?: number;
  numStrings?: number;
}

// This visual layer is decorative (its <svg> is aria-hidden + pointer-events:none).
// It intentionally does NOT receive onNoteClick: feeding a handler here would make
// FretboardNote's notes focusable (role/tabIndex) inside an aria-hidden subtree —
// invalid ARIA and dead duplicate tab stops. Interaction is owned by
// FretboardHitTargetLayer's real <button>s.
export const FretboardNoteLayer = memo(({
  notes,
  noteBubblePx,
  displayFormat,
  animationMode = "css",
  neckWidthPx,
  neckHeight,
  numStrings,
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
        neckWidthPx={neckWidthPx}
        neckHeight={neckHeight}
        numStrings={numStrings}
      />
    ))}
  </g>
));
FretboardNoteLayer.displayName = "FretboardNoteLayer";
