import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isInspectorPreviewEnabled } from "./inspectorPreview";

describe("isInspectorPreviewEnabled", () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  function setSearch(search: string) {
    Object.defineProperty(window, "location", {
      value: new URL(`http://localhost/${search}`),
      writable: true,
    });
  }

  it("returns false when no query string is present", () => {
    setSearch("");
    expect(isInspectorPreviewEnabled()).toBe(false);
  });

  it("returns false when the inspector param is missing", () => {
    setSearch("?foo=bar");
    expect(isInspectorPreviewEnabled()).toBe(false);
  });

  it("returns false when inspector has a non-tabs value", () => {
    setSearch("?inspector=other");
    expect(isInspectorPreviewEnabled()).toBe(false);
  });

  it("returns true when inspector=tabs is present", () => {
    setSearch("?inspector=tabs");
    expect(isInspectorPreviewEnabled()).toBe(true);
  });

  it("returns true when inspector=tabs is mixed with other params", () => {
    setSearch("?lang=en&inspector=tabs");
    expect(isInspectorPreviewEnabled()).toBe(true);
  });
});
