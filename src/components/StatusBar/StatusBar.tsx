import { useAtomValue } from "jotai";
import { CAGED_SHAPES, LENS_REGISTRY } from "@fretflow/core";
import {
  type FingeringPattern,
  scaleLabelAtom,
  chordLabelAtom,
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
import { VersionBadge } from "../VersionBadge/VersionBadge";
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

/**
 * The DAW shell's bottom status bar (Phase 12) — a single-line mono strip
 * reading Key / Chord / Lens / Pattern / Frets / Tempo / Tuning plus the
 * version tag. A pure read-out: it subscribes to existing atoms and never
 * writes. Mounted by `MainLayoutWrapper` on the desktop and tablet tiers.
 */
export function StatusBar() {
  const { t } = useTranslation();
  const scaleLabel = useAtomValue(scaleLabelAtom);
  const chordLabel = useAtomValue(chordLabelAtom);
  const chordDegree = useAtomValue(effectiveChordDegreeAtom);
  const lens = useAtomValue(practiceLensAtom);
  const pattern = useAtomValue(fingeringPatternAtom);
  const cagedShapes = useAtomValue(cagedShapesAtom);
  const fretStart = useAtomValue(fretStartAtom);
  const fretEnd = useAtomValue(fretEndAtom);
  const tempo = useAtomValue(progressionTempoBpmAtom);
  const tuningName = useAtomValue(tuningNameAtom);

  const lensLabel = LENS_REGISTRY.find((e) => e.id === lens)?.label ?? EMPTY;

  const chordValue = chordLabel
    ? chordDegree
      ? `${chordDegree} · ${chordLabel}`
      : chordLabel
    : EMPTY;

  const patternValue =
    pattern === "caged"
      ? `${PATTERN_LABELS.caged} · ${CAGED_SHAPES.filter((s) => cagedShapes.has(s)).join("") || EMPTY}`
      : PATTERN_LABELS[pattern];

  const fields: ReadonlyArray<{ id: string; label: string; value: string }> = [
    { id: "key", label: t("statusBar.key"), value: scaleLabel || EMPTY },
    { id: "chord", label: t("statusBar.chord"), value: chordValue },
    { id: "lens", label: t("statusBar.lens"), value: lensLabel },
    { id: "pattern", label: t("statusBar.pattern"), value: patternValue },
    { id: "frets", label: t("statusBar.frets"), value: `${fretStart}–${fretEnd}` },
    { id: "tempo", label: t("statusBar.tempo"), value: `${tempo} BPM` },
    { id: "tuning", label: t("statusBar.tuning"), value: tuningName || EMPTY },
  ];

  return (
    <div className={styles["status-bar"]} data-testid="status-bar">
      <dl className={styles.fields}>
        {fields.map((f) => (
          <div key={f.id} className={styles.field}>
            <dt className={styles.label}>{f.label}</dt>
            <dd className={styles.value} data-testid={`status-${f.id}`}>
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
      <VersionBadge />
    </div>
  );
}
