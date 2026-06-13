/** Serializable events emitted across the embed boundary. Grows with consumers. */
export type FretboardEvent =
  | {
      type: "noteActivated";
      /** Frequency in Hz of the activated note (what the builtin synth would play). */
      frequency: number;
      /** Scientific-pitch note name including octave, e.g. "C#4". */
      note: string;
      /** String index that was tapped; 0 = highest-pitched string. */
      string: number;
      /** Fret number that was tapped; 0 = open string. */
      fret: number;
    }
  | {
      // Emitted on preset/root/scale change so a host can render the chord sequence.
      type: "progressionResolved";
      steps: { index: number; degree: string; label: string; unavailable: boolean }[];
    }
  | {
      // Emitted when the visual clock advances the active step during playback.
      type: "activeStepChanged";
      index: number;
      label: string;
    }
  | {
      // Emitted when play/pause/loading/blocked state changes.
      type: "playbackStateChanged";
      playing: boolean;
      loading: boolean;
      blockedReason: string | null;
    };

export type FretboardEventSink = (event: FretboardEvent) => void;
