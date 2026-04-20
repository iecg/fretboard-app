import clsx from "clsx";
import type { PracticeBarGroup, PracticeBarNote } from "../theory";
import "./ChordPracticeBar.css";

interface PillProps {
  note: PracticeBarNote;
}

function Pill({ note }: PillProps) {
  const aria = [note.displayNote, note.intervalName].filter(Boolean).join(", ");
  return (
    <li
      className="practice-bar-pill"
      data-chord-root={note.isChordRoot ? "true" : undefined}
      data-guide-tone={note.isGuideTone ? "true" : undefined}
      data-tension={note.isTension ? "true" : undefined}
      data-in-scale={note.isInScale ? "true" : undefined}
      aria-label={aria}
    >
      <span className="practice-bar-pill-note">{note.displayNote}</span>
      {note.intervalName && (
        <span className="practice-bar-pill-interval">{note.intervalName}</span>
      )}
      {note.resolvesTo && (
        <span
          className="practice-bar-pill-resolve"
          aria-label={`resolves to ${note.resolvesTo.displayNote}`}
        >
          →{note.resolvesTo.displayNote}
        </span>
      )}
    </li>
  );
}

interface GroupProps {
  variant: "chord" | "land-on";
  group: PracticeBarGroup;
}

function Group({ variant, group }: GroupProps) {
  if (group.notes.length === 0) return null;
  return (
    <div
      className="practice-bar-group"
      data-group-variant={variant}
      aria-label={group.label}
    >
      <span className="practice-bar-group-label">{group.label}:</span>
      <ul className="practice-bar-pill-list">
        {group.notes.map((n, i) => (
          <Pill key={`${variant}-${n.internalNote}-${i}`} note={n} />
        ))}
      </ul>
    </div>
  );
}

export interface ChordPracticeBarProps {
  title: string;
  badge?: string | null;
  /** Active lens label sourced from LENS_REGISTRY. */
  lensLabel?: string | null;
  /** Chord group — lens-independent; always all chord members. */
  chordGroup: PracticeBarGroup;
  /** Land on group — lens-driven coaching subset. */
  landOnGroup: PracticeBarGroup;
  className?: string;
}

/**
 * Two groups are semantically identical when they cover the same notes in
 * the same order AND the Land on group adds no extra coaching data (e.g.
 * resolution arrows). In that case we collapse the bar to a single group
 * (preferring Land on) to avoid showing the same row twice.
 */
function landOnMatchesChord(
  chordGroup: PracticeBarGroup,
  landOnGroup: PracticeBarGroup,
): boolean {
  if (chordGroup.notes.length !== landOnGroup.notes.length) return false;
  if (landOnGroup.notes.some((n) => n.resolvesTo !== undefined)) return false;
  for (let i = 0; i < chordGroup.notes.length; i++) {
    const a = chordGroup.notes[i]!;
    const b = landOnGroup.notes[i]!;
    if (a.internalNote !== b.internalNote) return false;
    if (a.intervalName !== b.intervalName) return false;
  }
  return true;
}

export function ChordPracticeBar({
  title,
  badge,
  lensLabel,
  chordGroup,
  landOnGroup,
  className,
}: ChordPracticeBarProps) {
  if (chordGroup.notes.length === 0 && landOnGroup.notes.length === 0) {
    return null;
  }

  const collapse = landOnMatchesChord(chordGroup, landOnGroup);

  return (
    <section
      role="group"
      aria-label={`Practice cues: ${title}`}
      className={clsx("chord-practice-bar", className)}
    >
      <div className="chord-practice-bar-header">
        <span className="chord-practice-bar-title">{title}</span>
        {lensLabel && (
          <span className="chord-practice-bar-lens-label">{lensLabel}</span>
        )}
        {badge && <span className="chord-practice-bar-badge">{badge}</span>}
      </div>
      <div className="chord-practice-bar-groups">
        {!collapse && <Group variant="chord" group={chordGroup} />}
        <Group variant="land-on" group={landOnGroup} />
      </div>
    </section>
  );
}
