import { atom } from "jotai";
import {
  NOTES,
  ENHARMONICS,
  INTERVAL_NAMES,
  CHORD_DEFINITIONS,
  getNoteDisplay,
  formatAccidental,
  getDiatonicChord,
  getChordNotes,
} from "@fretflow/core";
import type {
  ChordMemberName,
  NoteSemantics,
  PracticeCue,
  PracticeCueNote,
  ChordRowEntry,
} from "@fretflow/core";
import { type DegreeId } from "@fretflow/core";
import {
  scaleContextAtom,
  colorNotesAtom,
  preferFlatsAtom,
} from "./scaleAtoms";
import {
  chordLookupAtom,
  chordOverlayHiddenAtom,
  chordHiddenNotesAtom,
  fullChordsEnabledAtom,
} from "./chordOverlayAtoms";
import { activeChordCachedDegreeAtom } from "./songStateAtoms";
import {
  resolvedProgressionStepsAtom,
  displayedProgressionStepIndexAtom,
  activeResolvedProgressionStepAtom,
  progressionTempoBpmAtom,
  progressionStepDeadlineAtom,
  beatsPerBarAtom,
  progressionLoopEnabledAtom,
  progressionPlayingAtom,
} from "./progressionAtoms";
import { progressionVisualFrameAtom } from "./progressionVisualAtoms";
import {
  getProgressionDurationBeats,
  MIN_PROGRESSION_TEMPO_BPM,
} from "../progressions/progressionDomain";
import {
  allChordMembersAtom,
} from "./composableSelectors";

/**
 * Field-wise equality for two NoteSemantics objects. The atom rebuilds the
 * Map (and every entry) from scratch on each evaluation, so reference-only
 * equality would never hit the cache. All NoteSemantics fields are
 * primitives → a flat field walk is enough.
 */
function noteSemanticsEqual(a: NoteSemantics, b: NoteSemantics): boolean {
  return (
    a.isScaleRoot === b.isScaleRoot &&
    a.isChordRoot === b.isChordRoot &&
    a.isChordTone === b.isChordTone &&
    a.isInScale === b.isInScale &&
    a.isColorTone === b.isColorTone &&
    a.isGuideTone === b.isGuideTone &&
    a.isTension === b.isTension &&
    a.memberName === b.memberName &&
    a.scaleDegree === b.scaleDegree &&
    a.isDiatonicChord === b.isDiatonicChord &&
    a.isFullChordMode === b.isFullChordMode
  );
}

/**
 * Module-scoped cache for {@link noteSemanticMapAtom}. Returning the same
 * Map reference when the recomputed semantics are value-equal lets React
 * Compiler's downstream auto-memos short-circuit (FretboardSVG, lens
 * predicates), eliminating render churn on no-op upstream writes.
 */
let cachedNoteSemanticMap = new Map<string, NoteSemantics>();

function memoizeNoteSemanticMap(next: Map<string, NoteSemantics>): Map<string, NoteSemantics> {
  if (cachedNoteSemanticMap === next) return cachedNoteSemanticMap;
  if (cachedNoteSemanticMap.size === next.size) {
    let equal = true;
    for (const [key, value] of next) {
      const prev = cachedNoteSemanticMap.get(key);
      if (prev === undefined || !noteSemanticsEqual(prev, value)) {
        equal = false;
        break;
      }
    }
    if (equal) return cachedNoteSemanticMap;
  }
  cachedNoteSemanticMap = next;
  return next;
}

/**
 * True when the playhead is inside the final beat of the active step — the
 * window in which the next chord's guide tones are previewed (anticipation).
 * Pure so it can be unit-tested without atom plumbing.
 */
export function isInAnticipationWindow(
  localFraction: number,
  stepDurationBeats: number,
): boolean {
  if (stepDurationBeats <= 0) return false;
  return localFraction >= (stepDurationBeats - 1) / stepDurationBeats;
}

/** Proportion of the step the lead-in ramp occupies (the final half). */
const LEAD_IN_PROPORTION = 0.5;
/** Minimum readable lead-in duration, so fast tempi still show the preview. */
const LEAD_IN_FLOOR_MS = 600;

