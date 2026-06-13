import { describe, it, expect } from "vitest";
import { IS_DEV, IS_TEST } from "./env";

describe("env", () => {
  it("reports test mode under vitest", () => {
    expect(IS_TEST).toBe(true);
  });
  it("exposes a boolean dev flag", () => {
    expect(typeof IS_DEV).toBe("boolean");
  });
});
