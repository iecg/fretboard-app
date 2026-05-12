import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { Eye, EyeOff } from "lucide-react";
import { AnimatePresence, motion } from 'motion/react';
import type { PracticeBarGroup, PracticeBarNote } from "@fretflow/core";
import {
  chordOverlayHiddenAtom,
  chordHiddenNotesAtom,
  scaleDegreeColorsEnabledAtom,
  toggleChordHiddenNoteAtom,
  toggleChordOverlayHiddenAtom,
} from "../../store/atoms";
import shared from "../shared/shared.module.css";
import styles from "./ChordPracticeBar.module.css";

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
        data-scale-degree={note.scaleDegree !== undefined ? note.scaleDegree : undefined}
        data-hidden-note={noteHidden ? "true" : undefined}
        style={note.degreeColor ? { "--degree-color": note.degreeColor } as React.CSSProperties : undefined}
        aria-label={`Toggle visibility of ${aria}`}
        aria-pressed={!noteHidden}
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
  const degreeColorsEnabled = useAtomValue(scaleDegreeColorsEnabledAtom);

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
      data-degree-colors={degreeColorsEnabled ? "true" : undefined}
    >
      <header className={styles["chord-practice-bar-header"]}>
        <button
          type="button"
          className={styles["practice-bar-eye-toggle"]}
          aria-label="Toggle visibility of chord overlay"
          aria-pressed={collapsed}
          onClick={() => toggleCollapsed()}
        >
          <span className={shared["flex-center"]}>
            {collapsed
              ? <EyeOff size={16} aria-hidden="true" />
              : <Eye size={16} aria-hidden="true" />}
          </span>
        </button>
        <span className={styles["chord-practice-bar-title"]}>{title}</span>
        {lensLabel && (
          <span className={styles["chord-practice-bar-lens-label"]}>{lensLabel}</span>
        )}
        {badge && <span className={styles["chord-practice-bar-badge"]}>{badge}</span>}
      </header>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="groups"
            className={styles["chord-practice-bar-groups-container"]}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