/**
 * Length of the lead-in preview window for a step of `stepDurationMs`.
 * Proportional (the final {@link LEAD_IN_PROPORTION} of the step) but clamped
 * up to {@link LEAD_IN_FLOOR_MS} and never longer than the step itself.
 * Pure so it can be unit-tested without atom plumbing.
 */
export function computeLeadInWindowMs(stepDurationMs: number): number {
  if (stepDurationMs <= 0) return 0;
  const proportional = stepDurationMs * LEAD_IN_PROPORTION;
  return Math.min(stepDurationMs, Math.max(proportional, LEAD_IN_FLOOR_MS));
}

/**
 * True when the playhead is inside the lead-in window. `localFraction` is the
 * [0,1] fraction of the step elapsed (same source as the anticipation check).
 */
export function isInLeadInWindow(
  localFraction: number,
  stepDurationMs: number,
): boolean {
  const windowMs = computeLeadInWindowMs(stepDurationMs);
  if (windowMs <= 0) return false;
  const startFraction = 1 - windowMs / stepDurationMs;
  return localFraction >= startFraction;
}

// Guide tone members: 3rd and 7th
const GUIDE_TONE_RAW = new Set(["b3", "3", "b7", "7"]);

/**
 * Finds nearest in-scale resolution (≤2 semitones, step-up preferred).
 * Logic shared between practiceCuesAtom and practiceBarLandOnGroupBaseAtom.
 */
function findNearestScaleResolution(
  note: string,
  scaleNotes: readonly string[],
  displayNote: (n: string) => string,
): { internalNote: string; displayNote: string } | undefined {
  const noteIdx = NOTES.indexOf(note);
  if (noteIdx === -1) return undefined;
  const scaleNoteSet = new Set(scaleNotes);
  for (let step = 1; step <= 2; step++) {
    const up = NOTES[(noteIdx + step) % 12];
    const down = NOTES[(noteIdx - step + 12) % 12];
    if (scaleNoteSet.has(up)) return { internalNote: up, displayNote: displayNote(up) };
    if (scaleNoteSet.has(down)) return { internalNote: down, displayNote: displayNote(down) };
  }
  return undefined;
}

const getDisplayLabel = (e: ChordRowEntry): string =>
  e.scaleInterval ?? e.memberName;

function toCueNote(e: ChordRowEntry): PracticeCueNote {
  return {
    internalNote: e.internalNote,
    displayNote: e.displayNote,
    intervalName: getDisplayLabel(e),
    role: e.role,
  };
}

function buildLandOnCue(allChordMembers: ChordRowEntry[]): PracticeCue {
  return {
    kind: "land-on",
    label: "Land on",
    notes: allChordMembers.map(toCueNote),
  };
}

const cueBaseInputsAtom = atom((get) => {
  const { chordType, chordRoot } = get(chordLookupAtom);
  if (!chordType) return null;
  const { scaleNotes } = get(scaleContextAtom);
  return {
    chordType,
    chordRoot,
    preferFlats: get(preferFlatsAtom),
    allChordMembers: get(allChordMembersAtom),
    scaleNotes,
  };
});


/** Gathers chord-specific inputs. Returns null when there is no active chord or the overlay is hidden. */
const chordSemanticInputsAtom = atom((get) => {
  const chordLookup = get(chordLookupAtom);
  const { chordType } = chordLookup;
  if (!chordType) return null;
  if (get(chordOverlayHiddenAtom)) return null;
  return {
    chordLookup,
    hiddenNotes: get(chordHiddenNotesAtom),
    chordDegree: get(activeChordCachedDegreeAtom),
  };
});

/** Gathers scale-specific inputs. */
const scaleSemanticInputsAtom = atom((get) => ({
  scaleContext: get(scaleContextAtom),
  colorNotes: get(colorNotesAtom),
}));

/**
 * Maps note → {@link NoteSemantics}, allowing multiple properties to coexist
 * for notes that fill more than one role (e.g. a chord root that lies outside
 * the active scale).
 *
 * Inputs (read via `get`): `chordSemanticInputsAtom`, `scaleSemanticInputsAtom`.
 *
 * Output: `Map<note, NoteSemantics>`. Empty map when there is no chord or the
 * overlay is hidden — consumers fall back to the scale-only base model.
 *
 * See the "Lens & Note Roles" section in `CLAUDE.md` for the role taxonomy.
 */
