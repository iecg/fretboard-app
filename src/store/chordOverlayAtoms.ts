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
  filterByHandSpan,
} from "@fretflow/core";
import type {
  ChordMemberFact,
  ResolvedChordMember,
  PracticeLens,
  Voicing,
  VoicingType,
} from "@fretflow/core";
import {
  k,
  createStorage,
  booleanStorage,
  constrainedNumberStorage,
  enumValidator,
  GET_ON_INIT,
  withStorageErrorBoundary,
} from "../utils/storage";
import { useFlatsAtom } from "./scaleAtoms";
import { activeResolvedProgressionStepAtom } from "./progressionAtoms";
import {
  activeChordRootAtom,
  activeChordQualityAtom,
} from "./songStateAtoms";
import { currentTuningAtom } from "./layoutAtoms";
import { handSizeAtom } from "./settingsAtoms";
import {
  cagedShapesAtom,
  cagedOctaveAtom,
  fingeringPatternAtom,
  npsPositionAtom,
} from "./fingeringAtoms";
import { formatChordShortLabel } from "../progressions/progressionDomain";

const PRACTICE_LENS_VALUES = LENS_REGISTRY.map((e) => e.id) as PracticeLens[];

// Map legacy three-lens IDs to the new two-lens IDs (Task 4.1).
// Returns a raw string — narrowing to PracticeLens happens at the validate
// boundary in onRead. Unknown inputs pass through unchanged so validate()
// can reject them and fall back to the atom default.
function mapLegacyLensId(raw: string): string {
  if (raw === "targets" || raw === "guide-tones") return "tones";
  if (raw === "tension") return "lead";
  return raw;
}

