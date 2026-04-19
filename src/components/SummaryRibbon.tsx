import { useAtomValue } from "jotai";
import { chordTypeAtom } from "../store/atoms";
import { ScaleStripPanel } from "./ScaleStripPanel";
import { ChordOverlayDock } from "./ChordOverlayDock";

/**
 * Orchestrates the top summary area.
 * No chord → bare ScaleStripPanel.
 * Chord active → .summary-ribbon shell with ScaleStripPanel + ChordOverlayDock as siblings.
 */
export function SummaryRibbon() {
  const chordType = useAtomValue(chordTypeAtom);

  if (!chordType) {
    return <ScaleStripPanel />;
  }

  return (
    <div className="summary-ribbon">
      <ScaleStripPanel />
      <ChordOverlayDock />
    </div>
  );
}
