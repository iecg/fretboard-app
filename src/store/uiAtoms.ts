import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { k, createStorage, rawStringStorage, GET_ON_INIT } from "../utils/storage";

const MOBILE_TABS = ["scales", "chords", "cof", "view"] as const;
type MobileTab = (typeof MOBILE_TABS)[number];

const mobileTabStorage = createStorage<MobileTab>({
  validate: (v) => (MOBILE_TABS as readonly string[]).includes(v),
  onRead: (v) => {
    // Migrate legacy values from old tab ids to new tab ids.
    if (v === ("key" as unknown as string) || v === ("scale" as unknown as string) || v === ("theory" as unknown as string)) return "scales";
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

export const mobileTabAtom = atomWithStorage<"scales" | "chords" | "cof" | "view">(
  k("mobileTab"),
  "scales",
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

export type CompactDensityMode = "auto" | "on" | "off";

const compactDensityStorage = createStorage<CompactDensityMode>({
  validate: (v) => ["auto", "on", "off"].includes(v as string),
  onRead: (v: unknown) => {
    if (v === true || v === "true") return "on";
    if (v === false || v === "false") return "auto";
    return v as CompactDensityMode;
  },
});

export const compactDensityAtom = atomWithStorage<CompactDensityMode>(
  k("compactDensity"),
  "auto",
  compactDensityStorage,
  GET_ON_INIT,
);

export type ThemePreference = "light" | "dark" | "system";

export const themeAtom = atomWithStorage<ThemePreference>(
  k("theme"),
  "dark",
  rawStringStorage<ThemePreference>(),
  GET_ON_INIT,
);
