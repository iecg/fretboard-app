import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useTranslation } from "./useTranslation";
import { Provider, createStore } from "jotai";
import { languageAtom } from "../store/languageAtom";
import React from "react";

describe("useTranslation", () => {
  it("translates to English by default", () => {
    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.language).toBe("en");
    expect(result.current.t("settings.title")).toBe("Settings");
  });

  it("translates to Spanish when language changes", () => {
    const store = createStore();
    store.set(languageAtom, "es");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.language).toBe("es");
    expect(result.current.t("settings.title")).toBe("Ajustes");
  });

  it("warns and returns the key when a translation is missing", () => {
    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useTranslation(), { wrapper });

    const missingKey = "nonexistent.key";
    expect(result.current.t(missingKey)).toBe(missingKey);
    expect(warnSpy).toHaveBeenCalledWith(`Translation key not found: ${missingKey}`);

    warnSpy.mockRestore();
  });
});