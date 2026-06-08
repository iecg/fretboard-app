import {
  resolveBassNoteForRole,
  resolveChordVoicing,
  resolveBassLineNotes,
  buildFunkColorVoicing,
  buildBossaColorVoicing,
} from "../progressionAudio";
import { buildVoicing, STRUM_PRESET } from "../voicingEngine";
import type { ResolvedProgressionStep } from "../progressionDomain";
import {
  getBassPattern,
  getChordPattern,
  getDrumPattern,
  getDrumVariation,
  variationFiresOnBar,
  repeatPatternToBeats,
  sliceCellToBar,
  type CatalogDrumPattern,
  type DrumHit,
  type DrumVariation,
  type BassArticulation,
} from "./patterns";
import { applyJitter, shouldDropHit, grooveLockTimeAmount } from "./humanize";

type DrumVoice = "kick" | "snare" | "hihat" | "openHat" | "ride" | "crossStick";
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
/** Velocity for the §3.4 end-of-phrase chromatic approach note — slightly under
 *  a downbeat so the leading tone leans into the next chord rather than
 *  competing with it. */
const TURNAROUND_APPROACH_VELOCITY = 0.75;
/** Piano LH bass octave for the bossa comp — an octave above the upright bass. */
const BOSSA_LH_OCTAVE = 3;

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

/**
 * Find the root the next chord change leads into, scanning forward from
 * `fromIndex` and skipping rests / unavailable steps. Wraps to the start of
 * the progression when `loop` is true. Returns undefined when nothing
 * resolvable follows (end of a non-looping progression, or all-rest tail).
 * Pure — used to target the §3.4 end-of-phrase chromatic approach note.
 */
