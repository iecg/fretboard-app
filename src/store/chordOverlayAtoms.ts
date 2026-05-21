import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { EMPTY_SET, setsEqual } from "./atomUtils";
import {
  NOTES,
  CHORD_DEFINITIONS,
  LENS_REGISTRY,
  getChordNotes,
  getNoteDisplay,
  formatAccidental,
  generateVoicings,
} from "@fretflow/core";
import type {
  ChordMemberFact,
  ResolvedChordMember,
  PracticeLens,
  VoicingType,
  VoicingInversion,
} from "@fretflow/core";
import {
  k,
  createStorage,
  rawStringStorage,
  booleanStorage,
  constrainedNumberStorage,
  GET_ON_INIT,
  withStorageErrorBoundary,
} from "../utils/storage";
import { useFlatsAtom } from "./scaleAtoms";
import { chordScopeToPositionAtom } from "./chordScope";
import { activeResolvedProgressionStepAtom } from "./progressionAtoms";
import {
  activeChordRootAtom,
  activeChordQualityAtom,
} from "./songStateAtoms";
import { currentTuningAtom } from "./layoutAtoms";
import { buildStringSetOptions, ALL_STRINGS } from "./voicingStringSets";
import { formatChordShortLabel } from "../progressions/progressionDomain";

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
    const oldViewMode =
      readLocalStorage(k("viewMode")) ?? readLocalStorage("viewMode");
    if (oldViewMode) return migrateViewModeToLens(oldViewMode);
    return undefined;
  },
});

/**
 * Helper: read a raw localStorage string value without subscribing to atoms.
 * Used inside migrate() callbacks where atom subscriptions are not allowed.
 */
function readLocalStorage(key: string): string | null {
  const raw = withStorageErrorBoundary<string | null>(key, null).getRaw();
  if (raw === null) return null;
  return raw === "" ? null : raw;
}

// ---------------------------------------------------------------------------
// Public read-only chord identity atoms.
//
// Phase 2.5: the "chord under edit" is always the active progression step.
// These atoms compose the unified `activeChord*` selectors so legacy
// consumers (voicing engine, lens availability, practice-bar) keep reading
// `chordRootAtom` / `chordTypeAtom` without knowing about the song-state
// layer. Writes go through `updateActiveChordAtom` in songStateAtoms.
// ---------------------------------------------------------------------------

/**
 * Resolved chord root for the active progression step. Falls back to "C" so
 * downstream NOTES-index lookups stay valid when no chord is active.
 */
export const chordRootAtom = atom((get): string => {
  return get(activeChordRootAtom) ?? "C";
});

/** Resolved chord quality for the active progression step. */
export const chordTypeAtom = atom((get): string | null => {
  return get(activeChordQualityAtom);
});

/**
 * True when the active chord source is a resolvable progression step.
 * Drives the Chord tab's cyan→orange accent switch.
 */
export const chordSourceIsProgressionAtom = atom((get) => {
  const activeStep = get(activeResolvedProgressionStepAtom);
  return !!activeStep && !activeStep.unavailable;
});

export const linkChordRootAtom = atomWithStorage(
  k("linkChordRoot"),
  true,
  booleanStorage,
  GET_ON_INIT,
);

export const chordOverlayHiddenAtom = atomWithStorage<boolean>(
  k("chordOverlayHidden"),
  false,
  booleanStorage,
  GET_ON_INIT,
);

// Transient per-note hides — keyed by chord identity so it auto-resets when chord changes.
const internalChordHiddenNotesAtom = atom<{
  chordRoot: string;
  chordType: string | null;
  notes: Set<string>;
} | null>(null);

export const chordHiddenNotesAtom = atom(
  (get) => {
    const state = get(internalChordHiddenNotesAtom);
    const chordRoot = get(chordRootAtom);
    const chordType = get(chordTypeAtom);
    if (state && state.chordRoot === chordRoot && state.chordType === chordType) {
      return state.notes;
    }
    return EMPTY_SET;
  },
  (get, set, update: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const chordRoot = get(chordRootAtom);
    const chordType = get(chordTypeAtom);
    const currentNotes = get(chordHiddenNotesAtom);
    const nextNotes =
      typeof update === "function" ? update(currentNotes) : update;
    if (setsEqual(currentNotes, nextNotes)) return;
    set(internalChordHiddenNotesAtom, { chordRoot, chordType, notes: nextNotes });
  },
);

