import { type ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { createStore, Provider, type Atom } from "jotai";

type AtomSeeds = ReadonlyArray<readonly [Atom<unknown>, unknown]>;
type JotaiStore = ReturnType<typeof createStore>;

function seedAtoms(store: JotaiStore, seeds: AtomSeeds): void {
  for (const [atom, value] of seeds) {
    store.set(atom as Parameters<typeof store.set>[0], value);
  }
}

/**
 * Renders a React element inside a Jotai Provider backed by a fresh isolated store.
 * Pass seed pairs to pre-populate atom values before render.
 *
 * Usage:
 *   const { getByText } = renderWithAtoms(<MyComponent />, [
 *     [myAtom, "initial-value"],
 *   ]);
 */
export function renderWithAtoms(
  ui: ReactElement,
  seeds: AtomSeeds = [],
  options?: Omit<RenderOptions, "wrapper">,
) {
  const store = createStore();
  seedAtoms(store, seeds);
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <Provider store={store}>{children}</Provider>
    ),
  });
}

/**
 * Creates an isolated Jotai store pre-populated with the given seed pairs.
 * Useful for asserting atom state after interactions.
 *
 * Usage:
 *   const store = makeAtomStore([[myAtom, "initial"]]);
 *   renderWithStore(<MyComponent />, store);
 */
export function makeAtomStore(seeds: AtomSeeds = []) {
  const store = createStore();
  seedAtoms(store, seeds);
  return store;
}

/**
 * Renders a React element inside a Jotai Provider backed by a provided store.
 * Use when you need to assert atom state after interactions via store.get().
 */
export function renderWithStore(
  ui: ReactElement,
  store: ReturnType<typeof createStore>,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <Provider store={store}>{children}</Provider>
    ),
  });
}
