import { describe, expect, it } from "vitest";
import { resolveFretboardMotionPolicy } from "./motionPolicy";

describe("resolveFretboardMotionPolicy", () => {
  it("disables all motion when reduced motion is requested", () => {
    expect(
      resolveFretboardMotionPolicy({
        prefersReducedMotion: true,
        noteCount: 42,
        shapeCount: 3,
        connectorCount: 2,
      }),
    ).toEqual({
      noteMode: "none",
      shapeMode: "none",
      connectorMode: "none",
    });
  });

  it("uses CSS for notes and group fades for shapes/connectors by default", () => {
    expect(
      resolveFretboardMotionPolicy({
        prefersReducedMotion: false,
        noteCount: 42,
        shapeCount: 2,
        connectorCount: 1,
      }),
    ).toEqual({
      noteMode: "css",
      shapeMode: "group",
      connectorMode: "group",
    });
  });
});
