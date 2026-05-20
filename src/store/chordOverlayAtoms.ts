import { atom, type Getter } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import { EMPTY_SET, setsEqual } from "./atomUtils";
import {
  NOTES,
  CHORD_DEFINITIONS,
  LENS_REGISTRY,
  getChordNotes,
  getNoteDisplay,
  formatAccidental,
  getDiatonicChord,
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
  getDegreesForScale,
  getQualityForDegree,
  type DegreeId,
} from "@fretflow/core";
import {
  k,
  createStorage,
  rawStringStorage,
  booleanStorage,
  constrainedNumberStorage,
  GET_ON_INIT,
  stringValidator,
  withStorageErrorBoundary,
} from "../utils/storage";
import {
  useFlatsAtom,
  rootNoteAtom,
  scaleNameAtom,
} from "./scaleAtoms";
import {
  activeResolvedProgressionStepAtom,
  activeProgressionStepAtom,
  updateProgressionStepDegreeAtom,
  updateProgressionStepQualityAtom,
} from "./progressionAtoms";
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
  const raw = withStorageErrorBoundary<string | null>(key, null).getRaw();
  if (raw === null) return null;
  // Return empty string as null (chordTypeStorage serializes null → "")
  return raw === "" ? null : raw;
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
  validate: stringValidator({ nullable: true }),
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

const chordOverlayModeStorage = createStorage<ChordOverlayMode>({
  validate: (v) => v === "off" || v === "degree" || v === "manual",
  migrate: (): ChordOverlayMode | undefined => {
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

export type ChordOverlayMode = "off" | "degree" | "manual";

export const chordOverlayModeAtom = atomWithStorage<ChordOverlayMode>(
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

const progressionIsActiveChordSource = (get: Getter) => {
  const activeStep = get(activeResolvedProgressionStepAtom);
  return (
    !!activeStep &&
    !activeStep.unavailable
  );
};

export const effectiveChordDegreeAtom = atom((get): DegreeId | null => {
  if (!progressionIsActiveChordSource(get)) return get(chordDegreeAtom);
  return get(activeProgressionStepAtom)?.degree ?? null;
});

export const effectiveChordOverlayModeAtom = atom((get): ChordOverlayMode => {
  if (progressionIsActiveChordSource(get)) return "degree";
  return get(chordOverlayModeAtom);
});

export const effectiveChordQualityOverrideAtom = atom((get): string | null => {
  if (!progressionIsActiveChordSource(get)) return get(chordQualityOverrideAtom);
  return get(activeProgressionStepAtom)?.qualityOverride ?? null;
});

/**
 * True when the active chord source is a progression step (progression mode on,
 * a resolvable active step exists). Drives the Chord tab's cyan→orange accent switch.
 */
export const chordSourceIsProgressionAtom = atom((get) =>
  progressionIsActiveChordSource(get),
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
    if (progressionIsActiveChordSource(get)) {
      const progressionStep = get(activeResolvedProgressionStepAtom);
      if (progressionStep?.root) {
        return progressionStep.root;
      }
    }

    const mode = get(chordOverlayModeAtom);
    if (mode === "off" || mode === "manual") return get(chordRootOverrideAtom);
    const degree = get(chordDegreeAtom);
    if (!degree) return get(chordRootOverrideAtom); // no degree selected yet
    const rootNote = get(rootNoteAtom);
    const scaleName = get(scaleNameAtom);
    const result = getDiatonicChord(degree, scaleName, rootNote);
    return result?.root ?? get(chordRootOverrideAtom);
  },
  (get, set, value: string | typeof RESET) => {
    if (value === RESET) {
      set(chordDegreeAtom, RESET);
      set(chordOverlayModeAtom, RESET);
      set(chordRootOverrideAtom, RESET);
      set(chordQualityOverrideAtom, RESET);
      return;
    }
    if (progressionIsActiveChordSource(get)) {
      return;
    }
    set(chordRootOverrideAtom, value);
    set(chordOverlayModeAtom, "manual");
  },
);

export const chordTypeAtom = atom(
  (get): string | null => {
    if (progressionIsActiveChordSource(get)) {
      const progressionStep = get(activeResolvedProgressionStepAtom);
      return progressionStep?.quality ?? null;
    }

    const mode = get(chordOverlayModeAtom);
    if (mode === "off") return null;
    if (mode === "manual") return get(chordQualityOverrideAtom) ?? "Major Triad";
    const degree = get(chordDegreeAtom);
    if (!degree) return null; // no degree selected yet
    // Degree mode: prefer the user's quality override when set so the user can
    // pin a specific quality (e.g. Dominant 7th on V) while keeping the chord
    // root bound to the active scale degree. Without an override, fall back to
    // the diatonic default for this degree + scale.
    const override = get(chordQualityOverrideAtom);
    if (override) return override;
    const rootNote = get(rootNoteAtom);
    const scaleName = get(scaleNameAtom);
    const result = getDiatonicChord(degree, scaleName, rootNote);
    return result?.quality ?? null;
  },
  (get, set, value: string | null | typeof RESET) => {
    if (value === RESET) {
      if (progressionIsActiveChordSource(get)) {
        const step = get(activeProgressionStepAtom);
        if (step) {
          set(updateProgressionStepQualityAtom, {
            id: step.id,
            qualityOverride: null,
          });
        }
      }
      set(chordDegreeAtom, RESET);
      set(chordOverlayModeAtom, RESET);
      set(chordRootOverrideAtom, RESET);
      set(chordQualityOverrideAtom, RESET);
      return;
    }
    if (progressionIsActiveChordSource(get)) {
      const step = get(activeProgressionStepAtom);
      if (step) {
        set(updateProgressionStepQualityAtom, {
          id: step.id,
          qualityOverride: value,
        });
      }
      return;
    }
    set(chordQualityOverrideAtom, value);
    // In degree mode with a degree active, preserve the degree binding —
    // the override applies on top of the derived chord root. Manual mode
    // behavior is unchanged: a chord-type write flips the overlay to manual.
    if (get(chordOverlayModeAtom) === "degree" && get(chordDegreeAtom)) {
      return;
    }
    set(chordOverlayModeAtom, "manual");
  },
);

/**
 * Action atom for changing the active scale degree in degree mode. Always
 * clears any `chordQualityOverride` so each click on a degree button starts
 * at its diatonic default (e.g. picking V resolves to Major Triad even if a
 * Dominant 7th override was active, and re-clicking the same degree clears
 * the override too).
 */
export const setChordDegreeAtom = atom(
  null,
  (get, set, value: DegreeId | null) => {
    if (progressionIsActiveChordSource(get)) {
      const step = get(activeProgressionStepAtom);
      if (step) {
        set(updateProgressionStepDegreeAtom, {
          id: step.id,
          degree: value ?? step.degree,
        });
      }
      return;
    }
    set(chordDegreeAtom, value);
    set(chordQualityOverrideAtom, null);
  },
);

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
