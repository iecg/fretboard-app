import { useAtom } from "jotai";
import { fretStartAtom, fretEndAtom } from "../../store/atoms";
import { MAX_FRET } from "@fretflow/core";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { FretRangeControl } from "../FretRangeControl/FretRangeControl";
import shared from "../shared/shared.module.css";
import styles from "./ViewTab.module.css";

export function ViewTab() {
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);

  return (
    <div className={styles.root} data-inspector-tab="view">
      <FingeringPatternControls />
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Fret Range</span>
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
