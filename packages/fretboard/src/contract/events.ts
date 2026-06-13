/** Serializable events emitted across the embed boundary. Grows with consumers. */
export type FretboardEvent = {
  type: "noteActivated";
  /** Frequency in Hz of the activated note (what the builtin synth would play). */
  frequency: number;
  /** Scientific-pitch note name including octave, e.g. "C#4". */
  note: string;
  /** String index that was tapped; 0 = highest-pitched string. */
  string: number;
  /** Fret number that was tapped; 0 = open string. */
  fret: number;
};

export type FretboardEventSink = (event: FretboardEvent) => void;
