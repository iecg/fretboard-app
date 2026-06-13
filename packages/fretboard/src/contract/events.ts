/** Serializable events emitted across the embed boundary. Grows with consumers. */
export type FretboardEvent = {
  type: "noteActivated";
  /** Frequency in Hz of the activated note (what the builtin synth would play). */
  frequency: number;
};

export type FretboardEventSink = (event: FretboardEvent) => void;
