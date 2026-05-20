import { useAtomValue } from "jotai";
import { chordSourceIsProgressionAtom } from "../../store/chordOverlayAtoms";
import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import styles from "./ChordTab.module.css";

export function ChordTab() {
  const isProgressionSource = useAtomValue(chordSourceIsProgressionAtom);
  return (
    <div
      className={styles.root}
      data-inspector-tab="chord"
      data-chord-accent={isProgressionSource ? "progression" : "overlay"}
    >
      <ChordOverlayControls />
    </div>
  );
}
