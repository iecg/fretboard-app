import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { k, rawStringStorage, booleanStorage, GET_ON_INIT } from "../utils/storage";

export const displayFormatAtom = atomWithStorage<"notes" | "degrees" | "none">(
  k("displayFormat"),
  "notes",
  rawStringStorage<"notes" | "degrees" | "none">(),
  GET_ON_INIT,
);

export const settingsOverlayOpenAtom = atom<boolean>(false);

export type ThemePreference = "light" | "dark" | "system";

export const themeAtom = atomWithStorage<ThemePreference>(
  k("theme"),
  "system",
  rawStringStorage<ThemePreference>(),
  GET_ON_INIT,
);

/**
 * One-time "What's new" notice shown in HelpModal explaining that the manual
 * chord-mode toggle was removed (Phase 2). Set to `true` once the user dismisses
 * the notice. Persisted so the message never returns for that user.
 */
export const seenChordModeRemovalNoticeAtom = atomWithStorage<boolean>(
  k("seenChordModeRemovalNotice"),
  false,
  booleanStorage,
  GET_ON_INIT,
);

