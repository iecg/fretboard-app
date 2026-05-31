import * as Tone from "tone";
import { createReusableVoicePool } from "./createReusableVoicePool";
import type { StrumSpec } from "./sound/patchTypes";

const DEFAULT_PARTIALS = [1, 0.8, 0.45, 0.22, 0.12, 0.05];
const DEFAULT_ATTACK = 0.01;
const DEFAULT_DECAY = 1.1;
const DEFAULT_SUSTAIN = 0.05;
const DEFAULT_RELEASE = 0.4;
const DEFAULT_NOTE_DURATION = 1.8;
const DEFAULT_RELEASE_TAIL_SEC = DEFAULT_NOTE_DURATION + DEFAULT_RELEASE + 0.15;

export interface PluckedVoiceHandle { cancel: () => void; }
export interface PluckStringOptions { velocity?: number; spec?: StrumSpec; durationSec?: number; }

type PluckPool = ReturnType<typeof createReusableVoicePool<Tone.Synth>>;

function makePool(spec?: StrumSpec): PluckPool {
  const oscillator = { type: "custom" as const, partials: spec?.oscillator.partials ?? DEFAULT_PARTIALS };
  const envelope = spec?.envelope ?? {
    attack: DEFAULT_ATTACK, decay: DEFAULT_DECAY, sustain: DEFAULT_SUSTAIN, release: DEFAULT_RELEASE,
  };
  return createReusableVoicePool<Tone.Synth>({
    createVoice: () => new Tone.Synth({ oscillator, envelope }),
  });
}

const defaultPool = makePool();
const poolsBySpec = new WeakMap<StrumSpec, PluckPool>();

function poolFor(spec?: StrumSpec): PluckPool {
  if (!spec) return defaultPool;
  const existing = poolsBySpec.get(spec);
  if (existing) return existing;
  const pool = makePool(spec);
  poolsBySpec.set(spec, pool);
  return pool;
}

export function pluckString(
  dest: AudioNode,
  frequency: number,
  startTime: number,
  options: PluckStringOptions = {},
): PluckedVoiceHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 1));
  if (velocity <= 0) return { cancel: () => {} };

  const spec = options.spec;
  const noteDuration = options.durationSec ?? spec?.noteDurationSec ?? DEFAULT_NOTE_DURATION;
  const releaseTail = spec?.releaseTailSec ?? DEFAULT_RELEASE_TAIL_SEC;
  const now = Tone.now();
  const playbackStartTime = Math.max(now, startTime);
  const lease = poolFor(spec).lease(dest, now);
  lease.setBusyUntil(playbackStartTime + releaseTail);
  lease.voice.triggerAttackRelease(frequency, noteDuration, startTime, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
    },
  };
}
