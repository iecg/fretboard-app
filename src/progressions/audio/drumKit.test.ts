import { describe, it, expect } from "vitest";
import { scheduleRide } from "./drumKit";

describe("scheduleRide", () => {
  it("is exported as a function", () => {
    expect(scheduleRide).toBeTypeOf("function");
  });
});
