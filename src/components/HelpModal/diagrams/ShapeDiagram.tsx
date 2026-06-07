import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

// Schematic 6-string × 5-fret grid: a CAGED "box" cluster vs a 3NPS span.
export function ShapeDiagram() {
  const { t } = useTranslation();
  const strings = [0, 1, 2, 3, 4, 5];
  const frets = [0, 1, 2, 3, 4];
  return (
    <svg
      className={styles.diagram}
      viewBox="0 0 240 80"
      role="img"
      aria-label={`${t("help.items.patternCagedLabel")} / ${t("help.items.patternNpsLabel")}`}
    >
      <g stroke="var(--surface-card-border)" strokeWidth="1">
        {strings.map((s) => (
          <line key={`s${s}`} x1="10" y1={10 + s * 12} x2="230" y2={10 + s * 12} />
        ))}
        {frets.map((f) => (
          <line key={`f${f}`} x1={10 + f * 26} y1="10" x2={10 + f * 26} y2="70" />
        ))}
      </g>
      {/* CAGED box: compact cluster (left) */}
      {strings.map((s) => (
        <circle key={`c${s}`} cx={36 + (s % 2) * 26} cy={10 + s * 12} r="4" fill="var(--neon-cyan)" />
      ))}
      {/* 3NPS span: three notes per string marching up the neck (right) */}
      {strings.map((s) =>
        [0, 1, 2].map((n) => (
          <circle
            key={`n${s}-${n}`}
            cx={140 + n * 22 + s * 2}
            cy={10 + s * 12}
            r="4"
            fill="var(--neon-orange)"
          />
        )),
      )}
    </svg>
  );
}
