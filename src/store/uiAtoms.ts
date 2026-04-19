import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { k, rawStringStorage, GET_ON_INIT } from "../utils/storage";

const MOBILE_TABS = ["theory", "view"] as const;
type MobileTab = (typeof MOBILE_TABS)[number];

const mobileTabStorage = {
  getItem(key: string, initialValue: MobileTab): MobileTab {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, initialValue);
        return initialValue;
      }
      if (stored === "key" || stored === "scale") {
        localStorage.setItem(key, "theory");
        return "theory";
      }
      if (stored === "settings") {
        localStorage.setItem(key, "view");
        return "view";
      }
      if (stored === "fretboard") {
        localStorage.setItem(key, "view");
        return "view";
      }
      if ((MOBILE_TABS as readonly string[]).includes(stored)) {
        return stored as MobileTab;
      }
      localStorage.setItem(key, initialValue);
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: MobileTab): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage blocked or unavailable; ignore.
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage blocked or unavailable; ignore.
    }
  },
};

export const displayFormatAtom = atomWithStorage<"notes" | "degrees" | "none">(
  k("displayFormat"),
  "notes",
  rawStringStorage<"notes" | "degrees" | "none">(),
  GET_ON_INIT,
);

export const mobileTabAtom = atomWithStorage<"theory" | "view">(
  k("mobileTab"),
  "theory",
  mobileTabStorage,
  GET_ON_INIT,
);

export const tabletTabAtom = atomWithStorage<"settings" | "scales">(
  k("tabletTab"),
  "settings",
  rawStringStorage<"settings" | "scales">(),
  GET_ON_INIT,
);

export type LandscapeNarrowTab = "fretboard" | "scaleChord" | "key";

export const landscapeNarrowTabAtom = atomWithStorage<LandscapeNarrowTab>(
  k("landscapeNarrowTab"),
  "fretboard",
  rawStringStorage<LandscapeNarrowTab>(),
  GET_ON_INIT,
);

export const settingsOverlayOpenAtom = atom<boolean>(false);
