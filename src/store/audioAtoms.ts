import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { k, booleanStorage, GET_ON_INIT, createStorage, enumValidator } from "../utils/storage";
import type { QualitySetting } from "../progressions/audio/sound/qualityTiers";

export const audioErrorAtom = atom<string | null>(null);

/**
 * Set when Safari's Web Audio output session is detected as wedged (context
 * reports "running" + currentTime advances, but the hardware clock is frozen —
 * see `core/audioOutputHealth.ts`). Not persisted: a browser restart clears the
 * condition, and so does a reload of this flag. Drives a guidance banner.
 */
export const audioOutputWedgedAtom = atom<boolean>(false);

export const enharmonicDisplayAtom = atom<"auto" | "on" | "off">("auto");

export const isMutedAtom = atomWithStorage(
  k("isMuted"),
  false,
  booleanStorage,
  GET_ON_INIT,
);

export const toggleMuteAtom = atom(null, (get, set) => {
  set(isMutedAtom, !get(isMutedAtom));
});

const QUALITY_VALUES = ["auto", "eco", "standard", "high"] as const satisfies readonly QualitySetting[];

export const audioQualityAtom = atomWithStorage<QualitySetting>(
  k("audioQuality"),
  "auto",
  createStorage<QualitySetting>({
    serialize: (v) => v,
    deserialize: (v) => v as QualitySetting,
    validate: enumValidator(QUALITY_VALUES),
  }),
  GET_ON_INIT,
);
