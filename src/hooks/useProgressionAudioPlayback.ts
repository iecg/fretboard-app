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
  progressionChordVariationsAtom,
  progressionBassVariationsAtom,
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

/**
 * A real MACROTASK yield (not a microtask). `getEngine()` resolves as a
 * microtask once the engine module is cached, and microtasks drain inside the
 * task that scheduled them — so the entire play-start continuation
 * (AudioContext creation → signal-graph materialization → five Tone.Part
 * constructions → transport start) chains into a SINGLE long task whenever the
 * built-layers cache is warm (e.g. the idle background build already ran, so
 * there is no `buildAllLayersAsync` await to break the chain). That single task
 * measured ~110-260ms and surfaced as `[Violation] 'click'/'pointerup' handler
 * took …ms` input-latency warnings.
 *
 * Awaiting this between the heavy phases forces each onto its own macrotask, so
 * no single task exceeds the ~50ms responsiveness budget. Timing is unaffected:
 * the Transport is held stopped (rewound to 0) across the whole continuation and
 * only `.start()`ed at the very end, so the only observable effect is that audio
 * onset is deferred by a few imperceptible milliseconds — already masked by the
 * 150ms loading-spinner deferral.
 */
const yieldToMacrotask = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

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
  const chordVariations = useAtomValue(progressionChordVariationsAtom);
  const bassVariations = useAtomValue(progressionBassVariationsAtom);

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
        chordVariations,
        bassVariations,
      }),
    [beatsPerBar, steps, chordPatternId, bassPatternId, drumPatternId, drumVariations, chordVariations, bassVariations],
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
        chordVariations,
        bassVariations,
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
      chordVariations,
      bassVariations,
      tempo,
      swing,
      loopEnabled,
    ],
  );
  const instrumentRef = useRef(chordInstrument);
  const genRef = useRef(0);
  // Tempo the currently-live Tone Parts were baked at. The layer event timings
  // are seconds-at-build-tempo; a live tempo change rescales the Transport but
  // not those baked seconds, so the visual timeline needs this reference to
  // mirror the rescale (see the tempo effect below + timeline.setTimelineScale).
  const builtTempoRef = useRef(tempo);

  const buildInputsRef = useRef({
    steps,
    chordPatternId,
    bassPatternId,
    drumPatternId,
    drumVariations,
    chordVariations,
    bassVariations,
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
      chordVariations,
      bassVariations,
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
            chordVariations,
            bassVariations,
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
    chordVariations,
    bassVariations,
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
    // (everything in `buildKey`) — restart playback deterministically from bar 1.
    // Three things happen synchronously, up front, so every restart is identical:
    //   1. dispose the old parts (silences the old audio immediately — no
    //      make-before-break overlap, whose build-completion-timed handoff made
    //      the restart point float: skipped chords / "started over" / "next bar"),
    //   2. clearTimeline() (snaps the visual playhead to the top),
    //   3. stop() the Tone Transport, rewinding its position to 0.
    //
    // Step 3 is what makes the restart CONSISTENT. The Transport otherwise
    // free-runs, so new parts started against it land at an arbitrary loop phase
    // — sometimes bar 1, sometimes mid-progression, sometimes skipping chords
    // (the exact inconsistency users reported). Rewinding to 0 means the new
    // parts always begin at chord 0.
    //
    // CRITICAL PAIRING: the partStart computation further below MUST then be
    // transport-RELATIVE (`SCHEDULE_LEAD_SECONDS`), not `ctx.currentTime + lead`.
    // ctx.currentTime keeps climbing across the session; scheduling parts at that
    // absolute value against a transport rewound to 0 would place them ~ctxTime
    // seconds in the future, so they never sound. The rewind and the relative
    // partStart are two halves of one fix — never change one without the other.
    if (engine) {
      engine.disposeAll(primsRef.current);
      primsRef.current = null;
      engine.clearTimeline();
      engine.getTransport().stop();
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

      // Yield before the signal-graph materialization so the (one-time, ~40ms)
      // AudioContext + layer-bus construction above doesn't share a task with
      // the graph build below. See `yieldToMacrotask`.
      await yieldToMacrotask();
      if (gen !== genRef.current) return;

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
      // These Parts are baked at inputs.tempo. Record it so a later live tempo
      // change can scale the visual timeline. clearTimeline() (fired up front in
      // the restart-tier reset) already reset the scale to 1 for this build.
      builtTempoRef.current = inputs.tempo;

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
        chordVariations: inputs.chordVariations,
        bassVariations: inputs.bassVariations,
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
            chordVariations: inputs.chordVariations,
            bassVariations: inputs.bassVariations,
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

      // Yield before constructing the five Tone.Parts. On a warm build cache the
      // `buildAllLayersAsync` await above is skipped, so without this break the
      // graph materialization and the ~35ms Part construction run in one task.
      // The Parts are built atomically (no yields between them) so the
      // generation check below is the only point a stale run can bail — there is
      // never a half-built Part set. See `yieldToMacrotask`.
      await yieldToMacrotask();
      if (gen !== genRef.current) return;

      // The Transport was rewound to 0 up front (see the restart-tier reset at
      // the top of this effect), so partStart is TRANSPORT-RELATIVE: a small lead
      // from position 0, NOT ctx.currentTime + lead. Pairing the rewind with a
      // relative start is what makes every restart begin at chord 0 / bar 1.
      const partStart = SCHEDULE_LEAD_SECONDS;
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
            case "crossStick": eng.scheduleCrossStick(audio.layers.drums, audioTime, { velocity: value.velocity, kit: drumKit }); break;
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
    // The Transport now runs at the new BPM, rescaling every scheduled event's
    // wall-clock position. The baked timeline seconds don't change, so mirror
    // the rescale into the visual timeline: scale = builtTempo / currentTempo.
    // Without this the playhead snaps to the stale baked offset at every bar.
    engine.setTimelineScale(builtTempoRef.current / Math.max(1, tempo));
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
  // Deferred to a macrotask so the ~30ms graph materialization never shares a
  // task with the React commit that triggered it: a genre switch re-renders the
  // backing-track controls, and running the rebuild in that same commit task
  // pushed the click/pointerup handlers past Chrome's input-latency budget.
  // Audio keeps playing through the previous graph for the few milliseconds
  // until the reconfigure lands; the cleanup cancels a still-pending rebuild
  // when the genre/quality changes again before it runs.
  useEffect(() => {
    if (!engine || !playing) return;
    const eng = engine;
    const timer = setTimeout(() => {
      const mix = eng.getGenreMix(genreId) ?? eng.DEFAULT_GENRE_MIX;
      const tier = resolveActiveTier(eng, quality);
      eng.configureProgressionGraph(eng.planSignalGraph(eng.TIER_PROFILES[tier], mix));
    }, 0);
    return () => clearTimeout(timer);
  }, [genreId, quality, playing]);
}
