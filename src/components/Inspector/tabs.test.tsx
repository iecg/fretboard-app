import { describe, it, expect } from "vitest";
import { INSPECTOR_TABS } from "./tabs";

describe("INSPECTOR_TABS", () => {
  it("has exactly two tabs: view and song", () => {
    expect(INSPECTOR_TABS.map((t) => t.id)).toEqual(["view", "song"]);
  });

  it("uses viewTab and songTab i18n keys", () => {
    expect(INSPECTOR_TABS.map((t) => t.labelKey)).toEqual(["viewTab", "songTab"]);
  });
});
