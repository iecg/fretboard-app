import { useCallback, useEffect, useRef } from "react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { getNoteFrequency } from "@fretflow/core";
import { audioQualityAtom, isMutedAtom } from "../store/audioAtoms";
import {
  auditionActiveAtom,
  auditionDisplayIndexAtom,
  auditionRequestTickAtom,
  beatsPerBarAtom,
  progressionBassEnabledAtom,
  progressionBassPatternAtom,
  progressionBassVariationsAtom,
  progressionChordEnabledAtom,
  progressionChordPatternAtom,
  progressionChordVariationsAtom,
  progressionDrumPatternAtom,
  progressionDrumVariationsAtom,
  progressionGenreStyleAtom,
  progressionPlayingAtom,
  progressionSwingAtom,
  progressionTempoBpmAtom,
  resolvedProgressionStepsAtom,
} from "../store/progressionAtoms";
import { ensureToneStarted } from "../core/toneInit";

type AudioEngine = typeof import("../progressions/audio/progressionAudioEngine");

let enginePromise: Promise<AudioEngine> | null = null;

/** Lazy engine loader — mirrors the pattern in `useProgressionAudioPlayback`.
 *  ES modules are cached, so this resolves to the same module instance the
 *  playback hook loads. */
async function getEngine(): Promise<AudioEngine | null> {
  if (!enginePromise) {
    enginePromise = import("../progressions/audio/progressionAudioEngine")
      .catch((err: unknown) => {
        const msg = (err as Error)?.message ?? "";
        // jsdom teardown between tests can reject an in-flight import; treat as
        // a soft miss so a later call retries (matches the playback hook).
        if (msg.includes("after the environment was torn down") || msg.includes("Cannot load")) {
          enginePromise = null;
          return null as unknown as AudioEngine;
        }
        throw err;
      });
  }
  return enginePromise;
}

/** Test-only: reset the lazy loader cache so each test starts fresh. */
export function __resetChordAuditionForTests(): void {
  enginePromise = null;
}

function readLayoutTier(): "mobile" | "tablet" | "desktop" {
  if (typeof document === "undefined") return "desktop";
  const t = document
    .querySelector("[data-layout-tier]")
    ?.getAttribute("data-layout-tier");
  return t === "mobile" || t === "tablet" ? t : "desktop";
}

// A small lead so the first scheduled chord lands just ahead of the audio clock.
const AUDITION_LEAD_SECONDS = 0.06;

// Each previewed chord plays for one beat — a quick sketch of the progression
// rather than each chord's real (possibly multi-bar) length.
const PREVIEW_BEATS_PER_CHORD = 1;

/**
 * Chord preview — plays the whole progression as a quick one-beat-per-chord
 * sketch (chord + bass), so the user can hear the full harmonic flow in a few
 * seconds and see (via the moving highlight) where the selected chord sits.
 *
 * Deliberately self-contained: reuses the engine's pure builder
 * (`buildAllLayersAsync`) and its chord/bass voices, but does NOT touch the
 * Tone Transport, the visual clock, or `progressionPlaying` state — those
 * carry the fragile restart/rewind invariants of full playback. Preview is
 * mutually exclusive with playback (the editor is locked while playing), so a
 * lighter, transport-free path is correct and far lower risk.
 *
 * Mounted once alongside `useProgressionAudioPlayback`.
 */
