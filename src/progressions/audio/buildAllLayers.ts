import {
  resolveBassNoteForRole,
  resolveChordVoicing,
  resolveBassLineNotes,
  extendFunkVoicing,
} from "../progressionAudio";
import type { ResolvedProgressionStep } from "../progressionDomain";
import {
  getBassPattern,
  getChordPattern,
  getDrumPattern,
  getDrumVariation,
  repeatPatternToBeats,
  type CatalogDrumPattern,
  type DrumHit,
  type BassArticulation,
} from "./patterns";
import { applyJitter } from "./humanize";

type DrumVoice = "kick" | "snare" | "hihat" | "openHat" | "ride";
type StrumStyle = "staccato" | "sustained";
type StrumDirection = "down" | "up";

export interface ChordOnsetEvent {
  stepIndex: number;
  isFirstBar: boolean;
  isLastBar: boolean;
  beats: number;
  durationSec: number;
  cumulativeStartSec: number;
}

export interface ChordStrumEvent {
  voicing: readonly string[];
  velocity: number;
  style?: StrumStyle;
  direction?: StrumDirection;
  durationSec?: number;
}

export interface BassEvent {
  note: string;
  velocity: number;
  durationSec?: number;
}

export interface DrumEvent {
  type: DrumVoice;
  velocity: number;
}

export interface MetronomeEvent {
  /** 1-based, cycles 1..beatsPerBar. Beat 1 is the bar downbeat (consumer
   *  switches to accent click). */
  beatInBar: number;
}

export interface BuildAllLayersInput {
  steps: readonly ResolvedProgressionStep[];
  tempoBpm: number;
  beatsPerBar: number;
  swing: number;
  chordPatternId: string;
  bassPatternId: string;
  drumPatternId: string;
  drumVariations: readonly string[];
  loop: boolean;
}

export interface BuiltLayers {
  chordOnsets: ReadonlyArray<{ time: number; value: ChordOnsetEvent }>;
  chordStrums: ReadonlyArray<{ time: number; value: ChordStrumEvent }>;
  bass: ReadonlyArray<{ time: number; value: BassEvent }>;
  drums: ReadonlyArray<{ time: number; value: DrumEvent }>;
  metronome: ReadonlyArray<{ time: number; value: MetronomeEvent }>;
  totalDurationSec: number;
}

const OFF_BEAT_TOLERANCE = 0.01;
/** Note length (seconds) for a muted chicken-scratch strum stroke — choked
 *  short so it reads as percussion, not a ringing chord. */
export const MUTED_STRUM_DURATION_SEC = 0.06;
/** Note length (seconds) for an accented funk "stab" — long enough to read as a
 *  ringing strummed chord (the patch sustain lets it ring), unlike the choke. */
export const STAB_STRUM_DURATION_SEC = 0.4;
/** Note length (seconds) for the single root-note anchor on the one — a short,
 *  tight pluck, longer than a muted ghost but well short of a ringing stab. */
export const ROOT_STRUM_DURATION_SEC = 0.12;

function swingBeat(beat: number, swing: number): number {
  if (swing <= 0) return beat;
  const isOff = Math.abs((beat % 1) - 0.5) < OFF_BEAT_TOLERANCE;
  return isOff ? beat + swing * (1 / 3) : beat;
}

/**
 * Translate a bass hit's articulation into a concrete note length in seconds.
 * `undefined` means "use the patch's natural decay+release" (unchanged today).
 */
export function articulationToDurationSec(
  articulation: BassArticulation | undefined,
  secondsPerBeat: number,
): number | undefined {
  switch (articulation) {
    case "staccato":
      return 0.3 * secondsPerBeat;
    case "legato":
      return 0.9 * secondsPerBeat;
    default:
      return undefined;
  }
}


interface VoicedDrumHit extends DrumHit {
  type: DrumVoice;
}