export const noteSemanticMapAtom = atom((get) => {
  const chordInputs = get(chordSemanticInputsAtom);
  if (!chordInputs) return memoizeNoteSemanticMap(new Map<string, NoteSemantics>());

  const scaleInputs = get(scaleSemanticInputsAtom);
  const {
    scaleContext: { rootNote, scaleName, scaleNoteSet, degreesMap },
    colorNotes,
  } = scaleInputs;
  const {
    chordLookup: { chordRoot, chordMembers, chordType },
    hiddenNotes,
    chordDegree,
  } = chordInputs;

  const colorNoteSet = new Set(colorNotes);

  // Per-note hides: drop hidden notes from chord-tone classification so the
  // fretboard renders them as scale-only / color-tone / inactive instead of
  // chord-tone-orange.
  const visibleMembers = hiddenNotes.size === 0
    ? chordMembers
    : chordMembers.filter((m) => !hiddenNotes.has(m.note));

  const memberByNote = new Map<string, (typeof visibleMembers)[number]>();
  for (const m of visibleMembers) memberByNote.set(m.note, m);
  const activeChordToneSet = new Set(visibleMembers.map((m) => m.note));

  // diatonic chord check (computed once per evaluation).
  let diatonicChordRoot: string | undefined;
  let diatonicChordQuality: string | undefined;
  if (chordDegree !== null) {
    const diatonicResult = getDiatonicChord(chordDegree, scaleName, rootNote);
    diatonicChordRoot = diatonicResult?.root;
    diatonicChordQuality = diatonicResult?.quality;
  }

  const map = new Map<string, NoteSemantics>();
  for (const note of NOTES) {
    const isInScale = scaleNoteSet.has(note);
    // A hidden chord root must not retain chord-root semantics — gate on the
    // visibility-filtered active set so per-note hides drop the role too.
    const isChordRoot = note === chordRoot && activeChordToneSet.has(chordRoot);
    const isChordTone = activeChordToneSet.has(note);
    const enh = ENHARMONICS[note];
    const isColorTone = colorNoteSet.has(note) || (!!enh && colorNoteSet.has(enh));
    const member = memberByNote.get(note);
    const isGuideTone = !!(member && GUIDE_TONE_RAW.has(member.name));
    const isTension = isChordTone && !isInScale;
    const isScaleRoot =
      note === rootNote ||
      ENHARMONICS[note] === rootNote ||
      ENHARMONICS[rootNote] === note;

    if (isInScale || isChordTone || isColorTone) {
      const tonicIdx = NOTES.indexOf(rootNote);
      const noteIdx = NOTES.indexOf(note);
      map.set(note, {
        isScaleRoot: !!isScaleRoot,
        isChordRoot,
        isChordTone,
        isInScale,
        isColorTone,
        isGuideTone,
        isTension,
        memberName: member?.name as ChordMemberName | undefined,
        scaleDegree: isInScale && tonicIdx !== -1 && noteIdx !== -1
          ? (
              degreesMap[(noteIdx - tonicIdx + 12) % 12] ??
              INTERVAL_NAMES[(noteIdx - tonicIdx + 12) % 12]
            ) as DegreeId | undefined
          : undefined,
        isDiatonicChord: isChordTone && isInScale
          && diatonicChordRoot !== undefined
          && diatonicChordRoot === chordRoot
          && diatonicChordQuality === chordType,
        isFullChordMode: get(fullChordsEnabledAtom),
      });
    }
  }
  return memoizeNoteSemanticMap(map);
});

/**
 * Derives the ordered coaching cues rendered in the practice bar.
 *
 * Inputs (read via `get`): chord root/type, scale name, and the chord-row
 * catalog. Emits "Land on" + "Tension" cues (chord notes that fall outside
 * the active scale, with nearest-in-scale resolution targets).
 *
 * Output: `PracticeCue[]` ordered for left-to-right display. Returns `[]`
 * when no chord is active.
 *
 * See the "Note Roles" section in `CLAUDE.md` for how cues compose with the
 * base note-role model.
 */
