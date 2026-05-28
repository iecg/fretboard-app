import {
  Channel,
  Compressor,
  Limiter,
  Gain,
  EQ3,
  Chebyshev,
  Distortion,
  Freeverb,
  JCReverb,
  Reverb,
} from "tone";
import type { TierProfile } from "./qualityTiers";
import type { GenreMix, MixInstrument } from "./genreMixPresets";
import type { InsertSpec } from "./patchTypes";
import { getBassPatch, getChordPatch, getDrumKitPatch } from "./instrumentPatches";

export interface ChannelPlan {
  volumeDb: number;
  pan: number;
  reverbSend: number;
  delaySend?: number;
  insert?: InsertSpec; // present only when tier enables inserts AND patch defines one
}

export interface SignalGraphPlan {
  channels: Record<MixInstrument, ChannelPlan>;
  reverbEngine: TierProfile["reverbEngine"];
  delayBus: boolean;
  maxPolyphony: number;
  oversample: TierProfile["oversample"];
  master: GenreMix["master"];
}

/** Insert spec that applies to each instrument channel, sourced from the
 *  active patch (chord/bass/drum). Metronome has no patch → no insert. */
function insertForChannel(channel: MixInstrument, mix: GenreMix): InsertSpec | undefined {
  switch (channel) {
    case "bass": return getBassPatch(mix.patches.bass)?.insert;
    case "chord": return getChordPatch(mix.patches.chord)?.insert;
    case "drums": return getDrumKitPatch(mix.patches.drumKit)?.insert;
    case "metronome": return undefined;
  }
}

export function planSignalGraph(tier: TierProfile, mix: GenreMix): SignalGraphPlan {
  const channels = {} as Record<MixInstrument, ChannelPlan>;
  for (const channel of ["chord", "bass", "drums", "metronome"] as const) {
    const m = mix.perInstrument[channel];
    channels[channel] = {
      volumeDb: m.volumeDb,
      pan: m.pan,
      reverbSend: m.reverbSend,
      delaySend: tier.delaySends ? m.delaySend : undefined,
      insert: tier.perInstrumentInserts ? insertForChannel(channel, mix) : undefined,
    };
  }
  return {
    channels,
    reverbEngine: tier.reverbEngine,
    delayBus: tier.delaySends,
    maxPolyphony: tier.maxPolyphony,
    oversample: tier.oversample,
    master: mix.master,
  };
}

// ---------------------------------------------------------------------------
// Materialization layer — turns a SignalGraphPlan into live Tone.js nodes.
// Requires a real AudioContext; not unit-tested in isolation.
// ---------------------------------------------------------------------------

export interface MaterializedGraph {
  /** Native input node each voice family connects into (preserves the
   *  existing `audio.layers.*` contract — voices call `.connect(node)`). */
  inputs: Record<MixInstrument, AudioNode>;
  /** Tear down every constructed Tone node. */
  dispose: () => void;
}

function buildReverb(
  engine: SignalGraphPlan["reverbEngine"],
  decay: number,
  wet: number,
): Reverb | JCReverb | Freeverb {
  if (engine === "convolution") {
    const r = new Reverb({ decay, wet });
    // async impulse; safe to use before resolve (silent until ready)
    void r.generate().catch((err) => {
      if (import.meta.env.DEV) console.warn("[buildSignalGraph] Reverb.generate() failed:", err);
    });
    return r;
  }
  // JCReverb/Freeverb take a normalized roomSize rather than a decay time, so we
  // map decay seconds → roomSize via `decay / 2.5` (a rough perceptual fit). The
  // clamps differ per algorithm: JCReverb caps ~0.9 because higher room sizes
  // destabilize its feedback comb filters, while Freeverb tolerates up to ~0.95
  // before it self-oscillates.
  if (engine === "jcreverb") {
    return new JCReverb({ roomSize: Math.min(0.9, decay / 2.5), wet });
  }
  return new Freeverb({ roomSize: Math.min(0.95, decay / 2.5), wet });
}

