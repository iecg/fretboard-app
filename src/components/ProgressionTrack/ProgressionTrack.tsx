import { useCallback, useRef, type CSSProperties } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import {
  setProgressionActiveStepIndexAtom,
  activeResolvedProgressionStepAtom,
  addProgressionStepAtom,
} from "../../store/progressionAtoms";
import { useTimelineViewModel } from "./hooks/useTimelineViewModel";
import { useTimelineAutoScroll } from "./hooks/useTimelineAutoScroll";
import styles from "./ProgressionTrack.module.css";
import { ProgressionBlock } from "./ProgressionBlock";
import { ProgressionPlayhead } from "./ProgressionPlayhead";
import { ProgressionRuler } from "./ProgressionRuler";

// Readable floor (in rem) for the shortest-duration block on mobile. The whole
// timeline is scaled so the shortest block reaches this width; longer blocks
// grow proportionally, preserving ruler/playhead alignment.
const MIN_BLOCK_REM = 5.25;

export function ProgressionTrack() {
  const {
    blockLayouts,
    totalDurationBars,
    totalBarsForDisplay,
    subdivisionsPerBar,
    shortestDurationBars,
    stepAtoms,
    displayedStepIndex,
    canPlay,
    playing,
    transportStartBar,
    playbackBlockedReason,
  } = useTimelineViewModel();

  const setActiveStep = useSetAtom(setProgressionActiveStepIndexAtom);
  const activeStep = useAtomValue(activeResolvedProgressionStepAtom);
  const addProgressionStep = useSetAtom(addProgressionStepAtom);

  // Stable callback so memoized ProgressionBlock children don't re-render on
  // every parent render of this component.
  const selectStep = useCallback(
    (index: number) => {
      if (playing) return;
      setActiveStep(index);
    },
    [setActiveStep, playing],
  );

  const trackRef = useRef<HTMLElement>(null);
  useTimelineAutoScroll(trackRef, displayedStepIndex);

  const mobileTimelineMinWidthRem =
    (totalBarsForDisplay / shortestDurationBars) * MIN_BLOCK_REM;

  return (
    <section
      ref={trackRef}
      role="group"
      aria-label="Progression track"
      className={styles.track}
      data-playing={playing ? "true" : undefined}
      title={playbackBlockedReason ?? undefined}
    >
      <div
        className={styles.timeline}
        style={{
          "--bar-count": totalBarsForDisplay,
          "--beats-per-bar": subdivisionsPerBar,
          "--mobile-timeline-min-width": `${mobileTimelineMinWidthRem}rem`,
        } as CSSProperties}
        aria-label="Progression timeline"
      >
        <ProgressionRuler
          totalBarsForDisplay={totalBarsForDisplay}
          subdivisionsPerBar={subdivisionsPerBar}
        />
        <div className={styles.lane}>
          <ProgressionPlayhead
            playing={playing && canPlay}
            stepStartBar={transportStartBar}
            totalDurationBars={totalDurationBars}
            totalBarsForDisplay={totalBarsForDisplay}
          />
          <div className={styles.blocks}>
            {stepAtoms.map((stepAtom, index) => {
              const layout = blockLayouts[index] ?? {
                durationBars: 0,
                startPercent: 0,
                widthPercent: 0,
              };
              return (
                <ProgressionBlock
                  key={`${stepAtom}`}
                  stepAtom={stepAtom}
                  index={index}
                  active={index === displayedStepIndex}
                  durationBars={layout.durationBars}
                  startPercent={layout.startPercent}
                  widthPercent={layout.widthPercent}
                  onSelect={selectStep}
                />
              );
            })}
            {totalBarsForDisplay > totalDurationBars ? (
              <span
                className={styles.blockSpacer}
                style={{
                  "--duration-bars": String(totalBarsForDisplay - totalDurationBars),
                  left: `${(totalDurationBars / totalBarsForDisplay) * 100}%`,
                  width: `${((totalBarsForDisplay - totalDurationBars) / totalBarsForDisplay) * 100}%`,
                } as CSSProperties}
                aria-hidden="true"
              />
            ) : null}
            {stepAtoms.length === 0 && (
              <button
                type="button"
                className={styles.emptyStateBlock}
                style={{
                  "--duration-bars": "1",
                  left: "0%",
                  width: "calc(100% - 3px)",
                } as CSSProperties}
                onClick={() => addProgressionStep()}
                aria-label="Add a chord to start playback"
              >
                <span className={styles.degreeBadge}>+</span>
                <span className={styles.blockText}>
                  <span className={styles.chordName}>Add a chord</span>
                  <span className={styles.duration}>To start playback</span>
                </span>
              </button>
            )}
          </div>
        </div>
        {playbackBlockedReason && stepAtoms.length > 0 ? (
          <p className={styles.statusNote} role="status">{playbackBlockedReason}</p>
        ) : activeStep?.unavailable ? (
          <p className={styles.statusNote} role="status">{activeStep.unavailableReason}</p>
        ) : null}
      </div>
    </section>
  );
}
