import { atom } from "jotai";
import {
  NOTES,
  ENHARMONICS,
  INTERVAL_NAMES,

  LENS_REGISTRY,
  getScaleNotes,
  getNoteDisplay,
  formatAccidental,
  getDiatonicChord,
  getChordNotes,
} from "@fretflow/core";
import type {
  ChordMemberName,
  LensAvailabilityContext,
  NoteSemantics,
  PracticeCue,
  PracticeCueNote,
  ChordRowEntry,

  PracticeBarNote,
  PracticeBarGroup,
} from "@fretflow/core";
import {
  getDegreesForScale,
  DEGREE_COLORS,
  type DegreeId,
} from "@fretflow/core";
import {
  rootNoteAtom,
  scaleNameAtom,
  scaleNotesAtom,
  colorNotesAtom,
  useFlatsAtom,
  practiceBarColorNotesAtom,
} from "./scaleAtoms";
import {
  chordRootAtom,
  chordTypeAtom,
  chordLabelAtom,
  chordTonesAtom,
  chordMembersAtom,
  practiceLensAtom,
  chordOverlayHiddenAtom,
  chordHiddenNotesAtom,
  fullChordsEnabledAtom,
} from "./chordOverlayAtoms";
import { activeChordCachedDegreeAtom } from "./songStateAtoms";
import {
  resolvedProgressionStepsAtom,
  activeProgressionStepIndexAtom,
} from "./progressionAtoms";
import {
  hasOutsideChordMembersAtom,
  allChordMembersAtom,
} from "./composableSelectors";
import { shapeHighlightedNoteSetAtom } from "./shapeAtoms";

// Guide tone members: 3rd and 7th
const GUIDE_TONE_RAW = new Set(["b3", "3", "b7", "7"]);
const GUIDE_TONE_FORMATTED = new Set(["♭3", "3", "♭7", "7"]);

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

export const practiceBarColorNotesFilteredAtom = atom((get) => {
  const chordTones = get(chordTonesAtom);
  const practiceBarColorNotes = get(practiceBarColorNotesAtom);
  const chordToneSet = new Set(chordTones);
  return practiceBarColorNotes.filter((n) => !chordToneSet.has(n.internalNote));
});

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
  const chordType = get(chordTypeAtom);
  if (!chordType) return null;
  return {
    chordType,
    chordRoot: get(chordRootAtom),
    useFlats: get(useFlatsAtom),
    allChordMembers: get(allChordMembersAtom),
    scaleNotes: get(scaleNotesAtom),
  };
});

const guideTonesCuesAtom = atom((get) => {
  const base = get(cueBaseInputsAtom);
  if (!base) return [] as PracticeCue[];
  const cues: PracticeCue[] = [];
  if (base.allChordMembers.length > 0) {
    cues.push(buildLandOnCue(base.allChordMembers));
  }
  const guideNotes = base.allChordMembers.filter((e) =>
    GUIDE_TONE_FORMATTED.has(e.memberName),
  );
  if (guideNotes.length > 0) {
    cues.push({
      kind: "guide-tones",
      label: "Guide tones",
      notes: guideNotes.map((e) => ({
        ...toCueNote(e),
        role: "guide-tone" as const,
      })),
    });
  }
  return cues;
});

const tensionCuesAtom = atom((get) => {
  const base = get(cueBaseInputsAtom);
  if (!base) return [] as PracticeCue[];
  const { allChordMembers, chordRoot, useFlats, scaleNotes } = base;

  const displayNote = (note: string) =>
    formatAccidental(getNoteDisplay(note, chordRoot, useFlats));

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

/** Gathers chord-specific inputs. Returns null when there is no active chord or the overlay is hidden. */
const chordSemanticInputsAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return null;
  if (get(chordOverlayHiddenAtom)) return null;
  return {
    chordRoot: get(chordRootAtom),
    chordMembers: get(chordMembersAtom),
    hiddenNotes: get(chordHiddenNotesAtom),
    chordDegree: get(activeChordCachedDegreeAtom),
    chordType,
  };
});

