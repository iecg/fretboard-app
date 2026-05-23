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
  Voicing,
  VoicingType,
} from "@fretflow/core";
import {
  k,
  createStorage,
  booleanStorage,
  enumValidator,
  GET_ON_INIT,
  withStorageErrorBoundary,
} from "../utils/storage";
import {
  buildStringSetOptions,
  ALL_STRINGS_OPTION,
  type StringSetOption,
} from "./voicingStringSets";
import { preferFlatsAtom } from "./scaleAtoms";
import { activeResolvedProgressionStepAtom } from "./progressionAtoms";
import {
  activeChordRootAtom,
  activeChordQualityAtom,
} from "./songStateAtoms";
import { currentTuningAtom } from "./layoutAtoms";
import {
  cagedShapesAtom,
  fingeringPatternAtom,
  npsPositionAtom,
} from "./fingeringAtoms";
import { shapeDataAtom } from "./shapeAtoms";
import { formatChordShortLabel } from "../progressions/progressionDomain";

const SCALE_FIT_NUMERATOR = 2;
const SCALE_FIT_DENOMINATOR = 3;

/** A voicing "majority-fits" the scale window when at least
 * ceil(frettedCount × 2/3) of its fretted notes lie within [window.lo, window.hi].
 * Open strings are not bound by the window (playable at any hand position). */
function majorityFitsInWindow(
  positionKeys: readonly string[],
  window: { lo: number; hi: number },
): boolean {
  const fretted = positionKeys
    .map((k) => Number(k.split("-")[1] ?? 0))
    .filter((f) => f > 0);
  if (fretted.length === 0) return true;
  const threshold = Math.ceil(
    (fretted.length * SCALE_FIT_NUMERATOR) / SCALE_FIT_DENOMINATOR,
  );
  const inside = fretted.filter((f) => f >= window.lo && f <= window.hi).length;
  return inside >= threshold;
}

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

const voicingStringSetStorage = createStorage<string>({
  validate: (v): v is string => typeof v === "string",
});

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
 * The user's string-set selection for Close voicings. Stored as the option id
 * ("all" or "0-1-2-3" style). The active option list depends on the active
 * chord's voice count; if the stored id no longer matches any option,
 * {@link effectiveStringSetAtom} falls back to ALL.
 */
export const voicingStringSetAtom = atomWithStorage<string>(
  k("voicingStringSet"),
  "all",
  voicingStringSetStorage,
  GET_ON_INIT,
);

/**
 * All close voicings that pass the snap-to-scale filter but WITHOUT the
 * string-set filter applied. Used by {@link stringSetOptionsAtom} to probe
 * each string-set window for availability independently of the user's
 * current selection.
 */
export const closeCandidatesAllStringSetsAtom = atom((get): Voicing[] => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  const all = generateVoicings({
    chordRoot: get(chordRootAtom),
    chordType,
    tuning: get(currentTuningAtom),
    maxFret: 24,
    voicingType: "close",
  });

  if (get(chordSnapToScaleAtom)) {
    const window = get(activeScaleWindowAtom);
    if (window) {
      return all.filter((v) => majorityFitsInWindow(v.positionKeys, window));
    }
  }
  return all;
});

/**
 * Options the picker offers for the current chord: always "All" + every
 * consecutive-string window for the chord's voice count. When snap-to-scale
 * is on and a scale pattern is active, options with zero fitting voicings are
 * marked disabled.
 */
export const stringSetOptionsAtom = atom((get): readonly StringSetOption[] => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [ALL_STRINGS_OPTION];
  const def = CHORD_DEFINITIONS[chordType];
  const base = buildStringSetOptions(def?.members.length ?? 4);

  const snap = get(chordSnapToScaleAtom);
  if (!snap) return base;
  const patternKeys = get(activeScalePatternPositionsAtom);
  if (patternKeys.size === 0) return base;

  const allCandidates = get(closeCandidatesAllStringSetsAtom);

  return base.map((opt) => {
    if (opt.id === "all") return opt;
    const optStringSet = new Set(opt.strings);
    const hasCandidate = allCandidates.some((v) =>
      v.notes.every((n) => optStringSet.has(n.stringIndex)),
    );
    return hasCandidate
      ? opt
      : { ...opt, disabled: true, disabledReason: "No voicing in current scale window" };
  });
});

