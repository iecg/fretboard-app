import { memo } from "react";
import { clsx } from "clsx";
import { formatAccidental } from "@fretflow/core";
import styles from "./FretboardSVG.module.css";
import type { NoteData } from "./hooks/useNoteData";

const NOTE_CLASS_ROLE: Record<string, string> = {
  "root-active": "root",
  "chord-tone": "chord tone",
  "note-blue": "blue note",
  "note-active": "scale tone",
  "note-scale-only": "scale tone",
  "chord-outside": "chord outside",
};

interface FretboardHitTargetLayerProps {
  noteData: NoteData[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
  noteBubblePx: number;
  noteFontPx: number;
  neckWidthPx: number;
  neckHeight: number;
  onNoteClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
}

export const FretboardHitTargetLayer = memo(({
  noteData,
  fretCenterX,
  stringYAt,
  noteBubblePx,
  noteFontPx,
  neckWidthPx,
  neckHeight,
  onNoteClick,
}: FretboardHitTargetLayerProps) => {
  return (
    <div
      className={styles["fretboard-a11y-layer"]}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: neckWidthPx,
        height: neckHeight,
      }}
    >
      {noteData.map(({ stringIndex, fretIndex, noteClass, displayValue, isHidden, noteName, isTension, isGuideTone }) => {
        const cx = fretCenterX(fretIndex);
        const cy = stringYAt(stringIndex, cx);
        const r = noteBubblePx / 2;
        return (
          <button
            key={`btn-${stringIndex}-${fretIndex}`}
            type="button"
            onClick={
              onNoteClick
                ? () => onNoteClick(stringIndex, fretIndex, noteName)
                : undefined
            }
            disabled={!onNoteClick}
            aria-hidden={isHidden || undefined}
            tabIndex={isHidden ? -1 : undefined}
            aria-label={`${formatAccidental(displayValue)} on string ${stringIndex + 1}, fret ${fretIndex}${NOTE_CLASS_ROLE[noteClass] ? `, ${NOTE_CLASS_ROLE[noteClass]}` : ""}`}
            data-note-role={noteClass !== "note-inactive" ? noteClass : undefined}
            data-note-tension={isTension || undefined}
            data-note-guide-tone={isGuideTone || undefined}
            className={clsx(
              styles["note-bubble"],
              styles[noteClass],
              isHidden && "hidden",
            )}
            style={{
              position: "absolute",
              left: cx - r,
              top: cy - r,
              width: noteBubblePx,
              height: noteBubblePx,
              fontSize: `${noteFontPx}px`,
              opacity: 0,
              pointerEvents: onNoteClick ? "auto" : "none",
            }}
          />
        );
      })}
    </div>
  );
});
FretboardHitTargetLayer.displayName = "FretboardHitTargetLayer";
