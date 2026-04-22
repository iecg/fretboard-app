import { atom } from "jotai";
import {
  getScaleNotes,
  formatAccidental,
  NOTES,
  type NoteRole,
  
  type LegendItem,
} from "../core/theory";
import {
  rootNoteAtom,
  scaleNameAtom,
  scaleNotesAtom,
  scaleLabelAtom,
} from "./scaleAtoms";
import {
  chordRootAtom,
  chordTypeAtom,
  chordTonesAtom,
  chordMembersAtom,
  chordLabelAtom,
  allChordMembersAtom,
} from "./chordOverlayAtoms";

export const noteRoleMapAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const chordRoot = get(chordRootAtom);
  const activeChordTones = get(chordTonesAtom);

  if (!chordType) return new Map<string, NoteRole>();
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  const activeChordToneSet = new Set(activeChordTones);
  const map = new Map<string, NoteRole>();
  for (const note of NOTES) {
    const isInScale = scaleNoteSet.has(note);
    const isActiveChordTone = activeChordToneSet.has(note);
    const isChordRootNote = note === chordRoot;
    if (isChordRootNote && isActiveChordTone) {
      map.set(note, "chord-root");
    } else if (isActiveChordTone && isInScale) {
      map.set(note, "chord-tone-in-scale");
    } else if (isActiveChordTone && !isInScale) {
      map.set(note, "chord-tone-outside-scale");
    } else if (isInScale) {
      map.set(note, "scale-only");
    }
  }
  return map;
});

// All chord members — tension lens shows all notes (not just outside ones).
export const summaryChordRowAtom = atom((get) => get(allChordMembersAtom));

export const summaryLegendItemsAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [] as LegendItem[];

  const summaryChordRow = get(summaryChordRowAtom);
  const noteRoleMap = get(noteRoleMapAtom);

  const rolesPresent = new Set(summaryChordRow.map((e) => e.role));
  const items: LegendItem[] = [];
  if (rolesPresent.has("chord-root"))
    items.push({ role: "chord-root", label: "Chord root" });
  if (rolesPresent.has("chord-tone-in-scale"))
    items.push({ role: "chord-tone-in-scale", label: "Chord tone" });
  if (rolesPresent.has("chord-tone-outside-scale"))
    items.push({ role: "chord-tone-outside-scale", label: "Outside scale" });
  // Scale-only notes are always visible.
  const hasScaleOnly = Array.from(noteRoleMap.values()).includes("scale-only");
  if (hasScaleOnly) {
    items.push({ role: "scale-only", label: "Scale only" });
  }
  return items;
});

export const summaryNotesAtom = atom((get) => get(scaleNotesAtom));

export const chordMemberLabelsAtom = atom((get) =>
  get(chordMembersAtom)
    .map((m) => (m.name === "root" ? "1" : formatAccidental(m.name)))
    .join(" "),
);

export const summaryHeaderLeftAtom = atom((get) => {
  const scaleLabel = get(scaleLabelAtom);
  return scaleLabel;
});

export const summaryHeaderRightAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const chordLabel = get(chordLabelAtom);

  if (!chordType || !chordLabel) return null;
  return chordLabel;
});

export const summaryPrimaryModeAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return "scale";
  return "scale";
});

export const sharedChordMembersAtom = atom((get) =>
  get(summaryChordRowAtom).filter((e) => e.inScale),
);

export const outsideChordMembersAtom = atom((get) =>
  get(summaryChordRowAtom).filter((e) => !e.inScale),
);
