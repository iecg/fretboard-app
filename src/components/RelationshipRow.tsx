import clsx from "clsx";
import type { ChordRowEntry } from "../theory";
import "./RelationshipRow.css";

interface RelationshipRowProps {
  sharedMembers: ChordRowEntry[];
  outsideMembers: ChordRowEntry[];
  className?: string;
}

export function RelationshipRow({
  sharedMembers,
  outsideMembers,
  className,
}: RelationshipRowProps) {
  if (sharedMembers.length === 0 && outsideMembers.length === 0) return null;

  return (
    <div
      className={clsx("relationship-row", className)}
      role="group"
      aria-label="Chord-scale relationship"
    >
      {sharedMembers.length > 0 && (
        <div className="relationship-group" data-group="shared">
          <span className="relationship-group-label">Shared</span>
          <ul className="relationship-pill-list" aria-label="Shared with scale">
            {sharedMembers.map((entry, i) => (
              <li
                key={`${entry.internalNote}-${i}`}
                className="relationship-pill"
                data-role={entry.role}
              >
                <span className="relationship-pill-note">{entry.displayNote}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {outsideMembers.length > 0 && (
        <div className="relationship-group" data-group="outside">
          <span className="relationship-group-label">Outside</span>
          <ul className="relationship-pill-list" aria-label="Outside scale">
            {outsideMembers.map((entry, i) => (
              <li
                key={`${entry.internalNote}-${i}`}
                className="relationship-pill"
                data-role={entry.role}
              >
                <span className="relationship-pill-note">{entry.displayNote}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
