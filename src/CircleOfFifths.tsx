import { CIRCLE_OF_FIFTHS, ENHARMONICS, getNoteDisplayInScale, getKeySignatureForDisplay, formatAccidental, SCALES } from "./theory";

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_RADIUS = SIZE * 0.48;
const INNER_RADIUS = SIZE * 0.26;
const LABEL_RADIUS = SIZE * 0.39;
const DEGREE_RADIUS = SIZE * 0.31;

function getCircleNoteLabels(note: string, rootNote: string, useFlats: boolean, scaleIntervals: number[]): { primary: string; enharmonic: string | null } {
  const display = getNoteDisplayInScale(note, rootNote, scaleIntervals, useFlats);
  if (display !== note) {
    // Respelled (sharp→flat, flat→sharp, or natural→accidental like F→E#)
    return { primary: formatAccidental(display), enharmonic: formatAccidental(note) };
  }
  // No change — check if there's a standard enharmonic to show
  if (note.includes('#')) {
    const enh = ENHARMONICS[note] ?? null;
    return { primary: formatAccidental(note), enharmonic: enh ? formatAccidental(enh) : null };
  }
  return { primary: note, enharmonic: null };
}

// Scale degrees keyed by chromatic semitone interval from root
const MODE_DEGREES: Record<string, Record<number, string>> = {
  // Major modes
  'Major':           { 0: "I", 2: "ii", 4: "iii", 5: "IV", 7: "V", 9: "vi", 11: "vii°" },
  'Lydian':          { 0: "I", 2: "II", 4: "iii", 6: "iv°", 7: "V", 9: "vi", 11: "vii" },
  'Mixolydian':      { 0: "I", 2: "ii", 4: "iii°", 5: "IV", 7: "v", 9: "vi", 10: "VII" },
  // Minor modes
  'Natural Minor':   { 0: "i", 2: "ii°", 3: "III", 5: "iv", 7: "v", 8: "VI", 10: "VII" },
  'Dorian':          { 0: "i", 2: "ii", 3: "III", 5: "IV", 7: "v", 9: "vi°", 10: "VII" },
  'Phrygian':        { 0: "i", 1: "II", 3: "III", 5: "iv", 7: "v°", 8: "VI", 10: "vii" },
  'Locrian':         { 0: "i°", 1: "II", 3: "iii", 5: "iv", 6: "V", 8: "VI", 10: "vii" },
  'Harmonic Minor':  { 0: "i", 2: "ii°", 3: "III+", 5: "iv", 7: "V", 8: "VI", 11: "vii°" },
};

export const DEGREE_COLORS: Record<string, string> = {
  "I": "#f59e0b",   // amber - tonic
  "i": "#f59e0b",
  "i°": "#f59e0b",
  "II": "#3b82f6",  // blue - supertonic
  "ii": "#3b82f6",
  "ii°": "#3b82f6",
  "III": "#10b981",  // emerald - mediant
  "III+": "#10b981",
  "iii": "#10b981",
  "iii°": "#10b981",
  "IV": "#ef4444",   // red - subdominant
  "iv": "#ef4444",
  "iv°": "#ef4444",
  "V": "#8b5cf6",   // violet - dominant
  "v": "#8b5cf6",
  "v°": "#8b5cf6",
  "VI": "#ec4899",   // pink - submediant
  "vi": "#ec4899",
  "vi°": "#ec4899",
  "VII": "#6366f1",  // indigo - leading tone
  "vii": "#6366f1",
  "vii°": "#6366f1",
};

// Fallback: major-quality scales use Major degrees, minor-quality use Natural Minor
export function getDegreesForScale(scaleName: string): Record<number, string> {
  if (MODE_DEGREES[scaleName]) return MODE_DEGREES[scaleName];
  const intervals = SCALES[scaleName];
  if (intervals && intervals.includes(4)) return MODE_DEGREES['Major'];
  return MODE_DEGREES['Natural Minor'];
}

export function CircleOfFifths({
  rootNote,
  setRootNote,
  scaleName = "Major",
  useFlats = false,
}: {
  rootNote: string;
  setRootNote: (n: string) => void;
  scaleName?: string;
  useFlats?: boolean;
}) {
  const rootIndex = CIRCLE_OF_FIFTHS.indexOf(rootNote);

  const keySig = getKeySignatureForDisplay(rootNote, useFlats);
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

          const { primary, enharmonic } = getCircleNoteLabels(note, rootNote, useFlats, SCALES[scaleName] || []);
          const noteFontSize = isActive ? SIZE * 0.055 : SIZE * 0.048;
          const degreeFontSize = SIZE * 0.038;

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
                  <tspan x={lx} dy="0.9em" fontSize={noteFontSize * 0.65} fontWeight="500" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.6)" strokeWidth="2.5" paintOrder="stroke">{enharmonic}</tspan>
                </text>
              ) : (
                <text
                  x={lx} y={ly}
                  dominantBaseline="middle" textAnchor="middle"
                  fontSize={noteFontSize}
                  fontWeight="bold"
                  fill={isActive ? "var(--text-main)" : "var(--text-muted)"}
                >
                  <tspan stroke="rgba(0,0,0,0.3)" strokeWidth="2" paintOrder="stroke">{primary}</tspan>
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
          fill="var(--text-muted)" fontSize={SIZE * 0.05}
          fontWeight="bold"
          stroke="rgba(0,0,0,0.3)" strokeWidth="2" paintOrder="stroke"
        >
          {formatAccidental(getNoteDisplayInScale(rootNote, rootNote, SCALES[scaleName] || [], useFlats))}
        </text>
        <text
          x={CX} y={CY + SIZE * 0.04}
          textAnchor="middle" dominantBaseline="middle"
          fill="var(--accent-primary)" fontSize={SIZE * 0.055}
          fontWeight="bold"
          stroke="rgba(0,0,0,0.3)" strokeWidth="2" paintOrder="stroke"
        >
          {keySigText}
        </text>
      </svg>
    </div>
  );
}
