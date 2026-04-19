import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  NOTES,
  CHORD_DEFINITIONS,
  getChordNotes,
  getScaleNotes,
  getNoteDisplay,
  getAvailableFocusPresets,
  applyFocusPreset,
  formatAccidental,
} from "../theory";
import type {
  ViewMode,
  FocusPreset,
  ChordMemberName,
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

const VIEW_MODE_VALUES: ViewMode[] = ["compare", "chord", "outside"];

const viewModeStorage = {
  getItem(key: string, initialValue: ViewMode): ViewMode {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, initialValue);
        return initialValue;
      }
      if ((VIEW_MODE_VALUES as string[]).includes(stored))
        return stored as ViewMode;
      localStorage.setItem(key, initialValue);
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: ViewMode): void {
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

const PRACTICE_LENS_VALUES: PracticeLens[] = [
  "targets",
  "guide-tones",
  "color",
  "targets-color",
  "tension",
];

function migrateViewModeToLens(viewMode: string): PracticeLens {
  switch (viewMode) {
    case "chord": return "targets";
    case "outside": return "tension";
    default: return "targets-color";
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

const FOCUS_PRESET_VALUES: FocusPreset[] = [
  "all",
  "triad",
  "shell",
  "guide-tones",
  "rootless",
  "custom",
];

const focusPresetStorage = {
  getItem(key: string, initialValue: FocusPreset): FocusPreset {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, initialValue);
        return initialValue;
      }
      if ((FOCUS_PRESET_VALUES as string[]).includes(stored))
        return stored as FocusPreset;
      localStorage.setItem(key, initialValue);
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: FocusPreset): void {
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

const customMembersStorage = {
  getItem(key: string, initialValue: ChordMemberName[]): ChordMemberName[] {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, JSON.stringify(initialValue));
        return initialValue;
      }
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed as ChordMemberName[];
        return initialValue;
      } catch {
        return initialValue;
      }
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: ChordMemberName[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
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

export const viewModeAtom = atomWithStorage<ViewMode>(
  k("viewMode"),
  "compare",
  viewModeStorage,
  GET_ON_INIT,
);

// Primary user-facing practice state — replaces viewMode as the UI concept.
// Stored separately; migrates from old viewMode on first access.
export const practiceLensAtom = atomWithStorage<PracticeLens>(
  k("practiceLens"),
  "targets-color",
  practiceLensStorage,
  GET_ON_INIT,
);

export const focusPresetAtom = atomWithStorage<FocusPreset>(
  k("focusPreset"),
  "all",
  focusPresetStorage,
  GET_ON_INIT,
);

export const customMembersAtom = atomWithStorage<ChordMemberName[]>(
  k("customMembers"),
  [],
  customMembersStorage,
  GET_ON_INIT,
);

// ---------------------------------------------------------------------------
// Overlay semantics — lens availability + derived flags
// ---------------------------------------------------------------------------

// Targets lens hides scale-only notes so only chord tones are shown.
export const hideNonChordNotesAtom = atom(
  (get) => get(practiceLensAtom) === "targets",
);

// ---------------------------------------------------------------------------
// Chord derived atoms
// ---------------------------------------------------------------------------

export const chordTonesAtom = atom((get) => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  return getChordNotes(chordRoot, chordType);
});

export const availableFocusPresetsAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return ["all", "custom"] as FocusPreset[];
  return getAvailableFocusPresets(chordType);
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

export const activeChordMembersAtom = atom((get) => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  const focusPreset = get(focusPresetAtom);
  const customMembers = get(customMembersAtom);
  const availablePresets = get(availableFocusPresetsAtom);

  if (!chordType) return [] as ResolvedChordMember[];
  const def = CHORD_DEFINITIONS[chordType];
  if (!def) return [] as ResolvedChordMember[];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (rootIndex === -1) return [] as ResolvedChordMember[];
  const effectivePreset = availablePresets.includes(focusPreset)
    ? focusPreset
    : "all";
  const members = applyFocusPreset(def, effectivePreset, customMembers);
  return members.map((m) => ({
    ...m,
    note: NOTES[(rootIndex + m.semitone) % 12],
  }));
});

export const activeChordTonesAtom = atom((get) =>
  get(activeChordMembersAtom).map((m) => m.note),
);

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

export const allChordMembersAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [] as ChordRowEntry[];

  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const chordRoot = get(chordRootAtom);
  const useFlats = get(useFlatsAtom);
  const activeChordMembers = get(activeChordMembersAtom);
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));

  return activeChordMembers.map((m): ChordRowEntry => {
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