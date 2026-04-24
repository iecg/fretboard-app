import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { themeAtom } from "../store/atoms";

export type ResolvedTheme = "modern-dark" | "modern-light";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function useResolvedTheme(): ResolvedTheme {
  const userPreference = useAtomValue(themeAtom);
  const [systemDark, setSystemDark] = useState<boolean>(
    () => window.matchMedia(DARK_QUERY).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(DARK_QUERY);
    const handler = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches);
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  if (userPreference === "system") {
    return systemDark ? "modern-dark" : "modern-light";
  }
  return userPreference === "light" ? "modern-light" : "modern-dark";
}
