import { lazy, Suspense } from "react";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import { setRootNoteAtom } from "../../store/actions";
import { enharmonicDisplayAtom } from "../../store/audioAtoms";
import { rootNoteAtom, scaleNameAtom, useFlatsAtom, scaleVisibleAtom } from "../../store/scaleAtoms";
import { ScaleSelector } from "../ScaleSelector/ScaleSelector";
import { ScaleTheoryFacts } from "./ScaleTheoryFacts";
import { GroupHeader, PropGrid } from "./InspectorGrid";
import { CircleOfFifthsSkeleton } from "../LoadingSkeleton/LoadingSkeleton";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { Switch } from "../Switch/Switch";
import { useTranslation } from "../../hooks/useTranslation";
import useLayoutMode from "../../hooks/useLayoutMode";
import styles from "./ScaleTab.module.css";

const CircleOfFifths = lazy(() =>
  import("../CircleOfFifths/CircleOfFifths").then((m) => ({
    default: m.CircleOfFifths,
  })),
);

export function ScaleTab() {
  const { t } = useTranslation();
  const rootNote = useAtomValue(rootNoteAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);
  const [scaleName] = useAtom(scaleNameAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);
  const { tier } = useLayoutMode();
  const [visible, setVisible] = useAtom(scaleVisibleAtom);

  return (
    <div className={styles.root} data-inspector-tab="scale">
      <div className={styles.layerVisibilityRow}>
        <Switch
          label={t("inspector.scaleLayer")}
          checked={visible}
          onChange={setVisible}
        />
        <span>{t("inspector.scaleLayer")}</span>
      </div>
      <div className={styles.fingeringRow}>
        <PropGrid columns={tier === "mobile" ? 2 : 6}>
          <FingeringPatternControls />
        </PropGrid>
      </div>
      <div className={styles.columns}>
        <div className={styles.col}>
          <GroupHeader>{t("inspector.groupKey")}</GroupHeader>
          <ScaleSelector />
        </div>
        <div className={styles.col} data-scale-col="wheel">
          <GroupHeader>{t("inspector.groupWheel")}</GroupHeader>
          <Suspense fallback={<CircleOfFifthsSkeleton />}>
            <CircleOfFifths
              rootNote={rootNote}
              setRootNote={setRootNote}
              scaleName={scaleName}
              useFlats={useFlats}
              enharmonicDisplay={enharmonicDisplay}
            />
          </Suspense>
        </div>
        <div className={styles.col}>
          <GroupHeader>{t("inspector.groupTheory")}</GroupHeader>
          <ScaleTheoryFacts />
        </div>
      </div>
    </div>
  );
}
