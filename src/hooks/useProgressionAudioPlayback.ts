import { useEffect, useMemo, useRef } from "react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { getNoteFrequency } from "@fretflow/core";
import { audioQualityAtom, isMutedAtom } from "../store/audioAtoms";
import {
  beatsPerBarAtom,
  progressionBassEnabledAtom,
  progressionBassPatternAtom,
  progressionChordEnabledAtom,
  progressionChordInstrumentAtom,
  progressionChordPatternAtom,
  progressionDrumPatternAtom,
  progressionDrumsEnabledAtom,
  progressionDrumVariationsAtom,
  progressionGenreStyleAtom,
  progressionLoopEnabledAtom,
  progressionMetronomeEnabledAtom,
  progressionPlaybackBlockedReasonAtom,
  progressionPlaybackLoadingAtom,
  progressionPlayingAtom,
  progressionSwingAtom,
  progressionTempoBpmAtom,
  resolvedProgressionStepsAtom,
  setProgressionActiveStepIndexAtom,
  setProgressionPlayingAtom,
} from "../store/progressionAtoms";
import type {
  PlaybackPrimitives,
  BassEvent,
  ChordOnsetEvent,
  ChordStrumEvent,
  DrumEvent,
  MetronomeEvent,
  ProgressionPartHandle,
} from "../progressions/audio/progressionAudioEngine";
import type { BuiltLayers } from "../progressions/audio/buildAllLayers";
import { startVisualClock, stopVisualClock } from "../progressions/audio/visualClock";

const SCHEDULE_LEAD_SECONDS = 0.05;

function readLayoutTier(): "mobile" | "tablet" | "desktop" {
  if (typeof document === "undefined") return "desktop";
  const t = document
    .querySelector("[data-layout-tier]")
    ?.getAttribute("data-layout-tier");
  return t === "mobile" || t === "tablet" ? t : "desktop";
}

function resolveActiveTier(
  eng: AudioEngine,
  quality: "auto" | "eco" | "standard" | "high",
) {
  return eng.resolveTier(quality, () =>
    eng.detectDefaultTier({
      cores: navigator.hardwareConcurrency,
      memoryGb: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
      layoutTier: readLayoutTier(),
    }),
  );
}

type AudioEngine = typeof import("../progressions/audio/progressionAudioEngine");

let enginePromise: Promise<AudioEngine> | null = null;
let engine: AudioEngine | null = null;

async function getEngine(): Promise<AudioEngine> {
  if (!enginePromise) {
    enginePromise = import("../progressions/audio/progressionAudioEngine").then((mod) => {
      engine = mod;
      return mod;
    }).catch((err: unknown) => {
      const msg = (err as Error)?.message ?? "";
      // Vitest tears down the jsdom env between tests; an in-flight dynamic
      // import can resolve into that void and reject with one of these
      // messages. They are NOT real failures — the caller bails via the
      // genRef mismatch check — but the rejection still bubbles as an
      // unhandled error and pollutes test output. Swallow them; re-throw
      // anything else.
      if (msg.includes("after the environment was torn down") || msg.includes("Cannot load")) {
        // Reset the promise so a later getEngine() call retries.
        enginePromise = null;
        engine = null;
        return null as unknown as AudioEngine;
      }
      console.error("getEngine import failed:", err);
      throw err;
    });
  }
  return enginePromise;
}

/** Test-only: reset the lazy loader cache so each test starts fresh. */
export function __resetProgressionAudioPlaybackForTests(): void {
  enginePromise = null;
  engine = null;
}

