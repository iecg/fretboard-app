import { atomWithStorage } from "jotai/utils";
import type { SupportedLanguage } from "../i18n/types";

export const languageAtom = atomWithStorage<SupportedLanguage>(
  "fretflow-language",
  "en"
);