/**
 * The string indices the user's stored selection resolves to (falls back to
 * ALL when the stored id doesn't match any current option — e.g. after a
 * chord swap that changes voice count). If the picked option is disabled,
 * falls back to the first enabled option's strings (Plan I-T7).
 */
export const effectiveStringSetAtom = atom((get): readonly number[] => {
  const options = get(stringSetOptionsAtom);
  const stored = get(voicingStringSetAtom);
  const match = options.find((o) => o.id === stored);
  if (match && !match.disabled) return match.strings;
  // Fallback chain: first enabled option (if any), else ALL.
  const firstEnabled = options.find((o) => !o.disabled);
  return firstEnabled ? firstEnabled.strings : ALL_STRINGS_OPTION.strings;
});

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
    const match = matchesOfShape[0];
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
 * The set of `"string-fret"` position keys covered by the active scale
 * pattern. Returns the full position-key set for CAGED and 3NPS patterns
 * (sourced from `shapeDataAtom.highlightNotes`, which are already coord
 * strings). Returns an empty set for patterns that don't define a positional
 * window (none, one-string, two-strings), so the snap filter becomes a no-op.
 */
export const activeScalePatternPositionsAtom = atom<Set<string>>((get) => {
  const pattern = get(fingeringPatternAtom);
  if (pattern === "caged" || pattern === "3nps") {
    const { highlightNotes } = get(shapeDataAtom);
    // highlightNotes for caged/3nps are "string-fret" coordinate strings.
    // Filter to only coord-shaped entries (contain a dash) to guard against
    // the "none" fallback which stores bare note names.
    return new Set(highlightNotes.filter((n) => n.includes("-")));
  }
  // none, one-string, two-strings have no positional pattern to lock to.
  return new Set();
});

/**
 * All Close voicings that fit within the active scale-shape window (or all of
 * them when no shape is active or when {@link chordSnapToScaleAtom} is off).
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

  // Apply the fret-bound snap (if enabled and a scale window is active), then
  // the string-set filter. Either step is a no-op when its precondition is
  // unmet. Majority-fit semantics: at least ceil(frettedCount × 2/3) of the
  // voicing's fretted notes must fall within [window.lo, window.hi]. Open
  // strings are always allowed. This admits voicings where ONE note spills
  // slightly outside the shape, which players naturally handle. (Plan I-T6)
  let windowed = all;
  if (get(chordSnapToScaleAtom)) {
    const window = get(activeScaleWindowAtom);
    if (window) {
      windowed = all.filter((v) => majorityFitsInWindow(v.positionKeys, window));
    }
  }

  const stringSet = new Set(get(effectiveStringSetAtom));
  // Fast-path when "all 6 strings" is selected — every voicing satisfies the
  // membership test, so skip the per-note loop.
  if (stringSet.size === 6) return windowed;
  return windowed.filter((v) =>
    v.notes.every((n) => stringSet.has(n.stringIndex)),
  );
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
  const preferFlats = get(preferFlatsAtom);
  if (!chordType) return null;
  return `${formatAccidental(getNoteDisplay(chordRoot, chordRoot, preferFlats))} ${chordType}`;
});

/** Compact chord symbol (e.g. "Am", "Cmaj7", "G7") for tight readouts. */
export const chordShortLabelAtom = atom((get) => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  const preferFlats = get(preferFlatsAtom);
  if (!chordType) return null;
  const rootLabel = formatAccidental(getNoteDisplay(chordRoot, chordRoot, preferFlats));
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
