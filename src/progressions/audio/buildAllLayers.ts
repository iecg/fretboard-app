import {
  resolveBassNoteForRole,
  resolveChordVoicing,
  resolveBassLineNotes,
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
} from "./patterns";
import type { ChordInstrumentId } from "./instruments/types";

export type DrumVoice = "kick" | "snare" | "hihat" | "openHat" | "ride";
export type StrumStyle = "staccato" | "sustained";
export type StrumDirection = "down" | "up";

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
}

export interface BassEvent {
  note: string;
  velocity: number;
}

export interface DrumEvent {
  type: DrumVoice;
  velocity: number;
}

export interface BuildAllLayersInput {
  steps: readonly ResolvedProgressionStep[];
  tempoBpm: number;
  beatsPerBar: number;
  swing: number;
  chordInstrument: ChordInstrumentId;
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
  totalDurationSec: number;
}

const OFF_BEAT_TOLERANCE = 0.01;

function swingBeat(beat: number, swing: number): number {
  if (swing <= 0) return beat;
  const isOff = Math.abs((beat % 1) - 0.5) < OFF_BEAT_TOLERANCE;
  return isOff ? beat + swing * (1 / 3) : beat;
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
export function buildAllLayers(input: BuildAllLayersInput): BuiltLayers {
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

  let cumulativeSec = 0;

  input.steps.forEach((step, stepIndex) => {
    const stepBeats = step.duration.unit === "bar"
      ? step.duration.value * input.beatsPerBar
      : step.duration.value;
    const stepDurationSec = stepBeats * secondsPerBeat;

    const scheduleThis = !step.unavailable && step.root !== null && step.quality !== null;
    if (!scheduleThis) {
      cumulativeSec += stepDurationSec;
      return;
    }

    const root = step.root as string;
    const quality = step.quality as string;
    const nextStep = input.steps[stepIndex + 1];
    const nextRoot = nextStep?.root ?? undefined;

    const voicing = resolveChordVoicing(root, quality);
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
          const hitTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          chordStrums.push({
            time: hitTime,
            value: {
              voicing,
              velocity: hit.velocity,
              style: hit.style,
              direction: hit.direction,
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
          );
          const hitTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          bass.push({
            time: hitTime,
            value: { note, velocity: hit.velocity },
          });
        }
      }

      if (drumHits.length > 0) {
        const hits = repeatPatternToBeats(drumHits, eventBeats, input.beatsPerBar);
        for (const hit of hits) {
          const hitTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          drums.push({
            time: hitTime,
            value: { type: hit.type, velocity: hit.velocity },
          });
        }
      }
    }

    cumulativeSec += stepDurationSec;
  });

  return {
    chordOnsets,
    chordStrums,
    bass,
    drums,
    totalDurationSec: cumulativeSec,
  };
}
