import { useAtom, useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
import {
  mobileTabAtom,
  rootNoteAtom,
  setRootNoteAtom,
  scaleNameAtom,
  useFlatsAtom,
  enharmonicDisplayAtom,
} from "../store/atoms";
import { CircleOfFifths } from "../CircleOfFifths";
import { TheoryControls } from "./TheoryControls";
import { FingeringPatternControls } from "./FingeringPatternControls";
import { ToggleBar } from "./ToggleBar";
import styles from "./MobileTabPanel.module.css";

const MOBILE_TAB_OPTIONS = [
  { value: "theory", label: "Theory" },
  { value: "view", label: "View" },
] as const;

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
      />
    </div>
  );
}

export function MobileTabPanel() {
  const [mobileTab, setMobileTab] = useAtom(mobileTabAtom);

  return (
    <>
      <ToggleBar
        options={MOBILE_TAB_OPTIONS}
        value={mobileTab}
        onChange={setMobileTab}
        variant="tabs"
      />
      <div className={styles["mobile-tab-content"]} data-testid="mobile-tab-content">
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
    </>
  );
}
