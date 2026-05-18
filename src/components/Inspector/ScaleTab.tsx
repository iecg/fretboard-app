import { lazy, Suspense } from "react";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import {
  rootNoteAtom,
  setRootNoteAtom,
  scaleNameAtom,
  useFlatsAtom,
  enharmonicDisplayAtom,
} from "../../store/atoms";
import { ScaleSelector } from "../ScaleSelector/ScaleSelector";
import { ScaleTheoryFacts } from "./ScaleTheoryFacts";
import { GroupHeader } from "./InspectorGrid";
import { CircleOfFifthsSkeleton } from "../LoadingSkeleton/LoadingSkeleton";
import { useTranslation } from "../../hooks/useTranslation";
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

  return (
    <div className={styles.root} data-inspector-tab="scale">
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
  );
}
