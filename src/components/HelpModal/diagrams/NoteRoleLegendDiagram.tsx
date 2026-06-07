import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

// Swatches mirror how the fretboard actually paints each note: the same
// --fb-* fill/stroke tokens FretboardSVG.module.css uses, so the legend tracks
// the live theme. Filled discs are "figure" notes (root / guide / chord tone);
// hollow rings are recessive (scale-only) or the green "go here next" target.
const ROLES: { key: string; fill: string; stroke: string }[] = [
  { key: "help.roles.root", fill: "var(--fb-home-fill)", stroke: "var(--fb-home-stroke)" },
  { key: "help.roles.guideTone", fill: "var(--fb-guide-fill)", stroke: "var(--fb-guide-stroke)" },
  { key: "help.roles.chordTone", fill: "var(--fb-neutral-fill)", stroke: "var(--fb-neutral-stroke)" },
  { key: "help.roles.scaleNote", fill: "none", stroke: "var(--fb-neutral-stroke)" },
  { key: "help.roles.resolution", fill: "none", stroke: "var(--note-incoming)" },
];

export function NoteRoleLegendDiagram() {
  const { t } = useTranslation();
  return (
    <dl className={styles.legend} aria-label={t("help.sections.noteColors")}>
      {ROLES.map((role) => (
        <div key={role.key} style={{ display: "contents" }}>
          <dt aria-hidden="true">
            <svg className={styles.swatch} viewBox="0 0 24 24" width="20" height="20">
              <circle cx="12" cy="12" r="8" fill={role.fill} stroke={role.stroke} strokeWidth="2.5" />
            </svg>
          </dt>
          <dd className={styles.legendLabel} style={{ margin: 0 }}>
            {t(role.key)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
