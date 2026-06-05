import React, { memo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { clsx } from "clsx";
import { formatAccidental } from "@fretflow/core";
import { getNoteVisuals } from "./utils/semantics";
import { glowUnderlayRadiusPx, reduceCircleRadius, taperAwareRadiusScale } from "./utils/noteSizing";
import styles from "./FretboardSVG.module.css";
import type { RenderedFretboardNote } from "./hooks/useAnimatedFretboardView";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "root-active": "scale root",
  "chord-root": "chord root",
  "chord-root-outside": "chord root (outside key)",
  "chord-tone": "chord tone",
  "chord-tone-in-scale": "chord tone in scale",
  "chord-tone-outside-scale": "chord tone outside scale",
  "note-diatonic-chord": "diatonic chord tone",
  "note-blue": "blue note",
  "note-active": "scale note",
  "note-scale-only": "scale note",
  "chord-outside": "chord tone outside scale",
  "color-tone": "color tone",
  "key-tonic": "key tonic",
  "note-inactive": "inactive",
};

const formatRole = (noteClass: string): string =>
  ROLE_DESCRIPTIONS[noteClass] ?? noteClass.replace(/-/g, " ");

interface FretboardNoteProps {
  note: RenderedFretboardNote;
  noteBubblePx: number;
  displayFormat: "notes" | "degrees" | "none";
  /** Layout geometry for taper-aware sizing. Omitted → no shrink (scale 1). */
  neckWidthPx?: number;
  neckHeight?: number;
  numStrings?: number;
  onNoteClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
}

export const FretboardNote = memo(function FretboardNote({
  note,
  noteBubblePx,
  displayFormat,
  neckWidthPx,
  neckHeight,
  numStrings,
  onNoteClick,
}: FretboardNoteProps) {
  const {
    stringIndex,
    fretIndex,
    noteName,
    cx,
    cy,
    octave,
    noteClass,
    displayName,
    displayValue,
    applyDimOpacity,
    applyLensEmphasis,
    isHidden,
    isTension,
    isGuideTone,
    fullChordShape,
    transitionRole,
  } = note;

  const prefersReducedMotion = useReducedMotion();
  const guideFade = { duration: prefersReducedMotion ? 0 : 0.18, ease: "easeOut" as const };

  const baseRadius = noteBubblePx / 2;
  const { radiusScale, noteShape } = getNoteVisuals(noteClass);
  const taperScale = taperAwareRadiusScale({
    x: cx,
    neckWidthPx: neckWidthPx ?? 0,
    neckHeight: neckHeight ?? 0,
    numStrings: numStrings ?? 0,
    noteBubblePx,
  });
  const rawRadius = baseRadius * radiusScale * taperScale;
  const r = reduceCircleRadius(rawRadius);
  const glowR = glowUnderlayRadiusPx(r);

  const shapeEl =
    noteShape === "diamond" ? (
      <polygon
        points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
      />
    ) : (
      <circle cx={cx} cy={cy} r={r} />
    );

  const baseOpacity = applyDimOpacity ? 0.8 : 1;
  const finalOpacity = baseOpacity * applyLensEmphasis.opacityBoost;
  const roleLabel = formatRole(noteClass);
  // Announce the same flat/sharp spelling sighted users see (e.g. "B♭", not the
  // internal sharp "A#"). displayName carries the scale-aware spelling. #493
  const ariaLabel = `${formatAccidental(displayName)}${octave} — ${roleLabel}`;
  const interactive = !!onNoteClick && !isHidden;
  return (
    <g
      className={clsx(
        styles["fretboard-note"],
        styles[noteClass],
        isHidden && "hidden",
      )}
      role={interactive ? "button" : undefined}
      aria-label={ariaLabel}
      aria-hidden={isHidden || undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={
        interactive
          ? () => onNoteClick!(stringIndex, fretIndex, noteName)
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNoteClick!(stringIndex, fretIndex, noteName);
              }
            }
          : undefined
      }
      data-note-role={noteClass !== "note-inactive" ? noteClass : undefined}
      data-note-shape={noteShape}
      data-note-tension={isTension || undefined}
      data-note-guide-tone={isGuideTone || undefined}
      data-full-chord-mode={fullChordShape || undefined}
      data-transition-role={transitionRole ?? undefined}
      data-in-region={note.isInRegion ? "true" : undefined}
      style={{
        "--note-r": r,
        "--emph-scale": applyLensEmphasis.radiusBoost,
        // Pin the emphasis scale to the note's FIXED geometric center in user
        // space. `transform-box: fill-box` + `transform-origin: center` would
        // pivot about the element's BOUNDING-BOX center, which moves whenever
        // the marker's radius changes (the bbox is asymmetric — guide ring,
        // guide label, and value text extend it past (cx,cy)). On a chord
        // transition that shifted pivot translated the marker ("jitter").
        // Anchoring to (cx,cy) keeps the center stable so only size/shape/color
        // change, never position.
        transformOrigin: `${cx}px ${cy}px`,
        transform: "scale(var(--emph-scale, 1))",
        opacity: finalOpacity !== 1 ? finalOpacity : undefined,
      } as React.CSSProperties}
    >
      <circle
        className={styles["note-glow-underlay"]}
        cx={cx}
        cy={cy}
        r={glowR}
        style={applyLensEmphasis.glowColor ? { fill: applyLensEmphasis.glowColor } : undefined}
        data-glow={applyLensEmphasis.glowColor ? "on" : "off"}
        aria-hidden="true"
      />
      {/* Guide-target countdown ring. CSS animates the scale CONTRACTION (the
          beat countdown, timed to --lead-in-duration); motion owns OPACITY so
          AnimatePresence fades it in on mount and OUT on removal — decoupling
          the fade-out from React's (startTransition-jittered) unmount timing,
          which is what caused the boundary flash. The ring lands bright on the
          beat, then fades as the chord arrives. */}
      <AnimatePresence>
        {transitionRole === "guide-target" && (
          <motion.circle
            key="guide-ring"
            className={styles["note-guide-ring"]}
            data-guide-ring="true"
            cx={cx}
            cy={cy}
            r={r + 4}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.95 }}
            exit={{ opacity: 0 }}
            transition={guideFade}
          />
        )}
      </AnimatePresence>
      {shapeEl}
      <AnimatePresence>
        {applyLensEmphasis.guideTargetLabel && (
          <motion.text
            key="guide-label"
            className={styles["note-guide-label"]}
            data-guide-label="true"
            x={cx + r + 2}
            y={cy - r - 2}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={guideFade}
          >
            {applyLensEmphasis.guideTargetLabel}
          </motion.text>
        )}
      </AnimatePresence>
      {displayFormat !== "none" && (
        <text x={cx} y={cy}>
          {formatAccidental(displayValue)}
        </text>
      )}
    </g>
  );
});
