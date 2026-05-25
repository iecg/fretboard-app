import { generateVoicingsUncached, type GenerateVoicingsParams, type Voicing } from "./voicings";

const cache = new Map<string, Voicing[]>();

function getCacheKey(params: GenerateVoicingsParams): string {
  return `${params.chordRoot}|${params.chordType}|${params.tuning.join(",")}|${params.maxFret}|${params.voicingType}`;
}

export function getCachedVoicings(params: GenerateVoicingsParams): Voicing[] {
  const key = getCacheKey(params);
  let result = cache.get(key);
  if (!result) {
    result = generateVoicingsUncached(params);
    cache.set(key, result);
  }
  return result;
}

export function prewarmVoicings(
  chords: Array<{ chordRoot: string; chordType: string | null }>,
  tuning: string[],
  maxFret: number
): void {
  for (const { chordRoot, chordType } of chords) {
    if (!chordType) continue;
    getCachedVoicings({ chordRoot, chordType, tuning, maxFret, voicingType: "full" });
    getCachedVoicings({ chordRoot, chordType, tuning, maxFret, voicingType: "close" });
  }
}

export function clearVoicingCache(): void {
  cache.clear();
}
