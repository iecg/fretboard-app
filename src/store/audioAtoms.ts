import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { k, booleanStorage, GET_ON_INIT } from "../utils/storage";

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
