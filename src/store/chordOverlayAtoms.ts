import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  NOTES,
  CHORD_DEFINITIONS,
  LENS_REGISTRY,
  getChordNotes,
  getScaleNotes,
  getNoteDisplay,
  formatAccidental,
} from "../theory";
import type {
  ChordMemberFact,
  ResolvedChordMember,
  PracticeLens,
  ChordRowEntry,
} from "../theory";
import {
  k,
  rawStringStorage,
  booleanStorage,
  constrainedNumberStorage,
  GET_ON_INIT,
} from "../utils/storage";
import {
  scaleNotesAtom,
  useFlatsAtom,
  rootNoteAtom,
  scaleNameAtom,
} from "./scaleAtoms";

// ---------------------------------------------------------------------------
// Chord overlay storage adapters
// ---------------------------------------------------------------------------

// chordType is stored as '' when null (matching old behavior)
const chordTypeStorage = {
  getItem(key: string, initialValue: string | null): string | null {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, "");
        return initialValue;
      }
      return stored === "" ? null : stored;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: string | null): void {
    try {
      localStorage.setItem(key, value ?? "");
    } catch {
      // Storage blocked or unavailable; ignore.
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage blocked or unavailable; ignore.
    }
  },
};

const chordFretSpreadStorage = constrainedNumberStorage({ min: 0, max: 4, integer: true });

// ---------------------------------------------------------------------------
// Practice lens storage adapters
// ---------------------------------------------------------------------------

const PRACTICE_LENS_VALUES = LENS_REGISTRY.map((e) => e.id) as PracticeLens[];

function migrateViewModeToLens(viewMode: string): PracticeLens {
  switch (viewMode) {
    case "chord": return "targets";
    case "outside": return "tension";
    default: return "targets";
  }
}

const practiceLensStorage = {
  getItem(key: string, initialValue: PracticeLens): PracticeLens {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        if ((PRACTICE_LENS_VALUES as string[]).includes(stored))
          return stored as PracticeLens;
        localStorage.setItem(key, initialValue);
        return initialValue;
      }
      // One-time migration: map old viewMode to a lens on first access
      let oldViewMode = localStorage.getItem(k("viewMode"));
      if (!oldViewMode) {
        oldViewMode = localStorage.getItem("viewMode");
      }
      if (oldViewMode) {
        const migrated = migrateViewModeToLens(oldViewMode);
        localStorage.setItem(key, migrated);
        return migrated;
      }
      localStorage.setItem(key, initialValue);
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: PracticeLens): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage blocked or unavailable; ignore.
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage blocked or unavailable; ignore.
    }
  },
};


// ---------------------------------------------------------------------------
// Chord overlay base atoms
// ---------------------------------------------------------------------------

export const chordRootAtom = atomWithStorage(
  k("chordRoot"),
  "C",
  rawStringStorage(),
  GET_ON_INIT,
);

export const chordTypeAtom = atomWithStorage<string | null>(
  k("chordType"),
  null,
  chordTypeStorage,
  GET_ON_INIT,
);

export const linkChordRootAtom = atomWithStorage(
  k("linkChordRoot"),
  true,
  booleanStorage,
  GET_ON_INIT,
);

export const chordFretSpreadAtom = atomWithStorage(
  k("chordFretSpread"),
  0,
  chordFretSpreadStorage,
  GET_ON_INIT,
);

// ---------------------------------------------------------------------------
// Practice lens base atoms
// ---------------------------------------------------------------------------

// Primary user-facing practice state.
// Migrates from legacy viewMode value on first access (handled by practiceLensStorage).
export const practiceLensAtom = atomWithStorage<PracticeLens>(
  k("practiceLens"),
  "targets",
  practiceLensStorage,
  GET_ON_INIT,
);

// ---------------------------------------------------------------------------
// Overlay semantics — lens availability + derived flags
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Chord derived atoms
// ---------------------------------------------------------------------------

export const chordTonesAtom = atom((get) => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  return getChordNotes(chordRoot, chordType);
});

export const chordMembersAtom = atom((get) => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  if (!chordType) return [] as ResolvedChordMember[];
  const def = CHORD_DEFINITIONS[chordType];
  if (!def) return [] as ResolvedChordMember[];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (rootIndex === -1) return [] as ResolvedChordMember[];
  return def.members.map((m) => ({
    ...m,
    note: NOTES[(rootIndex + m.semitone) % 12],
  }));
});

export const hasOutsideChordMembersAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const chordTones = get(chordTonesAtom);
  if (!chordType || chordTones.length === 0) return false;
  const scaleNotes = get(scaleNotesAtom);
  const scaleNoteSet = new Set(scaleNotes);
  return chordTones.some((note) => !scaleNoteSet.has(note));
});

export const chordLabelAtom = atom((get) => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  const useFlats = get(useFlatsAtom);
  if (!chordType) return null;
  return `${formatAccidental(getNoteDisplay(chordRoot, chordRoot, useFlats))} ${chordType}`;
});

export const chordSummaryNotesAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const chordTones = get(chordTonesAtom);
  const chordRoot = get(chordRootAtom);
  if (!chordType || chordTones.length === 0) return [] as string[];
  const chordRootIdx = NOTES.indexOf(chordRoot);
  const chordToneSet = new Set(chordTones);
  return NOTES.slice(chordRootIdx)
    .concat(NOTES.slice(0, chordRootIdx))
    .filter((n) => chordToneSet.has(n));
});

// ---------------------------------------------------------------------------
// allChordMembersAtom — ChordRowEntry list with scale-membership and roles
// Used by practiceLensAtoms and atoms.ts summary atoms.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// chordMemberFactsAtom — pure chord facts, no scale context
//
// Reads only chordRootAtom and chordTypeAtom. Does NOT read scaleNotesAtom,
// rootNoteAtom, or scaleNameAtom. This is the scale-independent layer from
// which scale-aware atoms (allChordMembersAtom) are built.
// ---------------------------------------------------------------------------

export const chordMemberFactsAtom = atom((get): ChordMemberFact[] => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  const def = CHORD_DEFINITIONS[chordType];
  if (!def) return [];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (rootIndex === -1) return [];
  // displayNote uses chord-root-relative accidentals (FLAT_KEYS membership of
  // chordRoot), NOT the scale-derived useFlats — keeping this atom scale-free.
  return def.members.map((m): ChordMemberFact => {
    const note = NOTES[(rootIndex + m.semitone) % 12];
    return {
      internalNote: note,
      displayNote: formatAccidental(getNoteDisplay(note, chordRoot)),
      memberName: m.name === "root" ? "1" : formatAccidental(m.name),
      semitone: m.semitone,
      isChordRoot: m.name === "root",
    };
  });
});

export const allChordMembersAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [] as ChordRowEntry[];

  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const chordRoot = get(chordRootAtom);
  const useFlats = get(useFlatsAtom);
  const chordMembers = get(chordMembersAtom);
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));

  return chordMembers.map((m): ChordRowEntry => {
    const inScale = scaleNoteSet.has(m.note);
    const isRoot = m.name === "root";
    let role: ChordRowEntry["role"];
    if (isRoot) {
      role = "chord-root";
    } else if (inScale) {
      role = "chord-tone-in-scale";
    } else {
      role = "chord-tone-outside-scale";
    }
    return {
      internalNote: m.note,
      displayNote: formatAccidental(getNoteDisplay(m.note, chordRoot, useFlats)),
      memberName: m.name === "root" ? "1" : formatAccidental(m.name),
      role,
      inScale,
    };
  });
});