export const practiceCuesAtom = atom((get) => {
  const base = get(cueBaseInputsAtom);
  if (!base) return [] as PracticeCue[];
  const { allChordMembers, chordRoot, preferFlats, scaleNotes } = base;

  const displayNote = (note: string) =>
    formatAccidental(getNoteDisplay(note, chordRoot, preferFlats));

  const cues: PracticeCue[] = [];
  if (allChordMembers.length > 0) {
    cues.push(buildLandOnCue(allChordMembers));
  }
  const tensionMembers = allChordMembers.filter((e) => !e.inScale);
  if (tensionMembers.length > 0) {
    const tensionNotes = tensionMembers.map((e) => ({
      ...toCueNote(e),
      role: "chord-tone-outside-scale" as const,
      resolvesTo: findNearestScaleResolution(e.internalNote, scaleNotes, displayNote),
    }));
    cues.push({
      kind: "tension",
      label: "Tension",
      notes: tensionNotes,
    });
  }
  return cues;
});


/**
 * Pitch-class set of the chord at the step *after* the active progression step.
 * Wraps around so that the last step's next is the first step. When the
 * progression has exactly one step, next wraps to that same step (all its
 * tones are returned).
 *
 * Notes are in the FretFlow sharps convention (C#, D#, …), matching
 * `getChordNotes` which already performs the same sharp-normalization.
 *
 * Returns an empty set when:
 * - The progression is empty.
 * - The resolved next step is unavailable in the current scale.
 * - The step's quality is not a known FretFlow chord quality.
 */
export const nextChordTonesAtom = atom((get): Set<string> => {
  const steps = get(resolvedProgressionStepsAtom);
  if (steps.length === 0) return new Set();
  const active = get(displayedProgressionStepIndexAtom);
  if (active === steps.length - 1 && !get(progressionLoopEnabledAtom)) {
    return new Set();
  }
  const nextIndex = (active + 1) % steps.length;
  const step = steps[nextIndex];
  if (!step || step.unavailable || step.root === null || step.quality === null) {
    return new Set();
  }
  const notes = getChordNotes(step.root, step.quality);
  return new Set(notes);
});

/**
 * Pitch-class set of the active progression chord. Reads the active step via
 * `activeResolvedProgressionStepAtom` so the index is clamped to the current
 * progression length. Sharps convention. Empty when unresolvable.
 */
export const activeChordTonesAtom = atom((get): Set<string> => {
  const activeStep = get(activeResolvedProgressionStepAtom);
  if (
    !activeStep ||
    activeStep.unavailable ||
    activeStep.root === null ||
    activeStep.quality === null
  ) {
    return new Set();
  }
  return new Set(getChordNotes(activeStep.root, activeStep.quality));
});

/**
 * Pitch-class set of notes shared between the active chord and the next chord
 * in the progression (common tones). Useful for the Lead lens to identify
 * pivot/guide notes when navigating between chords.
 *
 * Reads the active step via `activeChordTonesAtom` so the index is clamped to
 * the current progression length — protects against transient out-of-range
 * states (e.g. after a step is removed).
 *
 * Both sets use the same sharps convention so the intersection is reliable.
 * Returns an empty set when the progression is empty or the active step is
 * unresolvable.
 */
export const commonTonesWithNextAtom = atom((get): Set<string> => {
  const activeTones = get(activeChordTonesAtom);
  const next = get(nextChordTonesAtom);
  return new Set([...activeTones].filter((n) => next.has(n)));
});

/**
 * Pitch classes the next chord introduces that the active chord lacks
 * (`next − current`). These are the positions previewed as incoming ghosts.
 */
export const incomingTonesAtom = atom((get): Set<string> => {
  const current = get(activeChordTonesAtom);
  const next = get(nextChordTonesAtom);
  return new Set([...next].filter((n) => !current.has(n)));
});

/**
 * Pitch classes the active chord drops on the change (`current − next`).
 */
export const departingTonesAtom = atom((get): Set<string> => {
  const current = get(activeChordTonesAtom);
  const next = get(nextChordTonesAtom);
  if (next.size === 0) return new Set();
  return new Set([...current].filter((n) => !next.has(n)));
});

