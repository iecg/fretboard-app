import { atom } from "jotai";
import type { FretboardEventSink } from "./events";

/**
 * "builtin": the package renders its own audio (GuitarSynth / Tone.js) — the
 * web app's behavior. "events": the package is silent and emits FretboardEvents
 * so the host (e.g. a native shell) renders audio itself.
 *
 * Scope: today this only routes the tap-to-play path (`Fretboard.handleFretClick`),
 * which is the only audio source reachable from `FretboardEmbed` (it renders a
 * bare `<Fretboard/>`, no progression/Inspector surface). The Tone.js
 * progression engine does NOT yet consult this atom, so any future embed that
 * surfaces progression playback must extend the routing before "events" mode
 * can claim full silence.
 */
export const audioModeAtom = atom<"builtin" | "events">("builtin");

/** Host-registered event sink. Null outside an embed. */
export const fretboardEventSinkAtom = atom<FretboardEventSink | null>(null);
