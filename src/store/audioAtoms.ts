import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { k, booleanStorage, GET_ON_INIT, createStorage, enumValidator } from "../utils/storage";
import type { QualitySetting } from "../progressions/audio/sound/qualityTiers";

export const audioErrorAtom = atom<string | null>(null);

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
