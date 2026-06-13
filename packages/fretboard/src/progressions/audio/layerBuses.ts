export type ProgressionLayer = "chord" | "bass" | "drums" | "metronome";

export interface LayerBuses {
  chord: GainNode;
  bass: GainNode;
  drums: GainNode;
  metronome: GainNode;
}

/**
 * One GainNode per layer between the layer's audio source and the parent
 * destination. Toggling a layer flips its gain to 1 or 0 with no sequencer
 * rebuild — useful when the user mutes drums mid-bar.
 */
export function buildLayerBuses(
  ctx: AudioContext,
  destination: AudioNode,
): LayerBuses {
  const layers: ProgressionLayer[] = ["chord", "bass", "drums", "metronome"];
  const buses = {} as Record<ProgressionLayer, GainNode>;
  for (const layer of layers) {
    const gain = ctx.createGain();
    gain.connect(destination);
    buses[layer] = gain;
  }
  return buses as LayerBuses;
}

/**
 * Flip a single layer's gain. `enabled=false` mutes the layer; `true`
 * restores unity gain. Future expansion (per-layer volume sliders) reads
 * from the same node.
 */
export function setLayerGain(
  buses: LayerBuses,
  layer: ProgressionLayer,
  enabled: boolean,
): void {
  buses[layer].gain.value = enabled ? 1 : 0;
}
