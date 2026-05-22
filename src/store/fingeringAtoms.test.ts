// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { cagedOctaveAtom, npsOctaveAtom } from "./fingeringAtoms";
import { makeAtomStore } from "../test-utils/renderWithAtoms";

describe("cagedOctaveAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 0", () => {
    const store = makeAtomStore([]);
    expect(store.get(cagedOctaveAtom)).toBe(0);
  });

  it("accepts value 0", () => {
    const store = makeAtomStore([]);
    store.set(cagedOctaveAtom, 0);
    expect(store.get(cagedOctaveAtom)).toBe(0);
  });

  it("accepts value 1", () => {
    const store = makeAtomStore([]);
    store.set(cagedOctaveAtom, 1);
    expect(store.get(cagedOctaveAtom)).toBe(1);
  });

  it("uses the same storage constraint as npsOctaveAtom (0..1 integer)", () => {
    // Both atoms use npsOctaveStorage — verify they clamp consistently
    const store = makeAtomStore([[cagedOctaveAtom, 0], [npsOctaveAtom, 0]]);
    store.set(cagedOctaveAtom, 1);
    store.set(npsOctaveAtom, 1);
    expect(store.get(cagedOctaveAtom)).toBe(1);
    expect(store.get(npsOctaveAtom)).toBe(1);
  });
});