/**
 * Materialize the plan against a real AudioContext + the parent destination
 * (ctx.destination or the existing master bus GainNode). Returns native input
 * nodes for each instrument family plus a disposer.
 *
 * Routing per channel:
 *   nativeInput(Gain) → [EQ3 → saturation]? → Channel(volume+pan) → masterGlue
 *                                                   └─(reverbSend)→ reverbBus → masterGlue
 * masterGlue: Compressor → Limiter → destination
 * reverbBus:  Reverb → (into masterGlue input, post-compressor pre-limiter)
 *
 * INVARIANT: `ctx` MUST be the same AudioContext that Tone is bound to. The app
 * binds Tone to the progression AudioContext via `Tone.setContext(audio.ctx)`
 * in `toneBus.ts` (see also `bus.ts`); the native input GainNodes created here
 * with `ctx.createGain()` and the Tone effect nodes must share one context, or
 * the cross-graph `.connect()` calls below will silently fail to route audio.
 *
 * NOTE: `SignalGraphPlan.delayBus` / `ChannelPlan.delaySend` are carried in the
 * plan but intentionally NOT materialized in this slice — delay sends are
 * reserved for a later iteration. The gap is explicit so it isn't mistaken for
 * a bug; no delay bus is constructed and the per-channel `delaySend` is unused.
 */
export function materializeSignalGraph(
  ctx: AudioContext,
  destination: AudioNode,
  plan: SignalGraphPlan,
): MaterializedGraph {
  const disposers: Array<() => void> = [];
  const track = <T extends { dispose: () => void }>(n: T): T => {
    disposers.push(() => n.dispose());
    return n;
  };
  // Native input GainNodes aren't Tone nodes, so they have no `.dispose()`.
  // Track them separately to `.disconnect()` on teardown (otherwise old inputs
  // stay wired across a graph rebuild on tier/genre change).
  const nativeInputs: GainNode[] = [];

  // Master glue: Compressor → Limiter → destination
  const comp = track(new Compressor(plan.master.compressor));
  const limiter = track(new Limiter(plan.master.limiterThreshold));
  comp.connect(limiter);
  limiter.connect(destination);

  // Reverb bus returns into the compressor input (glued with dry signal).
  const reverb = track(buildReverb(plan.reverbEngine, plan.master.reverb.decay, plan.master.reverb.wet));
  reverb.connect(comp);

  const inputs = {} as Record<MixInstrument, AudioNode>;
  for (const ch of ["chord", "bass", "drums", "metronome"] as const) {
    const cfg = plan.channels[ch];
    const input = ctx.createGain(); // native node voices connect into
    nativeInputs.push(input);
    const channel = track(new Channel({ volume: cfg.volumeDb, pan: cfg.pan }));

    // Optional insert chain (EQ3 + saturation), built with real Tone nodes.
    // `head` tracks the last node in the chain; may be native GainNode or a Tone node.
    let head: GainNode | EQ3 | Distortion | Chebyshev = input;

    if (cfg.insert?.eq3) {
      const eq = track(new EQ3(cfg.insert.eq3));
      // GainNode.connect() only accepts AudioNode; eq.input is MultibandSplit (ToneAudioNode),
      // so cast through unknown to bridge the native↔Tone boundary.
      (head as GainNode).connect(eq.input as unknown as AudioNode);
      head = eq;
    }

    if (cfg.insert?.saturation) {
      const sat =
        cfg.insert.saturation.kind === "distortion"
          ? track(new Distortion(cfg.insert.saturation.amount))
          : track(new Chebyshev(Math.max(1, Math.round(cfg.insert.saturation.amount))));
      // head may be GainNode or EQ3; both have .connect() but with incompatible overloads,
      // so we use a minimal structural cast to unify the call site.
      (head as unknown as { connect: (n: unknown) => void }).connect(sat);
      head = sat;
    }

    // Head → Channel (volume + pan) → master glue
    (head as unknown as { connect: (n: unknown) => void }).connect(channel);
    channel.connect(comp);

    // Reverb send tap off the channel.
    if (cfg.reverbSend > 0) {
      const send = track(new Gain(cfg.reverbSend));
      channel.connect(send);
      send.connect(reverb);
    }

    inputs[ch] = input;
  }

  return {
    inputs,
    dispose: () => {
      for (const d of disposers) {
        try {
          d();
        } catch {
          /* ignore disposal errors */
        }
      }
      // Native GainNodes have no dispose(); just unwire them.
      for (const node of nativeInputs) {
        try {
          node.disconnect();
        } catch {
          /* ignore disconnect errors */
        }
      }
    },
  };
}
