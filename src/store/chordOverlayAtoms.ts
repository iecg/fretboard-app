import { atom, type Atom } from "jotai";
import { atomWithStorage, selectAtom } from "jotai/utils";
import { EMPTY_SET, setsEqual } from "./atomUtils";
import {
  NOTES,
  CHORD_DEFINITIONS,
  getChordNotes,
  getNoteDisplay,
  formatAccidental,
  generateVoicings,
} from "@fretflow/core";
import type {
  ChordMemberFact,
  ResolvedChordMember,
  ShapePolygon,
  Voicing,
  VoicingType,
} from "@fretflow/core";
import {
  k,
  createStorage,
  booleanStorage,
  enumValidator,
  GET_ON_INIT,
} from "../utils/storage";
import {
  buildStringSetOptions,
  type StringSetOption,
} from "./voicingStringSets";
import { preferFlatsAtom } from "./scaleAtoms";
import { activeResolvedProgressionStepAtom } from "./progressionAtoms";
import {
  activeChordRootAtom,
  activeChordQualityAtom,
} from "./songStateAtoms";
import { getCachedFretboardLayout } from "../core/fretboardLayoutCache";
import { currentTuningAtom } from "./layoutAtoms";
import {
  cagedShapesAtom,
  fingeringPatternAtom,
} from "./fingeringAtoms";
import { shapeDataAtom, autoCenterTargetAtom } from "./shapeAtoms";
import { activePositionAtom } from "./chordScope";
import {
  selectFullChordMatchesForCagedPosition,
  selectFullChordMatchesForThreeNpsPosition,
  selectCloseFallbacksForCagedPosition,
  selectCloseFallbacksForThreeNpsPosition,
} from "../hooks/voicingSelection";
import { formatChordShortLabel } from "../progressions/progressionDomain";
import { fallbackVoicingMatchesAtom } from "./voicingFallbackAtoms";
import { buildPolygonCoverage } from "../core/polygonCoverage";

export interface ShapeInstanceRange {
  minFret: number;
  maxFret: number;
}

export interface ChordLookup {
  chordRoot: string;
  chordType: string | null;
  chordTones: readonly string[];
  chordToneSet: ReadonlySet<string>;
  chordMembers: readonly ResolvedChordMember[];
  memberByNote: ReadonlyMap<string, ResolvedChordMember>;
}

/**
 * True when a single `"string-fret"` position key falls within any
 * non-truncated polygon's diagonal vertex bounds.
 */
export function isInAnyPolygon(
  positionKey: string,
  polygons: readonly ShapePolygon[],
): boolean {
  return buildPolygonCoverage(polygons, 24).coveredPositions.has(positionKey);
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

export const activeScaleInstanceRangesAtom = atom<ShapeInstanceRange[]>((get) => {
  const pattern = get(fingeringPatternAtom);
  const { shapePolygons, boxBounds } = get(shapeDataAtom);

  if (pattern === "caged" && shapePolygons.length > 0) {
    return shapePolygons.map((p) => ({
      minFret: p.intendedMin,
      maxFret: p.intendedMax,
    }));
  }
  if (pattern === "3nps" && boxBounds.length > 0) {
    return boxBounds.map((b) => ({
      minFret: b.minFret,
      maxFret: b.maxFret,
    }));
  }
  return [];
});

/**
 * All close voicings the chord generates — unscoped to position or string set.
 * Scoping happens at {@link visibleVoicingMatchesAtom} / {@link chordHighlightPositionsAtom} level.
 * Used by {@link stringSetOptionsAtom} to probe each string-set window for
 * availability independently of the user's current selection.
 */
export const closeCandidatesAllStringSetsAtom = atom((get): Voicing[] => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  return generateVoicings({
    chordRoot: get(chordRootAtom),
    chordType,
    tuning: get(currentTuningAtom),
    maxFret: 24,
    voicingType: "close",
  });
});

/**
 * Options the picker offers for the current chord: always "All" + every
 * consecutive-string window for the chord's voice count.
 *
 * Two disable layers compose:
 *   1. **Close-mode (position-scoped):** when a CAGED shape or 3NPS position
 *      is active, options with zero candidates fitting any active polygon/box
 *      are disabled.
 *   2. **Full-mode fallback:** if any active position needs a close-voicing
 *      fallback (see `fallbackPolygonsAtom`), options whose candidates can't
 *      fit any fallback-needing polygon are disabled. Prevents the user from
 *      picking a string set that yields zero connectors while the picker
 *      still claims it's a valid choice.
 */
