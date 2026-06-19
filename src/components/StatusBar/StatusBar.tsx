import { useAtomValue } from "jotai";
import { CAGED_SHAPES } from "@fretflow/core";
import { chordShortLabelAtom } from "@fretflow/fretboard/store/chordOverlayAtoms";
import { activeChordCachedDegreeAtom } from "@fretflow/fretboard/store/songStateAtoms";
import { fingeringPatternAtom, cagedShapesAtom } from "@fretflow/fretboard/store/fingeringAtoms";
import type { FingeringPattern } from "@fretflow/fretboard/store/fingeringAtoms";
import { fretStartAtom, fretEndAtom, tuningNameAtom } from "@fretflow/fretboard/store/layoutAtoms";
import { progressionTempoBpmAtom, progressionStepsAtom, totalProgressionBarsAtom } from "@fretflow/fretboard/store/progressionAtoms";
import { scaleLabelAtom } from "@fretflow/fretboard/store/scaleAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./StatusBar.module.css";

/** Placeholder for a field with no current value. */
const EMPTY = "—"; // em dash

/** Display labels for the fingering patterns. */
const PATTERN_LABELS: Record<FingeringPattern, string> = {
  none: "None",
  caged: "CAGED",
  "3nps": "3NPS",
  "one-string": "One String",
  "two-strings": "Two Strings",
};

interface StatusField {
  id: string;
  label: string;
  value: string;
}

/**
 * The DAW shell's bottom status bar — a single-line mono strip. Reading fields
 * (Key / Chord / Pattern / Frets) sit flush-left; the session fields
 * (Tempo / Tuning) and the version tag are pushed flush-right. A pure read-out:
 * it subscribes to existing atoms and never writes. Mounted by
 * `MainLayoutWrapper` on the desktop and tablet tiers.
 */
export function StatusBar() {
  const { t } = useTranslation();
  const scaleLabel = useAtomValue(scaleLabelAtom);
  const chordShortLabel = useAtomValue(chordShortLabelAtom);
  const chordDegree = useAtomValue(activeChordCachedDegreeAtom);
  const pattern = useAtomValue(fingeringPatternAtom);
  const cagedShapes = useAtomValue(cagedShapesAtom);
  const fretStart = useAtomValue(fretStartAtom);
  const fretEnd = useAtomValue(fretEndAtom);
  const tempo = useAtomValue(progressionTempoBpmAtom);
  const totalBars = useAtomValue(totalProgressionBarsAtom);
  const steps = useAtomValue(progressionStepsAtom);
  const tuningName = useAtomValue(tuningNameAtom);

  const chordValue = chordShortLabel
    ? chordDegree
      ? `${chordDegree} · ${chordShortLabel}`
      : chordShortLabel
    : EMPTY;

  const patternValue =
    pattern === "caged"
      ? `${PATTERN_LABELS.caged} · ${CAGED_SHAPES.filter((s) => cagedShapes.has(s)).join("") || EMPTY}`
      : PATTERN_LABELS[pattern];

  const leftFields: ReadonlyArray<StatusField> = [
    { id: "key", label: t("statusBar.key"), value: scaleLabel || EMPTY },
    { id: "chord", label: t("statusBar.chord"), value: chordValue },
    { id: "pattern", label: t("statusBar.pattern"), value: patternValue },
    { id: "frets", label: t("statusBar.frets"), value: `${fretStart}–${fretEnd}` },
  ];
  const stepCount = steps.length;
  const progressionValue = `${totalBars} ${totalBars === 1 ? "bar" : "bars"} · ${stepCount} ${stepCount === 1 ? "chord" : "chords"}`;

  const rightFields: ReadonlyArray<StatusField> = [
    { id: "tempo", label: t("statusBar.tempo"), value: `${tempo} BPM` },
    { id: "progression", label: t("statusBar.progressionLength"), value: progressionValue },
    { id: "tuning", label: t("statusBar.tuning"), value: tuningName || EMPTY },
  ];

  const renderField = (f: StatusField) => (
    <div key={f.id} className={styles.field} data-field-id={f.id}>
      <span className={styles.label}>{f.label}</span>
      <span className={styles.value} data-testid={`status-${f.id}`}>
        {f.value}
      </span>
    </div>
  );

  return (
    <div className={styles["status-bar"]} data-testid="status-bar" data-full-bleed="true">
      <div className={styles.group}>{leftFields.map(renderField)}</div>
      <div className={styles.group}>
        {rightFields.map(renderField)}
        <span className={styles.field} data-field-id="version">
          <span className={styles.version} data-testid="status-version">
            FretFlow Studio {__APP_VERSION__}
          </span>
        </span>
      </div>
    </div>
  );
}
