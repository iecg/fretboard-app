import { type ReactNode } from "react";
import { ScaleSelector } from "../ScaleSelector/ScaleSelector";
import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import { KeyExplorer } from "../KeyExplorer/KeyExplorer";
import styles from "../TheoryControls/TheoryControls.module.css";

interface TheoryControlsProps {
  keyExplorer?: ReactNode;
}

export function TheoryControls({ keyExplorer }: TheoryControlsProps) {
  return (
    <div className={styles["theory-controls"]} data-testid="theory-controls">
      <ScaleSelector />
      {keyExplorer ? <KeyExplorer>{keyExplorer}</KeyExplorer> : null}
      <ChordOverlayControls />
    </div>
  );
}

export default TheoryControls;
