// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetProgressionAudioForTests, ensureProgressionAudio } from "./bus";

describe("ensureProgressionAudio", () => {
  beforeEach(() => {
    _resetProgressionAudioForTests();
  });

  it("logs a dev-mode warning when init throws", () => {
    const origCtor = (window as unknown as { AudioContext: unknown }).AudioContext;
    // Force a throw inside the try: monkey-patch window.AudioContext to throw.
    // Must use a class (function constructor) so Vitest doesn't emit its own
    // "did not use 'function' or 'class'" warning on the spy call.
    class BrokenAudioContext {
      constructor() {
        throw new Error("induced failure for warn-test");
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext =
      BrokenAudioContext as unknown as typeof AudioContext;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const audio = ensureProgressionAudio();

    expect(audio).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[progression-audio]"),
      expect.any(Error),
    );

    warnSpy.mockRestore();
    (window as unknown as { AudioContext: unknown }).AudioContext = origCtor;
    _resetProgressionAudioForTests();
  });
});
