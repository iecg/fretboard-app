import { useProgressionState } from "../../hooks/useProgressionState";
import { useScaleState } from "../../hooks/useScaleState";
import { TransportBar } from "../TransportBar/TransportBar";
import { ProgressionPositionReadout } from "./ProgressionPositionReadout";
import styles from "./HeaderTransportCluster.module.css";

/**
 * The header SCALE readout shows only the root + scale name — the
 * parenthetical mode ("(Ionian)") and any trailing mode index ("1st Mode")
 * are dropped so the chip stays compact.
 */
function scaleHeadline(label: string): string {
  return label.split(" (")[0].trim();
}


/**
 * The DAW transport cluster, hosted in the unified `AppHeader` (Always-On DAW
 * Phase A). Composes `TransportBar` (playback + status lights + instrument
 * toggles) with the position, tempo, and scale readouts that previously lived
 * in `ProgressionTrack`'s transport row.
 *
 * All readouts bind to existing atoms via `useProgressionState` /
 * `useScaleState` — this component is a pure relocation of rendering, with no
 * new state.
 */
export function HeaderTransportCluster() {
  const {
    progressionTempoBpm,
    progressionPlaying,
    progressionPlaybackBlockedReason,
    totalProgressionBars,
    beatsPerBar,
  } = useProgressionState();
  const { scaleLabel } = useScaleState();

  const canPlay = !progressionPlaybackBlockedReason;
  const scale = scaleHeadline(scaleLabel);

  return (
    <div className={styles.cluster} data-testid="header-transport-cluster">
      <TransportBar />

      <ProgressionPositionReadout
        playing={progressionPlaying && canPlay}
        stoppedBar={1}
        totalProgressionBars={totalProgressionBars}
        beatsPerBar={beatsPerBar}
        tempoBpm={progressionTempoBpm}
      />

      <div className={styles.contextReadouts}>
        <div className={styles.contextBox}>
          <span className={styles.readoutLabel}>Tempo</span>
          <span className={styles.tempoValue} data-testid="header-tempo">
            {progressionTempoBpm}
            <span className={styles.tempoUnit}>BPM</span>
          </span>
        </div>
        <div className={styles.contextBox}>
          <span className={styles.readoutLabel}>Scale</span>
          <span className={styles.scaleValue}>
            <span className={styles.scalePrimary}>{scale}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
