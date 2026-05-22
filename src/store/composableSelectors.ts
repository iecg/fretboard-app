import { atom } from "jotai";
import {
  CHORD_DEFINITIONS,
  INTERVAL_NAMES,
  NOTES,
  formatAccidental,
  getNoteDisplay,
  getScaleNotes,
} from "@fretflow/core";
import type { ChordRowEntry, ResolvedChordMember } from "@fretflow/core";
import { getDegreesForScale, type DegreeId } from "@fretflow/core";
import {
  chordMembersAtom,
  chordRootAtom,
  chordTypeAtom,
} from "./chordOverlayAtoms";
import {
  rootNoteAtom,
  scaleNameAtom,
  scaleNotesAtom,
  preferFlatsAtom,
} from "./scaleAtoms";

// ---------------------------------------------------------------------------
// Pure, atom-agnostic predicates and builders that compose the chord and
// scale domains. Nothing here imports Jotai state — these are the seam used
// by the cross-domain derived atoms below to keep the chord and scale modules
// independent (chord atoms must not read scale atoms directly).
// ---------------------------------------------------------------------------

function toNoteSet(
  scaleNotes: ReadonlySet<string> | readonly string[],
): ReadonlySet<string> {
  return scaleNotes instanceof Set ? scaleNotes : new Set(scaleNotes);
}

export function isChordMemberInScale(
  note: string,
  scaleNotes: ReadonlySet<string> | readonly string[],
): boolean {
  return toNoteSet(scaleNotes).has(note);
}

export function hasAnyChordToneOutsideScale(
  chordNotes: readonly string[],
  scaleNotes: ReadonlySet<string> | readonly string[],
): boolean {
  const set = toNoteSet(scaleNotes);
  return chordNotes.some((n) => !set.has(n));
}

export function chordMemberRole(
  member: ResolvedChordMember,
  scaleNotes: ReadonlySet<string>,
): ChordRowEntry["role"] {
  if (member.name === "root") return "chord-root";
  return scaleNotes.has(member.note)
    ? "chord-tone-in-scale"
    : "chord-tone-outside-scale";
}

export function buildChordRowEntries(
  chordMembers: readonly ResolvedChordMember[],
  chordRoot: string,
  rootNote: string,
  scaleName: string,
  preferFlats: boolean,
): ChordRowEntry[] {
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  const degreesMap = getDegreesForScale(scaleName);
  const tonicIdx = NOTES.indexOf(rootNote);

  return chordMembers.map((m): ChordRowEntry => {
    const inScale = scaleNoteSet.has(m.note);
    const role = chordMemberRole(m, scaleNoteSet);
    let scaleDegree: DegreeId | undefined;
    let scaleInterval: string | undefined;
    const noteIdx = NOTES.indexOf(m.note);
    if (noteIdx !== -1 && tonicIdx !== -1) {
      const semitone = (noteIdx - tonicIdx + 12) % 12;
      scaleInterval = formatAccidental(INTERVAL_NAMES[semitone] ?? "1");
      if (inScale) {
        scaleDegree = degreesMap[semitone] ?? INTERVAL_NAMES[semitone];
      }
    }
    return {
      internalNote: m.note,
      displayNote: formatAccidental(getNoteDisplay(m.note, chordRoot, preferFlats)),
      memberName: m.name === "root" ? "1" : formatAccidental(m.name),
      role,
      inScale,
      scaleDegree,
      scaleInterval,
    };
  });
}

// ---------------------------------------------------------------------------
// Cross-domain derived atoms — composed in this neutral module so that
// neither `chordOverlayAtoms` nor `scaleAtoms` has to import the other.
// ---------------------------------------------------------------------------

export const hasOutsideChordMembersAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return false;
  const chordRoot = get(chordRootAtom);
  const def = CHORD_DEFINITIONS[chordType];
  if (!def) return false;
  const rootIndex = NOTES.indexOf(chordRoot);
  if (rootIndex === -1) return false;
  const tones = def.members.map((m) => NOTES[(rootIndex + m.semitone) % 12]);
  return hasAnyChordToneOutsideScale(tones, get(scaleNotesAtom));
});

/**
 * Catalog of chord members annotated with scale-membership flags and role
 * tags — the canonical input shared by every practice-lens composite (see
 * `practiceLensAtoms.ts`) and the chord summary atoms in `atoms.ts`.
 *
 * Inputs (read via `get`): `chordTypeAtom`, `chordRootAtom`, `rootNoteAtom`,
 * `scaleNameAtom`. Empty array when no chord is selected.
 *
 * Output: `ChordRowEntry[]` covering every chord member, including those that
 * fall outside the active scale (consumers decide how to render outsiders).
 *
 * See the "Lens & Note Roles" section in `CLAUDE.md` for the role taxonomy.
 */
export const allChordMembersAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [] as ChordRowEntry[];
  return buildChordRowEntries(
    get(chordMembersAtom),
    get(chordRootAtom),
    get(rootNoteAtom),
    get(scaleNameAtom),
    get(preferFlatsAtom),
  );
});
