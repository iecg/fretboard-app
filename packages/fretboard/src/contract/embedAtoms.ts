import { atom } from "jotai";
import type { FretboardEventSink } from "./events";

/**
 * "builtin": the package renders its own audio (GuitarSynth / Tone.js) — the
 * web app's behavior. "events": the package is silent and emits FretboardEvents
 * so the host (e.g. a native shell) renders audio itself.
 */
export const audioModeAtom = atom<"builtin" | "events">("builtin");

/** Host-registered event sink. Null outside an embed. */
export const fretboardEventSinkAtom = atom<FretboardEventSink | null>(null);
