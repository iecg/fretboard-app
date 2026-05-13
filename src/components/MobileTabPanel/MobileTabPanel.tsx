import { useAtomValue, useSetAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import {
  mobileTabAtom,
  rootNoteAtom,
  setRootNoteAtom,
  scaleNameAtom,
  useFlatsAtom,
  enharmonicDisplayAtom,
} from "../../store/atoms";
import { CircleOfFifths } from "../CircleOfFifths/CircleOfFifths";
import { ScaleSelector } from "../ScaleSelector/ScaleSelector";
import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import { ProgressionControls } from "../ProgressionControls/ProgressionControls";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { Card } from "../Card/Card";
import { TAB_LABELS } from "../../constants/tabLabels";
import { useCompactDensity } from "../../hooks/useCompactDensity";
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
  const compact = useCompactDensity();

  return (
    <div className={styles["mobile-tab-content"]} data-layout-scope="mobile-tabs" data-testid="mobile-tab-content">
      <AnimatePresence mode="wait" initial={false}>
        {mobileTab === "scales" && (
          <motion.div
            key="scales"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <Card title={TAB_LABELS.scales} className={styles["mobile-tab-card"]} data-mobile-tab="scales">
              <ScaleSelector compact={compact} />
            </Card>
          </motion.div>
        )}
        {mobileTab === "chords" && (
          <motion.div
            key="chords"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <Card title={TAB_LABELS.chords} className={styles["mobile-tab-card"]} data-mobile-tab="chords">
              <ChordOverlayControls compact={compact} />
            </Card>
          </motion.div>
        )}
        {mobileTab === "progression" && (
          <motion.div
            key="progression"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <Card title={TAB_LABELS.progression} className={styles["mobile-tab-card"]} data-mobile-tab="progression">
              <ProgressionControls compact={compact} />
            </Card>
          </motion.div>
        )}
        {mobileTab === "cof" && (
          <motion.div
            key="cof"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <Card title={TAB_LABELS.cof} className={styles["mobile-tab-card"]} data-mobile-tab="cof">
              <MobileKeyExplorer />
            </Card>
          </motion.div>
        )}
        {mobileTab === "view" && (
          <motion.div
            key="view"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <Card title={TAB_LABELS.view} className={styles["mobile-tab-card"]} data-mobile-tab="view">
              <FingeringPatternControls compact={compact} />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
