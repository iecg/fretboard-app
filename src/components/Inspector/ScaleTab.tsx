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
import { CircleOfFifthsSkeleton } from "../LoadingSkeleton/LoadingSkeleton";
import styles from "./ScaleTab.module.css";

const CircleOfFifths = lazy(() =>
  import("../CircleOfFifths/CircleOfFifths").then((m) => ({
    default: m.CircleOfFifths,
  })),
);

export function ScaleTab() {
  const rootNote = useAtomValue(rootNoteAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);
  const [scaleName] = useAtom(scaleNameAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);

  return (
    <div className={styles.root} data-inspector-tab="scale">
      <ScaleSelector />
      <div className={styles.cofWrapper}>
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
    </div>
  );
}
