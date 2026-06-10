import type { ChordInstrumentId, ChordVoice } from "./types";
import { createStrumVoice } from "./strumVoice";
import { createReusableChordVoice } from "./createReusableChordVoice";
import { getChordPatch, DEFAULT_CHORD_PATCH_BY_FAMILY } from "../sound/instrumentPatches";
import type { ChordFamily, ChordPatch } from "../sound/patchTypes";

export type { ChordInstrumentId, ChordVoice } from "./types";

const familyForInstrument = (id: ChordInstrumentId): ChordFamily =>
  id === "strum" ? "strum" : "poly";

const voiceCache = new Map<string, ChordVoice>();

function buildVoice(patch: ChordPatch): ChordVoice {
  if (patch.family === "strum") return createStrumVoice(patch.strum);
  return createReusableChordVoice(patch.poly!);
}

function voiceForPatch(patch: ChordPatch): ChordVoice {
  const cached = voiceCache.get(patch.id);
  if (cached) return cached;
  const v = buildVoice(patch);
  voiceCache.set(patch.id, v);
  return v;
}

/**
 * Resolve the chord voice for the user-selected instrument family, preferring
 * the genre's chord patch when its family matches; otherwise fall back to the
 * family default patch. Memoized per patch id (one pooled voice per timbre).
 */
export function getChordVoiceForInstrument(
  instrument: ChordInstrumentId,
  genrePatchId: string,
  genreAltPatchId?: string,
): ChordVoice {
  const family = familyForInstrument(instrument);
  // Prefer whichever of the genre's primary/alt patches matches the selected
  // instrument family; otherwise fall back to that family's default patch.
  const candidates = [genrePatchId, genreAltPatchId]
    .map((id) => (id ? getChordPatch(id) : undefined))
    .filter((p): p is ChordPatch => p !== undefined);
  const patch = candidates.find((p) => p.family === family)
    ?? getChordPatch(DEFAULT_CHORD_PATCH_BY_FAMILY[family])!;
  return voiceForPatch(patch);
}

