import { describe, expect, it } from "vitest";
import { resolveFretboardMotionPolicy } from "./motionPolicy";

describe("resolveFretboardMotionPolicy", () => {
  it("disables all motion when reduced motion is requested", () => {
    expect(
      resolveFretboardMotionPolicy({ prefersReducedMotion: true }),
    ).toEqual({
      noteMode: "none",
      shapeMode: "none",
      connectorMode: "none",
    });
  });

  it("uses CSS for notes and group fades for shapes/connectors by default", () => {
    expect(
      resolveFretboardMotionPolicy({ prefersReducedMotion: false }),
    ).toEqual({
      noteMode: "css",
      shapeMode: "group",
      connectorMode: "group",
    });
  });
});
