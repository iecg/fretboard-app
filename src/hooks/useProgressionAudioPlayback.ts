import { useEffect, useMemo, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { getNoteFrequency } from "@fretflow/core";
import { isMutedAtom } from "../store/audioAtoms";
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
  ProgressionPartHandle,
} from "../progressions/audio/progressionAudioEngine";

const SCHEDULE_LEAD_SECONDS = 0.05;

type AudioEngine = typeof import("../progressions/audio/progressionAudioEngine");

let enginePromise: Promise<AudioEngine> | null = null;
let engine: AudioEngine | null = null;

async function getEngine(): Promise<AudioEngine> {
  if (!enginePromise) {
    enginePromise = import("../progressions/audio/progressionAudioEngine").then((mod) => {
      engine = mod;
      return mod;
    }).catch((err) => {
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

  const setActiveStepIndex = useSetAtom(setProgressionActiveStepIndexAtom);
  const setPlaying = useSetAtom(setProgressionPlayingAtom);
  const setLoading = useSetAtom(progressionPlaybackLoadingAtom);

  const primsRef = useRef<PlaybackPrimitives | null>(null);
  const buildKey = useMemo(
    () =>
      JSON.stringify({
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
    [steps, chordPatternId, bassPatternId, drumPatternId, drumVariations],
  );
  const instrumentRef = useRef(chordInstrument);
  const beatsPerBarRef = useRef(beatsPerBar);
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

  useEffect(() => {
    const tearDown = () => {
      engine?.disposeAll(primsRef.current);
      primsRef.current = null;
      if (engine) engine.silenceProgressionBus();
      engine?.clearTimeline();
      setLoading(false);
    };

    if (blocked || muted) { tearDown(); return; }
    if (!playing) { tearDown(); engine?.pauseTimeline(); return; }

    const gen = ++genRef.current;
    setLoading(true);

    getEngine().then((eng) => {
      if (gen !== genRef.current) return;
      const audio = eng.ensureProgressionAudio();
      if (!audio) { tearDown(); return; }
      eng.resumeProgressionAudio();
      eng.restoreProgressionBus();

      const inputs = buildInputsRef.current;

      // Apply tempo/swing/time-signature BEFORE constructing Parts so
      // Tone.Part's seconds→ticks conversion uses the user-selected BPM, not
      // Tone's default (120 BPM). On first play, Effects 2-4 fire while the
      // engine is still loading (`if (!engine) return;`), so the Transport
      // sits at its defaults until the user nudges any of these values.
      // Initializing them here closes that gap — the metronome Loop("4n")
      // and the chord/bass/drum Parts then share the same tick rate from
      // beat 1, eliminating the desync the user reported.
      eng.setPlaybackTempo(inputs.tempo);
      eng.setPlaybackSwing(inputs.swing);
      eng.setPlaybackTimeSignature(inputs.beatsPerBar);

      const built = eng.buildAllLayers({
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
      if (built.chordOnsets.length === 0) { tearDown(); return; }

      const partStart = audio.ctx.currentTime + SCHEDULE_LEAD_SECONDS;
      const parts: ProgressionPartHandle[] = [];
      const totalDurationSec = built.totalDurationSec;

      let hasFiredOnce = false;
      const chordOnsetPart = eng.createProgressionPart<ChordOnsetEvent>({
        events: built.chordOnsets, loop: inputs.loopEnabled, loopEnd: totalDurationSec,
        onEvent: (audioTime, event) => {
          if (!hasFiredOnce) { hasFiredOnce = true; setLoading(false); }
          eng.setActiveStep(event.stepIndex, audioTime, event.durationSec, event.cumulativeStartSec, totalDurationSec);
          if (event.isFirstBar) {
            eng.getDraw().schedule(() => setActiveStepIndex(event.stepIndex), audioTime);
          }
        },
      });
      chordOnsetPart.start(partStart, 0);
      parts.push(chordOnsetPart);

      const chordStrumPart = eng.createProgressionPart<ChordStrumEvent>({
        events: built.chordStrums, loop: inputs.loopEnabled, loopEnd: totalDurationSec,
        onEvent: (audioTime, value) => {
          const voice = eng.getChordVoice(instrumentRef.current);
          voice.scheduleChord(audio.layers.chord, value.voicing, audioTime, {
            velocity: value.velocity, style: value.style, direction: value.direction,
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
          eng.scheduleBassNote(audio.layers.bass, freq, audioTime, { velocity: value.velocity });
        },
      });
      bassPart.start(partStart, 0);
      parts.push(bassPart);

      const drumPart = eng.createProgressionPart<DrumEvent>({
        events: built.drums, loop: inputs.loopEnabled, loopEnd: totalDurationSec,
        onEvent: (audioTime, value) => {
          switch (value.type) {
            case "kick": eng.scheduleKick(audio.layers.drums, audioTime, { velocity: value.velocity }); break;
            case "snare": eng.scheduleSnare(audio.layers.drums, audioTime, { velocity: value.velocity }); break;
            case "hihat": eng.scheduleHiHat(audio.layers.drums, audioTime, { velocity: value.velocity }); break;
            case "openHat": eng.scheduleHiHat(audio.layers.drums, audioTime, { velocity: value.velocity, open: true }); break;
            case "ride": eng.scheduleRide(audio.layers.drums, audioTime, { velocity: value.velocity }); break;
          }
        },
      });
      drumPart.start(partStart, 0);
      parts.push(drumPart);

      let beatCounter = 0;
      const metronome = eng.createMetronomeLoop({
        beatsPerBar: beatsPerBarRef.current,
        onBeat: (beatTime) => {
          beatCounter = (beatCounter % beatsPerBarRef.current) + 1;
          eng.scheduleClick(audio.layers.metronome, beatTime, { accent: beatCounter === 1 });
        },
      });
      metronome.start(partStart);

      eng.getTransport().start();

      let endEventId: number | null = null;
      if (!inputs.loopEnabled) {
        endEventId = eng.getTransport().scheduleOnce(
          () => setPlaying(false),
          `+${totalDurationSec + SCHEDULE_LEAD_SECONDS}`,
        );
      }

      primsRef.current = { parts, loop: metronome, endEventId, totalDurationSec };
    });

    const genRefSnapshot = genRef;
    return () => {
      // Bumping genRef in cleanup IS the point — it invalidates any still-
      // pending `getEngine().then(...)` so it bails instead of building Parts
      // after teardown. The snapshot variable above captures the ref object
      // for lint's exhaustive-deps check (which would otherwise warn).
      genRefSnapshot.current++;
      if (engine) engine.getDraw().cancel();
      engine?.disposeAll(primsRef.current);
      primsRef.current = null;
      setLoading(false);
    };
  }, [
    playing,
    blocked,
    muted,
    buildKey,
    setActiveStepIndex,
    setPlaying,
    setLoading,
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
    beatsPerBarRef.current = beatsPerBar;
    if (!engine) return;
    engine.setPlaybackTimeSignature(beatsPerBar);
  }, [beatsPerBar]);

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
}
