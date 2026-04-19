import { type ReactNode } from "react";
import { ScaleSelector } from "./ScaleSelector";
import { ChordOverlayControls } from "./ChordOverlayControls";
import { KeyExplorer } from "./KeyExplorer";
import "./TheoryControls.css";

interface TheoryControlsProps {
  keyExplorer?: ReactNode;
}

export function TheoryControls({ keyExplorer }: TheoryControlsProps) {
  return (
    <div className="theory-controls">
      <ScaleSelector />
      {keyExplorer ? <KeyExplorer>{keyExplorer}</KeyExplorer> : null}
      <ChordOverlayControls />
    </div>
  );
}

export default TheoryControls;