export const stringSetOptionsAtom = atom((get): readonly StringSetOption[] => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  const def = CHORD_DEFINITIONS[chordType];
  const base = buildStringSetOptions(def?.members.length ?? 4);

  // Imports below are at the bottom of this file to break a top-of-file
  // circular import (voicingFallbackAtoms imports from this module). The
  // bindings are live at getter-evaluation time.
  const fallbackPolygons = get(fallbackPolygonsAtom);
  const fallback3Nps = get(fallback3NpsBoxBoundsAtom);
  const fallbackActive = fallbackPolygons.length > 0 || fallback3Nps !== null;

  const allCandidates = get(closeCandidatesAllStringSetsAtom);
  const { shapePolygons } = get(shapeDataAtom);
  const fingeringPattern = get(fingeringPatternAtom);
  const cagedShapes = get(cagedShapesAtom);
  const activePosition = get(activePositionAtom);
  const snapActive = activePosition && (fingeringPattern === "caged" || fingeringPattern === "3nps");

  if (!snapActive && !fallbackActive) return base;

  return base.map((opt) => {
    if (opt.id === "all") return opt;
    const optStringSet = new Set(opt.strings);
    const candidatesOnSet = allCandidates.filter((v) =>
      v.notes.every((n) => optStringSet.has(n.stringIndex)),
    );

    if (snapActive) {
      let fitsAnyScope: boolean;
      if (fingeringPattern === "caged") {
        const activePolygons = shapePolygons.filter(
          (p) => p.shape !== undefined && cagedShapes.has(p.shape) && !p.truncated,
        );
        fitsAnyScope = activePolygons.some(
          (polygon) => selectCloseFallbacksForCagedPosition(candidatesOnSet, polygon).length > 0,
        );
      } else {
        const { highlightNotes } = get(shapeDataAtom);
        const patternPositions = new Set(highlightNotes.filter((n) => n.includes("-")));
        fitsAnyScope = selectCloseFallbacksForThreeNpsPosition(candidatesOnSet, patternPositions).length > 0;
      }
      if (!fitsAnyScope) {
        return { ...opt, disabled: true, disabledReason: "No voicing in current position" };
      }
    }

    if (fallbackActive) {
      // At least one candidate must fit at least one fallback-needing position.
      let fits = false;
      if (fallback3Nps !== null) {
        fits = candidatesOnSet.some((v) =>
          v.notes.every((n) => {
            const b = fallback3Nps[n.stringIndex];
            return b !== undefined && n.fretIndex >= b.minFret && n.fretIndex <= b.maxFret;
          }),
        );
      } else {
        fits = candidatesOnSet.some((v) =>
          fallbackPolygons.some((polygon) =>
            v.notes.every((n) => {
              const leftFret = polygon.vertices[n.stringIndex]?.fret;
              const rightFret = polygon.vertices[polygon.vertices.length - 1 - n.stringIndex]?.fret;
              if (leftFret === undefined || rightFret === undefined) return false;
              const minFret = Math.min(leftFret, rightFret);
              const maxFret = Math.max(leftFret, rightFret);
              return n.fretIndex >= minFret && n.fretIndex <= maxFret;
            }),
          ),
        );
      }
      if (!fits) {
        return { ...opt, disabled: true, disabledReason: "No voicing fits this position" };
      }
    }

    return opt;
  });
});

const ALL_SIX_STRINGS: readonly number[] = [0, 1, 2, 3, 4, 5];

/**
 * The string indices the engine renders close-voicing candidates against.
 * Voicing-mode aware:
 *   - voicing === "full":  returns ALL_SIX_STRINGS unconditionally. Full mode
 *     uses the full board; the user's stored window is irrelevant.
 *   - voicing === "close": returns stored window's strings if it matches an
 *     enabled option; else first enabled option's strings (auto-heal);
 *     else stored window's strings unchanged (engine renders nothing, toggle
 *     bar honestly shows the dead-end).
 */
