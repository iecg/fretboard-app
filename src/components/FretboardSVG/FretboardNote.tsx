import React, { memo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { clsx } from "clsx";
import { formatAccidental } from "@fretflow/core";
import { getNoteVisuals } from "./utils/semantics";
import { reduceCircleRadius, taperAwareRadiusScale } from "./utils/noteSizing";
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

// Radial half-length (user units) of a beat-tick mark, centered on the drain
// track (ringR). Each tick is a short radial <line> spanning ringR ± this, so it
// crosses the track band (core stroke-width 2.75 → half-width ~1.375) and reads
// as a clock tick ON the track. Anchoring to ringR — each note's OWN track radius
// (ringR = r + standoff) — places the tick precisely on the track for both chord
// tones and in-scale tones despite their different marker sizes, with no per-type
// parameters. Kept ≤ the halo half-width (~2.375) so the tick stays within the
// ring's footprint and never spurs into bare wood.
const TICK_HALF_LEN = 2;

interface FretboardNoteProps {
  note: RenderedFretboardNote;
  noteBubblePx: number;
  displayFormat: "notes" | "degrees" | "none";
  /** Layout geometry for taper-aware sizing. Omitted → no shrink (scale 1). */
  neckWidthPx?: number;
  neckHeight?: number;
  numStrings?: number;
  /** Window-fractions (0,1) for static beat-tick notches on the countdown ring. */
  countdownTicks?: number[];
  onNoteClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
}

export const FretboardNote = memo(function FretboardNote({
  note,
  noteBubblePx,
  displayFormat,
  neckWidthPx,
  neckHeight,
  numStrings,
  countdownTicks,
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
  const guidePhase = transitionRole === "guide-target" ? "landing" : undefined;

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

  // Target ring standoff: a clamped-proportional gap so the ring reads as a
  // halo (not a second border) at every marker size. A fixed gap is a larger
  // fraction of a small recessed note than a large chord note; scaling by
  // markerR keeps the breathing-room ratio constant, floored/capped so it never
  // sub-pixels or balloons.
  const ringR = r + Math.min(6, Math.max(3, r * 0.22));

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
      {/* Target backing disc — ground-lifts a recessed (hollow) target note so
          the ring frames a legible body instead of empty wood. Rendered BEHIND
          the marker shape + label: on a filled chord note the opaque fill hides
          it (graceful degrade), on a hollow note it shows through. Incoming hue
          so it reads as the same "next target" signal as the ring. */}
      {guidePhase && (
        <circle
          className={styles["note-target-backing"]}
          data-guide-phase={guidePhase}
          cx={cx}
          cy={cy}
          r={r}
          aria-hidden="true"
        />
      )}
      {shapeEl}
      {/* Countdown target ring. A dark halo under a coloured core (a 2-colour
          "Oreo" ring) keeps it legible over any fill and on light or dark wood.
          Drawn ON TOP of the marker (after shapeEl): a filled chord/root note is
          opaque and — enlarged by the taper scale + the root's playback radius
          boost — would otherwise occlude the ring's inner edge, leaving only a
          sliver. The ring sits at a standoff OUTSIDE the marker, so painting it
          last keeps the full halo + core visible on every note type.
          The core DRAINS clockwise over the whole countdown window (CSS), with a
          brightness ramp + gentle looming scale escalating toward the beat;
          motion owns the group OPACITY so AnimatePresence fades it in on mount
          and OUT on removal — decoupling the fade-out from React's
          startTransition-jittered unmount (the boundary flash). */}
      <AnimatePresence>
        {guidePhase && (
          <motion.g
            key="guide-ring"
            className={styles["note-guide-ring"]}
            data-guide-ring="true"
            data-guide-phase={guidePhase}
            // Only "primary" targets (inside the active shape region) get the
            // animated countdown — humans can phase-track only ~4 simultaneous
            // "clocks" (Gu et al. 2014), and a guide tone lights up at every
            // fretboard position. Secondary targets stay as quiet static markers.
            data-guide-primary={note.isInRegion ? "true" : "false"}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            // Primary targets hold full group opacity; the escalating salience
            // comes from the core's brightness ramp + looming scale over the
            // countdown window, not a dimmer group. Secondary (out-of-region)
            // targets are quiet static markers at reduced opacity.
            animate={{ opacity: note.isInRegion ? 1 : 0.4 }}
            exit={{ opacity: 0 }}
            transition={guideFade}
            style={{ transformBox: "fill-box", transformOrigin: "center" } as React.CSSProperties}
          >
            <circle className={styles["note-guide-ring-halo"]} cx={cx} cy={cy} r={ringR} />
            <circle
              className={styles["note-guide-ring-core"]}
              cx={cx}
              cy={cy}
              r={ringR}
              pathLength={100}
            />
            {/* On-beat flash — a bright ring that blooms outward as the core
                drains empty, giving a sharp coincidence landmark exactly on the
                beat (the gradual drain alone has no crisp "now" instant). CSS
                only animates it in the landing phase. */}
            <circle className={styles["note-guide-ring-flash"]} cx={cx} cy={cy} r={ringR} />
            {/* Static beat-tick marks — short BRIGHT radial ticks centered on the
                drain track (ringR) at each beat boundary, giving a countable
                "segment done" read as the green core drains past them. Only on
                PRIMARY (in-region) targets, and only when the step has enough
                beats to warrant ticks (countdownTicks empty otherwise). Each is a
                <line> at angle θ = 2π·f (drain origin at 3 o'clock, sweeping
                clockwise), spanning ringR ± TICK_HALF_LEN so it crosses the track
                band — clock ticks: axis-aligned at the 4-beat cardinal positions.
                Anchored to ringR (each note's OWN track radius), so chord tones
                and in-scale tones — different marker sizes, hence different ringR
                — both get ticks precisely on their track without per-type tuning.
                Rendered INSIDE the ring group so the ring's loom scales the ticks
                WITH the track, keeping them locked on it through the countdown. */}
            {note.isInRegion &&
              countdownTicks?.map((f, i) => {
                const theta = 2 * Math.PI * f;
                const cos = Math.cos(theta);
                const sin = Math.sin(theta);
                const inner = ringR - TICK_HALF_LEN;
                const outer = ringR + TICK_HALF_LEN;
                return (
                  <line
                    key={`tick-${i}`}
                    className={styles["note-guide-ring-tick"]}
                    data-guide-tick="true"
                    x1={cx + cos * inner}
                    y1={cy + sin * inner}
                    x2={cx + cos * outer}
                    y2={cy + sin * outer}
                    aria-hidden="true"
                  />
                );
              })}
          </motion.g>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {applyLensEmphasis.guideTargetLabel && (
          <motion.text
            key="guide-label"
            className={styles["note-guide-label"]}
            data-guide-label="true"
            x={cx + ringR + 3}
            y={cy - ringR - 1}
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
