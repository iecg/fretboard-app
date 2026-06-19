import { useAtomValue } from "jotai";
import clsx from "clsx";
import { progressionTempoBpmAtom } from "@fretflow/fretboard/store/progressionAtoms";
import styles from "./TempoReadout.module.css";

/**
 * Compact LCD tempo chip — label + "{bpm} BPM" value. Used inside the desktop
 * HeaderTransportCluster and standalone in the sheet-shell header's middle
 * gap. Subscribes narrowly to the tempo atom (not the full transport model)
 * so the header chip re-renders only when the BPM changes.
 */
export function TempoReadout({ className }: { className?: string }) {
  const bpm = useAtomValue(progressionTempoBpmAtom);
  return (
    <div className={clsx(styles.readout, className)}>
      <span className={styles.readoutLabel}>Tempo</span>
      <span className={styles.tempoValue} data-testid="header-tempo">
        {bpm}
        <span className={styles.tempoUnit}>BPM</span>
      </span>
    </div>
  );
}
