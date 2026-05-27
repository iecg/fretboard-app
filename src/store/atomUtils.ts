import { atom, type Atom } from "jotai";

export const EMPTY_SET: Set<string> = Object.freeze(new Set<string>()) as Set<string>;

export function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * Shallow value-equality for two read-only Maps: same size and each key in
 * `a` maps to a value in `b` that is reference-equal (Object.is). Used by
 * selector-level memoization to return the previous Map reference when the
 * recomputed Map is value-equal — letting downstream React Compiler memos
 * short-circuit cleanly.
 */
export function mapsShallowEqual<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (!b.has(key) || b.get(key) !== value) return false;
  }
  return true;
}

/**
 * Creates a read-only atom that returns `sourceAtom`'s value when
 * `visibleAtom` is true, or the provided `fallback` when false.
 *
 * Common use: gating scale/chord data behind a visibility toggle so that
 * downstream consumers see an empty collection when the feature is hidden.
 */
export function gatedAtom<T>(
  sourceAtom: Atom<T>,
  visibleAtom: Atom<boolean>,
  fallback: T,
): Atom<T> {
  return atom((get) => {
    if (!get(visibleAtom)) return fallback;
    return get(sourceAtom);
  });
}
