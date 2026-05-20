/**
 * Synthesized drum kit voices: kick, snare, closed/open hi-hat. Each hit is
 * scheduled at an absolute `AudioContext.currentTime` so the backing track
 * stays sample-accurate even if the React loop drifts.
 *
 * Voices are short and self-contained: each call builds the oscillators /
 * noise buffers it needs, schedules an envelope, and lets the WebAudio engine
 * tear them down on `onended`. There is no pool — drum hits are cheap and
 * disposable.
 */

const HIT_VELOCITY_DEFAULT = 1;

function clampVelocity(v: number | undefined): number {
  if (v === undefined) return HIT_VELOCITY_DEFAULT;
  return Math.max(0, Math.min(1.5, v));
}

let cachedNoiseBuffer: AudioBuffer | null = null;
let cachedNoiseCtx: AudioContext | null = null;

/** Build (and memoize) a 1-second white-noise buffer per AudioContext. */
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoiseBuffer && cachedNoiseCtx === ctx) return cachedNoiseBuffer;
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseBuffer = buffer;
  cachedNoiseCtx = ctx;
  return buffer;
}

function disposeNodes(...nodes: AudioNode[]): void {
  for (const n of nodes) {
    try {
      n.disconnect();
    } catch {
      // already disconnected
    }
  }
}

export interface DrumHitOptions {
  velocity?: number;
}

export interface DrumVoiceHandle {
  cancel: () => void;
}

function createDrumVoiceHandle(
  ctx: AudioContext,
  sources: readonly AudioScheduledSourceNode[],
  nodes: readonly AudioNode[],
): DrumVoiceHandle {
  let canceled = false;
  return {
    cancel: () => {
      if (canceled) return;
      canceled = true;
      for (const source of sources) {
        try {
          source.stop(ctx.currentTime);
        } catch {
          // Source may already have ended or had an earlier stop time.
        }
      }
      disposeNodes(...nodes);
    },
  };
}

/**
 * Schedule a kick drum hit at `time`. Models a punchy 808-style kick: sine
 * oscillator with a fast exponential pitch drop and a short click transient.
 */
export function scheduleKick(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  options: DrumHitOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  // Zero velocity → silent hit. Bail before scheduling so we never pass 0
  // into exponentialRampToValueAtTime (which throws on non-positive targets).
  if (velocity <= 0) return { cancel: () => {} };

  // Body
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.18);
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(0.9 * velocity, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
  osc.connect(gain).connect(dest);
  osc.start(time);
  osc.stop(time + 0.4);
  osc.onended = () => disposeNodes(osc, gain);

  // Click transient (higher harmonic burst)
  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = "triangle";
  click.frequency.setValueAtTime(1200, time);
  clickGain.gain.setValueAtTime(0.0001, time);
  clickGain.gain.exponentialRampToValueAtTime(0.3 * velocity, time + 0.002);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
  click.connect(clickGain).connect(dest);
  click.start(time);
  click.stop(time + 0.05);
  click.onended = () => disposeNodes(click, clickGain);

  return createDrumVoiceHandle(
    ctx,
    [osc, click],
    [osc, gain, click, clickGain],
  );
}

/**
 * Schedule a snare hit. Combines filtered noise (the rattle) with a low
 * triangle wave (the body) for a balanced backbeat snare.
 */
export function scheduleSnare(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  options: DrumHitOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return { cancel: () => {} };

  // Noise rattle
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.value = 1500;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.001, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.55 * velocity, time + 0.003);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
  noise.connect(noiseFilter).connect(noiseGain).connect(dest);
  noise.start(time);
  noise.stop(time + 0.2);
  noise.onended = () => disposeNodes(noise, noiseFilter, noiseGain);

  // Tonal body
  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(220, time);
  body.frequency.exponentialRampToValueAtTime(140, time + 0.08);
  bodyGain.gain.setValueAtTime(0.001, time);
  bodyGain.gain.exponentialRampToValueAtTime(0.35 * velocity, time + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
  body.connect(bodyGain).connect(dest);
  body.start(time);
  body.stop(time + 0.15);
  body.onended = () => disposeNodes(body, bodyGain);

  return createDrumVoiceHandle(
    ctx,
    [noise, body],
    [noise, noiseFilter, noiseGain, body, bodyGain],
  );
}

export interface HiHatOptions extends DrumHitOptions {
  /** Open hat has a longer decay tail. Default false (closed). */
  open?: boolean;
}

/**
 * Schedule a hi-hat hit. Pure noise through a steep highpass; the `open`
 * variant lets the tail ring out for ~0.3s, the closed variant chokes at
 * ~50ms.
 */
export function scheduleHiHat(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  options: HiHatOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return { cancel: () => {} };
  const decay = options.open ? 0.3 : 0.05;

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 10000;
  bp.Q.value = 0.8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(0.35 * velocity, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

  noise.connect(hp).connect(bp).connect(gain).connect(dest);
  noise.start(time);
  noise.stop(time + decay + 0.05);
  noise.onended = () => disposeNodes(noise, hp, bp, gain);

  return createDrumVoiceHandle(
    ctx,
    [noise],
    [noise, hp, bp, gain],
  );
}

export interface RideOptions extends DrumHitOptions {
  bell?: boolean;
}

/**
 * Schedule a ride cymbal hit. Filtered noise with a longer decay than hi-hat.
 * The optional `bell` mode raises the frequency and tightens the Q for a
 * brighter, more focused ping.
 */
export function scheduleRide(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  options: RideOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return { cancel: () => {} };
  const decay = options.bell ? 0.15 : 0.5;

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = options.bell ? 6000 : 4000;
  bp.Q.value = options.bell ? 2 : 0.5;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3000;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(0.25 * velocity, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

  noise.connect(bp).connect(hp).connect(gain).connect(dest);
  noise.start(time);
  noise.stop(time + decay + 0.05);
  noise.onended = () => disposeNodes(noise, bp, hp, gain);

  return createDrumVoiceHandle(ctx, [noise], [noise, bp, hp, gain]);
}