export const effectiveStringSetAtom = atom((get): readonly number[] => {
  if (get(voicingAtom) === "full") return ALL_SIX_STRINGS;
  const options = get(stringSetOptionsAtom);
  const stored = get(voicingStringSetAtom);
  const match = options.find((o) => o.id === stored);
  if (match && !match.disabled) return match.strings;
  const firstEnabled = options.find((o) => !o.disabled);
  if (firstEnabled) return firstEnabled.strings;
  // Dead-end: stored option may still exist (just disabled) — return its
  // strings so the toggle bar's selected button stays consistent. Engine
  // renders nothing because the stored window doesn't fit the position.
  if (match) return match.strings;
  // Final fallback: stored id matches nothing at all (e.g. after chord swap
  // shrunk voice count). Return empty so engine renders nothing.
  return [];
});

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
  }
  if (pattern === "caged" || pattern === "3nps") {
    const target = get(autoCenterTargetAtom);
    if (target) {
      return {
        lo: Math.max(0, target.minFret - FRET_WINDOW_BUFFER),
        hi: target.maxFret + FRET_WINDOW_BUFFER,
      };
    }
    const { highlightNotes } = get(shapeDataAtom);
    const positionKeys = highlightNotes.filter((n) => n.includes("-"));
    const fretted = positionKeys.map((k) => Number(k.split("-")[1])).filter((f) => f > 0);
    if (fretted.length === 0) return null;
    const lo = Math.max(0, Math.min(...fretted) - FRET_WINDOW_BUFFER);
    const hi = Math.max(...fretted) + FRET_WINDOW_BUFFER;
    return { lo, hi };
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
    return new Set(highlightNotes.filter((n) => n.includes("-")));
  }
  // none, one-string, two-strings have no positional pattern to lock to.
  return new Set();
});

/**
 * All close voicings for the active chord, filtered only by the user's selected
 * string-set window. The snap-to-scale / position-scoping filter has moved
 * upstream to {@link visibleVoicingMatchesAtom} and
 * {@link chordHighlightPositionsAtom}.
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
  const stringSet = new Set(get(effectiveStringSetAtom));
  if (stringSet.size === 6) return all;
  return all.filter((v) => v.notes.every((n) => stringSet.has(n.stringIndex)));
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

    return all;
  }
  // close: return every fitting candidate.
  return get(closeCandidatesAtom);
});

/**
 * The voicing matches actually shown on the board — filtered to the active
 * CAGED / 3NPS position via the same selectors the connector source uses.
 * When no active position exists (or in modes without a positional pattern),
 * falls back to the unfiltered matches from voicingMatchesAtom.
 *
 * This atom lets the highlight-position pipeline scope to the same voicings
 * the connector renders, instead of every voicing match across the whole
 * neck — eliminating the asymmetry where a connector polyline arcs through
 * a position whose chord-tone bubble was independently filtered out.
 */
// Module-scoped cache for visibleVoicingMatchesAtom. Two visible-voicing
// arrays are treated as value-equal when each entry has the same shape and
// the same ordered list of position-keys — enough for downstream consumers
// (connector renderer, chord-tone highlight set) to short-circuit when an
// upstream invalidation produces no observable change.
let cachedVisibleVoicings: Voicing[] = [];
let cachedVisibleVoicingsKey = "<uninitialized>";

function memoizeVoicings(next: readonly Voicing[]): Voicing[] {
  const fingerprint = next
    .map((voicing) => `${voicing.shape ?? "none"}:${voicing.positionKeys.join(",")}`)
    .join("|");

  if (fingerprint === cachedVisibleVoicingsKey) {
    return cachedVisibleVoicings;
  }

  cachedVisibleVoicingsKey = fingerprint;
  cachedVisibleVoicings = [...next];
  return cachedVisibleVoicings;
}

