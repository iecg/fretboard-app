import { describe, it, expect, beforeEach } from "vitest";
import { getChordVoice, _resetChordSynths } from "./index";

describe("chord voice resolution (piano-only chord layer)", () => {
  beforeEach(() => {
    _resetChordSynths();
  });
  it("resolves a known patch id to a memoized voice", () => {
    const v = getChordVoice("chord-epiano");
    expect(typeof v.scheduleChord).toBe("function");
    expect(v).toBe(getChordVoice("chord-epiano"));
  });

  it("falls back to the grand piano for unknown patch ids", () => {
    const unknown = getChordVoice("chord-does-not-exist");
    const grand = getChordVoice("chord-grand-piano");
    expect(unknown).toBe(grand);
  });
});
