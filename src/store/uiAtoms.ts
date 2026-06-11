import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { k, rawStringStorage, GET_ON_INIT } from "../utils/storage";

export const displayFormatAtom = atomWithStorage<"notes" | "degrees" | "none">(
  k("displayFormat"),
  "degrees",
  rawStringStorage<"notes" | "degrees" | "none">(),
  GET_ON_INIT,
);

export const settingsOverlayOpenAtom = atom<boolean>(false);

/**
 * Count of currently-open *modal* AdaptiveModal sheets (Settings / Help on
 * mobile). Bumped by `AdaptiveModal` while a `presentation="sheet"` modal is
 * open. The persistent `MobileSheet` is non-modal and does NOT touch this.
 *
 * Read by `useUnhideMobileShell`: a genuine modal sheet *should* aria-hide the
 * background (the shell + the persistent sheet), so while this is > 0 the
 * un-hiding observer stands down and lets Radix's `hideOthers` win. When it
 * returns to 0 the observer re-asserts the shell's accessibility (the
 * persistent sheet's spurious `hideOthers` lingers via aria-hidden's reference
 * counter and would otherwise stay applied).
 */
export const openModalSheetCountAtom = atom<number>(0);

export type ThemePreference = "light" | "dark" | "system";

export const themeAtom = atomWithStorage<ThemePreference>(
  k("theme"),
  "system",
  rawStringStorage<ThemePreference>(),
  GET_ON_INIT,
);

// Stores the id of the most recently dismissed What's-new notice.
// Empty string means the user has never dismissed any notice.
export const helpWhatsNewSeenAtom = atomWithStorage<string>(
  k("helpWhatsNewSeen"),
  "",
  rawStringStorage<string>(),
  GET_ON_INIT,
);

export type MobileSheetSnap = "peek" | "half" | "full";

/**
 * Persisted snap position of the mobile bottom sheet. "peek" shows only the
 * mini-player transport row; "half" and "full" expose the Inspector tabs.
 * Defaults to "half" — the sheet rests half-open (Maps-style) so the controls
 * use the lower screen and the fretboard is sized to fill the space above it
 * (see getMobileStringRowPx in src/layout/responsive.ts).
 */
export const mobileSheetSnapAtom = atomWithStorage<MobileSheetSnap>(
  k("mobileSheetSnap"),
  "half",
  rawStringStorage<MobileSheetSnap>(),
  GET_ON_INIT,
);

export type MobilePanelId = "none" | "overlay" | "song";

/**
 * Which dock panel is open in the mobile shell: the Overlay panel (anchored
 * above the dock, board stays visible) or the Song panel (full-screen setup).
 * Deliberately NOT persisted — restoring a stale "song" would reopen the
 * full-screen setup panel on every app load.
 */
export const mobilePanelAtom = atom<MobilePanelId>("none");

