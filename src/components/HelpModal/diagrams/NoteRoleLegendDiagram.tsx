import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

const ROLES: { key: string; color: string }[] = [
  { key: "help.roles.root", color: "var(--neon-orange-bright, var(--neon-orange))" },
  { key: "help.roles.chordTone", color: "var(--neon-orange)" },
  { key: "help.roles.scaleNote", color: "var(--neon-cyan)" },
  { key: "help.roles.colorTone", color: "var(--neon-violet)" },
  { key: "help.roles.resolution", color: "var(--note-incoming)" },
];

export function NoteRoleLegendDiagram() {
  const { t } = useTranslation();
  return (
    <dl className={styles.legend} aria-label={t("help.sections.noteColors")}>
      {ROLES.map((role) => (
        <div key={role.key} style={{ display: "contents" }}>
          <dt className={styles.swatch} style={{ color: role.color }} aria-hidden="true" />
          <dd className={styles.legendLabel} style={{ margin: 0 }}>
            {t(role.key)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
