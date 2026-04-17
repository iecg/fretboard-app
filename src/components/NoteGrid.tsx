import clsx from "clsx";
import { formatAccidental, getNoteDisplay } from "../theory";
import "./NoteGrid.css";
import shared from "./shared.module.css";

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
    <div className={shared["note-grid"]} role="group" aria-label="Note selector">
      {notes.map((n) => (
        <button
          key={n}
          type="button"
          className={clsx(shared["note-btn"], selected === n && shared.active)}
          aria-pressed={selected === n}
          onClick={() => onSelect(n)}
        >
          <span className={shared["note-btn-label"]}>
            {formatAccidental(getNoteDisplay(n, n, useFlats))}
          </span>
        </button>
      ))}
    </div>
  );
}
