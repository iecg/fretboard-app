import clsx from "clsx";
import { formatAccidental, getNoteDisplay } from "../theory";
import "./NoteGrid.css";

interface NoteGridProps {
  notes: string[];
  selected: string;
  onSelect: (note: string) => void;
  useFlats: boolean;
}

export function NoteGrid({
  notes,
  selected,
  onSelect,
  useFlats,
}: NoteGridProps) {
  return (
    <div className="note-grid" role="group" aria-label="Note selector">
      {notes.map((n) => (
        <button
          key={n}
          type="button"
          className={clsx("note-btn", { active: selected === n })}
          aria-pressed={selected === n}
          onClick={() => onSelect(n)}
        >
          {formatAccidental(getNoteDisplay(n, n, useFlats))}
        </button>
      ))}
    </div>
  );
}
