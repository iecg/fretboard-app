import { useEffect, useMemo, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { getContext, getTransport } from "tone";
import {
  ensureProgressionAudio,
  resumeProgressionAudio,
  restoreProgressionBus,
  silenceProgressionBus,
} from "../progressions/audio/bus";
import {
  buildAllLayers,
  type BassEvent,
  type ChordOnsetEvent,
  type ChordStrumEvent,
  type DrumEvent,
} from "../progressions/audio/buildAllLayers";
import {
  createMetronomeLoop,
  type MetronomeLoopHandle,
} from "../progressions/audio/progressionMetronomeLoop";
import {
  createProgressionPart,
  type ProgressionPartHandle,
} from "../progressions/audio/progressionPart";
import { setLayerGain } from "../progressions/audio/layerBuses";
import { getChordVoice } from "../progressions/audio/instruments";
import { scheduleBassNote } from "../progressions/audio/bass";
import {
  scheduleHiHat,
  scheduleKick,
  scheduleRide,
  scheduleSnare,
} from "../progressions/audio/drumKit";
import { scheduleClick } from "../progressions/audio/metronome";
import {
  clearTimeline,
  pauseTimeline,
  setActiveStep,
} from "../progressions/audio/timeline";
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
  progressionPlayingAtom,
  progressionSwingAtom,
  progressionTempoBpmAtom,
  resolvedProgressionStepsAtom,
  setProgressionActiveStepIndexAtom,
  setProgressionPlayingAtom,
} from "../store/progressionAtoms";

/** Lead between scheduling and audible hit; keeps Web Audio from dropping
 *  the first event when `currentTime` and "now" are the same sample. */
const SCHEDULE_LEAD_SECONDS = 0.05;

interface PlaybackPrimitives {
  parts: ProgressionPartHandle[];
  loop: MetronomeLoopHandle | null;
  endEventId: number | null;
}

function disposeAll(prims: PlaybackPrimitives | null) {
  if (!prims) return;
  prims.parts.forEach((p) => p.dispose());
  prims.loop?.dispose();
  if (prims.endEventId !== null) {
    getTransport().clear(prims.endEventId);
  }
}

/**
 * Tone-native progression playback orchestrator.
 *
 * Seven effects, ordered by cost:
 *  1. (Heavy)   Build / dispose primitives on changes that change WHICH
 *               events fire: playing, blocked, muted, steps, patterns,
 *               drum variations. Restart from bar 0.
 *  2. (Live)    Tempo  — Transport.bpm.value = N (events stored as ticks).
 *  3. (Live)    Swing  — Transport.swing = X.
 *  4. (Live)    Loop   — part.setLoop(bool, loopEnd?) on every Part.
 *  5. (Live)    Time signature — Transport.timeSignature = N + ref read
 *               by the metronome Loop callback for accent cycling.
 *  6. (Live)    Instrument — write to instrumentRef; the chord-strum
 *               Part callback reads via the ref each tick.
 *  7. (Live)    Layer mutes — setLayerGain(buses, layer, on/off).
 *
 * Live updates apply mid-bar with no audio glitch. Step / pattern edits
 * fall through Effect 1's full rebuild path.
 *
 * The chord-onset Part owns the React activeProgressionStepIndex advance,
 * deferred by the Tone lookahead via plain setTimeout so the visual
 * chord-overlay swap aligns with audio onset. NOT Tone.Draw.schedule —
 * its 250ms expiration silently drops events under heavy main-thread
 * load and would stall playback. NOT startTransition — it would defer
 * the Jotai write that the next-step React state depends on.
 */
