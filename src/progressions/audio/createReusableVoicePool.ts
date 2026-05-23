interface PoolableVoice {
  connect(dest: AudioNode): unknown;
  dispose(): void;
}

interface PooledVoiceEntry<TVoice extends PoolableVoice> {
  voice: TVoice;
  busyUntil: number;
  leaseGeneration: number;
}

export interface ReusableVoiceLease<TVoice extends PoolableVoice> {
  voice: TVoice;
  generation: number;
  setBusyUntil: (busyUntil: number) => void;
  isCurrent: () => boolean;
  dispose: () => void;
}

export function createReusableVoicePool<TVoice extends PoolableVoice>(config: {
  createVoice: () => TVoice;
}) {
  const voicePool = new WeakMap<AudioNode, PooledVoiceEntry<TVoice>[]>();

  const removeEntry = (dest: AudioNode, entry: PooledVoiceEntry<TVoice>) => {
    const entries = voicePool.get(dest);
    if (!entries) return;

    const nextEntries = entries.filter((candidate) => candidate !== entry);
    if (nextEntries.length === 0) {
      voicePool.delete(dest);
      return;
    }

    voicePool.set(dest, nextEntries);
  };

  const createEntry = (dest: AudioNode) => {
    const voice = config.createVoice();
    voice.connect(dest);
    return { voice, busyUntil: 0, leaseGeneration: 0 };
  };

  return {
    lease(dest: AudioNode, now: number): ReusableVoiceLease<TVoice> {
      const entries = voicePool.get(dest) ?? [];
      const entry =
        entries.find((candidate) => candidate.busyUntil <= now) ?? createEntry(dest);

      if (!entries.includes(entry)) {
        voicePool.set(dest, [...entries, entry]);
      }

      entry.leaseGeneration += 1;
      const generation = entry.leaseGeneration;

      return {
        voice: entry.voice,
        generation,
        setBusyUntil: (busyUntil) => {
          entry.busyUntil = busyUntil;
        },
        isCurrent: () => entry.leaseGeneration === generation,
        dispose: () => {
          if (entry.leaseGeneration !== generation) return;
          removeEntry(dest, entry);
          entry.busyUntil = 0;
          entry.voice.dispose();
        },
      };
    },
  };
}
