import { lazy, Suspense } from "react";
import styles from "./ExpandedControlsPanel.module.css";
import shared from "./shared.module.css";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import clsx from "clsx";
import {
  rootNoteAtom,
  setRootNoteAtom,
  scaleNameAtom,
  enharmonicDisplayAtom,
  fretStartAtom,
  fretEndAtom,
  useFlatsAtom,
} from "../store/atoms";
import {
  FingeringPatternControls,
} from "./FingeringPatternControls";
import { FretRangeControl } from "./FretRangeControl";
import { TheoryControls } from "./TheoryControls";
import { Card } from "./Card";
import { MAX_FRET } from "../constants";

// Lazy-loaded component
const CircleOfFifths = lazy(() =>
  import("../CircleOfFifths").then((m) => ({ default: m.CircleOfFifths }))
);

/**
 * Renders the Configuration card: FingeringPatternControls + fret range.
 */
export function BaseControlsSection() {
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);

  return (
    <Card
      title="Configuration"
      className={clsx("dashboard-card--configuration")}
      data-testid="dashboard-card-configuration"
    >
      <div className={styles["control-group"]}>
        <FingeringPatternControls />
        <div className={shared["control-section"]}>
          <span className={shared["section-label"]}>Fret Range</span>
          <FretRangeControl
            startFret={fretStart}
            endFret={fretEnd}
            onStartChange={setFretStart}
            onEndChange={setFretEnd}
            maxFret={MAX_FRET}
            layout="dashboard"
          />
        </div>
      </div>
    </Card>
  );
}

/**
 * Renders the Music Theory card.
 */
export function ScaleChordSection() {
  return (
    <Card
      title="Music Theory"
      className={clsx("dashboard-card--theory")}
      data-testid="dashboard-card-theory"
    >
      <TheoryControls />
    </Card>
  );
}

/**
 * Renders the key column: CircleOfFifths with heading.
 * Reads all required state from Jotai atoms directly.
 */
export function KeyColumn() {
  const rootNote = useAtomValue(rootNoteAtom);
  const handleSetRootNote = useSetAtom(setRootNoteAtom);
  const [scaleName] = useAtom(scaleNameAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);

  return (
    <Card title="Key Explorer" data-layout-column="key" data-testid="key-column">
      <Suspense fallback={null}>
        <CircleOfFifths
          rootNote={rootNote}
          setRootNote={handleSetRootNote}
          scaleName={scaleName}
          useFlats={useFlats}
          enharmonicDisplay={enharmonicDisplay}
        />
      </Suspense>
    </Card>
  );
}

/**
 * Shared non-mobile controls layout. Split mode stacks Settings + Scale/Chord
 * on the left with Key on the right. Stacked mode renders all three groups in
 * a single column for compact-height tablet and desktop viewports.
 */
export function ExpandedControlsPanel({
  mode,
}: {
  mode: "3col" | "split" | "stacked";
}) {
  return (
    <div className={styles["controls-panel"]} data-mode={mode}>
      <BaseControlsSection />
      <ScaleChordSection />
      <KeyColumn />
    </div>
  );
}
