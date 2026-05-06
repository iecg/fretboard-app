import { memo, useMemo, useCallback } from "react";
import { useSetAtom } from "jotai";
import { clsx } from "clsx";
import { formatAccidental } from "../../core/theory";
import { activeVoicingKeyAtom } from "../../store/atoms";
import styles from "./FretboardSVG.module.css";
import type { NoteData } from "./hooks/useNoteData";
import type { ChordConnectorVoicing } from "./hooks/useChordConnectorPolylines";

/**
 * Chord-tone note classes that trigger active-voicing emphasis.
 * Non-chord-tone roles (note-inactive, scale-only, color-tone, etc.) are
 * no-ops on hover/focus — they must not change or clear the active state.
 */
const CHORD_TONE_ROLES = new Set([
  "chord-tone",
  "chord-tone-in-scale",
  "chord-tone-outside-scale",
  "chord-root",
  "note-diatonic-chord",
  "note-active",
  "note-blue",
  "root-active",
]);

interface FretboardHitTargetLayerProps {
  noteData: NoteData[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
  noteBubblePx: number;
  noteFontPx: number;
  neckWidthPx: number;
  neckHeight: number;
  onNoteClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
  connectorVoicings: ChordConnectorVoicing[];
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
  connectorVoicings,
}: FretboardHitTargetLayerProps) => {
  const setActiveVoicingKey = useSetAtom(activeVoicingKeyAtom);

  /**
   * Lookup map from coordinate key "stringIndex,fretIndex" to voicingKey.
   * Built from the connector voicings passed in as a prop.
   * The canonical key format matches useChordConnectorPolylines: "si,fi" pairs.
   *
   * ChordConnectorVoicing carries raw vertices (x,y pixels) but the voicingKey
   * is derived from the sorted (stringIndex,fretIndex) pairs. To resolve
   * membership at hover-time without re-doing geometry, we search the voicings
   * list by matching pixel coordinates of the hovered note against each vertex.
   * For voicings with few vertices this is O(voicings * vertices_per_voicing)
   * and happens at most once per mouse-enter event.
   */
  const voicingKeyByCoord = useMemo(() => {
    // Map pixel coordinate (as a string "cx~cy") to voicingKey.
    // We snap to the same geometry functions used in the render path so floats
    // agree when the same inputs are passed in.
    const map = new Map<string, string>();
    for (const voicing of connectorVoicings) {
      for (const v of voicing.vertices) {
        map.set(`${v.x}~${v.y}`, voicing.voicingKey);
      }
    }
    return map;
  }, [connectorVoicings]);

  const handleNoteEnter = useCallback(
    (stringIndex: number, fretIndex: number, noteClass: string) => {
      if (!CHORD_TONE_ROLES.has(noteClass)) return;
      const cx = fretCenterX(fretIndex);
      const cy = stringYAt(stringIndex, cx);
      const key = voicingKeyByCoord.get(`${cx}~${cy}`) ?? null;
      setActiveVoicingKey(key);
    },
    [voicingKeyByCoord, fretCenterX, stringYAt, setActiveVoicingKey],
  );

  const handleNoteLeave = useCallback(() => {
    setActiveVoicingKey(null);
  }, [setActiveVoicingKey]);

  const handleNoteFocus = useCallback(
    (stringIndex: number, fretIndex: number, noteClass: string) => {
      if (!CHORD_TONE_ROLES.has(noteClass)) return;
      const cx = fretCenterX(fretIndex);
      const cy = stringYAt(stringIndex, cx);
      const key = voicingKeyByCoord.get(`${cx}~${cy}`) ?? null;
      setActiveVoicingKey(key);
    },
    [voicingKeyByCoord, fretCenterX, stringYAt, setActiveVoicingKey],
  );

  const handleNoteBlur = useCallback(() => {
    setActiveVoicingKey(null);
  }, [setActiveVoicingKey]);

  return (
    <div
      className={styles["fretboard-a11y-layer"]}
      style={{
        position: "absolute",
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
            onMouseEnter={() => handleNoteEnter(stringIndex, fretIndex, noteClass)}
            onMouseLeave={handleNoteLeave}
            onFocus={() => handleNoteFocus(stringIndex, fretIndex, noteClass)}
            onBlur={handleNoteBlur}
            disabled={!onNoteClick}
            aria-hidden={isHidden || undefined}
            tabIndex={isHidden ? -1 : undefined}
            aria-label={`${formatAccidental(displayValue)} on string ${stringIndex + 1}, fret ${fretIndex}`}
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
