import { atom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import {
  NOTES,
  CHORD_DEFINITIONS,
  LENS_REGISTRY,
  getChordNotes,
  getScaleNotes,
  getNoteDisplay,
  formatAccidental,
  getDiatonicChord,
} from "../core/theory";
import type {
  ChordMemberFact,
  ResolvedChordMember,
  PracticeLens,
  ChordRowEntry,
} from "../core/theory";
import {
  getDegreesForScale,
  getQualityForDegree,
} from "../core/degrees";
import {
  k,
  createStorage,
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

/** Opaque type alias for Roman-numeral degree IDs like "I", "ii", "vii°". */
type DegreeId = string;


const chordFretSpreadStorage = constrainedNumberStorage({
  min: 0,
  max: 4,
  integer: true,
});

const PRACTICE_LENS_VALUES = LENS_REGISTRY.map((e) => e.id) as PracticeLens[];

function migrateViewModeToLens(viewMode: string): PracticeLens {
  switch (viewMode) {
    case "chord": return "targets";
    case "outside": return "tension";
    default: return "targets";
  }
}

const practiceLensStorage = createStorage<PracticeLens>({
  validate: (v) => (PRACTICE_LENS_VALUES as string[]).includes(v),
  migrate: () => {
    const oldViewMode = localStorage.getItem(k("viewMode")) || localStorage.getItem("viewMode");
    if (oldViewMode) {
      const migrated = migrateViewModeToLens(oldViewMode);
      // Optional: cleanup legacy keys could go here, but legacy behavior just returned migrated
      return migrated;
    }
    return undefined;
  },
});

// ---------------------------------------------------------------------------
// Backing atoms for degree-based chord overlay (Phase 02)
// ---------------------------------------------------------------------------

/**
 * Helper: read a raw localStorage string value without subscribing to atoms.
 * Used inside migrate() callbacks where atom subscriptions are not allowed.
 * Note: legacy atom values (chordRoot, chordType, rootNote, scaleName) are stored as
 * plain strings — not JSON-encoded — by rawStringStorage/chordTypeStorage serializers.
 */
function readLocalStorage(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    // Return empty string as null (chordTypeStorage serializes null → "")
    return raw === "" ? null : raw;
  } catch {
    return null;
  }
}

/** Diatonic triad quality names — the only types that can be inferred from degree. */
const DIATONIC_TRIAD_QUALITIES = new Set([
  "Major Triad",
  "Minor Triad",
  "Diminished Triad",
]);

const chordDegreeStorage = createStorage<DegreeId | null>({
  serialize: (v) => v ?? "",
  deserialize: (v) => (v === "" ? null : (v as DegreeId)),
  validate: (v) => v === null || typeof v === "string",
  migrate: (): DegreeId | null | undefined => {
    // NOTE: Seventh chords ("Major 7th", "Minor 7th", "Dominant 7th") and "Power Chord (5)"
    // are NOT in the DEGREE_DIATONIC_QUALITY table and always fall back to manual mode here.
    // This is intentional — not a bug. Diatonic inference is triad-only.
    const chordType = readLocalStorage(k("chordType"));

    // (a) Overlay was off — no migration needed; default null is correct.
    if (!chordType) return undefined;

    // (b) Only triads can be inferred diatonically.
    if (!DIATONIC_TRIAD_QUALITIES.has(chordType)) return undefined;

    // Read legacy state from localStorage (no atom subscriptions inside migrate).
    const chordRoot = readLocalStorage(k("chordRoot")) ?? "C";
    const tonicNote = readLocalStorage(k("rootNote")) ?? "C";
    const scaleName = readLocalStorage(k("scaleName")) ?? "Major";

    const tonicIdx = NOTES.indexOf(tonicNote);
    const rootIdx = NOTES.indexOf(chordRoot);
    if (tonicIdx === -1 || rootIdx === -1) return undefined;

    const semitone = (rootIdx - tonicIdx + 12) % 12;
    const degreesMap = getDegreesForScale(scaleName);
    const degreeId = degreesMap[semitone] as DegreeId | undefined;
    if (!degreeId) return undefined;

    // Validate: the diatonic quality must match the stored chord type exactly.
    const expectedQuality = getQualityForDegree(degreeId, scaleName);
    if (expectedQuality !== chordType) return undefined;

    return degreeId;
  },
});

/** The user's chosen scale degree for the chord overlay. null = overlay off. */
export const chordDegreeAtom = atomWithStorage<DegreeId | null>(
  k("chordDegree"),
  null,
  chordDegreeStorage,
  GET_ON_INIT,
);

const chordOverlayModeStorage = createStorage<"degree" | "manual">({
  validate: (v) => v === "degree" || v === "manual",
  migrate: (): "degree" | "manual" | undefined => {
    // NOTE: Seventh chords ("Major 7th", "Minor 7th", "Dominant 7th") and "Power Chord (5)"
    // are NOT in the DEGREE_DIATONIC_QUALITY table and always fall back to manual mode here.
    // This is intentional — not a bug. Diatonic inference is triad-only.
    const chordType = readLocalStorage(k("chordType"));

    // No legacy chord type stored → default degree mode.
    if (!chordType) return "degree";

    // Diatonic triads → degree mode.
    if (DIATONIC_TRIAD_QUALITIES.has(chordType)) return "degree";

    // Seventh chords, Power Chord, or any other non-diatonic type → manual mode.
    return "manual";
  },
});

/** Explicit user intent: "degree" = chord follows the active scale degree; "manual" = pinned. */
export const chordOverlayModeAtom = atomWithStorage<"degree" | "manual">(
  k("chordOverlayMode"),
  "degree",
  chordOverlayModeStorage,
  GET_ON_INIT,
);

/** Populated only when chordOverlayMode is 'manual'. Ignored in degree mode. */
export const chordRootOverrideAtom = atomWithStorage<string>(
  k("chordRootOverride"),
  "C",
  rawStringStorage(),
  GET_ON_INIT,
);

const chordQualityOverrideStorage = createStorage<string | null>({
  serialize: (v) => v ?? "",
  deserialize: (v) => (v === "" ? null : v),
  migrate: (): string | null | undefined => {
    const chordType = readLocalStorage(k("chordType"));
    // Preserve the chord type for manual-mode users.
    if (chordType) return chordType;
    return undefined;
  },
});

/** Populated only when chordOverlayMode is 'manual'. Ignored in degree mode. */
export const chordQualityOverrideAtom = atomWithStorage<string | null>(
  k("chordQualityOverride"),
  null,
  chordQualityOverrideStorage,
  GET_ON_INIT,
);

// ---------------------------------------------------------------------------
// Public writable derived atoms — chordRootAtom and chordTypeAtom
//
// Read path: composes the four backing atoms via getDiatonicChord.
// Write path: persists the value into override atoms and flips mode to "manual".
// RESET path: cascades RESET to all four backing atoms.
// ---------------------------------------------------------------------------

export const chordRootAtom = atom(
  (get): string => {
    const mode = get(chordOverlayModeAtom);
    if (mode === "manual") return get(chordRootOverrideAtom);
    const degree = get(chordDegreeAtom);
    if (!degree) return get(chordRootOverrideAtom); // overlay off: return last-known root
    const rootNote = get(rootNoteAtom);
    const scaleName = get(scaleNameAtom);
    const result = getDiatonicChord(degree, scaleName, rootNote);
    return result?.root ?? get(chordRootOverrideAtom);
  },
  (_get, set, value: string | typeof RESET) => {
    if (value === RESET) {
      set(chordDegreeAtom, RESET);
      set(chordOverlayModeAtom, RESET);
      set(chordRootOverrideAtom, RESET);
      set(chordQualityOverrideAtom, RESET);
      return;
    }
    set(chordRootOverrideAtom, value);
    set(chordOverlayModeAtom, "manual");
  },
);

export const chordTypeAtom = atom(
  (get): string | null => {
    const mode = get(chordOverlayModeAtom);
    if (mode === "manual") return get(chordQualityOverrideAtom);
    const degree = get(chordDegreeAtom);
    if (!degree) return null; // overlay off
    const rootNote = get(rootNoteAtom);
    const scaleName = get(scaleNameAtom);
    const result = getDiatonicChord(degree, scaleName, rootNote);
    return result?.quality ?? null;
  },
  (_get, set, value: string | null | typeof RESET) => {
    if (value === RESET) {
      set(chordDegreeAtom, RESET);
      set(chordOverlayModeAtom, RESET);
      set(chordRootOverrideAtom, RESET);
      set(chordQualityOverrideAtom, RESET);
      return;
    }
    set(chordQualityOverrideAtom, value);
    set(chordOverlayModeAtom, "manual");
  },
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

// Migrates from legacy viewMode value on first access.
export const practiceLensAtom = atomWithStorage<PracticeLens>(
  k("practiceLens"),
  "targets",
  practiceLensStorage,
  GET_ON_INIT,
);

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

/**
 * Scale-independent chord facts.
 * displayNote uses chord-root-relative accidentals, NOT scale-derived accidentals.
 */
export const chordMemberFactsAtom = atom((get): ChordMemberFact[] => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  const def = CHORD_DEFINITIONS[chordType];
  if (!def) return [];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (rootIndex === -1) return [];
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

/**
 * ChordRowEntry list with scale-membership and roles.
 * Used by practiceLensAtoms and atoms.ts summary atoms.
 */
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
