import { CIRCLE_OF_FIFTHS, CIRCLE_DISPLAY_LABELS, getKeySignature } from "./theory";

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_RADIUS = SIZE * 0.48;
const INNER_RADIUS = SIZE * 0.26;
const LABEL_RADIUS = SIZE * 0.39;
const DEGREE_RADIUS = SIZE * 0.33;

function getDisplayLabel(note: string, rootNote: string): string {
  if (note === 'F#' && rootNote !== 'F#') return CIRCLE_DISPLAY_LABELS[note] || note;
  if (note === 'F#' && rootNote === 'F#') return 'F#';
  return CIRCLE_DISPLAY_LABELS[note] || note;
}

export function CircleOfFifths({
  rootNote,
  setRootNote,
}: {
  rootNote: string;
  setRootNote: (n: string) => void;
}) {
  const rootIndex = CIRCLE_OF_FIFTHS.indexOf(rootNote);

  const keySig = getKeySignature(rootNote);
  const keySigText = keySig === 0 ? '♮' : keySig > 0 ? `${keySig}♯` : `${Math.abs(keySig)}♭`;

  return (
    <div className="circle-fifths-container">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="circle-fifths-svg">
        {CIRCLE_OF_FIFTHS.map((note, index) => {
          const startAngle = ((index * 30 - 105) * Math.PI) / 180;
          const endAngle = (((index + 1) * 30 - 105) * Math.PI) / 180;

          const ox1 = CX + OUTER_RADIUS * Math.cos(startAngle);
          const oy1 = CY + OUTER_RADIUS * Math.sin(startAngle);
          const ox2 = CX + OUTER_RADIUS * Math.cos(endAngle);
          const oy2 = CY + OUTER_RADIUS * Math.sin(endAngle);

          const ix1 = CX + INNER_RADIUS * Math.cos(startAngle);
          const iy1 = CY + INNER_RADIUS * Math.sin(startAngle);
          const ix2 = CX + INNER_RADIUS * Math.cos(endAngle);
          const iy2 = CY + INNER_RADIUS * Math.sin(endAngle);

          const path = `M ${ix1} ${iy1} L ${ox1} ${oy1} A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${ix1} ${iy1} Z`;
          const isActive = rootNote === note;

          return (
            <path
              key={note}
              d={path}
              className={`circle-slice ${isActive ? "active" : ""}`}
              stroke="var(--surface-highlight)"
              strokeWidth={1}
              onClick={() => setRootNote(note)}
              role="button"
              tabIndex={0}
              aria-label={`Select ${note}`}
              aria-pressed={isActive}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setRootNote(note);
                }
              }}
            />
          );
        })}

        {/* Text labels inside segments */}
        {CIRCLE_OF_FIFTHS.map((note, index) => {
          const angle = ((index * 30 - 90) * Math.PI) / 180;
          const lx = CX + LABEL_RADIUS * Math.cos(angle);
          const ly = CY + LABEL_RADIUS * Math.sin(angle);
          const dx = CX + DEGREE_RADIUS * Math.cos(angle);
          const dy = CY + DEGREE_RADIUS * Math.sin(angle);
          const isActive = rootNote === note;

          const intervalIndex = (index - rootIndex + 12) % 12;
          let degreeStr = "";
          switch (intervalIndex) {
            case 0: degreeStr = "I"; break;
            case 1: degreeStr = "V"; break;
            case 2: degreeStr = "ii"; break;
            case 3: degreeStr = "vi"; break;
            case 4: degreeStr = "iii"; break;
            case 5: degreeStr = "vii°"; break;
            case 11: degreeStr = "IV"; break;
          }

          const label = getDisplayLabel(note, rootNote);
          const parts = label.split('/');
          const noteFontSize = isActive ? SIZE * 0.055 : SIZE * 0.048;
          const degreeFontSize = SIZE * 0.032;

          return (
            <g key={`text-group-${note}`} style={{ pointerEvents: "none" }}>
              {parts.length > 1 ? (
                <text
                  x={lx} y={ly}
                  dominantBaseline="middle" textAnchor="middle"
                  fontSize={noteFontSize}
                  fontWeight="bold"
                  fill={isActive ? "var(--text-main)" : "var(--text-muted)"}
                >
                  <tspan x={lx} dy="-0.5em">{parts[0]}</tspan>
                  <tspan x={lx} dy="1em" fontSize={noteFontSize * 0.85}>{parts[1]}</tspan>
                </text>
              ) : (
                <text
                  x={lx} y={ly}
                  dominantBaseline="middle" textAnchor="middle"
                  fontSize={noteFontSize}
                  fontWeight="bold"
                  fill={isActive ? "var(--text-main)" : "var(--text-muted)"}
                >
                  {label}
                </text>
              )}

              {degreeStr && (
                <text
                  x={dx} y={dy}
                  dominantBaseline="middle" textAnchor="middle"
                  fill="var(--accent-primary)"
                  fontSize={degreeFontSize}
                  fontWeight="bold"
                  opacity={isActive ? 1 : 0.6}
                >
                  {degreeStr}
                </text>
              )}
            </g>
          );
        })}

        {/* Inner donut hole */}
        <circle cx={CX} cy={CY} r={INNER_RADIUS} fill="var(--surface-base)" />

        {/* Root note and key signature in center */}
        <text
          x={CX} y={CY - SIZE * 0.04}
          textAnchor="middle" dominantBaseline="middle"
          fill="var(--text-muted)" fontSize={SIZE * 0.05}
          fontWeight="bold"
        >
          {rootNote}
        </text>
        <text
          x={CX} y={CY + SIZE * 0.04}
          textAnchor="middle" dominantBaseline="middle"
          fill="var(--accent-primary)" fontSize={SIZE * 0.055}
          fontWeight="bold"
        >
          {keySigText}
        </text>
      </svg>
    </div>
  );
}