export const toggleChordHiddenNoteAtom = atom(null, (_get, set, note: string) => {
  set(chordHiddenNotesAtom, (prev) => {
    const next = new Set(prev);
    if (next.has(note)) next.delete(note);
    else next.add(note);
    return next;
  });
});

// Mirrors toggleScaleVisibleAtom — collapsing clears per-note hides for a clean re-expand.
export const toggleChordOverlayHiddenAtom = atom(null, (get, set) => {
  const hidden = get(chordOverlayHiddenAtom);
  if (!hidden) {
    set(chordHiddenNotesAtom, new Set<string>());
    set(chordOverlayHiddenAtom, true);
  } else {
    set(chordOverlayHiddenAtom, false);
  }
});

export const chordFretSpreadAtom = atomWithStorage(
  k("chordFretSpread"),
  0,
  chordFretSpreadStorage,
  GET_ON_INIT,
);

/**
 * Discrete region selector that unifies the chord-overlay `scopeToPosition`
 * boolean and the `chordFretSpread` 0..4 stepper into a single 4-option
 * ToggleBar value:
 *
 *   - "all"      → scope=false (no positional constraint)
 *   - "position" → scope=true, spread=0 (strict position window)
 *   - "+2"       → scope=true, spread=2 (widen ±2 frets)
 *   - "+4"       → scope=true, spread=4 (widen ±4 frets)
 *
 * Reads bucket the underlying spread into the nearest discrete option so a
 * legacy persisted spread of 1 still surfaces as "+2".
 */
export type Region = "position" | "+2" | "+4" | "all";

export const regionAtom = atom(
  (get): Region => {
    if (!get(chordScopeToPositionAtom)) return "all";
    const sp = get(chordFretSpreadAtom);
    if (sp >= 3) return "+4";
    if (sp >= 1) return "+2";
    return "position";
  },
  (_get, set, next: Region) => {
    if (next === "all") {
      set(chordScopeToPositionAtom, false);
      return;
    }
    set(chordScopeToPositionAtom, true);
    set(
      chordFretSpreadAtom,
      next === "position" ? 0 : next === "+2" ? 2 : 4,
    );
  },
);

export const fullChordsEnabledAtom = atomWithStorage<boolean>(
  k("fullChordsEnabled"),
  false,
  booleanStorage,
  GET_ON_INIT,
);

const VOICING_INVERSIONS: VoicingInversion[] = ["root", "1st", "2nd", "3rd"];
const VOICING_TYPES: VoicingType[] = ["caged", "drop2", "triad"];

// Validated storage — a stale or corrupt localStorage entry that is not a
// member of the union falls back to the atom's default at read time.
const voicingTypeStorage = createStorage<VoicingType>({
  validate: (v) => (VOICING_TYPES as string[]).includes(v),
});
const voicingInversionStorage = createStorage<VoicingInversion>({
  validate: (v) => (VOICING_INVERSIONS as string[]).includes(v),
});

export const voicingTypeAtom = atomWithStorage<VoicingType>(
  k("voicingType"),
  "caged",
  voicingTypeStorage,
  GET_ON_INIT,
);

export const voicingInversionAtom = atomWithStorage<VoicingInversion>(
  k("voicingInversion"),
  "root",
  voicingInversionStorage,
  GET_ON_INIT,
);

/**
 * The selected string set, stored as a stable id ("all" or a string-number
 * window like "4·5·6"). The id encodes the exact strings, so it survives a
 * chord change when still valid; `effectiveStringSetAtom` resolves it and
 * falls back to "all" when it no longer exists for the active chord.
 */
export const voicingStringSetAtom = atomWithStorage<string>(
  k("voicingStringSet"),
  "all",
  rawStringStorage(),
  GET_ON_INIT,
);

