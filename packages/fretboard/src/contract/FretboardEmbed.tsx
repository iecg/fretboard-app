import { useEffect, useState } from "react";
import { Provider, createStore } from "jotai";
import { Fretboard } from "../components/Fretboard/Fretboard";
import { baseRootNoteAtom, baseScaleNameAtom } from "../store/scaleAtoms";
import { themeAtom, displayFormatAtom, type ThemePreference } from "../store/uiAtoms";
import { audioModeAtom, fretboardEventSinkAtom } from "./embedAtoms";
import type { FretboardEventSink } from "./events";
import { prefetchAudioModule, resumeGuitarAudio } from "../core/lazyGuitarAudio";

/**
 * Serializable configuration for an embedded fretboard. Every field crosses
 * process/webview boundaries, so values must stay JSON-serializable and only
 * change at human speed (no per-frame updates). Grows with consumers (M2+).
 */
export interface FretboardConfig {
  /** Root note as a sharp name, e.g. "C", "F#". */
  root?: string;
  /** Scale name as stored by the app's internal token (e.g. "major", "minor pentatonic"). */
  scale?: string;
  theme?: ThemePreference;
  displayFormat?: "notes" | "degrees" | "none";
  /** "builtin" (default): package plays its own audio. "events": silent, emits FretboardEvents. */
  audio?: "builtin" | "events";
  /** Pixel height per string row (host-controlled sizing). */
  stringRowPx?: number;

  // --- M2: scale/fingering overlay controls (all human-speed, serializable) ---
  /** Whether the scale overlay is shown on the board. */
  scaleVisible?: boolean;
  /** Active fingering pattern. */
  fingeringPattern?: "none" | "caged" | "3nps" | "one-string" | "two-strings";
  /** CAGED shape when fingeringPattern === "caged". */
  cagedShape?: "C" | "A" | "G" | "E" | "D";
  /** 3NPS position (1–7) when fingeringPattern === "3nps". */
  npsPosition?: number;
  /** 3NPS octave (0 = Low, 1 = High) when fingeringPattern === "3nps". */
  npsOctave?: number;
  /** Active string index (0–5) when fingeringPattern === "one-string". */
  oneStringIndex?: number;
  /** Connector toggle (0 = Off, 1 = On) when fingeringPattern === "one-string". */
  oneStringInterval?: number;
  /** Active pair index (0–4) when fingeringPattern === "two-strings". */
  twoStringsPair?: number;
  /** Interval (0 = Off, 1 = 3rds, 2 = 4ths, 3 = 6ths) when fingeringPattern === "two-strings". */
  twoStringsInterval?: number;
}

export interface FretboardEmbedProps {
  config: FretboardConfig;
  onEvent?: FretboardEventSink;
}

/**
 * Controlled, isolated-store wrapper for embedding the fretboard in a host
 * shell (e.g. an Expo DOM island). Serializable `config` in, `FretboardEvent`s
 * out, with injectable audio. The web app keeps rendering `<Fretboard/>`
 * directly against the default Jotai store — this is a NEW, additive surface.
 *
 * Note: each embed gets an isolated in-memory store, but the persisted
 * scale/root atoms (`atomWithStorage`) share global localStorage keys. Two
 * embeds mounted concurrently therefore share persisted scale/root state
 * (last write wins on reload). Per-embed storage namespacing is deferred to a
 * later milestone (injectable storage-key prefix).
 *
 * The effects below are the hydration layer: imperative atom writes keyed on
 * config changes. FretboardSVG and everything beneath it keep their direct
 * atom subscriptions untouched.
 */
export function FretboardEmbed({ config, onEvent }: FretboardEmbedProps) {
  // One isolated store per embed: embeds never share state with a host app
  // that might also be running the default Jotai store.
  const [store] = useState(() => createStore());

  useEffect(() => {
    if (config.root !== undefined) store.set(baseRootNoteAtom, config.root);
    if (config.scale !== undefined) store.set(baseScaleNameAtom, config.scale);
    if (config.theme !== undefined) store.set(themeAtom, config.theme);
    if (config.displayFormat !== undefined)
      store.set(displayFormatAtom, config.displayFormat);
    store.set(audioModeAtom, config.audio ?? "builtin");
  }, [store, config.root, config.scale, config.theme, config.displayFormat, config.audio]);

  useEffect(() => {
    // Jotai's primitive `set` treats a function value as an updater
    // `(prev) => next`. The sink is itself a function, so wrap it in an updater
    // to STORE it rather than invoke it.
    store.set(fretboardEventSinkAtom, () => onEvent ?? null);
  }, [store, onEvent]);

  // Web Audio unlock for embedded hosts (WKWebView/Safari). The tap handler
  // resumes the AudioContext only AFTER an async module import, which runs past
  // the gesture's user-activation window — so the first audible tap stays
  // silent. Prefetch the audio module on mount and resume it on the first
  // pointer gesture so taps actually play. Builtin mode only; web app behavior
  // is unchanged (it renders <Fretboard/> directly, not FretboardEmbed).
  const audioMode = config.audio ?? "builtin";
  useEffect(() => {
    if (audioMode !== "builtin" || typeof window === "undefined") return;
    prefetchAudioModule();
    const unlock = () => {
      // Best-effort unlock; swallow rejection so a failed lazy import/resume
      // never surfaces as an unhandledrejection in embedded hosts.
      void resumeGuitarAudio().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [audioMode]);

  return (
    <Provider store={store}>
      <Fretboard stringRowPx={config.stringRowPx} />
    </Provider>
  );
}
