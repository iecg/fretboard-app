// Public contract surface for @fretflow/fretboard.
export { FretboardEmbed } from "./contract/FretboardEmbed";
export type { FretboardConfig, FretboardEmbedProps } from "./contract/FretboardEmbed";
export type { FretboardEvent, FretboardEventSink } from "./contract/events";
export { Fretboard } from "./components/Fretboard/Fretboard";

// Audio controls for hosts that manage Web Audio unlock themselves. The
// package's `exports` map is extensionless, so subpath imports such as
// `@fretflow/fretboard/core/lazyGuitarAudio` do not resolve under Metro — the
// audio control surface must be reachable from the top-level entry.
export {
  resumeGuitarAudio,
  prefetchAudioModule,
  setGuitarMutePreference,
} from "./core/lazyGuitarAudio";
