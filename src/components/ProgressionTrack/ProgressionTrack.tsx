import { useCallback, type CSSProperties } from "react";
import clsx from "clsx";
import { useProgressionState } from "../../hooks/useProgressionState";
import styles from "./ProgressionTrack.module.css";
import { ProgressionBlock } from "./ProgressionBlock";
import { ProgressionPlayhead } from "./ProgressionPlayhead";

function durationToBars(
  duration: { value: number; unit: "bar" | "beat" },
  beatsPerBar: number,
): number {
  return duration.unit === "bar" ? duration.value : duration.value / beatsPerBar;
}

function getProgressionBlockLayouts(
  steps: readonly { duration: { value: number; unit: "bar" | "beat" } }[],
  beatsPerBar: number,
  totalBarsForDisplay: number,
): Array<{ durationBars: number; startPercent: number; widthPercent: number }> {
  let elapsedBars = 0;
  return steps.map((step) => {
    const durationBars = durationToBars(step.duration, beatsPerBar);
    const layout = {
      durationBars,
      startPercent: (elapsedBars / totalBarsForDisplay) * 100,
      widthPercent: (durationBars / totalBarsForDisplay) * 100,
    };
    elapsedBars += durationBars;
    return layout;
  });
}

export function ProgressionTrack() {
  const {
    progressionPlaying,
    progressionPlaybackBlockedReason,
    currentProgressionBar,
    totalProgressionBars,
    activeProgressionStepIndex,
    resolvedProgressionSteps,
    setActiveProgressionStepIndex,
    beatsPerBar,
  } = useProgressionState();

  const canPlay = !progressionPlaybackBlockedReason;
  const activeStep = resolvedProgressionSteps[activeProgressionStepIndex] ?? null;
  const totalDurationBars = Math.max(1, totalProgressionBars);
  const totalBarsForDisplay = Math.max(1, Math.ceil(totalProgressionBars));
  const subdivisionsPerBar = Math.max(1, Math.floor(beatsPerBar));
  const blockLayouts = getProgressionBlockLayouts(
    resolvedProgressionSteps,
    beatsPerBar,
    totalBarsForDisplay,
  );

  // Stable callback so memoized ProgressionBlock children don't re-render on
  // every parent render of this component.
  const selectStep = useCallback(
    (index: number) => {
      if (progressionPlaying) return;
      setActiveProgressionStepIndex(index);
    },
    [setActiveProgressionStepIndex, progressionPlaying],
  );

  return (
    <section
      role="group"
      aria-label="Progression track"
      className={styles.track}
      data-playing={progressionPlaying ? "true" : undefined}
      title={progressionPlaybackBlockedReason ?? undefined}
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
            playing={progressionPlaying && canPlay}
            stepStartBar={currentProgressionBar}
            totalDurationBars={totalDurationBars}
            totalBarsForDisplay={totalBarsForDisplay}
          />
          <div className={styles.blocks}>
            {resolvedProgressionSteps.map((step, index) => {
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
                  active={index === activeProgressionStepIndex}
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
        {progressionPlaybackBlockedReason ? (
          <p className={styles.statusNote} role="status">{progressionPlaybackBlockedReason}</p>
        ) : activeStep?.unavailable ? (
          <p className={styles.statusNote} role="status">{activeStep.unavailableReason}</p>
        ) : null}
      </div>
    </section>
  );
}
