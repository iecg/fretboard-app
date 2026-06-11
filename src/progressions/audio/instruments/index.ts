import type { ChordVoice } from "./types";
import { createReusableChordVoice } from "./createReusableChordVoice";
import { getChordPatch, DEFAULT_CHORD_PATCH_ID } from "../sound/instrumentPatches";

export type { ChordVoice } from "./types";

const voiceCache = new Map<string, ChordVoice>();

/**
 * Resolve the pooled chord voice for a chord patch id. The chord layer is
 * piano-only (poly patches); unknown ids fall back to the grand piano.
 * Memoized per patch id (one pooled voice per timbre).
 */
export function getChordVoice(patchId: string): ChordVoice {
  const patch = getChordPatch(patchId) ?? getChordPatch(DEFAULT_CHORD_PATCH_ID)!;
  const cached = voiceCache.get(patch.id);
  if (cached) return cached;
  const v = createReusableChordVoice(patch.poly);
  voiceCache.set(patch.id, v);
  return v;
}
