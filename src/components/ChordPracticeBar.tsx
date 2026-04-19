import clsx from "clsx";
import type { ChordRowEntry, ViewMode } from "../theory";
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

export interface ChordPracticeBarProps {
  title: string;
  badge: string | null;
  viewMode: ViewMode;
  targetMembers: ChordRowEntry[];
  sharedMembers: ChordRowEntry[];
  outsideMembers: ChordRowEntry[];
  className?: string;
}

export function ChordPracticeBar({
  title,
  badge,
  viewMode,
  targetMembers,
  sharedMembers,
  outsideMembers,
  className,
}: ChordPracticeBarProps) {
  if (
    targetMembers.length === 0 &&
    sharedMembers.length === 0 &&
    outsideMembers.length === 0
  )
    return null;

  const showTargets = viewMode === "compare" || viewMode === "chord";
  const showShared = viewMode === "compare";
  const showOutside = viewMode === "compare" || viewMode === "outside";

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
        {showShared && (
          <PillGroup
            label="Shared"
            members={sharedMembers}
            ariaLabel="Shared with scale"
          />
        )}
        {showOutside && (
          <PillGroup
            label="Outside"
            members={outsideMembers}
            ariaLabel="Outside scale"
          />
        )}
      </div>
    </section>
  );
}
