import { useRef, useEffect } from "react";
import clsx from "clsx";
import { formatAccidental, getNoteDisplay } from "../../core/theory";
import shared from "../shared/shared.module.css";

interface NoteGridProps {
  notes: string[];
  selected: string;
  onSelect: (note: string) => void;
  useFlats: boolean;
}

const GRID_COLS = 6;

export function NoteGrid({
  notes,
  selected,
  onSelect,
  useFlats,
}: NoteGridProps) {
  const selectedIndex = notes.indexOf(selected);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const keyboardDrivenRef = useRef(false);

  useEffect(() => {
    if (keyboardDrivenRef.current) {
      buttonRefs.current[selectedIndex]?.focus();
      keyboardDrivenRef.current = false;
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const cols = GRID_COLS;

    switch (e.key) {
      case "ArrowRight": {
        e.preventDefault();
        keyboardDrivenRef.current = true;
        const nextIndex = index < notes.length - 1 ? index + 1 : 0;
        onSelect(notes[nextIndex]);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        keyboardDrivenRef.current = true;
        const prevIndex = index > 0 ? index - 1 : notes.length - 1;
        onSelect(notes[prevIndex]);
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        keyboardDrivenRef.current = true;
        const nextIndex = index + cols;
        if (nextIndex < notes.length) {
          onSelect(notes[nextIndex]);
        } else {
          onSelect(notes[nextIndex - notes.length]);
        }
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        keyboardDrivenRef.current = true;
        const prevIndex = index - cols;
        if (prevIndex >= 0) {
          onSelect(notes[prevIndex]);
        } else {
          onSelect(notes[prevIndex + notes.length]);
        }
        break;
      }
      case "Home": {
        e.preventDefault();
        keyboardDrivenRef.current = true;
        onSelect(notes[0]);
        break;
      }
      case "End": {
        e.preventDefault();
        keyboardDrivenRef.current = true;
        onSelect(notes[notes.length - 1]);
        break;
      }
    }
  };

  return (
    <div className={shared["note-grid"]} role="group" aria-label="Note selector">
      {notes.map((n, index) => (
        <button
          key={n}
          ref={(el) => {
            buttonRefs.current[index] = el;
          }}
          type="button"
          className={clsx(shared["note-btn"], selected === n && shared.active)}
          aria-pressed={selected === n}
          onClick={() => onSelect(n)}
          onKeyDown={(e) => handleKeyDown(e, index)}
        >
          <span className={shared["note-btn-label"]}>
            {formatAccidental(getNoteDisplay(n, n, useFlats))}
          </span>
        </button>
      ))}
    </div>
  );
}