export function useChordAudition(): void {
  const store = useStore();
  const tick = useAtomValue(auditionRequestTickAtom);
  const playing = useAtomValue(progressionPlayingAtom);
  const setAuditionActive = useSetAtom(auditionActiveAtom);
  const setAuditionDisplayIndex = useSetAtom(auditionDisplayIndexAtom);

  // genRef is the bail token: any in-flight async run whose captured gen no
  // longer matches aborts before scheduling. timersRef holds every pending
  // timeout (loop re-arm + per-step highlight advances) so stop clears them all.
  const genRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stopAudition = useCallback(() => {
    genRef.current++;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setAuditionActive(false);
    setAuditionDisplayIndex(null);
  }, [setAuditionActive, setAuditionDisplayIndex]);

  const runAudition = useCallback(() => {
    // Toggle semantics: a request while a preview is sounding stops it.
    if (store.get(auditionActiveAtom)) {
      stopAudition();
      return;
    }
    // Gate: never preview over live playback or while muted.
    if (store.get(progressionPlayingAtom) || store.get(isMutedAtom)) return;

    const steps = store.get(resolvedProgressionStepsAtom);
    const beatsPerBar = store.get(beatsPerBarAtom);
    const tempoBpm = store.get(progressionTempoBpmAtom);

    // Preview the WHOLE progression as a quick sketch: every playable chord
    // coerced to a single beat. Lets the user hear the full harmonic flow in a
    // few seconds and see (via the moving highlight) where the selected chord
    // fits in the bigger picture — without sitting through each chord's real
    // (possibly multi-bar) length.
    const windowEntries: { index: number; step: (typeof steps)[number] }[] = [];
    for (let i = 0; i < steps.length; i += 1) {
      const s = steps[i]!;
      if (!s.unavailable && s.root != null && s.quality != null) {
        windowEntries.push({
          index: i,
          step: { ...s, duration: { value: PREVIEW_BEATS_PER_CHORD, unit: "beat" } },
        });
      }
    }
    if (windowEntries.length === 0) return;
    const windowSteps = windowEntries.map((e) => e.step);

    // One beat per chord → each step starts secondsPerBeat after the previous.
    const secondsPerBeat = (60 / Math.max(1, tempoBpm)) * PREVIEW_BEATS_PER_CHORD;
    const stepStartOffsetsSec = windowSteps.map((_, i) => i * secondsPerBeat);

    const gen = ++genRef.current;

    void (async () => {
      const eng = await getEngine();
      if (!eng || gen !== genRef.current) return;
      if (store.get(progressionPlayingAtom) || store.get(isMutedAtom)) return;

      const audio = eng.ensureProgressionAudio();
      if (!audio) return;
      try { await ensureToneStarted(); } catch { /* best-effort */ }
      if (gen !== genRef.current) return;
      await eng.resumeProgressionAudio();
      if (gen !== genRef.current || audio.ctx.state !== "running") return;

      eng.restoreProgressionBus();
      const mix = eng.getGenreMix(store.get(progressionGenreStyleAtom)) ?? eng.DEFAULT_GENRE_MIX;
      const tier = eng.resolveTier(store.get(audioQualityAtom), () =>
        eng.detectDefaultTier({
          cores: navigator.hardwareConcurrency,
          memoryGb: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
          layoutTier: readLayoutTier(),
        }),
      );
      eng.configureProgressionGraph(eng.planSignalGraph(eng.TIER_PROFILES[tier], mix));
      // Sync the two layers we schedule into to their enabled state (matches
      // playback start). Drums/metronome are intentionally left out — a clean
      // chord+bass audition is best for deciding a chord.
      eng.setLayerGain(audio.layers, "chord", store.get(progressionChordEnabledAtom));
      eng.setLayerGain(audio.layers, "bass", store.get(progressionBassEnabledAtom));

      const built = await eng.buildAllLayersAsync({
        steps: windowSteps,
        tempoBpm,
        beatsPerBar,
        swing: store.get(progressionSwingAtom),
        chordPatternId: store.get(progressionChordPatternAtom),
        bassPatternId: store.get(progressionBassPatternAtom),
        drumPatternId: store.get(progressionDrumPatternAtom),
        drumVariations: store.get(progressionDrumVariationsAtom),
        chordVariations: store.get(progressionChordVariationsAtom),
        bassVariations: store.get(progressionBassVariationsAtom),
        loop: false,
      });
      if (gen !== genRef.current) return;
      if (built.chordStrums.length === 0 && built.bass.length === 0) return;

      const chordPatchId = mix.patches.chord;
      const bassPatch = eng.getBassPatch(mix.patches.bass);

      // Schedule one pass of the window, chord + bass, at absolute audio times
      // relative to `base`. Mirrors the Part onEvent callbacks in the playback
      // hook, minus the Tone.Part wrapper.
      const scheduleCycle = (base: number) => {
        const voice = eng.getChordVoice(chordPatchId);
        for (const ev of built.chordStrums) {
          voice.scheduleChord(audio.layers.chord, ev.value.voicing, base + ev.time, {
            velocity: ev.value.velocity,
            style: ev.value.style,
            durationSec: ev.value.durationSec,
          });
        }
        for (const ev of built.bass) {
          const freq = getNoteFrequency(ev.value.note);
          if (!Number.isFinite(freq) || freq <= 0) continue;
          eng.scheduleBassNote(audio.layers.bass, freq, base + ev.time, {
            velocity: ev.value.velocity,
            durationSec: ev.value.durationSec,
            patch: bassPatch,
          });
        }
      };

      // Advance the moving highlight: one timer per step, landing with its audio
      // onset (lead + the step's offset).
      const leadMs = AUDITION_LEAD_SECONDS * 1000;
      windowEntries.forEach((entry, i) => {
        timersRef.current.push(
          setTimeout(() => {
            if (gen !== genRef.current) return;
            setAuditionDisplayIndex(entry.index);
          }, leadMs + stepStartOffsetsSec[i]! * 1000),
        );
      });

      scheduleCycle(audio.ctx.currentTime + AUDITION_LEAD_SECONDS);
      setAuditionActive(true);

      // Clear the playing state + highlight when the quick phrase finishes.
      timersRef.current.push(
        setTimeout(() => {
          if (gen !== genRef.current) return;
          setAuditionActive(false);
          setAuditionDisplayIndex(null);
        }, leadMs + built.totalDurationSec * 1000),
      );
    })();
  }, [store, setAuditionActive, setAuditionDisplayIndex, stopAudition]);

  // Fire an audition whenever the request tick advances. tick === 0 is the
  // initial mount (no request yet) — skip it.
  useEffect(() => {
    if (tick === 0) return;
    runAudition();
  }, [tick, runAudition]);

  // Stop any audition the moment full playback starts (they are exclusive).
  useEffect(() => {
    if (playing) stopAudition();
  }, [playing, stopAudition]);

  // Unmount cleanup.
  useEffect(() => {
    return () => stopAudition();
  }, [stopAudition]);
}
