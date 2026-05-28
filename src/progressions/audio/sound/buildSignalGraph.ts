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
