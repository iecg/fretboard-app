import { useProgressionState } from "../../hooks/useProgressionState";
import { useTranslation } from "../../hooks/useTranslation";
import { GENRE_STYLES } from "../../progressions/audio/genres";
import { CHORD_PATTERNS, BASS_PATTERNS, DRUM_PATTERNS } from "../../progressions/audio/patterns";
import type { ChordInstrumentId } from "../../progressions/audio/instruments/types";
import { Prop, GroupHeader } from "../Inspector/InspectorGrid";
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
        <select
          aria-label="Genre style"
          value={progressionGenreStyle}
          onChange={(e) => applyGenreStyle(e.target.value)}
          className={styles.select}
        >
          {GENRE_STYLES.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </Prop>
      <Prop label={t("inspector.btInstrument")} span={1}>
        <select
          aria-label="Chord instrument"
          value={progressionChordInstrument}
          onChange={(e) => setProgressionChordInstrument(e.target.value as ChordInstrumentId)}
          className={styles.select}
        >
          <option value="strum">Strum</option>
          <option value="piano">Piano</option>
          <option value="organ">Organ</option>
        </select>
      </Prop>
      <Prop label={t("inspector.btChordPattern")} span={1}>
        <select
          aria-label="Chord pattern"
          value={progressionChordPattern}
          onChange={(e) => setProgressionChordPattern(e.target.value)}
          className={styles.select}
        >
          {CHORD_PATTERNS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </Prop>
      <Prop label={t("inspector.btBassPattern")} span={1}>
        <select
          aria-label="Bass pattern"
          value={progressionBassPattern}
          onChange={(e) => setProgressionBassPattern(e.target.value)}
          className={styles.select}
        >
          {BASS_PATTERNS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </Prop>
      <Prop label={t("inspector.btDrumPattern")} span={1}>
        <select
          aria-label="Drum pattern"
          value={progressionDrumPattern}
          onChange={(e) => setProgressionDrumPattern(e.target.value)}
          className={styles.select}
        >
          {DRUM_PATTERNS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
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
          />
          <span className={styles.swingValue}>{Math.round(progressionSwing * 100)}%</span>
        </div>
      </Prop>
    </>
  );
}
