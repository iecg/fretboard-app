import clsx from "clsx";
import type { ChordRowEntry, PracticeBarColorNote, ViewMode } from "../theory";
import "./ChordPracticeBar.css";

interface PillGroupProps {
  label: string;
  members: ChordRowEntry[];
  ariaLabel: string;
}

function PillGroup({ label, members, ariaLabel }: PillGroupProps) {
  if (members.length === 0) return null;
  return (
    <div className="practice-bar-group">
      <span className="practice-bar-group-label">{label}</span>
      <ul className="practice-bar-pill-list" aria-label={ariaLabel}>
        {members.map((entry, i) => (
          <li
            key={`${entry.internalNote}-${i}`}
            className="practice-bar-pill"
            data-role={entry.role}
            aria-label={`${entry.displayNote}, ${entry.memberName}`}
          >
            <span className="practice-bar-pill-note">{entry.displayNote}</span>
            <span className="practice-bar-pill-interval">{entry.memberName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ColorPillGroupProps {
  label: string;
  entries: PracticeBarColorNote[];
  ariaLabel: string;
}

function ColorPillGroup({ label, entries, ariaLabel }: ColorPillGroupProps) {
  if (entries.length === 0) return null;
  return (
    <div className="practice-bar-group">
      <span className="practice-bar-group-label">{label}</span>
      <ul className="practice-bar-pill-list" aria-label={ariaLabel}>
        {entries.map((entry, i) => (
          <li
            key={`${entry.internalNote}-${i}`}
            className="practice-bar-pill"
            data-role="color-tone"
            aria-label={`${entry.displayNote}, ${entry.intervalName}`}
          >
            <span className="practice-bar-pill-note">{entry.displayNote}</span>
            <span className="practice-bar-pill-interval">{entry.intervalName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ChordPracticeBarProps {
  title: string;
  badge: string | null;
  viewMode: ViewMode;
  targetMembers: ChordRowEntry[];
  outsideMembers: ChordRowEntry[];
  colorNoteEntries?: PracticeBarColorNote[];
  className?: string;
}

export function ChordPracticeBar({
  title,
  badge,
  viewMode,
  targetMembers,
  outsideMembers,
  colorNoteEntries = [],
  className,
}: ChordPracticeBarProps) {
  const hasTargets = targetMembers.length > 0;
  const hasOutside = outsideMembers.length > 0;
  const hasColor = colorNoteEntries.length > 0;

  if (!hasTargets && !hasOutside && !hasColor) return null;

  const showTargets = (viewMode === "compare" || viewMode === "chord") && hasTargets;
  const showOutside = (viewMode === "compare" || viewMode === "outside") && hasOutside;
  const showColor = viewMode === "compare" && hasColor;

  return (
    <section
      role="group"
      aria-label={`Chord analysis: ${title}`}
      className={clsx("chord-practice-bar", className)}
    >
      <div className="chord-practice-bar-header">
        <span className="chord-practice-bar-title">{title}</span>
        {badge && (
          <span className="chord-practice-bar-badge">{badge}</span>
        )}
      </div>
      <div className="chord-practice-bar-groups">
        {showTargets && (
          <PillGroup
            label="Targets"
            members={targetMembers}
            ariaLabel="Target chord members"
          />
        )}
        {showOutside && (
          <PillGroup
            label="Outside"
            members={outsideMembers}
            ariaLabel="Outside scale"
          />
        )}
        {showColor && (
          <ColorPillGroup
            label="Color"
            entries={colorNoteEntries}
            ariaLabel="Characteristic color tones"
          />
        )}
      </div>
    </section>
  );
}
