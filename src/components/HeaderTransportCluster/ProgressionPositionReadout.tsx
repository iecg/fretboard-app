import { useEffect, useRef } from "react";
import { getTimelinePosition } from "../../progressions/audio/timeline";
import {
  formatProgressionPlaybackPosition,
  type FormattedPlaybackPositionParts,
} from "../../progressions/progressionDomain";
import styles from "./HeaderTransportCluster.module.css";

interface ProgressionPositionReadoutProps {
  playing: boolean;
  stepStartBar: number;
  stepBars: number;
  stepIndex: number;
  totalProgressionBars: number;
  beatsPerBar: number;
}

/** Position-write interval. Matches a 60 Hz refresh and is short enough that
 *  the subdivision digit's ~1ms resolution stays smooth. `setInterval` (not
 *  rAF) keeps the headless preview ticking; rAF is paused there. */
const TICK_MS = 16;

function PositionDigits({
  parts,
  muted = false,
  refs,
}: {
  parts: FormattedPlaybackPositionParts;
  muted?: boolean;
  refs?: {
    bar: React.RefObject<HTMLSpanElement | null>;
    beat: React.RefObject<HTMLSpanElement | null>;
    sub: React.RefObject<HTMLSpanElement | null>;
  };
}) {
  return (
    <span className={muted ? `${styles.digits} ${styles["digits--muted"]}` : styles.digits}>
      <span className={styles.digitBar} ref={refs?.bar}>{parts.bar}</span>
      <span className={styles.digitDot} aria-hidden="true">.</span>
      <span className={styles.digitBeat} ref={refs?.beat}>{parts.beat}</span>
      <span className={styles.digitDot} aria-hidden="true">.</span>
      <span className={styles.digitSub} ref={refs?.sub}>{parts.subdivision}</span>
    </span>
  );
}

/**
 * Renders the bar / beat / subdivision readout.
 *
 * The component renders React markup once per chord change (when props
 * actually change), then a single `setInterval` tick writes the three
 * dynamic digit spans imperatively via refs. This bypasses the per-frame
 * React reconciliation that the prior implementation triggered ~60 times
 * per second, freeing CPU for the audio scheduler.
 *
 * Reading from the shared audio-clock timeline (`getTimelinePosition()`)
 * keeps the displayed digits locked to what the user hears. On pause, the
 * timeline reports `fraction = 0`, so the digits snap to the start of the
 * current bar — matching the playhead's reset.
 */
export function ProgressionPositionReadout({
  playing,
  stepStartBar,
  stepBars,
  stepIndex,
  totalProgressionBars,
  beatsPerBar,
}: ProgressionPositionReadoutProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const barRef = useRef<HTMLSpanElement | null>(null);
  const beatRef = useRef<HTMLSpanElement | null>(null);
  const subRef = useRef<HTMLSpanElement | null>(null);
  // Last rendered digit values; skip the DOM write when nothing visible
  // would change, so the cost on the position-readout subtree is one
  // string comparison per tick when the bar is held / paused.
  const lastBarRef = useRef<string>("");
  const lastBeatRef = useRef<string>("");
  const lastSubRef = useRef<string>("");

  // Store chord-boundary props in refs so the animation loop can access
  // the latest values without needing to be cleared and restarted
  // at every transition.
  const propsRef = useRef({ stepStartBar, stepBars, stepIndex, totalProgressionBars, beatsPerBar });
  useEffect(() => {
    propsRef.current = { stepStartBar, stepBars, stepIndex, totalProgressionBars, beatsPerBar };
  }, [stepStartBar, stepBars, stepIndex, totalProgressionBars, beatsPerBar]);

  // Initial / chord-change static render: the bar/total parts come from
  // props (or a fallback) so SSR and the first paint are correct.
  const initialPosition = formatProgressionPlaybackPosition(
    stepStartBar,
    totalProgressionBars,
    beatsPerBar,
  );

  useEffect(() => {
    const write = (positionBar: number) => {
      const { totalProgressionBars: currentTotalBars, beatsPerBar: currentBPB } = propsRef.current;
      const p = formatProgressionPlaybackPosition(
        positionBar,
        currentTotalBars,
        currentBPB,
      );
      const { bar, beat, subdivision } = p.parts.current;
      if (bar !== lastBarRef.current && barRef.current) {
        barRef.current.textContent = bar;
        lastBarRef.current = bar;
      }
      if (beat !== lastBeatRef.current && beatRef.current) {
        beatRef.current.textContent = beat;
        lastBeatRef.current = beat;
      }
      if (subdivision !== lastSubRef.current && subRef.current) {
        subRef.current.textContent = subdivision;
        lastSubRef.current = subdivision;
      }

      // Update aria-label imperatively so screen readers stay in sync with
      // the high-frequency visual updates.
      if (containerRef.current) {
        containerRef.current.setAttribute(
          "aria-label",
          `Position ${p.current} of ${p.total}`,
        );
      }
    };

    const tick = () => {
      const tl = getTimelinePosition();
      const {
        stepStartBar: currentStepStartBar,
        stepBars: currentStepBars,
        stepIndex: currentStepIndex,
      } = propsRef.current;

      const live =
        playing
        && tl
        && tl.stepIndex === currentStepIndex
        && !tl.paused
        && currentStepBars > 0;
      const positionBar = live ? currentStepStartBar + tl.localFraction * currentStepBars : currentStepStartBar;
      write(positionBar);
    };

    // Reset the cached digit values so the first tick force-writes after a
    // chord boundary — even if the computed digits happen to match the
    // outgoing chord's last frame, the refs still need to settle to the
    // new step's start.
    lastBarRef.current = "";
    lastBeatRef.current = "";
    lastSubRef.current = "";
    tick();

    if (!playing) return;
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  return (
    <div className={styles.positionReadout}>
      <span className={styles.readoutLabel}>Position</span>
      <span
        ref={containerRef}
        className={styles.positionValue}
        role="status"
        aria-label={`Position ${initialPosition.current} of ${initialPosition.total}`}
      >
        <span className={styles.positionCurrent}>
          <PositionDigits
            parts={initialPosition.parts.current}
            refs={{ bar: barRef, beat: beatRef, sub: subRef }}
          />
        </span>
        <span className={styles.positionSeparator} aria-hidden="true">/</span>
        <span className={styles.positionTotal}>
          <PositionDigits parts={initialPosition.parts.total} muted />
        </span>
      </span>
    </div>
  );
}
