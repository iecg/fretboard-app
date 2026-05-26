import { useCallback, type CSSProperties } from "react";
import { useSetAtom } from "jotai";
import clsx from "clsx";
import { setProgressionActiveStepIndexAtom } from "../../store/progressionAtoms";
import { useTimelineViewModel } from "./hooks/useTimelineViewModel";
import styles from "./ProgressionTrack.module.css";
import { ProgressionBlock } from "./ProgressionBlock";
import { ProgressionPlayhead } from "./ProgressionPlayhead";

export function ProgressionTrack() {
  const {
    blockLayouts,
    totalDurationBars,
    totalBarsForDisplay,
    subdivisionsPerBar,
    steps,
    activeStepIndex,
    displayedStepIndex,
    canPlay,
    playing,
    transportStartBar,
    playbackBlockedReason,
  } = useTimelineViewModel();

  const setActiveStep = useSetAtom(setProgressionActiveStepIndexAtom);
  const activeStep = steps[activeStepIndex] ?? null;

  // Stable callback so memoized ProgressionBlock children don't re-render on
  // every parent render of this component.
  const selectStep = useCallback(
    (index: number) => {
      if (playing) return;
      setActiveStep(index);
    },
    [setActiveStep, playing],
  );

  return (
    <section
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
        } as CSSProperties}
        aria-label="Progression timeline"
      >
        <div className={styles.ruler} aria-hidden="true">
          {Array.from({ length: totalBarsForDisplay }, (_, i) => (
            <span key={i} className={styles.rulerBar}>
              {i > 0 ? <span className={styles.rulerBarTick} /> : null}
              <span className={styles.rulerBarNumber}>{i + 1}</span>
              {Array.from({ length: 2 * subdivisionsPerBar - 1 }, (__, j) => {
                const offset = (j + 1) / (2 * subdivisionsPerBar);
                const isBeat = (j + 1) % 2 === 0;
                return (
                  <span
                    key={j}
                    className={clsx(styles.rulerTick, isBeat && styles["rulerTick--beat"])}
                    style={{ left: `${offset * 100}%` } as CSSProperties}
                  />
                );
              })}
            </span>
          ))}
        </div>
        <div className={styles.lane}>
          <ProgressionPlayhead
            playing={playing && canPlay}
            stepStartBar={transportStartBar}
            totalDurationBars={totalDurationBars}
            totalBarsForDisplay={totalBarsForDisplay}
          />
          <div className={styles.blocks}>
            {steps.map((step, index) => {
              const layout = blockLayouts[index] ?? {
                durationBars: 0,
                startPercent: 0,
                widthPercent: 0,
              };
              return (
                <ProgressionBlock
                  key={step.id}
                  step={step}
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
          </div>
        </div>
        {playbackBlockedReason ? (
          <p className={styles.statusNote} role="status">{playbackBlockedReason}</p>
        ) : activeStep?.unavailable ? (
          <p className={styles.statusNote} role="status">{activeStep.unavailableReason}</p>
        ) : null}
      </div>
    </section>
  );
}