/** Gathers scale-specific inputs. */
const scaleSemanticInputsAtom = atom((get) => ({
  rootNote: get(rootNoteAtom),
  scaleName: get(scaleNameAtom),
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
  if (!chordInputs) return new Map<string, NoteSemantics>();

  const scaleInputs = get(scaleSemanticInputsAtom);
  const { rootNote, scaleName, colorNotes } = scaleInputs;
  const { chordRoot, chordMembers, hiddenNotes, chordDegree, chordType } = chordInputs;

  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
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

  // Phase 04: diatonic chord check (computed once per evaluation).
  // Phase 2.5: degree is sourced from the active progression step; the legacy
  // `chordOverlayMode === "degree"` gate is gone — the resolver already
  // returns the diatonic root + quality when no manual override is set.
  const degreesMap = getDegreesForScale(scaleName);

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
  return map;
});

/**
 * Derives the ordered coaching cues rendered in the practice bar.
 *
 * Inputs (read via `get`): the active practice lens (`practiceLensAtom`),
 * chord root/type, scale name, and the chord-row catalog.
 *
 * Output: `PracticeCue[]` ordered for left-to-right display. Returns `[]`
 * when no chord is active.
 *
 * See the "Lens & Note Roles" section in `CLAUDE.md` for how cues compose
 * with the base note-role model.
 */
export const practiceCuesAtom = atom((get) => {
  const practiceLens = get(practiceLensAtom);
  // TODO (Task 4.4/4.5): rewrite cue behavior for new lens IDs.
  // Temporary bridge: "tones" uses combined targets+guide-tones behavior;
  // "lead" uses the old tension behavior. This keeps the suite green while
  // the lens enum rename is complete.
  switch (practiceLens) {
    case "tones": return get(guideTonesCuesAtom);
    case "lead": return get(tensionCuesAtom);
    default: return [] as PracticeCue[];
  }
});

const entryToBarNote = (e: ChordRowEntry): PracticeBarNote => ({
  internalNote: e.internalNote,
  displayNote: e.displayNote,
  intervalName: getDisplayLabel(e),
  isChordRoot: e.role === "chord-root",
  isGuideTone: GUIDE_TONE_FORMATTED.has(e.memberName),
  isTension: !e.inScale,
  isInScale: e.inScale,
  scaleDegree: e.scaleDegree,
  degreeColor: e.scaleDegree ? DEGREE_COLORS[e.scaleDegree] : undefined,
});

/**
 * Chord group — lens-independent. Always shows all chord members.
 */
export const practiceBarChordGroupAtom = atom((get): PracticeBarGroup => {
  const members = get(allChordMembersAtom);
  return {
    label: "Chord",
    notes: members.map(entryToBarNote),
  };
});

/**
 * Land-on group base — lens-driven coaching subset.
 *  - tones: 3rd/7th members (falls back to all if none) — temporary bridge to old guide-tones behavior
 *  - lead: outside-scale members with resolutions — temporary bridge to old tension behavior
 *
 * Tasks 4.4/4.5 will rewrite this with the real per-lens logic; the current
 * mapping just keeps the suite green through the enum rename.
 *
 * Shape narrowing applied in atoms.ts to avoid circular imports.
 */
const practiceBarLandOnGroupBaseAtom = atom((get): PracticeBarGroup => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return { label: "Land on", notes: [] };

  const lens = get(practiceLensAtom);
  const chordRoot = get(chordRootAtom);
  const useFlats = get(useFlatsAtom);
  const allMembers = get(allChordMembersAtom);
  const scaleNotes = get(scaleNotesAtom);

  const displayNote = (note: string) =>
    formatAccidental(getNoteDisplay(note, chordRoot, useFlats));

  const findResolution = (note: string) =>
    findNearestScaleResolution(note, scaleNotes, displayNote);

  let subset: ChordRowEntry[];
  // TODO (Task 4.4/4.5): rewrite land-on subset logic for new lens IDs.
  // Temporary bridge: "tones" uses guide-tones subset (3rd/7th emphasis);
  // "lead" uses the old tension subset (outside-scale members).
  switch (lens) {
    case "tones": {
      const gt = allMembers.filter((e) => GUIDE_TONE_FORMATTED.has(e.memberName));
      subset = gt.length > 0 ? gt : allMembers;
      break;
    }
    case "lead":
      subset = allMembers.filter((e) => !e.inScale);
      break;
    default:
      subset = allMembers;
  }

  const notes: PracticeBarNote[] = subset.map((e) => {
    const base = entryToBarNote(e);
    return lens === "lead"
      ? { ...base, resolvesTo: findResolution(e.internalNote) }
      : base;
  });

  return { label: "Land on", notes };
});

