import { createReusableChordVoice } from "./createReusableChordVoice";

export const organVoice = createReusableChordVoice({
  volume: -10,
  maxPolyphonyFloor: 6,
  oscillator: { type: "custom", partials: [1, 0.6, 0.4, 0.3, 0.2] },
  envelope: { attack: 0.02, decay: 0.05, sustain: 0.9, release: 0.6 },
  releaseTailSec: 0.6,
  durationFor: (options) => (options.style === "staccato" ? 0.2 : 1.5),
});
