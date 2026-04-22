import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { themeAtom } from "../store/atoms";

export type ResolvedTheme = "modern-dark" | "modern-light";

export function useResolvedTheme(): ResolvedTheme {
  const userPreference = useAtomValue(themeAtom);
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
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
