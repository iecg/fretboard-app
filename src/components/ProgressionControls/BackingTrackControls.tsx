import { useProgressionState } from "../../hooks/useProgressionState";
import { useTranslation } from "../../hooks/useTranslation";
import { GENRE_STYLES } from "../../progressions/audio/genres";
import { CHORD_PATTERNS, BASS_PATTERNS, DRUM_PATTERNS } from "../../progressions/audio/patterns";
import type { ChordInstrumentId } from "../../progressions/audio/instruments/types";
import { Prop, GroupHeader } from "../Inspector/InspectorGrid";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import styles from "./BackingTrackControls.module.css";

/**
 * The BACKING TRACK group of the Progression tab — genre, chord instrument,
 * the chord/bass/drum pattern pickers, and the swing slider. Rehosted here
 * from `ProgressionTrack` (DAW Shell Phase 11). Returns a fragment of a
 * `GroupHeader` plus `Prop` cells, designed to be rendered inside the
 * Progression tab's `PropGrid`.
 */
export function BackingTrackControls() {
  const { t } = useTranslation();
  const {
    progressionGenreStyle,
    applyGenreStyle,
    progressionChordInstrument,
    setProgressionChordInstrument,
    progressionChordPattern,
    setProgressionChordPattern,
    progressionBassPattern,
    setProgressionBassPattern,
    progressionDrumPattern,
    setProgressionDrumPattern,
    progressionSwing,
    setProgressionSwing,
  } = useProgressionState();

  return (
    <>
      <GroupHeader>{t("inspector.groupBackingTrack")}</GroupHeader>
      <Prop label={t("inspector.btGenre")} span={1}>
        <LabeledSelect
          label="Genre style"
          hideLabel
          value={progressionGenreStyle}
          options={[
            ...GENRE_STYLES.map((g) => ({ value: g.id, label: g.label })),
            { value: "custom", label: "Custom" },
          ]}
          onChange={applyGenreStyle}
        />
      </Prop>
      <Prop label={t("inspector.btInstrument")} span={1}>
        <LabeledSelect
          label="Chord instrument"
          hideLabel
          value={progressionChordInstrument}
          options={[
            { value: "strum", label: "Strum" },
            { value: "piano", label: "Piano" },
            { value: "organ", label: "Organ" },
          ]}
          onChange={(v) => setProgressionChordInstrument(v as ChordInstrumentId)}
        />
      </Prop>
      <Prop label={t("inspector.btChordPattern")} span={1}>
        <LabeledSelect
          label="Chord pattern"
          hideLabel
          value={progressionChordPattern}
          options={CHORD_PATTERNS.map((p) => ({ value: p.id, label: p.label }))}
          onChange={setProgressionChordPattern}
        />
      </Prop>
      <Prop label={t("inspector.btBassPattern")} span={1}>
        <LabeledSelect
          label="Bass pattern"
          hideLabel
          value={progressionBassPattern}
          options={BASS_PATTERNS.map((p) => ({ value: p.id, label: p.label }))}
          onChange={setProgressionBassPattern}
        />
      </Prop>
      <Prop label={t("inspector.btDrumPattern")} span={1}>
        <LabeledSelect
          label="Drum pattern"
          hideLabel
          value={progressionDrumPattern}
          options={DRUM_PATTERNS.map((p) => ({ value: p.id, label: p.label }))}
          onChange={setProgressionDrumPattern}
        />
      </Prop>
      <Prop label={t("inspector.btSwing")} span={1}>
        <div className={styles.swing}>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={progressionSwing}
            onChange={(e) => setProgressionSwing(Number(e.target.value))}
            aria-label="Swing amount"
            className={styles.swingRange}
            style={{ ["--swing-fill" as string]: `${(progressionSwing / 0.5) * 100}%` }}
          />
          <span className={styles.swingValue}>{Math.round(progressionSwing * 100)}%</span>
        </div>
      </Prop>
    </>
  );
}
