import { useCallback, type CSSProperties } from "react";
import clsx from "clsx";
import {
  AudioWaveform,
  Drum,
  Guitar,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Timer,
} from "lucide-react";
import { useProgressionState } from "../../hooks/useProgressionState";
import { useScaleState } from "../../hooks/useScaleState";
import styles from "./ProgressionTrack.module.css";
import { ProgressionBlock } from "./ProgressionBlock";
import { ProgressionPlayhead } from "./ProgressionPlayhead";
import { ProgressionPositionReadout } from "./ProgressionPositionReadout";

function splitScaleLabel(label: string): { primary: string; secondary: string | null } {
  const match = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) return { primary: match[1].trim(), secondary: match[2].trim() };
  return { primary: label, secondary: null };
}

function durationToBars(
  duration: { value: number; unit: "bar" | "beat" },
  beatsPerBar: number,
): number {
  return duration.unit === "bar" ? duration.value : duration.value / beatsPerBar;
}

export function ProgressionTrack() {
  const {
    progressionTempoBpm,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    progressionStrumEnabled,
    setProgressionStrumEnabled,
    progressionBassEnabled,
    setProgressionBassEnabled,
    progressionDrumsEnabled,
    setProgressionDrumsEnabled,
    progressionMetronomeEnabled,
    setProgressionMetronomeEnabled,
    progressionPlaying,
    progressionPlaybackBlockedReason,
    progressionStepDurationMs,
    setProgressionPlaying,
    advanceProgressionPlayback,
    previousProgressionStep,
    currentProgressionBar,
    totalProgressionBars,
    activeProgressionStepIndex,
    resolvedProgressionSteps,
    setActiveProgressionStepIndex,
    beatsPerBar,
  } = useProgressionState();
  const { scaleLabel } = useScaleState();

  const canPlay = !progressionPlaybackBlockedReason;
  const activeStep = resolvedProgressionSteps[activeProgressionStepIndex] ?? null;
  const activeStepBars = activeStep ? durationToBars(activeStep.duration, beatsPerBar) : 0;
  const totalDurationBars = Math.max(1, totalProgressionBars);
  const totalBarsForDisplay = Math.max(1, Math.ceil(totalProgressionBars));
  const scale = splitScaleLabel(scaleLabel);
  const subdivisionsPerBar = Math.max(1, Math.floor(beatsPerBar));

  // Stable callback so memoized ProgressionBlock children don't re-render on
  // every parent render of this component.
  const selectStep = useCallback(
    (index: number) => setActiveProgressionStepIndex(index),
    [setActiveProgressionStepIndex],
  );

  return (
    <section
      role="group"
      aria-label="Progression track"
      className={styles.track}
      data-playing={progressionPlaying ? "true" : undefined}
      title={progressionPlaybackBlockedReason ?? undefined}
    >
      <div className={styles.transportRow}>
        <div className={styles.transportCluster}>
          <button
            type="button"
            className={styles.transportButton}
            onClick={() => previousProgressionStep()}
            disabled={!canPlay}
            aria-label="Previous chord"
          >
            <SkipBack size={13} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={clsx(styles.transportButton, styles.playButton, progressionPlaying && styles["transportButton--accent"])}
            onClick={() => setProgressionPlaying(!progressionPlaying)}
            disabled={!canPlay}
            aria-label={progressionPlaying ? "Pause progression" : "Play progression"}
          >
            {progressionPlaying ? (
              <Pause size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
            ) : (
              <Play size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            className={styles.transportButton}
            onClick={() => advanceProgressionPlayback()}
            disabled={!canPlay}
            aria-label="Next chord"
          >
            <SkipForward size={13} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={clsx(styles.transportButton, progressionLoopEnabled && styles["transportButton--accent"])}
            onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
            aria-pressed={progressionLoopEnabled}
            aria-label="Loop progression"
          >
            <Repeat size={13} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.statusLights} aria-label="Playback status">
          <span className={styles.statusLight} data-active={progressionPlaying ? "true" : undefined}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span className={styles.statusLabel}>Play</span>
          </span>
          <span className={styles.statusLight} data-active={progressionLoopEnabled ? "true" : undefined}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span className={styles.statusLabel}>Loop</span>
          </span>
        </div>

        <div className={styles.instrumentToggles} aria-label="Backing instruments">
          <button
            type="button"
            className={clsx(styles.instrumentToggle, progressionStrumEnabled && styles["instrumentToggle--active"])}
            onClick={() => setProgressionStrumEnabled(!progressionStrumEnabled)}
            aria-pressed={progressionStrumEnabled}
            aria-label="Chord strum"
            title="Chord strum"
          >
            <Guitar size={13} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={clsx(styles.instrumentToggle, progressionBassEnabled && styles["instrumentToggle--active"])}
            onClick={() => setProgressionBassEnabled(!progressionBassEnabled)}
            aria-pressed={progressionBassEnabled}
            aria-label="Bassline"
            title="Bassline"
          >
            <AudioWaveform size={13} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={clsx(styles.instrumentToggle, progressionDrumsEnabled && styles["instrumentToggle--active"])}
            onClick={() => setProgressionDrumsEnabled(!progressionDrumsEnabled)}
            aria-pressed={progressionDrumsEnabled}
            aria-label="Drums"
            title="Drums"
          >
            <Drum size={13} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={clsx(styles.instrumentToggle, progressionMetronomeEnabled && styles["instrumentToggle--active"])}
            onClick={() => setProgressionMetronomeEnabled(!progressionMetronomeEnabled)}
            aria-pressed={progressionMetronomeEnabled}
            aria-label="Metronome"
            title="Metronome"
          >
            <Timer size={13} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <ProgressionPositionReadout
          playing={progressionPlaying && canPlay}
          stepStartBar={currentProgressionBar}
          stepBars={activeStepBars}
          stepDurationMs={progressionStepDurationMs}
          stepIndex={activeProgressionStepIndex}
          totalProgressionBars={totalProgressionBars}
          beatsPerBar={beatsPerBar}
        />

        <div className={styles.contextReadouts}>
          <div className={styles.contextBox}>
            <span className={styles.readoutLabel}>Tempo</span>
            <span className={styles.tempoValue}>
              {progressionTempoBpm}
              <span className={styles.tempoUnit}>BPM</span>
            </span>
          </div>
          <div className={styles.contextBox}>
            <span className={styles.readoutLabel}>Scale</span>
            <span className={styles.scaleValue}>
              <span className={styles.scalePrimary}>{scale.primary}</span>
              {scale.secondary ? (
                <span className={styles.scaleSecondary}>{scale.secondary}</span>
              ) : null}
            </span>
          </div>
        </div>
      </div>

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
            stepBars={activeStepBars}
            stepDurationMs={progressionStepDurationMs}
            stepIndex={activeProgressionStepIndex}
            totalDurationBars={totalDurationBars}
          />
          <div className={styles.blocks}>
            {resolvedProgressionSteps.map((step, index) => (
              <ProgressionBlock
                key={step.id}
                step={step}
                index={index}
                active={index === activeProgressionStepIndex}
                durationBars={durationToBars(step.duration, beatsPerBar)}
                onSelect={selectStep}
              />
            ))}
            {totalBarsForDisplay > totalDurationBars ? (
              <span
                className={styles.blockSpacer}
                style={{ "--duration-bars": String(totalBarsForDisplay - totalDurationBars) } as CSSProperties}
                aria-hidden="true"
              />
            ) : null}
          </div>
        </div>
        {activeStep?.unavailable ? <p className={styles.statusNote}>{activeStep.unavailableReason}</p> : null}
      </div>
    </section>
  );
}
