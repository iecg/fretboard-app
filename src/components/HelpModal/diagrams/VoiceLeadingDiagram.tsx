import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

// Mirrors the fretboard's emphasis hues during a chord change: the next chord's
// guide tones light up in the green "go here next" incoming color, and tones the
// two chords share stay lit in the teal guide hue.
const STATES: { key: string; fill: string; stroke: string }[] = [
  { key: "help.voiceLeading.anticipation", fill: "none", stroke: "var(--note-incoming)" },
  { key: "help.voiceLeading.hold", fill: "var(--fb-guide-fill)", stroke: "var(--fb-guide-stroke)" },
];

export function VoiceLeadingDiagram() {
  const { t } = useTranslation();
  return (
    <dl className={styles.legend} aria-label={t("help.items.voiceLeadingLabel")}>
      {STATES.map((state) => (
        <div key={state.key} style={{ display: "contents" }}>
          <dt aria-hidden="true">
            <svg className={styles.swatch} viewBox="0 0 24 24" width="20" height="20">
              <circle cx="12" cy="12" r="8" fill={state.fill} stroke={state.stroke} strokeWidth="2.5" />
            </svg>
          </dt>
          <dd className={styles.legendLabel} style={{ margin: 0 }}>
            {t(state.key)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
