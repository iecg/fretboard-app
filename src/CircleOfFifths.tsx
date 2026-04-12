import { CIRCLE_OF_FIFTHS, getNoteDisplayInScale, getKeySignatureForDisplay, formatAccidental, SCALES } from "./theory";
import { DEGREE_COLORS, getDegreesForScale } from "./degrees";
import { getCircleNoteLabels } from "./circleOfFifthsUtils";

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_RADIUS = SIZE * 0.48;
const INNER_RADIUS = SIZE * 0.26;
const LABEL_RADIUS = SIZE * 0.39;
const DEGREE_RADIUS = SIZE * 0.31;


export function CircleOfFifths({
  rootNote,
  setRootNote,
  scaleName = "Major",
  useFlats = false,
  enharmonicDisplay = "auto",
}: {
  rootNote: string;
  setRootNote: (n: string) => void;
  scaleName?: string;
  useFlats?: boolean;
  enharmonicDisplay?: "auto" | "on" | "off";
}) {
  const rootIndex = CIRCLE_OF_FIFTHS.indexOf(rootNote);

  const rootDisplayLabel = getNoteDisplayInScale(rootNote, rootNote, SCALES[scaleName] || [], useFlats);
  const keySig = getKeySignatureForDisplay(rootDisplayLabel, scaleName, useFlats);
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
          const chromaticInterval = (intervalIndex * 7) % 12;
          const degreeMap = getDegreesForScale(scaleName);
          const degreeStr = degreeMap[chromaticInterval] ?? "";

          const { primary, enharmonic } = getCircleNoteLabels(note, rootNote, useFlats, SCALES[scaleName] || [], enharmonicDisplay);
          const noteFontSize = Math.max(15, isActive ? SIZE * 0.055 : SIZE * 0.048);
          const degreeFontSize = Math.max(10, SIZE * 0.038);

          return (
            <g key={`text-group-${note}`} style={{ pointerEvents: "none" }}>
              {enharmonic !== null ? (
                <text
                  x={lx} y={ly}
                  dominantBaseline="middle" textAnchor="middle"
                  fontSize={noteFontSize}
                  fontWeight="bold"
                  fill={isActive ? "var(--text-main)" : "var(--text-muted)"}
                >
                  <tspan x={lx} dy="-0.3em" stroke="rgba(0,0,0,0.3)" strokeWidth="2" paintOrder="stroke">{primary}</tspan>
                  <tspan x={lx} dy="0.9em" fontSize={Math.max(11, noteFontSize * 0.65)} fontWeight="500" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.6)" strokeWidth="2.5" paintOrder="stroke">{enharmonic}</tspan>
                </text>
              ) : (
                <text
                  x={lx} y={ly}
                  dominantBaseline="middle" textAnchor="middle"
                  fontSize={noteFontSize}
                  fontWeight="bold"
                  fill={isActive ? "var(--text-main)" : "var(--text-muted)"}
                >
                  <tspan x={lx} dy="0" stroke="rgba(0,0,0,0.3)" strokeWidth="2" paintOrder="stroke">{primary}</tspan>
                </text>
              )}

              {degreeStr && (
                <text
                  x={dx} y={dy}
                  dominantBaseline="middle" textAnchor="middle"
                  fill={DEGREE_COLORS[degreeStr] ?? "var(--accent-primary)"}
                  fontSize={degreeFontSize}
                  fontWeight="bold"
                  opacity={isActive ? 1.0 : 0.7}
                  stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" paintOrder="stroke"
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
          fill="var(--text-muted)" fontSize={Math.max(15, SIZE * 0.05)}
          fontWeight="bold"
          stroke="rgba(0,0,0,0.3)" strokeWidth="2" paintOrder="stroke"
        >
          {formatAccidental(getNoteDisplayInScale(rootNote, rootNote, SCALES[scaleName] || [], useFlats))}
        </text>
        <text
          x={CX} y={CY + SIZE * 0.04}
          textAnchor="middle" dominantBaseline="middle"
          fill="var(--accent-primary)" fontSize={Math.max(15, SIZE * 0.055)}
          fontWeight="bold"
          stroke="rgba(0,0,0,0.3)" strokeWidth="2" paintOrder="stroke"
        >
          {keySigText}
        </text>
      </svg>
    </div>
  );
}
