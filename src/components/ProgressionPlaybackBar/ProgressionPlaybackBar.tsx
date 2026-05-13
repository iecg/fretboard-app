import clsx from "clsx";
import { Pause, Play, Repeat, SkipBack, SkipForward } from "lucide-react";
import { StepperControl } from "../StepperControl/StepperControl";
import { useProgressionState } from "../../hooks/useProgressionState";
import shared from "../shared/shared.module.css";
import styles from "./ProgressionPlaybackBar.module.css";

const MAX_DOTS = 8;

export function ProgressionPlaybackBar() {
  const {
    progressionEnabled,
    progressionTempoBpm,
    setProgressionTempoBpm,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    progressionPlaying,
    progressionPlaybackBlockedReason,
    setProgressionPlaying,
    advanceProgressionPlayback,
    previousProgressionStep,
    currentProgressionBar,
    totalProgressionBars,
  } = useProgressionState();

  if (!progressionEnabled) return null;

  const canPlay = !progressionPlaybackBlockedReason;
  const totalBars = Math.max(1, Math.round(totalProgressionBars));
  const usingDots = totalBars <= MAX_DOTS;

  return (
    <section
      role="group"
      aria-label="Progression playback"
      className={styles["progression-playback-bar"]}
      data-playing={progressionPlaying ? "true" : undefined}
      data-blocked={progressionPlaybackBlockedReason ? "true" : undefined}
      title={progressionPlaybackBlockedReason ?? undefined}
    >
      <button
        type="button"
        className={clsx(shared["control-button"], progressionLoopEnabled && styles["loop-on"])}
        onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
        aria-pressed={progressionLoopEnabled}
        aria-label="Loop progression"
      >
        <Repeat size={16} aria-hidden="true" />
      </button>
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
        className={clsx(shared["control-button"], styles["play-button"])}
        onClick={() => setProgressionPlaying(!progressionPlaying)}
        aria-disabled={!canPlay}
        aria-label={progressionPlaying ? "Pause progression" : "Play progression"}
      >
        {progressionPlaying ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
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

      <div className={styles["bar-indicator"]} aria-label={`Bar ${currentProgressionBar} of ${totalBars}`}>
        {usingDots
          ? Array.from({ length: totalBars }, (_, i) => (
              <span
                key={i}
                className={clsx(styles["bar-dot"], i + 1 <= currentProgressionBar && styles["bar-dot--filled"])}
                aria-hidden="true"
              />
            ))
          : <span className={styles["bar-indicator-text"]}>Bar {currentProgressionBar} / {totalBars}</span>}
      </div>

      <StepperControl
        label="Tempo"
        value={progressionTempoBpm}
        min={40}
        max={240}
        step={1}
        formatValue={(v) => `${v} BPM`}
        onChange={setProgressionTempoBpm}
      />
    </section>
  );
}
