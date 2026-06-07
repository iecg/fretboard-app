import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

const STATES: { key: string; color: string }[] = [
  { key: "help.voiceLeading.anticipation", color: "var(--note-incoming)" },
  { key: "help.voiceLeading.hold", color: "var(--neon-cyan)" },
  { key: "help.voiceLeading.departing", color: "var(--neon-orange)" },
];

export function VoiceLeadingDiagram() {
  const { t } = useTranslation();
  return (
    <dl className={styles.legend} aria-label={t("help.items.voiceLeadingLabel")}>
      {STATES.map((state) => (
        <div key={state.key} style={{ display: "contents" }}>
          <dt className={styles.swatch} style={{ color: state.color }} aria-hidden="true" />
          <dd className={styles.legendLabel} style={{ margin: 0 }}>
            {t(state.key)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
