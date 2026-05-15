import { useAtom } from "jotai";
import { fretStartAtom, fretEndAtom } from "../../store/atoms";
import { MAX_FRET } from "@fretflow/core";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { FretRangeControl } from "../FretRangeControl/FretRangeControl";
import styles from "./ViewTab.module.css";

export function ViewTab() {
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);

  return (
    <div className={styles.root} data-inspector-tab="view">
      <FingeringPatternControls />
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Fret Range</span>
        <FretRangeControl
          startFret={fretStart}
          endFret={fretEnd}
          onStartChange={setFretStart}
          onEndChange={setFretEnd}
          maxFret={MAX_FRET}
          layout="dashboard"
        />
      </div>
    </div>
  );
}
