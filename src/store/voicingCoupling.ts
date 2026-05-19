import { atom } from "jotai";
import {
  generateVoicings,
  CHORD_DEFINITIONS,
  type VoicingType,
  type VoicingInversion,
} from "@fretflow/core";
import {
  chordTypeAtom,
  chordRootAtom,
  availableInversionsAtom,
  stringSetOptionsAtom,
} from "./chordOverlayAtoms";
import { currentTuningAtom } from "./layoutAtoms";

/**
 * Which voicing control was changed most recently. Drives auto-heal's
 * pin / preserve / move precedence. Not persisted — resets each session
 * to the default order (`type` → `stringSet` → `inversion`).
 */
export type VoicingControlId = "type" | "inversion" | "stringSet";

export interface VoicingTriple {
  type: VoicingType;
  inversion: VoicingInversion;
  /** A string-set id (`"all"` or e.g. `"4·5·6"`). */
  stringSet: string;
}

export interface ValidVoicingCombos {
  /** Every (type, inversion, stringSet) triple the engine accepts for the
   *  current chord — `caged` is intentionally excluded (it has its own
   *  always-valid path and is forced to root + all six strings). */
  triples: ReadonlyArray<VoicingTriple>;
  enabledTypes: ReadonlySet<VoicingType>;
  enabledInversions: ReadonlySet<VoicingInversion>;
  enabledStringSets: ReadonlySet<string>;
}

const EMPTY_COMBOS: ValidVoicingCombos = {
  triples: [],
  enabledTypes: new Set<VoicingType>(["caged"]),
  enabledInversions: new Set<VoicingInversion>(),
  enabledStringSets: new Set<string>(),
};

/**
 * The set of valid `(type, inversion, stringSet)` triples for the active
 * chord, plus per-control enabled-option sets. `caged` is always present in
 * `enabledTypes` — it is a self-contained mode that does not appear in
 * `triples` at all.
 *
 * Cost note: enumerates up to ~2 × 4 × 5 = 40 engine searches per chord
 * change (caged is excluded — it has its own engine path). Each search is
 * bounded; the atom is memoized per chord via Jotai's derived-atom caching.
 * Acceptable; revisit if profiling shows it.
 */
export const validVoicingCombosAtom = atom<ValidVoicingCombos>((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType || !CHORD_DEFINITIONS[chordType]) return EMPTY_COMBOS;
  const chordRoot = get(chordRootAtom);
  const tuning = get(currentTuningAtom);
  const inversions = get(availableInversionsAtom);
  const stringSetOptions = get(stringSetOptionsAtom);

  const triples: VoicingTriple[] = [];
  const enabledTypes = new Set<VoicingType>(["caged"]);
  const enabledInversions = new Set<VoicingInversion>();
  const enabledStringSets = new Set<string>();

  for (const type of ["triad", "drop2"] as const) {
    for (const inversion of inversions) {
      for (const option of stringSetOptions) {
        const result = generateVoicings({
          chordRoot,
          chordType,
          tuning,
          maxFret: 24,
          voicingType: type,
          inversion,
          stringSet: option.strings,
        });
        if (result.length === 0) continue;
        triples.push({ type, inversion, stringSet: option.id });
        enabledTypes.add(type);
        enabledInversions.add(inversion);
        enabledStringSets.add(option.id);
      }
    }
  }

  return { triples, enabledTypes, enabledInversions, enabledStringSets };
});

/**
 * Recency order, most-recent-first. Updated by `ChordOverlayControls`'s
 * `onChange` handlers; consumed by the heal effect to choose what to pin
 * and what to move.
 */
export const controlRecencyAtom = atom<readonly VoicingControlId[]>([
  "type",
  "stringSet",
  "inversion",
]);

/** Write-only atom: move `id` to the front of the recency list. */
export const noteControlChangeAtom = atom(null, (get, set, id: VoicingControlId) => {
  const prev = get(controlRecencyAtom);
  if (prev[0] === id) return;
  const next: VoicingControlId[] = [id, ...prev.filter((c) => c !== id)];
  set(controlRecencyAtom, next);
});

function isValidTriple(
  triples: ReadonlyArray<VoicingTriple>,
  candidate: VoicingTriple,
): boolean {
  return triples.some(
    (t) =>
      t.type === candidate.type &&
      t.inversion === candidate.inversion &&
      t.stringSet === candidate.stringSet,
  );
}

/**
 * Given a (possibly invalid) `current` triple and a recency order, return
 * the nearest valid triple from `triples`:
 *
 *   1. The most-recently-touched control (`recency[0]`) is pinned.
 *   2. Among triples that match the pinned value, prefer those that keep
 *      the next-most-recently-touched sibling (`recency[1]`).
 *   3. If forced to move the more-recent sibling, prefer triples that keep
 *      the least-recent sibling (`recency[2]`).
 *   4. Tie-break by first occurrence in `triples` (stable selection).
 *
 * If `current` is already valid, returns it unchanged. If no triple matches
 * the pinned control, returns `current` unchanged.
 */
export function nearestValidTriple(
  triples: ReadonlyArray<VoicingTriple>,
  current: VoicingTriple,
  recency: readonly VoicingControlId[],
): VoicingTriple {
  if (isValidTriple(triples, current)) return current;
  if (recency.length !== 3) return current;
  const [pinned, mid, low] = recency;

  const matches = triples.filter((t) => t[pinned] === current[pinned]);
  if (matches.length === 0) return current;

  const keepMid = matches.filter((t) => t[mid] === current[mid]);
  const pool = keepMid.length > 0 ? keepMid : matches;

  const keepLow = pool.filter((t) => t[low] === current[low]);
  const candidates = keepLow.length > 0 ? keepLow : pool;

  return candidates[0];
}
