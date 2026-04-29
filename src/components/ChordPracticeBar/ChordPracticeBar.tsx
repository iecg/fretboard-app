import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import type { PracticeBarGroup, PracticeBarNote } from "../../core/theory";
import {
  chordOverlayHiddenAtom,
  chordHiddenNotesAtom,
  toggleChordHiddenNoteAtom,
  toggleChordOverlayHiddenAtom,
} from "../../store/atoms";
import styles from "./ChordPracticeBar.module.css";

function EyeOpenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <path d="m1 1 22 22"/>
    </svg>
  );
}

interface PillProps {
  note: PracticeBarNote;
  noteHidden: boolean;
  onToggleNote: (internalNote: string) => void;
}

function Pill({ note, noteHidden, onToggleNote }: PillProps) {
  const aria = [note.displayNote, note.intervalName].filter(Boolean).join(", ");
  return (
    <li className={styles["practice-bar-pill-item"]}>
      <button
        type="button"
        className={styles["practice-bar-pill"]}
        data-chord-root={note.isChordRoot ? "true" : undefined}
        data-guide-tone={note.isGuideTone ? "true" : undefined}
        data-tension={note.isTension ? "true" : undefined}
        data-in-scale={note.isInScale ? "true" : undefined}
        data-hidden-note={noteHidden ? "true" : undefined}
        aria-label={`${noteHidden ? "Show" : "Hide"} ${aria}`}
        aria-pressed={noteHidden}
        onClick={() => onToggleNote(note.internalNote)}
      >
        <span className={styles["practice-bar-pill-note"]}>{note.displayNote}</span>
        {note.intervalName && (
          <span className={styles["practice-bar-pill-interval"]}>{note.intervalName}</span>
        )}
        {note.resolvesTo && (
          <span
            className={styles["practice-bar-pill-resolve"]}
            aria-label={`resolves to ${note.resolvesTo.displayNote}`}
          >
            →{note.resolvesTo.displayNote}
          </span>
        )}
      </button>
    </li>
  );
}

interface GroupProps {
  variant: "chord" | "land-on";
  group: PracticeBarGroup;
  hiddenNotes: Set<string>;
  onToggleNote: (internalNote: string) => void;
}

function Group({ variant, group, hiddenNotes, onToggleNote }: GroupProps) {
  if (group.notes.length === 0) return null;
  return (
    <div
      className={styles["practice-bar-group"]}
      data-group-variant={variant}
      aria-label={group.label}
    >
      <span className={styles["practice-bar-group-label"]}>{group.label}:</span>
      <ul className={styles["practice-bar-pill-list"]}>
        {group.notes.map((n, i) => (
          <Pill
            key={`${variant}-${n.internalNote}-${i}`}
            note={n}
            noteHidden={hiddenNotes.has(n.internalNote)}
            onToggleNote={onToggleNote}
          />
        ))}
      </ul>
    </div>
  );
}

export interface ChordPracticeBarProps {
  title: string;
  badge?: string | null;
  /** Active lens label from LENS_REGISTRY. */
  lensLabel?: string | null;
  /** All chord members. */
  chordGroup: PracticeBarGroup;
  /** Lens-driven coaching subset. */
  landOnGroup: PracticeBarGroup;
  className?: string;
}

/** Collapse groups when notes match and no coaching data (resolutions) is present. */
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
  const collapsed = useAtomValue(chordOverlayHiddenAtom);
  const hiddenNotes = useAtomValue(chordHiddenNotesAtom);
  const toggleNote = useSetAtom(toggleChordHiddenNoteAtom);
  const toggleCollapsed = useSetAtom(toggleChordOverlayHiddenAtom);

  if (chordGroup.notes.length === 0 && landOnGroup.notes.length === 0) {
    return null;
  }

  const dedupGroups = landOnMatchesChord(chordGroup, landOnGroup);

  return (
    <section
      role="group"
      aria-label={`Practice cues: ${title}`}
      className={clsx(styles["chord-practice-bar"], className)}
      data-collapsed={collapsed ? "true" : undefined}
    >
      <div className={styles["chord-practice-bar-header"]}>
        <button
          type="button"
          className={styles["practice-bar-eye-toggle"]}
          aria-label={collapsed ? "Show chord overlay" : "Hide chord overlay"}
          aria-pressed={collapsed}
          onClick={() => toggleCollapsed()}
        >
          {collapsed ? <EyeClosedIcon /> : <EyeOpenIcon />}
        </button>
        <span className={styles["chord-practice-bar-title"]}>{title}</span>
        {lensLabel && (
          <span className={styles["chord-practice-bar-lens-label"]}>{lensLabel}</span>
        )}
        {badge && <span className={styles["chord-practice-bar-badge"]}>{badge}</span>}
      </div>
      {!collapsed && (
        <div className={styles["chord-practice-bar-groups"]}>
          {!dedupGroups && (
            <Group
              variant="chord"
              group={chordGroup}
              hiddenNotes={hiddenNotes}
              onToggleNote={toggleNote}
            />
          )}
          <Group
            variant="land-on"
            group={landOnGroup}
            hiddenNotes={hiddenNotes}
            onToggleNote={toggleNote}
          />
        </div>
      )}
    </section>
  );
}