/**
 * The ordered String Set options for the active chord. The option list
 * rebuilds whenever the chord's tone count changes.
 */
export const stringSetOptionsAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const def = chordType ? CHORD_DEFINITIONS[chordType] : undefined;
  return buildStringSetOptions(def ? def.members.length : 0);
});

/**
 * The stored string-set id resolved to its string-index array against the
 * active chord. When the id is not a current option (the chord changed),
 * this falls back to all six strings — the engine and picker both self-heal.
 */
export const effectiveStringSetAtom = atom((get): readonly number[] => {
  const options = get(stringSetOptionsAtom);
  const stored = get(voicingStringSetAtom);
  const match = options.find((o) => o.id === stored);
  return match ? match.strings : ALL_STRINGS;
});

/**
 * Whether the voicing connector lines render on the fretboard. Drives the
 * Chord tab's VOICING-header "Connectors" toggle. Default on so the voicing
 * engine's output is visible without an extra click.
 */
export const voicingConnectorsAtom = atomWithStorage<boolean>(
  k("voicingConnectors"),
  true,
  booleanStorage,
  GET_ON_INIT,
);

/** Inversions valid for the active chord — triads drop "3rd", dyads keep "root" only. */
export const availableInversionsAtom = atom((get): VoicingInversion[] => {
  const chordType = get(chordTypeAtom);
  const def = chordType ? CHORD_DEFINITIONS[chordType] : undefined;
  const count = def ? def.members.length : 4;
  // Dyads (e.g. power chords) expose only the root position.
  if (count <= 2) return VOICING_INVERSIONS.slice(0, 1);
  return VOICING_INVERSIONS.slice(0, Math.min(count, 4));
});

/** The renderer's voicing source. */
export const voicingMatchesAtom = atom((get) => {
  if (get(chordOverlayHiddenAtom)) return [];
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  const voicingType = get(voicingTypeAtom);
  const isCaged = voicingType === "caged";
  const available = get(availableInversionsAtom);
  const inversion = get(voicingInversionAtom);
  return generateVoicings({
    chordRoot: get(chordRootAtom),
    chordType,
    tuning: get(currentTuningAtom),
    maxFret: 24,
    voicingType,
    // A CAGED shape is a fixed root-position object — it has no meaningful
    // string subset or inversion, so caged ignores both controls.
    inversion: isCaged
      ? "root"
      : available.includes(inversion)
        ? inversion
        : "root",
    stringSet: isCaged ? ALL_STRINGS : get(effectiveStringSetAtom),
  });
});

// Back-compat alias: existing consumers read fullChordMatchesAtom; the voicing
// engine is now the source. Drop2/triad voicings have no CAGED `shape`.
export const fullChordMatchesAtom = atom((get) => get(voicingMatchesAtom));

export const fullChordPositionsAtom = atom((get) =>
  get(fullChordMatchesAtom).flatMap((match) => match.positionKeys),
);

// Migrates from legacy viewMode value on first access.
export const practiceLensAtom = atomWithStorage<PracticeLens>(
  k("practiceLens"),
  "targets",
  practiceLensStorage,
  GET_ON_INIT,
);

export const chordTonesAtom = atom((get) => {
  if (get(chordOverlayHiddenAtom)) return [];
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  const tones = getChordNotes(chordRoot, chordType);
  const hidden = get(chordHiddenNotesAtom);
  if (hidden.size === 0) return tones;
  return tones.filter((n) => !hidden.has(n));
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

export const chordLabelAtom = atom((get) => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  const useFlats = get(useFlatsAtom);
  if (!chordType) return null;
  return `${formatAccidental(getNoteDisplay(chordRoot, chordRoot, useFlats))} ${chordType}`;
});

/** Compact chord symbol (e.g. "Am", "Cmaj7", "G7") for tight readouts. */
export const chordShortLabelAtom = atom((get) => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  const useFlats = get(useFlatsAtom);
  if (!chordType) return null;
  const rootLabel = formatAccidental(getNoteDisplay(chordRoot, chordRoot, useFlats));
  return formatChordShortLabel(rootLabel, chordType);
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