export function nextResolvableRoot(
  steps: readonly ResolvedProgressionStep[],
  fromIndex: number,
  loop: boolean,
): string | undefined {
  const n = steps.length;
  for (let offset = 1; offset <= n; offset++) {
    const rawIdx = fromIndex + offset;
    if (rawIdx >= n && !loop) return undefined;
    const candidate = steps[rawIdx % n];
    if (
      !candidate.unavailable &&
      candidate.root !== null &&
      candidate.quality !== null
    ) {
      return candidate.root;
    }
  }
  return undefined;
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
  for (const h of pattern.crossStick ?? []) out.push({ ...h, type: "crossStick" });
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
  // Base drum pattern hits apply every bar; variations are gated per bar below.
  const baseDrumHits: VoicedDrumHit[] = drumPattern ? collectDrumHits(drumPattern) : [];
  const variations: DrumVariation[] = input.drumVariations
    .map((id) => getDrumVariation(id))
    .filter((v): v is DrumVariation => Boolean(v));

  const chordOnsets: Array<{ time: number; value: ChordOnsetEvent }> = [];
  const chordStrums: Array<{ time: number; value: ChordStrumEvent }> = [];
  const bass: Array<{ time: number; value: BassEvent }> = [];
  const drums: Array<{ time: number; value: DrumEvent }> = [];
  const metronome: Array<{ time: number; value: MetronomeEvent }> = [];

  let cumulativeSec = 0;
  let lastVoicing: string[] | undefined = undefined;
  let lastBassNote: string | undefined = undefined;
  let absoluteBar = 0;

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

    const isBarUnit = step.duration.unit === "bar";
    const barsInStep = isBarUnit
      ? Math.max(1, Math.floor(step.duration.value))
      : 1;

    if (step.unavailable || step.root === null || step.quality === null) {
      cumulativeSec += stepDurationSec;
      absoluteBar += barsInStep; // a rest bar still occupies its phrase slot
      continue;
    }

    const root = step.root;
    const quality = step.quality;
    const nextStep = input.steps[stepIndex + 1];
    const nextRoot = nextStep?.root ?? undefined;
    // §3.4: the chord the next change leads into (loop-aware, skips rests).
    const turnaroundTarget = nextResolvableRoot(input.steps, stepIndex, input.loop);

    const voicing = buildVoicing(root, quality, lastVoicing, STRUM_PRESET);
    if (voicing.length > 0) {
      lastVoicing = voicing;
    }
    // Split the funk voicing intents: the "root" anchor needs the plain triad's
    // root note; the "color-stab" needs a voice-led rootless funk grip in the
    // current chord's register. Computed only when the pattern uses each hit.
    const needsRootAnchor = !!chordPattern?.hits.some((h) => h.articulation === "root");
    const needsColor = !!chordPattern?.hits.some((h) => h.articulation === "color-stab");
    const plainVoicing = needsRootAnchor ? resolveChordVoicing(root, quality) : voicing;
    const colorVoicing = needsColor
      ? buildFunkColorVoicing(root, quality, lastVoicing)
      : voicing;
    const rootNoteVoicing =
      needsRootAnchor && plainVoicing.length > 0 ? [plainVoicing[0]] : voicing;
    // Rootless jazz comp voicing (bossa) — opt-in per pattern. Falls back to the
    // default voicing for every other comp.
    const compVoicing =
      chordPattern?.voicing === "rootless-jazz"
        ? buildBossaColorVoicing(root, quality, lastVoicing)
        : voicing;
    // Bossa LH bass notes (root on beat 1, fifth on beat 3), octave 3 — single
    // notes played by the piano under the RH rootless chords.
    const bossaLhNotes =
      chordPattern?.voicing === "rootless-jazz"
        ? resolveBassLineNotes(root, quality, BOSSA_LH_OCTAVE)
        : [];
    const bassRootVoicing = bossaLhNotes.length > 0 ? [bossaLhNotes[0]] : voicing;
    const bassFifthVoicing =
      bossaLhNotes.length > 1 ? [bossaLhNotes[1]] : bassRootVoicing;
    const bassLineNotes = resolveBassLineNotes(root, quality);
    // When the comp supplies its own LH bass (rootless-jazz), it doubles the
    // upright bassline an octave up on beats 1 & 3. Grid-lock both voices'
    // attacks (zero time jitter) so they sound in perfect unison — independent
    // timing humanization flams two notes an octave apart. Velocity jitter still
    // applies, and other comps keep their natural timing humanization.
    const lockBassToGrid = chordPattern?.voicing === "rootless-jazz";

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
        const chordCellBars = chordPattern.bars ?? 1;
        const hits = isBarUnit && chordCellBars > 1
          ? sliceCellToBar(chordPattern.hits, absoluteBar % chordCellBars, input.beatsPerBar)
          : repeatPatternToBeats(chordPattern.hits, eventBeats, input.beatsPerBar);
        for (let hitIndex = 0; hitIndex < hits.length; hitIndex++) {
          const hit = hits[hitIndex];
          const isLhBass =
            hit.voiceRole === "bass-root" || hit.voiceRole === "bass-fifth";
          const chordSeed = stepIndex * 10000 + bar * 100 + hit.beat;
          if (!isLhBass && shouldDropHit(hit.velocity, chordSeed)) continue;
          const baseTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          const { time: hitTime, velocity } = applyJitter({
            time: baseTime,
            velocity: hit.velocity,
            seed: chordSeed,
            // LH bass doubles the upright an octave up — lock it to the grid.
            timeAmountSec: isLhBass ? 0 : grooveLockTimeAmount(hit.beat, 0.015),
          });
          // A sustained chord rings until the next hit in the bar, or to the bar
          // end when it is the last hit — a true whole note for ballad-whole,
          // tempo- and meter-aware at any setting. (Hits are bar-local and in
          // ascending beat order, so the next hit's beat is the ring boundary.)
          const sustainedDurationSec =
            hit.style === "sustained"
              ? Math.max(0, (hits[hitIndex + 1]?.beat ?? eventBeats) - hit.beat) *
                secondsPerBeat
              : 0;
          chordStrums.push({
            time: hitTime,
            value: {
              voicing:
                hit.voiceRole === "bass-root"
                  ? bassRootVoicing
                  : hit.voiceRole === "bass-fifth"
                    ? bassFifthVoicing
                    : hit.articulation === "color-stab"
                      ? colorVoicing
                      : hit.articulation === "root"
                        ? rootNoteVoicing
                        : compVoicing,
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
                      : hit.style === "sustained"
                        ? sustainedDurationSec
                        : undefined,
            },
          });
        }
      }

      if (bassPattern && bassLineNotes.length > 0) {
        const bassCellBars = bassPattern.bars ?? 1;
        const patternHits = isBarUnit && bassCellBars > 1
          ? sliceCellToBar(bassPattern.hits, absoluteBar % bassCellBars, input.beatsPerBar)
          : repeatPatternToBeats(bassPattern.hits, eventBeats, input.beatsPerBar);
        // §3.4 end-of-phrase walk: on a step's last bar that precedes a real
        // chord change, opted-in patterns drop their tail (any hit on/after the
        // bar's last beat) and lead into the next root with one chromatic
        // approach note. Patterns without the flag are untouched.
        const isTurnaroundBar =
          isBarUnit &&
          isLast &&
          bassPattern.turnaround === true &&
          turnaroundTarget !== undefined &&
          turnaroundTarget !== root;
        const lastBeat = input.beatsPerBar - 1;
        const hits = isTurnaroundBar
          ? [
              ...patternHits.filter((h) => h.beat < lastBeat),
              {
                beat: lastBeat,
                velocity: TURNAROUND_APPROACH_VELOCITY,
                note: "chromatic-approach" as const,
                articulation: "legato" as const,
              },
            ]
          : patternHits;
        for (const hit of hits) {
          const bassSeed = stepIndex * 10000 + bar * 100 + hit.beat + 1;
          if (!lockBassToGrid && shouldDropHit(hit.velocity, bassSeed)) continue;
          // The synthetic approach note targets the next chord (loop-aware);
          // every other hit keeps today's behavior exactly.
          const approachTarget =
            isTurnaroundBar && hit.note === "chromatic-approach"
              ? turnaroundTarget
              : isLast
                ? nextRoot
                : root;
          const note = resolveBassNoteForRole(
            root,
            quality,
            hit.note,
            approachTarget,
            undefined,
            lastBassNote,
          );
          lastBassNote = note;
          const baseTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          const { time: hitTime, velocity } = applyJitter({
            time: baseTime,
            velocity: hit.velocity,
            seed: bassSeed,
            // Lock to the grid when the comp doubles this line (bossa LH), so
            // the two voices attack in perfect unison instead of flamming.
            timeAmountSec: lockBassToGrid ? 0 : grooveLockTimeAmount(hit.beat, 0.015),
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

      const drumCellBars = drumPattern?.bars ?? 1;
      const baseForBar: VoicedDrumHit[] = isBarUnit && drumCellBars > 1
        ? sliceCellToBar(baseDrumHits, absoluteBar % drumCellBars, input.beatsPerBar)
        : baseDrumHits;
      const firingVariationHits: VoicedDrumHit[] = variations
        .filter((v) => variationFiresOnBar(v, absoluteBar))
        .flatMap((v) => collectDrumHits(v.pattern));
      const drumHitsForBar: VoicedDrumHit[] = [...baseForBar, ...firingVariationHits];
      if (drumHitsForBar.length > 0) {
        const hits = repeatPatternToBeats(drumHitsForBar, eventBeats, input.beatsPerBar);
        for (const hit of hits) {
          const drumSeed = stepIndex * 10000 + bar * 100 + hit.beat + 2;
          if (shouldDropHit(hit.velocity, drumSeed)) continue;
          const baseTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          const { time: hitTime, velocity } = applyJitter({
            time: baseTime,
            velocity: hit.velocity,
            seed: drumSeed,
            timeAmountSec: grooveLockTimeAmount(hit.beat, 0.005),
            velocityAmount: 0.05,
          });
          drums.push({
            time: hitTime,
            value: { type: hit.type, velocity },
          });
        }
      }

      absoluteBar++;
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
