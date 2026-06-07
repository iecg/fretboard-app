import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

// Real, musically-correct shapes rendered on mini necks (string index 0 = high E
// at top, matching the app's tuning convention). Roots use the fretboard's amber
// "home" tokens; other tones use the neutral tokens — the same hues the legend
// and fretboard use. A "fret" sits in the cell between fret wires.

interface Dot {
  /** String index, 0 = high E (top) … 5 = low E (bottom). */
  s: number;
  fret: number;
  root?: boolean;
}

// A minor pentatonic, position 1 (CAGED "E" box). Two notes per string.
const CAGED_BOX: Dot[] = [
  { s: 0, fret: 5, root: true }, { s: 0, fret: 8 },
  { s: 1, fret: 5 }, { s: 1, fret: 8 },
  { s: 2, fret: 5 }, { s: 2, fret: 7 },
  { s: 3, fret: 5 }, { s: 3, fret: 7, root: true },
  { s: 4, fret: 5 }, { s: 4, fret: 7 },
  { s: 5, fret: 5, root: true }, { s: 5, fret: 8 },
];

// G major, three notes per string (one position).
const THREE_NPS: Dot[] = [
  { s: 0, fret: 5 }, { s: 0, fret: 7 }, { s: 0, fret: 8 },
  { s: 1, fret: 5 }, { s: 1, fret: 7 }, { s: 1, fret: 8, root: true },
  { s: 2, fret: 4 }, { s: 2, fret: 5 }, { s: 2, fret: 7 },
  { s: 3, fret: 4 }, { s: 3, fret: 5, root: true }, { s: 3, fret: 7 },
  { s: 4, fret: 3 }, { s: 4, fret: 5 }, { s: 4, fret: 7 },
  { s: 5, fret: 3, root: true }, { s: 5, fret: 5 }, { s: 5, fret: 7 },
];

const ROW = 11;
const COL = 15;
const PAD_X = 6;
const PAD_TOP = 6;
const PAD_BOTTOM = 16;

function MiniNeck({ dots, minFret, maxFret, label }: {
  dots: Dot[];
  minFret: number;
  maxFret: number;
  label: string;
}) {
  const cols = maxFret - minFret + 1;
  const w = PAD_X * 2 + cols * COL;
  const h = PAD_TOP + 5 * ROW + PAD_BOTTOM;
  const neckRight = PAD_X + cols * COL;
  const x = (fret: number) => PAD_X + (fret - minFret + 0.5) * COL;
  const y = (s: number) => PAD_TOP + s * ROW;

  return (
    <svg className={styles.miniNeck} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <g stroke="var(--fb-neutral-stroke)" strokeWidth="0.75" opacity="0.5">
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <line key={`s${s}`} x1={PAD_X} y1={y(s)} x2={neckRight} y2={y(s)} />
        ))}
        {Array.from({ length: cols + 1 }, (_, i) => (
          <line key={`f${i}`} x1={PAD_X + i * COL} y1={PAD_TOP} x2={PAD_X + i * COL} y2={PAD_TOP + 5 * ROW} />
        ))}
      </g>
      {dots.map((d) => (
        <circle
          key={`${d.s}-${d.fret}`}
          cx={x(d.fret)}
          cy={y(d.s)}
          r="4"
          fill={d.root ? "var(--fb-home-fill)" : "var(--fb-neutral-fill)"}
          stroke={d.root ? "var(--fb-home-stroke)" : "var(--fb-neutral-stroke)"}
          strokeWidth="1.5"
        />
      ))}
      <text x={x(minFret)} y={h - 4} textAnchor="middle" className={styles.miniNeckFret}>
        {minFret}
      </text>
      <text x={neckRight + PAD_X} y={h - 4} textAnchor="end" className={styles.miniNeckLabel}>
        {label}
      </text>
    </svg>
  );
}

export function ShapeDiagram() {
  const { t } = useTranslation();
  return (
    <div className={styles.shapeRow}>
      <MiniNeck dots={CAGED_BOX} minFret={5} maxFret={8} label={t("help.items.patternCagedLabel")} />
      <MiniNeck dots={THREE_NPS} minFret={3} maxFret={8} label={t("help.items.patternNpsLabel")} />
    </div>
  );
}
