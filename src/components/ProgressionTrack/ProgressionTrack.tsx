import { type CSSProperties } from "react";
import clsx from "clsx";
import { Pause, Play, Repeat, SkipBack, SkipForward } from "lucide-react";
import { useProgressionState } from "../../hooks/useProgressionState";
import { useScaleState } from "../../hooks/useScaleState";
import {
  formatProgressionDurationLabel,
  formatProgressionPlaybackPosition,
  type FormattedPlaybackPositionParts,
} from "../../progressions/progressionDomain";
import styles from "./ProgressionTrack.module.css";

function formatDurationShort(label: string): string {
  return label
    .replace(" bars", "B")
    .replace(" bar", "B")
    .replace(" beats", "bt")
    .replace(" beat", "bt");
}

function splitScaleLabel(label: string): { primary: string; secondary: string | null } {
  const match = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) return { primary: match[1].trim(), secondary: match[2].trim() };
  return { primary: label, secondary: null };
}

function PositionDigits({ parts, muted = false }: { parts: FormattedPlaybackPositionParts; muted?: boolean }) {
  return (
    <span className={clsx(styles.digits, muted && styles["digits--muted"])}>
      <span className={styles.digitBar}>{parts.bar}</span>
      <span className={styles.digitDot} aria-hidden="true">.</span>
      <span className={styles.digitBeat}>{parts.beat}</span>
      <span className={styles.digitDot} aria-hidden="true">.</span>
      <span className={styles.digitSub}>{parts.subdivision}</span>
    </span>
  );
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
  const activeStep = resolvedProgressionSteps[activeProgressionStepIndex] ?? null;
  const playheadLeft = `${Math.max(0, Math.min(100, ((currentProgressionBar - 1) / totalDurationBars) * 100))}%`;
  const position = formatProgressionPlaybackPosition(
    currentProgressionBar,
    totalProgressionBars,
    beatsPerBar,
  );
  const scale = splitScaleLabel(scaleLabel);
  const subdivisionsPerBar = Math.max(1, Math.floor(beatsPerBar));

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
            <SkipBack size={14} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={clsx(styles.transportButton, styles.playButton, progressionPlaying && styles["transportButton--accent"])}
            onClick={() => setProgressionPlaying(!progressionPlaying)}
            disabled={!canPlay}
            aria-label={progressionPlaying ? "Pause progression" : "Play progression"}
          >
            {progressionPlaying ? (
              <Pause size={15} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
            ) : (
              <Play size={15} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            className={styles.transportButton}
            onClick={() => advanceProgressionPlayback()}
            disabled={!canPlay}
            aria-label="Next chord"
          >
            <SkipForward size={14} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={clsx(styles.transportButton, progressionLoopEnabled && styles["transportButton--accent"])}
            onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
            aria-pressed={progressionLoopEnabled}
            aria-label="Loop progression"
          >
            <Repeat size={14} strokeWidth={2.4} aria-hidden="true" />
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

        <div className={styles.positionReadout}>
          <span className={styles.readoutLabel}>Position</span>
          <span
            className={styles.positionValue}
            aria-label={`Position ${position.current} of ${position.total}`}
          >
            <span className={styles.positionCurrent}>
              <PositionDigits parts={position.parts.current} />
            </span>
            <span className={styles.positionSeparator} aria-hidden="true">/</span>
            <span className={styles.positionTotal}>
              <PositionDigits parts={position.parts.total} muted />
            </span>
          </span>
        </div>

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
              <span className={styles.rulerBarNumber}>{i + 1}</span>
              <span className={styles.rulerTicks} aria-hidden="true">
                {Array.from({ length: subdivisionsPerBar - 1 }, (__, j) => (
                  <span key={j} className={styles.rulerTick} />
                ))}
              </span>
            </span>
          ))}
        </div>
        <div className={styles.blocks}>
          <span
            className={styles.playhead}
            style={{ left: playheadLeft }}
            data-testid="progression-playhead"
            data-animated={progressionPlaying ? "true" : undefined}
            aria-hidden="true"
          >
            <span className={styles.playheadArrow} aria-hidden="true" />
            <span className={styles.playheadLine} aria-hidden="true" />
          </span>
          {resolvedProgressionSteps.map((step, index) => {
            const duration = formatProgressionDurationLabel(step.duration);
            const selected = index === activeProgressionStepIndex;
            const durationBars = step.duration.unit === "bar"
              ? step.duration.value
              : step.duration.value / beatsPerBar;
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
                  <span
                    className={styles.chordName}
                    title={step.resolvedChordLabel ?? step.unavailableReason ?? undefined}
                  >
                    {step.shortChordLabel ?? step.unavailableReason}
                  </span>
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