export function useProgressionAudioPlayback() {
  // Read every relevant atom at the top so deps arrays stay tidy.
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

  // Layer enable flags — light effect only.
  const chordOn = useAtomValue(progressionChordEnabledAtom);
  const bassOn = useAtomValue(progressionBassEnabledAtom);
  const drumsOn = useAtomValue(progressionDrumsEnabledAtom);
  const metronomeOn = useAtomValue(progressionMetronomeEnabledAtom);

  const setActiveStepIndex = useSetAtom(setProgressionActiveStepIndexAtom);
  const setPlaying = useSetAtom(setProgressionPlayingAtom);

  const primsRef = useRef<PlaybackPrimitives | null>(null);
  // Stable structural key of the heavy-effect inputs. `resolvedProgressionStepsAtom`
  // returns a fresh array on every read, so depending on it directly would
  // re-fire Effect 1 on every render. Hashing into a string lets us depend
  // on value-identity rather than reference-identity.
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
  // Refs so the Part / Loop callbacks can read live state without depending
  // on closure recreation (which would force a rebuild on instrument /
  // beatsPerBar changes). The live-update effects below keep these refs in
  // sync with their atom values.
  const instrumentRef = useRef(chordInstrument);
  const beatsPerBarRef = useRef(beatsPerBar);

  // --- Effect 1: heavy build / dispose ---
  // Reads the freshest atom snapshots via a ref that mirrors each render's
  // values, so this effect can be keyed on the structurally-stable `buildKey`
  // without losing access to the per-render values for tempo / swing /
  // loopEnabled (which are intentionally NOT effect-1 deps — they have
  // dedicated live-update effects below).
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
  // IMPORTANT: this effect has no deps array on purpose. React commits no-deps
  // effects before keyed effects in the same render, which guarantees Effect 1
  // reads up-to-date inputs via buildInputsRef even when `buildKey` doesn't
  // include all of them (tempo / swing / loop / beatsPerBar / instrument live
  // outside buildKey). Do not add deps here.
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
      disposeAll(primsRef.current);
      primsRef.current = null;
      silenceProgressionBus();
    };

    if (blocked || muted) {
      tearDown();
      clearTimeline();
      return;
    }
    if (!playing) {
      tearDown();
      pauseTimeline();
      return;
    }
    // Snapshot heavy-effect inputs once at build time.
    const inputs = buildInputsRef.current;

    const audio = ensureProgressionAudio();
    if (!audio) return;
    void resumeProgressionAudio();
    restoreProgressionBus();

    // Event times are computed at the CURRENT tempo / beatsPerBar / swing
    // and then Tone stores them as ticks — subsequent live changes to those
    // settings will re-time the same events without rebuilding.
    const built = buildAllLayers({
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
    if (built.chordOnsets.length === 0) {
      tearDown();
      return;
    }

    const partStart = audio.ctx.currentTime + SCHEDULE_LEAD_SECONDS;
    const parts: ProgressionPartHandle[] = [];
    const totalDurationSec = built.totalDurationSec;
    // Pending chord-overlay advance timeouts. Cleared on tear-down so a
    // pause during the lookahead window doesn't write a stale active-step
    // index after the orchestrator has torn down.
    const pendingAdvanceTimeouts = new Set<number>();

    // 1. Chord-onset Part — drives React activeProgressionStepIndex.
    const chordOnsetPart = createProgressionPart<ChordOnsetEvent>({
      events: built.chordOnsets,
      loop: inputs.loopEnabled,
      loopEnd: totalDurationSec,
      onEvent: (audioTime, event) => {
        // Always publish to timeline so the playhead reflects the new bar.
        setActiveStep(
          event.stepIndex,
          audioTime,
          event.durationSec,
          event.cumulativeStartSec,
          totalDurationSec,
        );
        if (event.isFirstBar) {
          // Defer the Jotai write by the Tone lookahead delta so the chord
          // overlay React state flips at AUDIO ONSET, not at the
          // ~lookAhead-seconds-early callback fire time. Plain setTimeout —
          // no Tone.Draw (250ms expiration silently drops events under heavy
          // main-thread load → stall), no startTransition (would deprioritize
          // the Jotai write that the next-step useEffect chain depends on).
          // See commit 4f50968 for the original visual-leads-audio symptom.
          const rawNow = getContext().immediate();
          const delayMs = Math.max(0, (audioTime - rawNow) * 1000);
          if (delayMs <= 0) {
            setActiveStepIndex(event.stepIndex);
          } else {
            const id = window.setTimeout(() => {
              pendingAdvanceTimeouts.delete(id);
              setActiveStepIndex(event.stepIndex);
            }, delayMs);
            pendingAdvanceTimeouts.add(id);
          }
        }
      },
    });
    chordOnsetPart.start(partStart, 0);
    parts.push(chordOnsetPart);

    // 2. Chord strum Part. Reads instrumentRef.current each tick so
    //    instrument switches don't require rebuilding the Part.
    const chordStrumPart = createProgressionPart<ChordStrumEvent>({
      events: built.chordStrums,
      loop: inputs.loopEnabled,
      loopEnd: totalDurationSec,
      onEvent: (audioTime, value) => {
        const voice = getChordVoice(instrumentRef.current);
        voice.scheduleChord(audio.layers.chord, value.voicing, audioTime, {
          velocity: value.velocity,
          style: value.style,
          direction: value.direction,
        });
      },
    });
    chordStrumPart.start(partStart, 0);
    parts.push(chordStrumPart);

    // 3. Bass Part.
    const bassPart = createProgressionPart<BassEvent>({
      events: built.bass,
      loop: inputs.loopEnabled,
      loopEnd: totalDurationSec,
      onEvent: (audioTime, value) => {
        const freq = getNoteFrequency(value.note);
        if (!Number.isFinite(freq) || freq <= 0) return;
        scheduleBassNote(audio.layers.bass, freq, audioTime, {
          velocity: value.velocity,
        });
      },
    });
    bassPart.start(partStart, 0);
    parts.push(bassPart);

    // 4. Drum Part.
    const drumPart = createProgressionPart<DrumEvent>({
      events: built.drums,
      loop: inputs.loopEnabled,
      loopEnd: totalDurationSec,
      onEvent: (audioTime, value) => {
        switch (value.type) {
          case "kick":
            scheduleKick(audio.layers.drums, audioTime, { velocity: value.velocity });
            break;
          case "snare":
            scheduleSnare(audio.layers.drums, audioTime, { velocity: value.velocity });
            break;
          case "hihat":
            scheduleHiHat(audio.layers.drums, audioTime, { velocity: value.velocity });
            break;
          case "openHat":
            scheduleHiHat(audio.layers.drums, audioTime, {
              velocity: value.velocity,
              open: true,
            });
            break;
          case "ride":
            scheduleRide(audio.layers.drums, audioTime, { velocity: value.velocity });
            break;
        }
      },
    });
    drumPart.start(partStart, 0);
    parts.push(drumPart);

    // 5. Metronome Loop. The wrapper's `beatInBar` arg closes over its
    //    construction-time `beatsPerBar`, so we override with an
    //    orchestrator-owned counter that reads `beatsPerBarRef.current` —
    //    that way a live time-signature change (Effect 5) updates the
    //    accent cycle without rebuilding the Loop.
    let beatCounter = 0;
    const metronome = createMetronomeLoop({
      beatsPerBar: beatsPerBarRef.current,
      onBeat: (audioTime) => {
        beatCounter = (beatCounter % beatsPerBarRef.current) + 1;
        scheduleClick(audio.layers.metronome, audioTime, {
          accent: beatCounter === 1,
        });
      },
    });
    metronome.start(partStart);

    // Transport must be running for Tone callbacks to fire. Idempotent.
    getTransport().start();

    // Non-loop progressions: schedule a one-shot pause at the natural end.
    let endEventId: number | null = null;
    if (!inputs.loopEnabled) {
      endEventId = getTransport().scheduleOnce(() => {
        setPlaying(false);
      }, `+${totalDurationSec + SCHEDULE_LEAD_SECONDS}`);
    }

    primsRef.current = { parts, loop: metronome, endEventId };
    return () => {
      pendingAdvanceTimeouts.forEach((id) => window.clearTimeout(id));
      pendingAdvanceTimeouts.clear();
      disposeAll(primsRef.current);
      primsRef.current = null;
    };
    // NOTE: tempo / swing / loopEnabled / beatsPerBar / chordInstrument are
    // INTENTIONALLY excluded from this deps array — they have dedicated
    // live-update effects below (Effects 2-6) that mutate the live
    // primitives without rebuilding. They're funnelled into the effect via
    // `buildInputsRef` (mirrored from the prior render).
  }, [
    playing,
    blocked,
    muted,
    buildKey,
    setActiveStepIndex,
    setPlaying,
  ]);

  // --- Effect 2: live tempo ---
  // Tone.Part stores events as ticks (PPQ-relative), so flipping the
  // Transport's bpm re-times every pending event automatically. No rebuild.
  useEffect(() => {
    const transport = getTransport() as unknown as { bpm?: { value: number } } | null;
    if (transport?.bpm) {
      transport.bpm.value = tempo;
    }
  }, [tempo]);

  // --- Effect 3: live swing ---
  // Transport.swing applies globally to all events scheduled through it.
  useEffect(() => {
    const transport = getTransport() as unknown as { swing?: number } | null;
    if (transport && transport.swing !== undefined) {
      transport.swing = swing;
    }
  }, [swing]);

  // --- Effect 4: live loop toggle ---
  // setLoop on every existing Part. loopEnd was stored in ticks at build
  // time, so it re-times with bpm; no need to recompute the seconds value.
  useEffect(() => {
    primsRef.current?.parts.forEach((p) => {
      p.setLoop(loopEnabled);
    });
  }, [loopEnabled]);

  // --- Effect 5: live time signature (beatsPerBar) ---
  // Transport.timeSignature affects bar-relative time arithmetic. The
  // metronome accent cycle uses the wrapper's internal counter; live
  // changes here update the ref for any future rebuild.
  useEffect(() => {
    beatsPerBarRef.current = beatsPerBar;
    const transport = getTransport() as unknown as { timeSignature?: number } | null;
    if (transport && transport.timeSignature !== undefined) {
      transport.timeSignature = beatsPerBar;
    }
  }, [beatsPerBar]);

  // --- Effect 6: live chord instrument ---
  // The chord-strum Part callback reads instrumentRef.current each tick
  // via getChordVoice(...), so an instrument switch takes effect on the
  // next strum hit without rebuilding the Part.
  useEffect(() => {
    instrumentRef.current = chordInstrument;
  }, [chordInstrument]);

  // --- Effect 7: live layer-gain toggles ---
  useEffect(() => {
    const audio = ensureProgressionAudio();
    if (!audio) return;
    setLayerGain(audio.layers, "chord", chordOn);
    setLayerGain(audio.layers, "bass", bassOn);
    setLayerGain(audio.layers, "drums", drumsOn);
    setLayerGain(audio.layers, "metronome", metronomeOn);
  }, [chordOn, bassOn, drumsOn, metronomeOn]);
}
