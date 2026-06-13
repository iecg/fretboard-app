import { useEffect, useRef, useState } from "react";
import { Provider, createStore } from "jotai";
import { Fretboard } from "../components/Fretboard/Fretboard";
import { baseRootNoteAtom, baseScaleNameAtom, scaleVisibleAtom } from "../store/scaleAtoms";
import { themeAtom, displayFormatAtom, type ThemePreference } from "../store/uiAtoms";
import { audioModeAtom, fretboardEventSinkAtom } from "./embedAtoms";
import type { FretboardEventSink } from "./events";
import { prefetchAudioModule, resumeGuitarAudio } from "../core/lazyGuitarAudio";
import { ProgressionPlaybackRunner } from "./ProgressionPlaybackRunner";
import {
  fingeringPatternAtom,
  selectSingleCagedShapeAtom,
  npsPositionAtom,
  npsOctaveAtom,
  oneStringIndexAtom,
  oneStringIntervalAtom,
  twoStringsPairAtom,
  twoStringsIntervalAtom,
} from "../store/fingeringAtoms";
import { voicingAtom } from "../store/chordOverlayAtoms";
import { practiceLensAtom } from "../store/practiceLensAtoms";
import { updateActiveChordAtom } from "../store/songStateAtoms";
import {
  loadProgressionPresetAtom,
  progressionLoopEnabledAtom,
  progressionTempoBpmAtom,
  progressionGenreStyleAtom,
  progressionDrumsEnabledAtom,
  progressionBassEnabledAtom,
  progressionChordEnabledAtom,
  progressionMetronomeEnabledAtom,
  setProgressionPlayingAtom,
  resolvedProgressionStepsAtom,
  displayedProgressionStepIndexAtom,
  progressionPlayingAtom,
  progressionPlaybackLoadingAtom,
  progressionPlaybackBlockedReasonAtom,
} from "../store/progressionAtoms";

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

  // --- M3: in-webview progression playback (opt-in) ---
  /** Mount the Tone.js progression engine for this embed. Default false (M2 embeds unchanged). */
  progressionEnabled?: boolean;
  /** Progression preset id (e.g. "one-five-six-four"). Loading resets playback + applies the preset's scale/genre. */
  progressionPreset?: string;
  /** Transport: play/pause. */
  progressionPlaying?: boolean;
  /** Loop the progression. */
  progressionLoop?: boolean;
  /** Tempo in BPM (engine clamps to 40..240). */
  progressionTempoBpm?: number;
  /** Genre style: "pop"|"rock"|"blues"|"jazz"|"ballad"|"funk"|"bossa-nova". */
  progressionGenre?: string;
  /** Layer toggles. */
  drumsEnabled?: boolean;
  bassEnabled?: boolean;
  chordsEnabled?: boolean;
  metronomeEnabled?: boolean;

  // --- M3: chord card (acts on the active progression step + board overlay) ---
  /** Quality override for the active chord (one of the CHORD_DEFINITIONS keys), or null to clear. */
  activeChordQuality?: string | null;
  /** Manual root for the active chord (sharp name), or null to clear. */
  activeChordManualRoot?: string | null;
  /** Board voicing overlay. */
  chordVoicing?: "off" | "full" | "close";
  /** Practice lens overlay. */
  chordPracticeLens?: "guide" | "root" | "common";
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

  // M2: scale/fingering overlay hydration. Same imperative-write pattern as the
  // base config effect above — each field is optional, so only defined values
  // are written (undefined leaves the atom at its persisted/default value).
  useEffect(() => {
    if (config.scaleVisible !== undefined) store.set(scaleVisibleAtom, config.scaleVisible);
    if (config.fingeringPattern !== undefined) store.set(fingeringPatternAtom, config.fingeringPattern);
    if (config.cagedShape !== undefined) store.set(selectSingleCagedShapeAtom, config.cagedShape);
    if (config.npsPosition !== undefined) store.set(npsPositionAtom, config.npsPosition);
    if (config.npsOctave !== undefined) store.set(npsOctaveAtom, config.npsOctave);
    if (config.oneStringIndex !== undefined) store.set(oneStringIndexAtom, config.oneStringIndex);
    if (config.oneStringInterval !== undefined) store.set(oneStringIntervalAtom, config.oneStringInterval);
    if (config.twoStringsPair !== undefined) store.set(twoStringsPairAtom, config.twoStringsPair);
    if (config.twoStringsInterval !== undefined) store.set(twoStringsIntervalAtom, config.twoStringsInterval);
  }, [
    store,
    config.scaleVisible,
    config.fingeringPattern,
    config.cagedShape,
    config.npsPosition,
    config.npsOctave,
    config.oneStringIndex,
    config.oneStringInterval,
    config.twoStringsPair,
    config.twoStringsInterval,
  ]);

  // M3: preset load — its OWN effect, keyed only on the preset id. Loading a
  // preset resets playing→false and applies the preset's scale + category genre,
  // so it must NOT re-run when unrelated song fields change (e.g. a tempo tweak
  // would otherwise reload the preset and stop playback).
  useEffect(() => {
    if (config.progressionPreset !== undefined) {
      store.set(loadProgressionPresetAtom, config.progressionPreset);
    }
  }, [store, config.progressionPreset]);

  // M3: song feel — loop / tempo / genre / layers. Declared AFTER the preset
  // effect so on mount these override the preset's category defaults. Keyed
  // narrowly so a feel change never reloads the preset.
  useEffect(() => {
    if (config.progressionLoop !== undefined) store.set(progressionLoopEnabledAtom, config.progressionLoop);
    if (config.progressionTempoBpm !== undefined) store.set(progressionTempoBpmAtom, config.progressionTempoBpm);
    if (config.progressionGenre !== undefined) store.set(progressionGenreStyleAtom, config.progressionGenre);
    if (config.drumsEnabled !== undefined) store.set(progressionDrumsEnabledAtom, config.drumsEnabled);
    if (config.bassEnabled !== undefined) store.set(progressionBassEnabledAtom, config.bassEnabled);
    if (config.chordsEnabled !== undefined) store.set(progressionChordEnabledAtom, config.chordsEnabled);
    if (config.metronomeEnabled !== undefined) store.set(progressionMetronomeEnabledAtom, config.metronomeEnabled);
  }, [
    store,
    config.progressionLoop,
    config.progressionTempoBpm,
    config.progressionGenre,
    config.drumsEnabled,
    config.bassEnabled,
    config.chordsEnabled,
    config.metronomeEnabled,
  ]);

  // M3: transport — playing in its OWN effect so toggling play never reloads the
  // preset or re-applies the feel.
  useEffect(() => {
    if (config.progressionPlaying !== undefined) {
      store.set(setProgressionPlayingAtom, config.progressionPlaying);
    }
  }, [store, config.progressionPlaying]);

  // M3: chord card. Voicing/lens are board overlays; quality/manualRoot write to
  // the active progression step via updateActiveChordAtom (no-op if no active
  // step). null is a meaningful value here (clears the override), so guard only
  // against undefined.
  // Declared AFTER the preset effect so on mount the preset populates steps first; otherwise the quality/manualRoot writes find no active step and no-op.
  useEffect(() => {
    if (config.chordVoicing !== undefined) store.set(voicingAtom, config.chordVoicing);
    if (config.chordPracticeLens !== undefined) store.set(practiceLensAtom, config.chordPracticeLens);
    if (config.activeChordQuality !== undefined) {
      store.set(updateActiveChordAtom, { quality: config.activeChordQuality });
    }
    if (config.activeChordManualRoot !== undefined) {
      store.set(updateActiveChordAtom, { root: config.activeChordManualRoot });
    }
  }, [store, config.chordVoicing, config.chordPracticeLens, config.activeChordQuality, config.activeChordManualRoot]);

  // Keep the latest onEvent without making the subscription effect depend on its
  // identity — hosts often pass an inline arrow, which would otherwise re-subscribe
  // and re-emit the initial snapshot on every host render.
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  // M3: events-out. Subscribe to the isolated store and push coarse, human-speed
  // events to the host. `displayedProgressionStepIndexAtom` already debounces
  // RAF→React via startTransition, so this fires at step boundaries, not per frame.
  useEffect(() => {
    if (!config.progressionEnabled) return;

    const labelOf = (s: { shortChordLabel: string | null; label: string }) =>
      s.shortChordLabel ?? s.label;

    const emitResolved = () => {
      const sink = onEventRef.current;
      if (!sink) return;
      const steps = store.get(resolvedProgressionStepsAtom);
      sink({
        type: "progressionResolved",
        steps: steps.map((s) => ({
          index: s.index,
          degree: String(s.degree),
          label: labelOf(s),
          unavailable: s.unavailable,
        })),
      });
    };
    const emitActive = () => {
      const sink = onEventRef.current;
      if (!sink) return;
      const idx = store.get(displayedProgressionStepIndexAtom);
      const steps = store.get(resolvedProgressionStepsAtom);
      const s = steps[idx];
      sink({ type: "activeStepChanged", index: idx, label: s ? labelOf(s) : "" });
    };
    const emitPlayback = () => {
      const sink = onEventRef.current;
      if (!sink) return;
      sink({
        type: "playbackStateChanged",
        playing: store.get(progressionPlayingAtom),
        loading: store.get(progressionPlaybackLoadingAtom),
        blockedReason: store.get(progressionPlaybackBlockedReasonAtom),
      });
    };

    const unsubs = [
      store.sub(resolvedProgressionStepsAtom, emitResolved),
      store.sub(displayedProgressionStepIndexAtom, emitActive),
      store.sub(progressionPlayingAtom, emitPlayback),
      store.sub(progressionPlaybackLoadingAtom, emitPlayback),
      // blockedReason derives from resolvedProgressionStepsAtom, so a preset load fires emitPlayback alongside emitResolved — intentional.
      store.sub(progressionPlaybackBlockedReasonAtom, emitPlayback),
    ];
    // Initial snapshot so the host renders correct state before the first change.
    emitResolved();
    emitActive();
    emitPlayback();
    return () => unsubs.forEach((u) => u());
  }, [store, config.progressionEnabled]);

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
      {config.progressionEnabled ? <ProgressionPlaybackRunner /> : null}
      <Fretboard stringRowPx={config.stringRowPx} />
    </Provider>
  );
}