function collectDrumHits(pattern: CatalogDrumPattern): VoicedDrumHit[] {
  const out: VoicedDrumHit[] = [];
  for (const h of pattern.kicks) out.push({ ...h, type: "kick" });
  for (const h of pattern.snares) out.push({ ...h, type: "snare" });
  for (const h of pattern.hats) out.push({ ...h, type: "hihat" });
  for (const h of pattern.openHats ?? []) out.push({ ...h, type: "openHat" });
  for (const h of pattern.ride ?? []) out.push({ ...h, type: "ride" });
  return out;
}

/**
 * Flatten a resolved progression into per-layer event streams ready to feed
 * Tone primitives. Pure function — no audio scheduling, no Tone references.
 *
 * Multi-bar steps expand into multiple chord-onset events (carrying
 * isFirstBar / isLastBar so the consumer can gate React writes and
 * chromatic-approach bass). Per-bar pattern hits expand inline: a 2-bar
 * step with a 4-hit drum pattern yields 8 drum events.
 */
export async function buildAllLayersAsync(input: BuildAllLayersInput): Promise<BuiltLayers> {
  const secondsPerBeat = 60 / Math.max(1, input.tempoBpm);

  const chordPattern = getChordPattern(input.chordPatternId);
  const bassPattern = getBassPattern(input.bassPatternId);
  const drumPattern = getDrumPattern(input.drumPatternId);
  const variationHits: VoicedDrumHit[] = input.drumVariations
    .map((id) => getDrumVariation(id)?.pattern)
    .filter((p): p is CatalogDrumPattern => Boolean(p))
    .flatMap((p) => collectDrumHits(p));
  const drumHits: VoicedDrumHit[] = drumPattern
    ? [...collectDrumHits(drumPattern), ...variationHits]
    : variationHits;

  const chordOnsets: Array<{ time: number; value: ChordOnsetEvent }> = [];
  const chordStrums: Array<{ time: number; value: ChordStrumEvent }> = [];
  const bass: Array<{ time: number; value: BassEvent }> = [];
  const drums: Array<{ time: number; value: DrumEvent }> = [];
  const metronome: Array<{ time: number; value: MetronomeEvent }> = [];

  let cumulativeSec = 0;
  let lastVoicing: string[] | undefined = undefined;
  let lastBassNote: string | undefined = undefined;

  for (let stepIndex = 0; stepIndex < input.steps.length; stepIndex++) {
    const step = input.steps[stepIndex];
    
    // Yield to the event loop every 8 steps to prevent UI lockup
    if (stepIndex > 0 && stepIndex % 8 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const stepBeats = step.duration.unit === "bar"
      ? step.duration.value * input.beatsPerBar
      : step.duration.value;
    const stepDurationSec = stepBeats * secondsPerBeat;

    if (step.unavailable || step.root === null || step.quality === null) {
      cumulativeSec += stepDurationSec;
      continue;
    }

    const root = step.root;
    const quality = step.quality;
    const nextStep = input.steps[stepIndex + 1];
    const nextRoot = nextStep?.root ?? undefined;

    const voicing = resolveChordVoicing(root, quality, undefined, lastVoicing);
    if (voicing.length > 0) {
      lastVoicing = voicing;
    }
    // The plain (non-voice-led) voicing is the register-safe base for funk
    // extensions AND the source of the single-note root anchor. Computed only
    // when the pattern needs it (a color-stab or root hit), to avoid a second
    // resolveChordVoicing call on non-funk patterns.
    const needsPlainVoicing = !!chordPattern?.hits.some(
      (h) => h.articulation === "color-stab" || h.articulation === "root",
    );
    const plainVoicing = needsPlainVoicing
      ? resolveChordVoicing(root, quality)
      : voicing;
    const spicyVoicing = needsPlainVoicing
      ? extendFunkVoicing(plainVoicing, root, quality)
      : voicing;
    const rootNoteVoicing =
      needsPlainVoicing && plainVoicing.length > 0 ? [plainVoicing[0]] : voicing;
    const bassLineNotes = resolveBassLineNotes(root, quality);

    const isBarUnit = step.duration.unit === "bar";
    const barsInStep = isBarUnit
      ? Math.max(1, Math.floor(step.duration.value))
      : 1;
    const eventBeats = isBarUnit ? input.beatsPerBar : stepBeats;
    const eventSec = eventBeats * secondsPerBeat;

    for (let bar = 0; bar < barsInStep; bar++) {
      const barStart = cumulativeSec + bar * eventSec;
      const isFirst = bar === 0;
      const isLast = bar === barsInStep - 1;

      chordOnsets.push({
        time: barStart,
        value: {
          stepIndex,
          isFirstBar: isFirst,
          isLastBar: isLast,
          beats: eventBeats,
          durationSec: eventSec,
          cumulativeStartSec: barStart,
        },
      });

      if (chordPattern && voicing.length > 0) {
        const hits = repeatPatternToBeats(chordPattern.hits, eventBeats, input.beatsPerBar);
        for (const hit of hits) {
          const baseTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          const { time: hitTime, velocity } = applyJitter({
            time: baseTime,
            velocity: hit.velocity,
            seed: stepIndex * 10000 + bar * 100 + hit.beat,
          });
          chordStrums.push({
            time: hitTime,
            value: {
              voicing:
                hit.articulation === "color-stab"
                  ? spicyVoicing
                  : hit.articulation === "root"
                    ? rootNoteVoicing
                    : voicing,
              velocity,
              style: hit.style,
              direction: hit.direction,
              durationSec:
                hit.articulation === "muted"
                  ? MUTED_STRUM_DURATION_SEC
                  : hit.articulation === "root"
                    ? ROOT_STRUM_DURATION_SEC
                    : hit.articulation === "stab" || hit.articulation === "color-stab"
                      ? STAB_STRUM_DURATION_SEC
                      : undefined,
            },
          });
        }
      }

      if (bassPattern && bassLineNotes.length > 0) {
        const hits = repeatPatternToBeats(bassPattern.hits, eventBeats, input.beatsPerBar);
        for (const hit of hits) {
          const note = resolveBassNoteForRole(
            root,
            quality,
            hit.note,
            isLast ? nextRoot : root,
            undefined,
            lastBassNote,
          );
          lastBassNote = note;
          const baseTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          const { time: hitTime, velocity } = applyJitter({
            time: baseTime,
            velocity: hit.velocity,
            seed: stepIndex * 10000 + bar * 100 + hit.beat + 1, // slight offset for bass
          });
          bass.push({
            time: hitTime,
            value: {
              note,
              velocity,
              durationSec: articulationToDurationSec(hit.articulation, secondsPerBeat),
            },
          });
        }
      }

      if (drumHits.length > 0) {
        const hits = repeatPatternToBeats(drumHits, eventBeats, input.beatsPerBar);
        for (const hit of hits) {
          const baseTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          const { time: hitTime, velocity } = applyJitter({
            time: baseTime,
            velocity: hit.velocity,
            seed: stepIndex * 10000 + bar * 100 + hit.beat + 2, // offset for drums
            timeAmountSec: 0.005, // tighter timing jitter for drums
            velocityAmount: 0.05,
          });
          drums.push({
            time: hitTime,
            value: { type: hit.type, velocity },
          });
        }
      }
    }

    cumulativeSec += stepDurationSec;
  }

  const totalBeats = Math.round(cumulativeSec / secondsPerBeat);
  for (let beat = 0; beat < totalBeats; beat++) {
    metronome.push({
      time: beat * secondsPerBeat,
      value: { beatInBar: (beat % input.beatsPerBar) + 1 },
    });
  }

  return {
    chordOnsets,
    chordStrums,
    bass,
    drums,
    metronome,
    totalDurationSec: cumulativeSec,
  };
}
