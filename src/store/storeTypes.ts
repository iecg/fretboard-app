import type { createStore } from "jotai";

/** Concrete type of the Jotai store returned by `createStore()` / `useStore()`. */
export type Store = ReturnType<typeof createStore>;
