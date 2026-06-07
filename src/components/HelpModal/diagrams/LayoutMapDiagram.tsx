import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

export function LayoutMapDiagram() {
  const { t } = useTranslation();
  return (
    <svg
      className={styles.diagram}
      viewBox="0 0 240 90"
      role="img"
      aria-label={`${t("help.layoutDiagram.mobile")} / ${t("help.layoutDiagram.desktop")}`}
    >
      <g fill="none" stroke="var(--surface-card-border)" strokeWidth="1.5">
        {/* Mobile: stacked board + tab bar */}
        <rect x="8" y="8" width="60" height="50" rx="4" fill="var(--surface-float)" />
        <rect x="8" y="62" width="28" height="18" rx="4" fill="var(--surface-panel)" />
        <rect x="40" y="62" width="28" height="18" rx="4" fill="var(--surface-panel)" />
        {/* Desktop: board + side cards */}
        <rect x="96" y="8" width="84" height="72" rx="4" fill="var(--surface-float)" />
        <rect x="186" y="8" width="46" height="22" rx="4" fill="var(--surface-panel)" />
        <rect x="186" y="33" width="46" height="22" rx="4" fill="var(--surface-panel)" />
        <rect x="186" y="58" width="46" height="22" rx="4" fill="var(--surface-panel)" />
      </g>
      <text x="38" y="20" textAnchor="middle" fontSize="7" fill="var(--chrome-fg-muted)">
        {t("help.layoutDiagram.mobile")}
      </text>
      <text x="164" y="20" textAnchor="middle" fontSize="7" fill="var(--chrome-fg-muted)">
        {t("help.layoutDiagram.desktop")}
      </text>
    </svg>
  );
}