const practiceLensStorage = createStorage<PracticeLens>({
  onRead: (v) => mapLegacyLensId(v as string) as PracticeLens,
  validate: (v) => (PRACTICE_LENS_VALUES as string[]).includes(v),
  migrate: () => {
    // migrate() only runs when the storage key is absent (see
    // createStorage.getItem in src/utils/storage.ts). When the lens key
    // exists with a legacy value, onRead() handles the mapping instead, so
    // there's no point checking `k("practiceLens")` here.
    // Legacy: viewMode predates the lens key entirely.
    const oldViewMode =
      readLocalStorage(k("viewMode")) ?? readLocalStorage("viewMode");
    if (oldViewMode === "chord") return "tones";
    if (oldViewMode === "outside") return "lead";
    if (oldViewMode) return "tones";
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

export const fullChordsEnabledAtom = atomWithStorage<boolean>(
  k("fullChordsEnabled"),
  false,
  booleanStorage,
  GET_ON_INIT,
);

const VOICING_VALUES = ["off", "full", "close"] as const satisfies readonly VoicingType[];

const voicingValueStorage = createStorage<VoicingType>({
  validate: enumValidator(VOICING_VALUES),
});

const closePositionIndexStorage = constrainedNumberStorage({ integer: true });

/**
 * The single Voicing control. Off = no connector polygons. Full = CAGED full-
 * chord polygon at the active scale shape's position (or all 5 positions when
 * no scale shape is active). Close = compact 3–5-string polygon at the active
 * cycle index inside the scale-shape window (or anywhere on the neck when no
 * scale shape).
 */
export const voicingAtom = atomWithStorage<VoicingType>(
  k("voicing"),
  "full",
  voicingValueStorage,
  GET_ON_INIT,
);

/**
 * Cycle pointer for Close voicings.
 *
 * @deprecated The Close voicing picker no longer uses a numeric cycle index.
 * Retained for one more commit until Task F5z overwrites the slot with the
 * string-set selection atom; no live consumers remain.
 */
export const closePositionIndexAtom = atomWithStorage<number>(
  k("closePositionIndex"),
  0,
  closePositionIndexStorage,
  GET_ON_INIT,
);

/**
 * Toggle for "snap close voicings to the active scale window". When true
 * (default), `closeCandidatesAtom` is filtered to candidates that fit inside
 * `activeScaleWindowAtom`. When false, the filter is bypassed and every
 * hand-span-fitting candidate is offered regardless of scale position.
 */
export const chordSnapToScaleAtom = atomWithStorage<boolean>(
  k("chordSnapToScale"),
  true,
  booleanStorage,
  GET_ON_INIT,
);

const FRET_WINDOW_BUFFER = 1;

/**
 * All Full (CAGED) voicings for the active chord. Internal — used by both the
 * `voicingMatchesAtom` 'full' branch and `activeScaleWindowAtom`'s CAGED
 * window derivation. Centralises the engine call so a chord change recomputes
 * once per store, not once per consumer.
 */
const fullVoicingsAtom = atom((get): Voicing[] => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  return generateVoicings({
    chordRoot: get(chordRootAtom),
    chordType,
    tuning: get(currentTuningAtom),
    maxFret: 24,
    voicingType: "full",
  });
});

/**
 * Returns the fret window of the active scale shape, or null when no single
 * shape is active. For CAGED, derive from the matched full-chord polygon (no
 * standalone window table exists in @fretflow/core); for 3NPS, use the
 * stored position. Buffer ±1 fret either side.
 */
export const activeScaleWindowAtom = atom((get): { lo: number; hi: number } | null => {
  const pattern = get(fingeringPatternAtom);
  if (pattern === "caged") {
    const shapes = get(cagedShapesAtom);
    if (shapes.size !== 1) return null;
    const shape = [...shapes][0];
    const fullMatches = get(fullVoicingsAtom);
    const matchesOfShape = fullMatches.filter((v) => v.shape === shape);
    const octave = get(cagedOctaveAtom);
    const match = matchesOfShape[octave] ?? matchesOfShape[0];
    if (!match) return null;
    const fretted = match.notes.map((n) => n.fretIndex).filter((f) => f > 0);
    if (fretted.length === 0) return null;
    const lo = Math.max(0, Math.min(...fretted) - FRET_WINDOW_BUFFER);
    const hi = Math.max(...fretted) + FRET_WINDOW_BUFFER;
    return { lo, hi };
  }
  if (pattern === "3nps") {
    const pos = get(npsPositionAtom);
    if (pos <= 0) return null;
    return { lo: Math.max(0, pos - FRET_WINDOW_BUFFER), hi: pos + 2 + FRET_WINDOW_BUFFER };
  }
  return null;
});

/**
 * All Close voicings that fit within the active scale-shape window (or all of
 * them when no shape is active or when {@link chordSnapToScaleAtom} is off)
 * AND pass the hand-span filter.
 */
export const closeCandidatesAtom = atom((get): Voicing[] => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  const all = generateVoicings({
    chordRoot: get(chordRootAtom),
    chordType,
    tuning: get(currentTuningAtom),
    maxFret: 24,
    voicingType: "close",
  });
  const handFiltered = filterByHandSpan(all, get(handSizeAtom));

  // User has opted out of scale-window snapping — return every hand-fitting
  // candidate regardless of scale shape.
  if (!get(chordSnapToScaleAtom)) return handFiltered;

  const scaleWindow = get(activeScaleWindowAtom);
  if (!scaleWindow) return handFiltered;
  return handFiltered.filter((v) => {
    const fretted = v.notes.map((n) => n.fretIndex).filter((f) => f > 0);
    if (fretted.length === 0) return true;
    const min = Math.min(...fretted);
    const max = Math.max(...fretted);
    return min >= scaleWindow.lo && max <= scaleWindow.hi;
  });
});

/**
 * The renderer's voicing source. For Full, returns CAGED matches (optionally
 * narrowed to the active CAGED shape). For Close, returns ALL fitting
 * candidates — the renderer paints every polyline uniformly.
 */
export const voicingMatchesAtom = atom((get): Voicing[] => {
  const voicing = get(voicingAtom);
  if (voicing === "off") return [];
  if (get(chordOverlayHiddenAtom)) return [];
  if (voicing === "full") {
    const all = get(fullVoicingsAtom);
    if (all.length === 0) return [];
    const pattern = get(fingeringPatternAtom);
    if (pattern === "caged") {
      const shapes = get(cagedShapesAtom);
      if (shapes.size === 1) {
        const shape = [...shapes][0];
        return all.filter((v) => v.shape === shape);
      }
    }
    return all;
  }
  // close: return every fitting candidate.
  return get(closeCandidatesAtom);
});

/**
 * The set of fretboard positions that should render the "chord tone"
 * emphasis. Decoupled from {@link voicingMatchesAtom} so that the Close
 * voicing picker can change selection (which updates the connector polyline
 * only) without disturbing which notes are highlighted on the neck.
 *
 * For Full: union of every matched full-chord polygon's positions.
 * For Close: union of every fitting candidate's positions (so users see all
 * the available voicing options highlighted in the active window).
 */
export const chordHighlightPositionsAtom = atom((get): Set<string> => {
  const voicing = get(voicingAtom);
  if (voicing === "off") return new Set<string>();
  if (get(chordOverlayHiddenAtom)) return new Set<string>();
  if (voicing === "full") {
    return new Set(get(voicingMatchesAtom).flatMap((v) => v.positionKeys));
  }
  // close: snap-to-scale toggle is already applied inside closeCandidatesAtom.
  return new Set(get(closeCandidatesAtom).flatMap((v) => v.positionKeys));
});

// Migrates from legacy viewMode value on first access.
export const practiceLensAtom = atomWithStorage<PracticeLens>(
  k("practiceLens"),
  "tones",
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
