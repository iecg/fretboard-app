import { type CSSProperties } from "react";
import clsx from "clsx";
import { Pause, Play, Repeat, SkipBack, SkipForward } from "lucide-react";
import { useProgressionState } from "../../hooks/useProgressionState";
import { useScaleState } from "../../hooks/useScaleState";
import { formatProgressionDurationLabel } from "../../progressions/progressionDomain";
import shared from "../shared/shared.module.css";
import styles from "./ProgressionTrack.module.css";

function formatDurationShort(label: string): string {
  return label.replace(" bars", "b").replace(" bar", "b").replace(" beats", "bt").replace(" beat", "bt");
}

function formatPosition(currentBar: number, activeIndex: number, totalBars: number, totalSteps: number): string {
  const bar = String(Math.max(1, currentBar)).padStart(2, "0");
  return `${bar}.${activeIndex + 1} / ${String(totalBars).padStart(2, "0")}.${totalSteps}`;
}

export function ProgressionTrack() {
  const {
    progressionTempoBpm,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    progressionPlaying,
    progressionPlaybackBlockedReason,
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
  const totalDurationBars = Math.max(1, totalProgressionBars);
  const totalBarsForDisplay = Math.max(1, Math.ceil(totalProgressionBars));
  const totalSteps = Math.max(1, resolvedProgressionSteps.length);
  const activeStep = resolvedProgressionSteps[activeProgressionStepIndex] ?? null;
  const playheadLeft = `${Math.max(0, Math.min(100, ((currentProgressionBar - 1) / totalDurationBars) * 100))}%`;

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
            className={shared["control-button"]}
            onClick={() => previousProgressionStep()}
            disabled={!canPlay}
            aria-label="Previous chord"
          >
            <SkipBack size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={clsx(shared["control-button"], styles.playButton)}
            onClick={() => setProgressionPlaying(!progressionPlaying)}
            disabled={!canPlay}
            aria-label={progressionPlaying ? "Pause progression" : "Play progression"}
          >
            {progressionPlaying ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={shared["control-button"]}
            onClick={() => advanceProgressionPlayback()}
            disabled={!canPlay}
            aria-label="Next chord"
          >
            <SkipForward size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={clsx(shared["control-button"], progressionLoopEnabled && styles.loopOn)}
            onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
            aria-pressed={progressionLoopEnabled}
            aria-label="Loop progression"
          >
            <Repeat size={16} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.statusLights} aria-label="Playback status">
          <span className={styles.statusLight} data-active={progressionPlaying ? "true" : undefined}>Play</span>
          <span className={styles.statusLight} data-active={progressionLoopEnabled ? "true" : undefined}>Loop</span>
        </div>

        <div className={styles.positionReadout}>
          <span className={styles.readoutLabel}>Position</span>
          <span className={styles.positionValue}>{formatPosition(currentProgressionBar, activeProgressionStepIndex, totalBarsForDisplay, totalSteps)}</span>
        </div>

        <div className={styles.contextReadouts}>
          <div className={styles.contextBox}>
            <span className={styles.readoutLabel}>Tempo</span>
            <span className={styles.tempoValue}>{progressionTempoBpm}<span>BPM</span></span>
          </div>
          <div className={styles.contextBox}>
            <span className={styles.readoutLabel}>Scale</span>
            <span className={styles.scaleValue}>{scaleLabel}</span>
          </div>
        </div>
      </div>

      <div className={styles.timeline} aria-label="Progression timeline">
        <div
          className={styles.ruler}
          style={{ "--bar-count": totalBarsForDisplay } as CSSProperties}
          aria-hidden="true"
        >
          {Array.from({ length: totalBarsForDisplay }, (_, i) => <span key={i}>{i + 1}</span>)}
        </div>
        <div className={styles.blocks}>
          <span
            className={styles.playhead}
            style={{ left: playheadLeft }}
            data-testid="progression-playhead"
            aria-hidden="true"
          />
          {resolvedProgressionSteps.map((step, index) => {
            const duration = formatProgressionDurationLabel(step.duration);
            const selected = index === activeProgressionStepIndex;
            const durationBars = step.duration.unit === "bar" ? step.duration.value : step.duration.value / beatsPerBar;
            return (
              <button
                key={step.id}
                type="button"
                className={styles.block}
                style={{ "--duration-bars": String(durationBars) } as CSSProperties}
                data-active={selected ? "true" : undefined}
                data-unavailable={step.unavailable ? "true" : undefined}
                onClick={() => setActiveProgressionStepIndex(index)}
                aria-label={`Step ${index + 1}, ${step.degree}, ${step.resolvedChordLabel ?? "Unavailable"}, ${duration}${selected ? ", active" : ""}`}
              >
                <span className={styles.degreeBadge}>{step.degree}</span>
                <span className={styles.blockText}>
                  <span className={styles.chordName}>{step.resolvedChordLabel ?? step.unavailableReason}</span>
                  <span className={styles.duration}>{formatDurationShort(duration)}</span>
                </span>
              </button>
            );
          })}
        </div>
        {activeStep?.unavailable ? <p className={styles.statusNote}>{activeStep.unavailableReason}</p> : null}
      </div>
    </section>
  );
}
