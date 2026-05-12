import { atom, type Atom } from "jotai";

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
