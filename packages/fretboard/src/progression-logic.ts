// Tone-free musical-logic surface for native (React Native) consumers.
// NONE of these modules import "tone" — safe to import from a RN app where
// Tone.js cannot run. The web app keeps using the Tone-based engine directly.
export { buildAllLayersAsync } from "./progressions/audio/buildAllLayers";
export type {
  BuildAllLayersInput, BuiltLayers,
  ChordOnsetEvent, ChordStrumEvent, BassEvent, DrumEvent, MetronomeEvent,
} from "./progressions/audio/buildAllLayers";
export {
  getChordPattern, getBassPattern, getDrumPattern,
  getChordVariation, getBassVariation, getDrumVariation,
} from "./progressions/audio/patterns";
export { getGenreStyle, GENRE_STYLES } from "./progressions/audio/genres";
export type { GenreStyle } from "./progressions/audio/genres";
export { getGenreMix } from "./progressions/audio/sound/genreMixPresets";
export { getBassPatch, getDrumKitPatch } from "./progressions/audio/sound/instrumentPatches";
export type { BassPatch, DrumKitPatch, PolyChordSpec } from "./progressions/audio/sound/patchTypes";
export {
  PROGRESSION_PRESETS, resolveProgressionStep,
} from "./progressions/progressionDomain";
export type {
  ProgressionStep, ResolvedProgressionStep, ProgressionPreset,
} from "./progressions/progressionDomain";
