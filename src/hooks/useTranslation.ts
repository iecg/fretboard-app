import { useAtomValue } from "jotai";
import { languageAtom } from "../store/languageAtom";
import { en } from "../i18n/en";
import { es } from "../i18n/es";
import type { Dictionary } from "../i18n/types";

const dictionaries: Record<string, Dictionary> = { en, es };

export function useTranslation() {
  const language = useAtomValue(languageAtom);
  const dict = dictionaries[language] || en;

  const t = (keyPath: string): string => {
    const keys = keyPath.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = dict;
    for (const key of keys) {
      if (current[key] === undefined) {
        console.warn(`Translation key not found: ${keyPath}`);
        return keyPath;
      }
      current = current[key];
    }
    return current as string;
  };

  return { t, language };
}