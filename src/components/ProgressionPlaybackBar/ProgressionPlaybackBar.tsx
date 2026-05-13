import clsx from "clsx";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Pause,
  Play,
  Repeat,
} from "lucide-react";
import {
  MAX_PROGRESSION_TEMPO_BPM,
  MIN_PROGRESSION_TEMPO_BPM,
} from "../../progressions/progressionDomain";
import { useProgressionState } from "../../hooks/useProgressionState";
import styles from "./ProgressionPlaybackBar.module.css";

export function ProgressionPlaybackBar() {
  const {
    progressionEnabled,
    progressionPlaying,
    setProgressionPlaying,
    progressionTempoBpm,
    setProgressionTempoBpm,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    progressionPlaybackBlockedReason,
    advanceProgressionPlayback,
    previousProgressionStep,
  } = useProgressionState();

  if (!progressionEnabled) return null;

  return (
    <div className={styles["progression-playback-bar"]}>
      <div className={styles["transport-group"]}>
        <button
          type="button"
          className={styles["transport-btn"]}
          onClick={() => previousProgressionStep()}
          aria-label="Previous step"
          title="Previous step"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          className={clsx(styles["transport-btn"], styles["transport-btn--primary"])}
          onClick={() => setProgressionPlaying(!progressionPlaying)}
          aria-label={progressionPlaying ? "Pause playback" : "Start playback"}
          title={progressionPlaying ? "Pause" : "Play"}
          disabled={!!progressionPlaybackBlockedReason}
        >
          {progressionPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>

        <button
          type="button"
          className={styles["transport-btn"]}
          onClick={() => advanceProgressionPlayback()}
          aria-label="Next step"
          title="Next step"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className={styles["config-group"]}>
        <button
          type="button"
          className={clsx(styles["config-btn"], progressionLoopEnabled && styles["config-btn--active"])}
          onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
          aria-label={progressionLoopEnabled ? "Disable loop" : "Enable loop"}
          aria-pressed={progressionLoopEnabled}
          title="Loop"
        >
          <Repeat size={16} />
        </button>

        <div className={styles["tempo-control"]}>
          <label htmlFor="progression-tempo" className="sr-only">Tempo (BPM)</label>
          <input
            id="progression-tempo"
            type="number"
            min={MIN_PROGRESSION_TEMPO_BPM}
            max={MAX_PROGRESSION_TEMPO_BPM}
            value={progressionTempoBpm}
            onChange={(e) => setProgressionTempoBpm(Number(e.target.value))}
            className={styles["tempo-input"]}
          />
          <span className={styles["tempo-unit"]}>BPM</span>
        </div>
      </div>

      {progressionPlaybackBlockedReason ? (
        <div className={styles["blocked-notice"]} title={progressionPlaybackBlockedReason}>
          <CircleAlert size={14} />
          <span className={styles["blocked-text"]}>{progressionPlaybackBlockedReason}</span>
        </div>
      ) : null}
    </div>
  );
}