export function useProgressionAudioPlayback() {
  const playing = useAtomValue(progressionPlayingAtom);
  const blocked = useAtomValue(progressionPlaybackBlockedReasonAtom);
  const muted = useAtomValue(isMutedAtom);
  const loopEnabled = useAtomValue(progressionLoopEnabledAtom);
  const steps = useAtomValue(resolvedProgressionStepsAtom);
  const tempo = useAtomValue(progressionTempoBpmAtom);
  const beatsPerBar = useAtomValue(beatsPerBarAtom);
  const swing = useAtomValue(progressionSwingAtom);
  const chordInstrument = useAtomValue(progressionChordInstrumentAtom);
  const chordPatternId = useAtomValue(progressionChordPatternAtom);
  const bassPatternId = useAtomValue(progressionBassPatternAtom);
  const drumPatternId = useAtomValue(progressionDrumPatternAtom);
  const drumVariations = useAtomValue(progressionDrumVariationsAtom);

  const chordOn = useAtomValue(progressionChordEnabledAtom);
  const bassOn = useAtomValue(progressionBassEnabledAtom);
  const drumsOn = useAtomValue(progressionDrumsEnabledAtom);
  const metronomeOn = useAtomValue(progressionMetronomeEnabledAtom);
  const genreId = useAtomValue(progressionGenreStyleAtom);
  const quality = useAtomValue(audioQualityAtom);

  const setActiveStepIndex = useSetAtom(setProgressionActiveStepIndexAtom);
  const setPlaying = useSetAtom(setProgressionPlayingAtom);
  const setLoading = useSetAtom(progressionPlaybackLoadingAtom);
  const store = useStore();

  const primsRef = useRef<PlaybackPrimitives | null>(null);
  const buildKey = useMemo(
    () =>
      JSON.stringify({
        beatsPerBar, // metronome event stream is baked per meter; live changes require rebuild
        steps: steps.map((s) => ({
          root: s.root,
          quality: s.quality,
          dur: s.duration,
          unavailable: s.unavailable ?? false,
        })),
        chordPatternId,
        bassPatternId,
        drumPatternId,
        drumVariations,
      }),
    [beatsPerBar, steps, chordPatternId, bassPatternId, drumPatternId, drumVariations],
  );
  const cacheRef = useRef<{ key: string; value: BuiltLayers } | null>(null);
  const fullCacheKey = useMemo(
    () =>
      JSON.stringify({
        beatsPerBar,
        steps: steps.map((s) => ({
          root: s.root,
          quality: s.quality,
          dur: s.duration,
          unavailable: s.unavailable ?? false,
        })),
        chordPatternId,
        bassPatternId,
        drumPatternId,
        drumVariations,
        tempo,
        swing,
        loopEnabled,
      }),
    [
      beatsPerBar,
      steps,
      chordPatternId,
      bassPatternId,
      drumPatternId,
      drumVariations,
      tempo,
      swing,
      loopEnabled,
    ],
  );
  const instrumentRef = useRef(chordInstrument);
  const genRef = useRef(0);

  const buildInputsRef = useRef({
    steps,
    chordPatternId,
    bassPatternId,
    drumPatternId,
    drumVariations,
    tempo,
    beatsPerBar,
    swing,
    loopEnabled,
  });
  // Mirror the freshest input snapshot into a ref so Effect 1's `.then()`
  // closure reads up-to-date values when the dynamic import resolves.
  // IMPORTANT: do NOT bump `genRef` here. genRef is the bail token for the
  // in-flight import; bumping it on every render (including the re-render
  // caused by setLoading(true) inside Effect 1) makes the still-pending
  // `.then()` always see gen !== genRef.current and silently abort.
  useEffect(() => {
    buildInputsRef.current = {
      steps,
      chordPatternId,
      bassPatternId,
      drumPatternId,
      drumVariations,
      tempo,
      beatsPerBar,
      swing,
      loopEnabled,
    };
  });

  // Debounced background compilation during idle time.
  useEffect(() => {
    let isMounted = true;
    if (playing || blocked || muted) return;

    const runBackgroundBuild = () => {
      // Avoid rebuilding if already cached.
      if (cacheRef.current && cacheRef.current.key === fullCacheKey) {
        return;
      }

      getEngine().then(async (eng) => {
        if (!isMounted) return;
        if (eng === null) return;
        // Verify playing hasn't started in the meantime.
        if (store.get(progressionPlayingAtom)) return;

        try {
          const built = await eng.buildAllLayersAsync({
            steps,
            tempoBpm: tempo,
            beatsPerBar,
            swing,
            chordPatternId,
            bassPatternId,
            drumPatternId,
            drumVariations,
            loop: loopEnabled,
          });

          if (!isMounted) return;
          // Verify playing hasn't started in the meantime before caching.
          if (store.get(progressionPlayingAtom)) return;

          cacheRef.current = {
            key: fullCacheKey,
            value: built,
          };
        } catch (err) {
          console.error("Background audio build failed:", err);
        }
      }).catch((err) => {
        console.error("Background getEngine failed:", err);
      });
    };

    const timer = setTimeout(runBackgroundBuild, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    playing,
    blocked,
    muted,
    fullCacheKey,
    steps,
    tempo,
    beatsPerBar,
    swing,
    chordPatternId,
    bassPatternId,
    drumPatternId,
    drumVariations,
    loopEnabled,
    store,
  ]);

  // Dedicated unmount cleanup to catch the case where the component is unmounted
  // while audio is still playing.
  useEffect(() => {
    return () => {
      stopVisualClock();
      if (engine) engine.getDraw().cancel?.();
      engine?.disposeAll(primsRef.current);
      primsRef.current = null;
      engine?.silenceProgressionBus();
      setLoading(false);
    };
  }, [setLoading]);

  useEffect(() => {
    const tearDownAndStop = () => {
      stopVisualClock();
      engine?.disposeAll(primsRef.current);
      primsRef.current = null;
      if (engine) engine.silenceProgressionBus();
      engine?.clearTimeline();
      setLoading(false);
    };

    if (blocked || muted) { tearDownAndStop(); return; }
    if (!playing) { tearDownAndStop(); engine?.pauseTimeline(); return; }
    startVisualClock(store);

    const gen = ++genRef.current;

    // Restart-tier reset: whenever this effect re-runs while playing — a
    // style/genre swap, pattern change, chord edit, or time-signature change
    // (everything in `buildKey`) — tear the old audio down *up front* so the
    // switch is deterministic. Disposing the old parts here silences the old
    // audio immediately instead of letting it play through until the async
    // rebuild lands (the old make-before-break swap, whose build-completion-timed
    // handoff made the restart point float — skipped chords / "started over" /
    // "next bar" at random). `clearTimeline()` snaps the visual playhead to the
    // top; the new parts below start at offset 0, so playback restarts cleanly
    // from bar 1 once compiled.
    //
    // Do NOT stop or rewind the Tone Transport here. Parts are scheduled at an
    // absolute AudioContext time (`partStart = ctx.currentTime + lead`), and the
    // Transport runs continuously from first play so its position tracks that
    // clock. Rewinding the Transport to 0 (via stop) while `partStart` stays at
    // the (large) current ctx time would schedule the freshly-built parts far in
    // the future, so they never sound — playback silently dies and never restarts.
    if (engine) {
      engine.disposeAll(primsRef.current);
      primsRef.current = null;
      engine.clearTimeline();
    }

    // Defer the loading spinner to prevent rapid UI flashing for fast rebuilds
    // In test mode, we make it synchronous to satisfy strict test assertions.
    let loadingTimer: ReturnType<typeof setTimeout> | undefined;
    if (import.meta.env.MODE === "test") {
      setLoading(true);
    } else {
      loadingTimer = setTimeout(() => {
        if (gen === genRef.current) setLoading(true);
      }, 150);
    }

    getEngine().then(async (eng) => {
      if (eng === null) return;
      if (gen !== genRef.current) return;
      const audio = eng.ensureProgressionAudio();
      if (!audio) { tearDownAndStop(); return; }
      eng.resumeProgressionAudio();
      eng.restoreProgressionBus();
      eng.setLayerGain(audio.layers, "chord", store.get(progressionChordEnabledAtom));
      eng.setLayerGain(audio.layers, "bass", store.get(progressionBassEnabledAtom));
      eng.setLayerGain(audio.layers, "drums", store.get(progressionDrumsEnabledAtom));
      eng.setLayerGain(audio.layers, "metronome", store.get(progressionMetronomeEnabledAtom));

      const mix = eng.getGenreMix(store.get(progressionGenreStyleAtom)) ?? eng.DEFAULT_GENRE_MIX;
      const tier = resolveActiveTier(eng, store.get(audioQualityAtom));
      eng.configureProgressionGraph(eng.planSignalGraph(eng.TIER_PROFILES[tier], mix));
      const bassPatch = eng.getBassPatch(mix.patches.bass);
      const drumKit = eng.getDrumKitPatch(mix.patches.drumKit);
      const chordPatchId = mix.patches.chord;

      const inputs = buildInputsRef.current;

      // Apply tempo/swing/time-signature BEFORE constructing Parts so
      // Tone.Part's seconds→ticks conversion uses the user-selected BPM, not
      // Tone's default (120 BPM). On first play, the live tempo/swing effects fire while the
      // engine is still loading (`if (!engine) return;`), so the Transport
      // sits at its defaults until the user nudges any of these values.
      // Initializing them here closes that gap — all five Parts (chord-onset,
      // chord-strum, bass, drums, metronome) share the same tick rate from
      // beat 1, eliminating the desync the user reported.
      eng.setPlaybackTempo(inputs.tempo);
      eng.setPlaybackSwing(inputs.swing);
      eng.setPlaybackTimeSignature(inputs.beatsPerBar);

      let built;
      const currentCacheKey = JSON.stringify({
        beatsPerBar: inputs.beatsPerBar,
        steps: inputs.steps.map((s) => ({
          root: s.root,
          quality: s.quality,
          dur: s.duration,
          unavailable: s.unavailable ?? false,
        })),
        chordPatternId: inputs.chordPatternId,
        bassPatternId: inputs.bassPatternId,
        drumPatternId: inputs.drumPatternId,
        drumVariations: inputs.drumVariations,
        tempo: inputs.tempo,
        swing: inputs.swing,
        loopEnabled: inputs.loopEnabled,
      });

      if (cacheRef.current && cacheRef.current.key === currentCacheKey) {
        built = cacheRef.current.value;
      } else {
        try {
          built = await eng.buildAllLayersAsync({
            steps: inputs.steps,
            tempoBpm: inputs.tempo,
            beatsPerBar: inputs.beatsPerBar,
            swing: inputs.swing,
            chordPatternId: inputs.chordPatternId,
            bassPatternId: inputs.bassPatternId,
            drumPatternId: inputs.drumPatternId,
            drumVariations: inputs.drumVariations,
            loop: inputs.loopEnabled,
          });
          cacheRef.current = {
            key: currentCacheKey,
            value: built,
          };
        } catch (err) {
          console.error("Audio build failed", err);
          clearTimeout(loadingTimer);
          setLoading(false);
          return;
        }
      }
      
      clearTimeout(loadingTimer);
      if (gen !== genRef.current) return;
      if (built.chordOnsets.length === 0) { tearDownAndStop(); return; }

      // Old parts and timeline were already disposed/cleared up front (see the
      // restart-tier reset at the top of this effect). The Transport keeps
      // running; the new Parts below start at offset 0 to restart from bar 1.
      const partStart = audio.ctx.currentTime + SCHEDULE_LEAD_SECONDS;
      const parts: ProgressionPartHandle[] = [];
      const totalDurationSec = built.totalDurationSec;

      let hasFiredOnce = false;
      const chordOnsetPart = eng.createProgressionPart<ChordOnsetEvent>({
        events: built.chordOnsets, loop: inputs.loopEnabled, loopEnd: totalDurationSec,
        onEvent: (audioTime, event) => {
          eng.setActiveStep(event.stepIndex, audioTime, event.durationSec, event.cumulativeStartSec, totalDurationSec);
          eng.getDraw().schedule(() => {
            if (!hasFiredOnce) { hasFiredOnce = true; setLoading(false); }
            if (event.isFirstBar) {
              setActiveStepIndex(event.stepIndex);
            }
          }, audioTime);
        },
      });
      chordOnsetPart.start(partStart, 0);
      parts.push(chordOnsetPart);

      const chordStrumPart = eng.createProgressionPart<ChordStrumEvent>({
        events: built.chordStrums, loop: inputs.loopEnabled, loopEnd: totalDurationSec,
        onEvent: (audioTime, value) => {
          const voice = eng.getChordVoiceForInstrument(instrumentRef.current, chordPatchId);
          voice.scheduleChord(audio.layers.chord, value.voicing, audioTime, {
            velocity: value.velocity, style: value.style, direction: value.direction, durationSec: value.durationSec,
          });
        },
      });
      chordStrumPart.start(partStart, 0);
      parts.push(chordStrumPart);

      const bassPart = eng.createProgressionPart<BassEvent>({
        events: built.bass, loop: inputs.loopEnabled, loopEnd: totalDurationSec,
        onEvent: (audioTime, value) => {
          const freq = getNoteFrequency(value.note);
          if (!Number.isFinite(freq) || freq <= 0) return;
          eng.scheduleBassNote(audio.layers.bass, freq, audioTime, { velocity: value.velocity, durationSec: value.durationSec, patch: bassPatch });
        },
      });
      bassPart.start(partStart, 0);
      parts.push(bassPart);

      const drumPart = eng.createProgressionPart<DrumEvent>({
        events: built.drums, loop: inputs.loopEnabled, loopEnd: totalDurationSec,
        onEvent: (audioTime, value) => {
          switch (value.type) {
            case "kick": eng.scheduleKick(audio.layers.drums, audioTime, { velocity: value.velocity, kit: drumKit }); break;
            case "snare": eng.scheduleSnare(audio.layers.drums, audioTime, { velocity: value.velocity, kit: drumKit }); break;
            case "hihat": eng.scheduleHiHat(audio.layers.drums, audioTime, { velocity: value.velocity, kit: drumKit }); break;
            case "openHat": eng.scheduleHiHat(audio.layers.drums, audioTime, { velocity: value.velocity, open: true, kit: drumKit }); break;
            case "ride": eng.scheduleRide(audio.layers.drums, audioTime, { velocity: value.velocity, kit: drumKit }); break;
          }
        },
      });
      drumPart.start(partStart, 0);
      parts.push(drumPart);

      // 5. Metronome Part — explicit per-beat events spanning totalDurationSec
      //    so the loop wraps in lock-step with the chord/bass/drum parts.
      //    Replaces the prior Tone.Loop("4n", ...) which fired on an
      //    independent schedule and clicked past the loop end whenever
      //    totalDurationSec didn't fall on a quarter-note boundary.
      const metronomePart = eng.createProgressionPart<MetronomeEvent>({
        events: built.metronome,
        loop: inputs.loopEnabled,
        loopEnd: totalDurationSec,
        onEvent: (audioTime, value) => {
          eng.scheduleClick(audio.layers.metronome, audioTime, {
            accent: value.beatInBar === 1,
          });
        },
      });
      metronomePart.start(partStart, 0);
      parts.push(metronomePart);

      eng.getTransport().start();

      let endEventId: number | null = null;
      if (!inputs.loopEnabled) {
        endEventId = eng.getTransport().scheduleOnce(
          () => setPlaying(false),
          `+${totalDurationSec + SCHEDULE_LEAD_SECONDS}`,
        );
      }

      primsRef.current = { parts, endEventId, totalDurationSec };
    }).catch((err) => {
      console.error("Playback getEngine failed:", err);
      if (gen !== genRef.current) return;
      tearDownAndStop();
      setPlaying(false);
    });

    const genRefSnapshot = genRef;
    return () => {
      clearTimeout(loadingTimer);
      // Bumping genRef in cleanup IS the point — it invalidates any still-
      // pending `getEngine().then(...)` so it bails instead of building Parts
      // after teardown. The snapshot variable above captures the ref object
      // for lint's exhaustive-deps check (which would otherwise warn).
      genRefSnapshot.current++;
      
      // Audio is NOT disposed here. The next effect run handles teardown: a
      // restart-tier change disposes + rewinds up front (see the reset block at
      // the top of this effect), and a stop (`playing` false) hits the
      // `tearDownAndStop()` early-return branch. Cleanup's only job is bumping
      // `genRef` to invalidate any in-flight build.
    };
  }, [
    playing,
    blocked,
    muted,
    buildKey,
    setActiveStepIndex,
    setPlaying,
    setLoading,
    store,
  ]);

  useEffect(() => {
    if (!engine) return;
    engine.setPlaybackTempo(tempo);
  }, [tempo]);

  useEffect(() => {
    if (!engine) return;
    engine.setPlaybackSwing(swing);
  }, [swing]);

  useEffect(() => {
    instrumentRef.current = chordInstrument;
  }, [chordInstrument]);

  useEffect(() => {
    if (!engine) return;
    const audio = engine.ensureProgressionAudio();
    if (!audio) return;
    engine.setLayerGain(audio.layers, "chord", chordOn);
    engine.setLayerGain(audio.layers, "bass", bassOn);
    engine.setLayerGain(audio.layers, "drums", drumsOn);
    engine.setLayerGain(audio.layers, "metronome", metronomeOn);
  }, [chordOn, bassOn, drumsOn, metronomeOn]);

  useEffect(() => {
    if (!engine) return;
    const prims = primsRef.current;
    if (!prims) return;
    const { totalDurationSec } = prims;
    prims.parts.forEach((p) => p.setLoop(loopEnabled, totalDurationSec));
    if (loopEnabled) {
      if (prims.endEventId !== null) {
        engine.getTransport().clear(prims.endEventId);
        prims.endEventId = null;
      }
    } else {
      if (prims.endEventId === null && totalDurationSec > 0) {
        const transport = engine.getTransport() as unknown as { seconds: number };
        const elapsedInLoop = transport.seconds % totalDurationSec;
        const remaining = totalDurationSec - elapsedInLoop;
        prims.endEventId = engine.getTransport().scheduleOnce(
          () => setPlaying(false),
          `+${remaining + SCHEDULE_LEAD_SECONDS}`,
        );
      }
    }
  }, [loopEnabled, setPlaying]);

  // Quality/genre change → rebuild the mix graph in place (no Part rebuild).
  useEffect(() => {
    if (!engine || !playing) return;
    const eng = engine;
    const mix = eng.getGenreMix(genreId) ?? eng.DEFAULT_GENRE_MIX;
    const tier = resolveActiveTier(eng, quality);
    eng.configureProgressionGraph(eng.planSignalGraph(eng.TIER_PROFILES[tier], mix));
  }, [genreId, quality, playing]);
}