/**
 * Shape-aware Land-on group. Narrows the base lens subset to notes present in
 * the active shape context (except for tension, which stays global). The
 * Chord group never goes through this — it is always all chord members.
 */
export const practiceBarLandOnGroupAtom = atom((get) => {
  const base = get(practiceBarLandOnGroupBaseAtom);
  const lens = get(practiceLensAtom);
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  if (!shapeHighlightedNoteSet || lens === "lead") return base;
  const filtered = base.notes.filter((n) =>
    shapeHighlightedNoteSet.has(n.internalNote),
  );
  if (filtered.length === 0) return base;
  return { ...base, notes: filtered };
});

export const showChordPracticeBarAtom = atom((get) => {
  return !!get(chordTypeAtom);
});

export const practiceBarTitleAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const chordLabel = get(chordLabelAtom);
  if (!chordType) return "";
  return chordLabel ?? "";
});

export const practiceBarBadgeAtom = atom(() => null as string | null);

/**
 * Active lens label from LENS_REGISTRY.
 */
export const practiceBarLensLabelAtom = atom((get): string | null => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return null;
  const lens = get(practiceLensAtom);
  const entry = LENS_REGISTRY.find((e) => e.id === lens);
  return entry?.label ?? null;
});

/**
 * Context inputs for LENS_REGISTRY predicates.
 */
export const lensAvailabilityContextAtom = atom((get): LensAvailabilityContext => {
  const chordType = get(chordTypeAtom);
  const chordMembers = get(chordMembersAtom);
  const colorNotes = get(colorNotesAtom);
  const hasOutsideChordMembers = get(hasOutsideChordMembersAtom);

  return {
    hasChordOverlay: !!chordType,
    hasGuideTones: chordMembers.some((m) => GUIDE_TONE_RAW.has(m.name)),
    hasColorNotes: colorNotes.length > 0,
    hasOutsideTones: hasOutsideChordMembers,
  };
});

/**
 * Resolved list of lenses with availability and reasons.
 */
export const lensAvailabilityAtom = atom((get) => {
  const ctx = get(lensAvailabilityContextAtom);
  return LENS_REGISTRY.map((entry) => ({
    id: entry.id,
    label: entry.label,
    description: entry.description,
    available: entry.isAvailable(ctx),
    reason: entry.unavailableReason(ctx),
  }));
});

/**
 * Pitch-class set of the chord at the step *after* the active progression step.
 * Wraps around so that the last step's next is the first step.
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
  const active = get(activeProgressionStepIndexAtom);
  const nextIndex = (active + 1) % steps.length;
  const step = steps[nextIndex];
  if (!step || step.unavailable || step.root === null || step.quality === null) {
    return new Set();
  }
  const notes = getChordNotes(step.root, step.quality);
  return new Set(notes);
});

/**
 * Pitch-class set of notes shared between the active chord and the next chord
 * in the progression (common tones). Useful for the Lead lens to identify
 * pivot/guide notes when navigating between chords.
 *
 * Both sets use the same sharps convention so the intersection is reliable.
 * Returns an empty set when the progression is empty.
 */
export const commonTonesWithNextAtom = atom((get): Set<string> => {
  const active = get(activeProgressionStepIndexAtom);
  const steps = get(resolvedProgressionStepsAtom);
  if (steps.length === 0) return new Set();
  const activeStep = steps[active];
  if (!activeStep || activeStep.unavailable || activeStep.root === null || activeStep.quality === null) {
    return new Set();
  }
  const activeTones = new Set(getChordNotes(activeStep.root, activeStep.quality));
  const next = get(nextChordTonesAtom);
  return new Set([...activeTones].filter((n) => next.has(n)));
});
