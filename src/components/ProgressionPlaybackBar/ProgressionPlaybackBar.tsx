import { useEffect } from "react";
import clsx from "clsx";
import { Pause, Play, Repeat, SkipBack, SkipForward } from "lucide-react";
import {
  PROGRESSION_DURATION_LABELS,
} from "../../progressions/progressionDomain";
import { useProgressionState } from "../../hooks/useProgressionState";
import shared from "../shared/shared.module.css";
import styles from "./ProgressionPlaybackBar.module.css";

export function ProgressionPlaybackBar() {
  const {
    progressionEnabled,
    progressionTempoBpm,
    setProgressionTempoBpm,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    progressionPlaying,
    progressionStepDurationMs,
    progressionPlaybackBlockedReason,
    activeProgressionStepIndex,
    activeResolvedProgressionStep,
    resolvedProgressionSteps,
    setProgressionPlaying,
    setActiveProgressionStepIndex,
    advanceProgressionPlayback,
    previousProgressionStep,
  } = useProgressionState();

  useEffect(() => {
    if (!progressionEnabled || !progressionPlaying || progressionPlaybackBlockedReason) return;
    const timeoutId = window.setTimeout(() => {
      advanceProgressionPlayback();
    }, progressionStepDurationMs);
    return () => window.clearTimeout(timeoutId);
  }, [
    advanceProgressionPlayback,
    progressionEnabled,
    progressionPlaybackBlockedReason,
    progressionPlaying,
    progressionStepDurationMs,
    activeProgressionStepIndex,
  ]);

  if (!progressionEnabled) return null;

  const current = activeResolvedProgressionStep;
  const canPlay = !progressionPlaybackBlockedReason;
  const upcoming = resolvedProgressionSteps
    .filter((step) => step.index !== activeProgressionStepIndex && !step.unavailable)
    .slice(0, 3);

  return (
    <section
      role="group"
      aria-label="Progression playback"
      className={styles["progression-playback-bar"]}
      data-playing={progressionPlaying ? "true" : undefined}
    >
      <div className={styles["playback-main"]}>
        <div className={styles["current-step"]}>
          <span className={styles["current-degree"]}>{current?.degree ?? "-"}</span>
          <span className={styles["current-chord"]}>{current?.resolvedChordLabel ?? "No chord"}</span>
          {current ? (
            <span className={styles["current-duration"]}>
              {PROGRESSION_DURATION_LABELS[current.duration]}
            </span>
          ) : null}
        </div>
        {progressionPlaybackBlockedReason ? (
          <p className={shared["field-hint"]}>{progressionPlaybackBlockedReason}</p>
        ) : null}
      </div>

      <div className={styles["transport-row"]}>
        <button
          type="button"
          className={shared["control-button"]}
          onClick={() => previousProgressionStep()}
          disabled={!canPlay}
          aria-label="Previous progression step"
        >
          <SkipBack size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={clsx(shared["control-button"], styles["play-button"])}
          onClick={() => setProgressionPlaying(!progressionPlaying)}
          disabled={!canPlay}
          aria-label={progressionPlaying ? "Pause progression" : "Play progression"}
        >
          {progressionPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={shared["control-button"]}
          onClick={() => advanceProgressionPlayback()}
          disabled={!canPlay}
          aria-label="Next progression step"
        >
          <SkipForward size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={shared["control-button"]}
          onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
          aria-pressed={progressionLoopEnabled}
          aria-label="Loop progression"
        >
          <Repeat size={16} aria-hidden="true" />
        </button>
        <label className={styles["tempo-field"]} htmlFor="progression-tempo-input">
          <span className={styles["tempo-label"]}>Tempo</span>
          <input
            id="progression-tempo-input"
            type="number"
            min={40}
            max={240}
            step={1}
            value={progressionTempoBpm}
            onChange={(event) => setProgressionTempoBpm(Number(event.target.value))}
            aria-label="Progression tempo"
          />
        </label>
      </div>

      {upcoming.length > 0 ? (
        <div className={styles["upcoming-row"]} aria-label="Upcoming progression steps">
          {upcoming.map((step) => (
            <button
              key={step.id}
              type="button"
              className={styles["upcoming-chip"]}
              onClick={() => setActiveProgressionStepIndex(step.index)}
            >
              {step.degree}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
