import clsx from "clsx";
import type { PracticeCue } from "../theory";
import "./ChordPracticeBar.css";

function cueKindDefaultRole(kind: PracticeCue["kind"]): string {
  switch (kind) {
    case "guide-tones": return "guide-tone";
    case "color-note": return "color-tone";
    case "tension": return "chord-tone-outside-scale";
    default: return "chord-tone-in-scale";
  }
}

interface CueLineProps {
  cue: PracticeCue;
}

function CueLine({ cue }: CueLineProps) {
  return (
    <div className="practice-bar-cue">
      <span className="practice-bar-cue-label">{cue.label}:</span>
      <ul className="practice-bar-pill-list" aria-label={cue.label}>
        {cue.notes.map((note, i) => (
          <li
            key={`${note.internalNote}-${i}`}
            className="practice-bar-pill"
            data-role={note.role ?? cueKindDefaultRole(cue.kind)}
            aria-label={[note.displayNote, note.intervalName].filter(Boolean).join(", ")}
          >
            <span className="practice-bar-pill-note">{note.displayNote}</span>
            {note.intervalName && (
              <span className="practice-bar-pill-interval">{note.intervalName}</span>
            )}
            {note.resolvesTo && (
              <span className="practice-bar-pill-resolve" aria-label={`resolves to ${note.resolvesTo.displayNote}`}>
                →{note.resolvesTo.displayNote}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ChordPracticeBarProps {
  title: string;
  badge?: string | null;
  cues: PracticeCue[];
  isShapeLocal?: boolean;
  shapeContextLabel?: string | null;
  /** Shape-filtered cues — shown instead of global cues when in single-shape context */
  shapeLocalCues?: PracticeCue[];
  className?: string;
}

export function ChordPracticeBar({
  title,
  badge,
  cues,
  isShapeLocal = false,
  shapeContextLabel = null,
  shapeLocalCues,
  className,
}: ChordPracticeBarProps) {
  const effectiveCues =
    isShapeLocal && shapeLocalCues && shapeLocalCues.length > 0
      ? shapeLocalCues
      : cues;

  if (effectiveCues.length === 0) return null;

  return (
    <section
      role="group"
      aria-label={`Practice cues: ${title}`}
      className={clsx("chord-practice-bar", className)}
    >
      <div className="chord-practice-bar-header">
        <span className="chord-practice-bar-title">{title}</span>
        {badge && <span className="chord-practice-bar-badge">{badge}</span>}
      </div>
      {shapeContextLabel && (
        <div className="chord-practice-bar-context">{shapeContextLabel}</div>
      )}
      <div className="chord-practice-bar-cues">
        {effectiveCues.map((cue, i) => (
          <CueLine key={`${cue.kind}-${i}`} cue={cue} />
        ))}
      </div>
    </section>
  );
}
