import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { k, createStorage, rawStringStorage, GET_ON_INIT } from "../utils/storage";

const MOBILE_TABS = ["theory", "view"] as const;
type MobileTab = (typeof MOBILE_TABS)[number];

const mobileTabStorage = createStorage<MobileTab>({
  validate: (v) => (MOBILE_TABS as readonly string[]).includes(v),
  onRead: (v) => {
    if (v === ("key" as unknown as string) || v === ("scale" as unknown as string)) return "theory";
    if (v === ("settings" as unknown as string) || v === ("fretboard" as unknown as string)) return "view";
    return v;
  },
});

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

export const themeAtom = atomWithStorage<"light" | "dark" | "system">(
  k("theme"),
  "dark",
  rawStringStorage<"light" | "dark" | "system">(),
  GET_ON_INIT,
);
