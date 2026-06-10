import { describe, expect, it } from "vitest";
import { getResponsiveLayout } from "./responsive";

describe("useSheetShell flag", () => {
  it("is true for the mobile tier", () => {
    expect(getResponsiveLayout(375, 812).useSheetShell).toBe(true);
  });

  it("is true for tablet-split (tablet width, tall viewport)", () => {
    expect(getResponsiveLayout(800, 1100).useSheetShell).toBe(true);
  });

  it("is false for tablet-stacked (tablet width, compact height)", () => {
    expect(getResponsiveLayout(800, 700).useSheetShell).toBe(false);
  });

  it("is false for all desktop variants", () => {
    expect(getResponsiveLayout(1280, 1000).useSheetShell).toBe(false);
    expect(getResponsiveLayout(1100, 700).useSheetShell).toBe(false);
  });
});

describe("stringRowPx", () => {
  it("mobile string rows grow to use reclaimed chrome space", () => {
    expect(getResponsiveLayout(375, 812).stringRowPx).toBe(38);
  });
});
