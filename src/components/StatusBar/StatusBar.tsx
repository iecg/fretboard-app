import { useAtomValue } from "jotai";
import { CAGED_SHAPES, LENS_REGISTRY } from "@fretflow/core";
import {
  type FingeringPattern,
  scaleLabelAtom,
  chordShortLabelAtom,
  effectiveChordDegreeAtom,
  practiceLensAtom,
  fingeringPatternAtom,
  cagedShapesAtom,
  fretStartAtom,
  fretEndAtom,
  progressionTempoBpmAtom,
  tuningNameAtom,
} from "../../store/atoms";
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

/** Compact lens labels — the strip mirrors the Chord tab's short forms. */
const LENS_SHORT_LABELS: Record<string, string> = {
  targets: "Chord Tones",
  "guide-tones": "Guide Tones",
  tension: "Tension",
};

interface StatusField {
  id: string;
  label: string;
  value: string;
}

/**
 * The DAW shell's bottom status bar — a single-line mono strip. Reading fields
 * (Key / Chord / Lens / Pattern / Frets) sit flush-left; the session fields
 * (Tempo / Tuning) and the version tag are pushed flush-right. A pure read-out:
 * it subscribes to existing atoms and never writes. Mounted by
 * `MainLayoutWrapper` on the desktop and tablet tiers.
 */
export function StatusBar() {
  const { t } = useTranslation();
  const scaleLabel = useAtomValue(scaleLabelAtom);
  const chordShortLabel = useAtomValue(chordShortLabelAtom);
  const chordDegree = useAtomValue(effectiveChordDegreeAtom);
  const lens = useAtomValue(practiceLensAtom);
  const pattern = useAtomValue(fingeringPatternAtom);
  const cagedShapes = useAtomValue(cagedShapesAtom);
  const fretStart = useAtomValue(fretStartAtom);
  const fretEnd = useAtomValue(fretEndAtom);
  const tempo = useAtomValue(progressionTempoBpmAtom);
  const tuningName = useAtomValue(tuningNameAtom);

  const lensLabel =
    LENS_SHORT_LABELS[lens] ??
    LENS_REGISTRY.find((e) => e.id === lens)?.label ??
    EMPTY;

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
    { id: "lens", label: t("statusBar.lens"), value: lensLabel },
    { id: "pattern", label: t("statusBar.pattern"), value: patternValue },
    { id: "frets", label: t("statusBar.frets"), value: `${fretStart}–${fretEnd}` },
  ];
  const rightFields: ReadonlyArray<StatusField> = [
    { id: "tempo", label: t("statusBar.tempo"), value: `${tempo} BPM` },
    { id: "tuning", label: t("statusBar.tuning"), value: tuningName || EMPTY },
  ];

  const renderField = (f: StatusField) => (
    <div key={f.id} className={styles.field}>
      <span className={styles.label}>{f.label}</span>
      <span className={styles.value} data-testid={`status-${f.id}`}>
        {f.value}
      </span>
    </div>
  );

  return (
    <div className={styles["status-bar"]} data-testid="status-bar">
      <div className={styles.group}>{leftFields.map(renderField)}</div>
      <div className={styles.group}>
        {rightFields.map(renderField)}
        <span className={styles.field}>
          <span className={styles.version} data-testid="status-version">
            FretFlow Studio {__APP_VERSION__}
          </span>
        </span>
      </div>
    </div>
  );
}