/**
 * Pitch-class set of guide tones (3rd and 7th) for the chord at the *next*
 * progression step. Used by the Lead lens anticipation window: when the
 * beat position enters the last beat of the current step, notes matching
 * these pitch classes receive "anticipation" emphasis.
 *
 * Guide tone detection mirrors `chordMembersAtom` / `GUIDE_TONE_RAW`:
 * filters ChordDefinition members whose name is b3, 3, b7, or 7, then
 * resolves the note from root + semitone offset.
 *
 * Returns an empty set when:
 * - The progression is empty.
 * - The next step is unavailable or missing root/quality.
 * - The next chord has no recognizable guide tones (e.g. power chords).
 */
export const nextChordGuideTonesAtom = atom((get): Set<string> => {
  const steps = get(resolvedProgressionStepsAtom);
  if (steps.length === 0) return new Set();
  const active = get(displayedProgressionStepIndexAtom);
  if (active === steps.length - 1 && !get(progressionLoopEnabledAtom)) {
    return new Set();
  }
  const nextIndex = (active + 1) % steps.length;
  const step = steps[nextIndex];
  if (!step || step.unavailable || step.root === null || step.quality === null) {
    return new Set();
  }
  const def = CHORD_DEFINITIONS[step.quality];
  if (!def) return new Set();
  const rootIndex = NOTES.indexOf(step.root);
  if (rootIndex === -1) return new Set();
  const guideTones = new Set<string>();
  for (const member of def.members) {
    if (GUIDE_TONE_RAW.has(member.name)) {
      guideTones.add(NOTES[(rootIndex + member.semitone) % 12]);
    }
  }
  return guideTones;
});

/**
 * Duration of the active progression step in beats.
 *
 * Exported for reuse in Task 4.5 (anticipation window check:
 * `beatPosition >= stepDurationBeats - 1`).
 */
export const activeStepDurationBeatsAtom = atom((get): number => {
  const step = get(activeResolvedProgressionStepAtom);
  if (!step || step.unavailable) return 0;
  const beatsPerBar = get(beatsPerBarAtom);
  return getProgressionDurationBeats(step.duration, beatsPerBar);
});

/**
 * Discrete anticipation phase. Reads the per-frame visual-frame atom but its
 * VALUE only flips at the last-beat threshold, so Jotai subscribers re-render
 * at most twice per step instead of every animation frame.
 */
export const anticipationActiveAtom = atom((get): boolean => {
  if (!get(progressionPlayingAtom)) return false;
  const frame = get(progressionVisualFrameAtom);
  if (!frame || frame.paused) return false;
  return isInAnticipationWindow(frame.localFraction, get(activeStepDurationBeatsAtom));
});

/**
 * Current beat position within the active progression step, derived from
 * the step deadline and tempo. Beat 0 = just started; `stepDurationBeats` = step ended.
 *
 * Formula: `stepDurationBeats - beatsRemaining`, clamped to [0, stepDurationBeats].
 *
 * This atom reads `Date.now()` directly and is therefore time-dependent.
 * In Jotai, derived atoms only recompute when their declared dependencies
 * (tempo, deadline, step) change — NOT on every clock tick.
 *
 * TODO (Task 4.5+): consumers need a 60Hz ticker atom to get live updates;
 * subscribe a raf-driven atom that sets a dummy counter so this recomputes
 * on every animation frame.
 */
export const beatPositionAtom = atom((get): number => {
  const tempo = get(progressionTempoBpmAtom);
  const deadline = get(progressionStepDeadlineAtom);
  const stepDurationBeats = get(activeStepDurationBeatsAtom);
  if (deadline == null) return 0;
  // Guard against tempo === 0 (would yield Infinity for secondsPerBeat).
  // Storage validation enforces a min, but direct programmatic `set` could
  // bypass it — mirror `getProgressionDurationMs`'s clamp.
  const safeTempo = Math.max(MIN_PROGRESSION_TEMPO_BPM, tempo);
  const secondsRemaining = Math.max(0, (deadline - Date.now()) / 1000);
  const secondsPerBeat = 60 / safeTempo;
  const beatsRemaining = secondsRemaining / secondsPerBeat;
  // Clamp to documented [0, stepDurationBeats] invariant for float safety.
  return Math.min(stepDurationBeats, Math.max(0, stepDurationBeats - beatsRemaining));
});
