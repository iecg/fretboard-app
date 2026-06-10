import { useAtomValue } from "jotai";
import { usePlaybackTransportModel } from "../../hooks/usePlaybackTransportModel";
import { scaleHeadlineAtom } from "../../store/scaleAtoms";
import { TransportBar } from "../TransportBar/TransportBar";
import { ProgressionPositionReadout } from "./ProgressionPositionReadout";
import styles from "./HeaderTransportCluster.module.css";

/**
 * The DAW transport cluster, hosted in the unified `AppHeader` (Always-On DAW
 * Phase A). Composes `TransportBar` (playback + status lights + instrument
 * toggles) with the position, tempo, and scale readouts that previously lived
 * in `ProgressionTrack`'s transport row.
 *
 * All readouts bind to existing atoms via `usePlaybackTransportModel` and the
 * shared `scaleHeadlineAtom` selector — this component is a pure relocation of
 * rendering, with no new state.
 *
 * The header SCALE readout shows only the root + scale name; the parenthetical
 * mode ("(Ionian)") is dropped by `scaleHeadlineAtom` so the chip stays compact.
 */
export function HeaderTransportCluster() {
  const {
    progressionTempoBpm,
    progressionPlaying,
    progressionPlaybackBlockedReason,
    totalProgressionBars,
    beatsPerBar,
  } = usePlaybackTransportModel();
  const scale = useAtomValue(scaleHeadlineAtom);

  const canPlay = !progressionPlaybackBlockedReason;

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
