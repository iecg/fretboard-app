import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

const SHORTCUTS: { keys: string; labelKey: string }[] = [
  { keys: "Space", labelKey: "help.shortcuts.play" },
  { keys: ".", labelKey: "help.shortcuts.stop" },
  { keys: "R", labelKey: "help.shortcuts.loop" },
  { keys: "M", labelKey: "help.shortcuts.mute" },
  { keys: "1", labelKey: "help.shortcuts.track1" },
  { keys: "2", labelKey: "help.shortcuts.track2" },
  { keys: "3", labelKey: "help.shortcuts.track3" },
  { keys: "4", labelKey: "help.shortcuts.track4" },
  { keys: "↑ ↓", labelKey: "help.shortcuts.tempo" },
  { keys: "← →", labelKey: "help.shortcuts.steps" },
  { keys: "T", labelKey: "help.shortcuts.tab" },
  { keys: "S", labelKey: "help.shortcuts.scale" },
  { keys: "C", labelKey: "help.shortcuts.chord" },
];

export function ShortcutTableDiagram() {
  const { t } = useTranslation();
  return (
    <table className={styles.shortcutTable} aria-label={t("help.sections.shortcuts")}>
      <tbody>
        {SHORTCUTS.map((s) => (
          <tr key={s.labelKey}>
            <th scope="row">
              <span className={styles.keycap}>{s.keys}</span>
            </th>
            <td>{t(s.labelKey)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
