import { useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
import {
  mobileTabAtom,
  rootNoteAtom,
  setRootNoteAtom,
  scaleNameAtom,
  useFlatsAtom,
  enharmonicDisplayAtom,
} from "../../store/atoms";
import { CircleOfFifths } from "../CircleOfFifths/CircleOfFifths";
import { TheoryControls } from "../TheoryControls/TheoryControls";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import styles from "./MobileTabPanel.module.css";

function MobileKeyExplorer() {
  const rootNote = useAtomValue(rootNoteAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);
  return (
    <div className={styles["cof-container"]}>
      <CircleOfFifths
        rootNote={rootNote}
        setRootNote={setRootNote}
        scaleName={scaleName}
        useFlats={useFlats}
        enharmonicDisplay={enharmonicDisplay}
        variant="inline"
      />
    </div>
  );
}

export function MobileTabPanel() {
  const mobileTab = useAtomValue(mobileTabAtom);

  return (
    <div className={styles["mobile-tab-content"]} data-layout-scope="mobile-tabs" data-testid="mobile-tab-content">
      {mobileTab === "theory" && (
        <div className={clsx(styles["mobile-tab-panel"], styles["mobile-theory-tab"])}>
          <TheoryControls keyExplorer={<MobileKeyExplorer />} />
        </div>
      )}
      {mobileTab === "view" && (
        <div className={clsx(styles["mobile-tab-panel"], styles["mobile-view-tab"])}>
          <FingeringPatternControls />
        </div>
      )}
    </div>
  );
}