export const visibleVoicingMatchesAtom = atom((get): Voicing[] => {
  const matches = get(voicingMatchesAtom);
  const fallbacks = get(fallbackVoicingMatchesAtom);
  if (matches.length === 0 && fallbacks.length === 0) return memoizeVoicings(matches);

  const pattern = get(fingeringPatternAtom);
  const activePosition = get(activePositionAtom);

  const voicing = get(voicingAtom);
  let scoped: Voicing[];
  if (pattern === "caged" && activePosition) {
    const { shapePolygons } = get(shapeDataAtom);
    const cagedShapes = get(cagedShapesAtom);
    if (voicing === "full") {
      scoped = selectFullChordMatchesForCagedPosition(matches, shapePolygons, cagedShapes);
    } else {
      // close: strict in-polygon fit. Dedupe across polygon instances —
      // a single voicing may fit multiple octave instances of the same shape;
      // emitting it once per polygon would create phantom conflicts in
      // assignConflictOffsets and assign non-zero offsets to non-overlapping voicings.
      // Truncated polygons (e.g. the open D-shape clipped at the nut) are
      // valid hosts — selectCloseFallbacksForCagedPosition only accepts
      // voicings whose notes fit per-string vertex bounds, so the visible
      // portion of a truncated polygon can still host an open-position
      // close voicing (e.g. open C on strings 0-1-2 inside the open D-shape).
      const activePolygons = shapePolygons.filter(
        (p) => p.shape !== undefined && cagedShapes.has(p.shape),
      );
      const seen = new Set<string>();
      scoped = activePolygons
        .flatMap((polygon) => selectCloseFallbacksForCagedPosition(matches, polygon))
        .filter((v) => {
          const key = v.positionKeys.slice().sort().join("|");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }
  } else if (pattern === "3nps" && activePosition) {
    const { highlightNotes } = get(shapeDataAtom);
    const patternPositions = new Set(highlightNotes.filter((n) => n.includes("-")));
    if (voicing === "full") {
      scoped = selectFullChordMatchesForThreeNpsPosition(matches, patternPositions, 0);
    } else {
      scoped = selectCloseFallbacksForThreeNpsPosition(matches, patternPositions);
    }
  } else {
    scoped = matches;
  }

  return memoizeVoicings(fallbacks.length > 0 ? [...scoped, ...fallbacks] : scoped);
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
// Module-scoped cache: holds the last computed Set + a fingerprint of its
// position-key content. Returning the cached reference (instead of a fresh
// Set each evaluation) lets React Compiler's auto-memoization actually
// short-circuit downstream consumers (FretboardSVG, useChordConnectorPolylines,
// useNoteData) when the chord highlight set is value-equal across Jotai
// re-evaluations triggered by upstream dep churn.
let cachedHighlightSet: Set<string> = new Set();
let cachedHighlightKey = "<uninitialized>";

function memoizedHighlightSet(positionKeys: Iterable<string>): Set<string> {
  const sorted = [...new Set(positionKeys)].sort();
  const fingerprint = sorted.join("|");
  if (fingerprint === cachedHighlightKey) {
    return cachedHighlightSet;
  }
  cachedHighlightKey = fingerprint;
  cachedHighlightSet = new Set(sorted);
  return cachedHighlightSet;
}

export const chordHighlightPositionsAtom = atom((get): Set<string> => {
  const voicing = get(voicingAtom);
  if (get(chordOverlayHiddenAtom)) return memoizedHighlightSet([]);

  if (voicing === "full") {
    // Derive position keys from the *visible* voicings only — this matches
    // the selection the connector renderer uses (filtered to the active
    // CAGED/3NPS position via visibleVoicingMatchesAtom). Always supplement
    // with addChordTonesWithinPolygon so in-polygon chord tones light up
    // for every position the active pattern covers. The per-position polygon
    // filter is gone — visibleVoicingMatchesAtom's voicing-level selection
    // already keeps neck-spanning voicings from leaking in, and
    // connector-vertex positions outside the polygon now survive (matching
    // what the connector polyline draws through).
    const visibleMatches = get(visibleVoicingMatchesAtom);
    const result = new Set(visibleMatches.flatMap((v) => v.positionKeys));
    const { shapePolygons } = get(shapeDataAtom);
    if (shapePolygons.length > 0) {
      addChordTonesWithinPolygon(get, result, shapePolygons);
    }
    return memoizedHighlightSet(result);
  }

  if (voicing === "close") {
    // Mirror the full branch: derive from visible (position-scoped) voicings
    // so chord-tone highlights stay confined to the active CAGED/3NPS window.
    const visibleMatches = get(visibleVoicingMatchesAtom);
    const result = new Set(visibleMatches.flatMap((v) => v.positionKeys));
    const { shapePolygons } = get(shapeDataAtom);
    if (shapePolygons.length > 0) {
      addChordTonesWithinPolygon(get, result, shapePolygons);
    }
    return memoizedHighlightSet(result);
  }

  // voicing === "off": always highlight chord tones restricted to the pattern when one is active
  if (voicing === "off") {
    const { shapePolygons } = get(shapeDataAtom);
    if (shapePolygons.length > 0) {
      const result = new Set<string>();
      addChordTonesWithinPolygon(get, result, shapePolygons);
      return memoizedHighlightSet(result);
    }
  }

  return memoizedHighlightSet([]);
});

/** Fill `result` with every fretboard position whose note is a chord tone
 *  and lies within at least one scale-pattern polygon. */
function addChordTonesWithinPolygon(
  get: <T>(a: Atom<T>) => T,
  result: Set<string>,
  shapePolygons: readonly ShapePolygon[],
): void {
  const tones = get(chordTonesAtom);
  if (tones.length === 0) return;
  const tuning = get(currentTuningAtom);
  const layout = getCachedFretboardLayout(tuning, 24);
  const polygonCoverage = buildPolygonCoverage(shapePolygons, 24);
  for (let s = 0; s < tuning.length; s++) {
    for (let f = 0; f <= 24; f++) {
      if (tones.includes(layout[s][f])) {
        const key = `${s}-${f}`;
        if (polygonCoverage.coveredPositions.has(key)) {
          result.add(key);
        }
      }
    }
  }
}

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

const rawChordMembersAtom = atom((get) => {
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

const chordLookupCache = new Map<string, ChordLookup>();

export const chordLookupAtom = atom((get): ChordLookup => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  const chordTones = get(chordTonesAtom);
  const chordMembers = get(rawChordMembersAtom);
  const key = `${chordRoot}|${chordType ?? "none"}|${chordTones.join(",")}`;

  const cached = chordLookupCache.get(key);
  if (cached) return cached;

  const next: ChordLookup = {
    chordRoot,
    chordType,
    chordTones,
    chordToneSet: new Set(chordTones),
    chordMembers,
    memberByNote: new Map(chordMembers.map((member) => [member.note, member])),
  };
  chordLookupCache.set(key, next);
  return next;
});

export const chordMembersAtom = atom((get) => get(chordLookupAtom).chordMembers);

/** Stable slice: chord root letter alone. Re-emits only when the root changes. */
export const chordLookupRootAtom = selectAtom(
  chordLookupAtom,
  (lookup) => lookup.chordRoot,
);

/** Stable slice: chord quality/type alone. Re-emits only when the type changes. */
export const chordLookupTypeAtom = selectAtom(
  chordLookupAtom,
  (lookup) => lookup.chordType,
);

/** Compact chord symbol (e.g. "Am", "Cmaj7", "G7") for tight readouts. */
export const chordShortLabelAtom = atom((get) => {
  const chordRoot = get(chordLookupRootAtom);
  const chordType = get(chordLookupTypeAtom);
  const preferFlats = get(preferFlatsAtom);
  if (!chordType) return null;
  const rootLabel = formatAccidental(getNoteDisplay(chordRoot, chordRoot, preferFlats));
  return formatChordShortLabel(rootLabel, chordType);
});
/**
 * Scale-independent chord facts.
 * displayNote uses chord-root-relative accidentals, NOT scale-derived accidentals.
 */
export const chordMemberFactsAtom = atom((get): ChordMemberFact[] => {
  const { chordRoot, chordType, chordMembers } = get(chordLookupAtom);
  if (!chordType) return [];
  return chordMembers.map((member): ChordMemberFact => ({
    internalNote: member.note,
    displayNote: formatAccidental(getNoteDisplay(member.note, chordRoot)),
    memberName: member.name === "root" ? "R" : formatAccidental(member.name),
    semitone: member.semitone,
    isChordRoot: member.name === "root",
  }));
});

// Circular-import-safe re-imports — see comment in `stringSetOptionsAtom`.
// Placed at file bottom so chordOverlayAtoms's exports are fully bound before
// voicingFallbackAtoms re-enters this module. Atoms read these only inside
// getter bodies, so the bindings are live by the time they're dereferenced.

import {
  fallbackPolygonsAtom,
  fallback3NpsBoxBoundsAtom,
} from "./voicingFallbackAtoms";
