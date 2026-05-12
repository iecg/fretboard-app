import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
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
});