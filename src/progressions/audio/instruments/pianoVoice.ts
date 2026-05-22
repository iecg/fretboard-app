import { createReusableChordVoice } from "./createReusableChordVoice";

export const pianoVoice = createReusableChordVoice({
  volume: -6,
  maxPolyphonyFloor: 6,
  oscillator: { type: "custom", partials: [1, 0.5, 0.25, 0.12] },
  envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 1.2 },
  durationFor: (options) => (options.style === "sustained" ? 1.2 : 0.4),
});
