import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeVoiceLeadingMoves,
  MAX_VOICE_LEADING_MOVES,
  MIN_VOICE_LEADING_TRAVEL_PX,
  MAX_VOICE_LEADING_FRET_SPAN,
  MAX_VOICE_LEADING_STRING_SPAN,
  type VoiceLeadingNote,
} from "./voiceLeading";

function note(o: Partial<VoiceLeadingNote> & Pick<VoiceLeadingNote, "stringIndex" | "fretIndex" | "cx" | "cy">): VoiceLeadingNote {
  return { isInRegion: true, transitionRole: undefined, ...o };
}

afterEach(() => vi.restoreAllMocks());

describe("computeVoiceLeadingMoves", () => {
  it("returns [] when there are no incoming targets", () => {
    const notes = [note({ stringIndex: 1, fretIndex: 5, cx: 100, cy: 0, transitionRole: "departing" })];
    expect(computeVoiceLeadingMoves(notes)).toEqual([]);
  });

  it("returns [] when there are no departing/held sources", () => {
    const notes = [note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming" })];
    expect(computeVoiceLeadingMoves(notes)).toEqual([]);
  });

  it("pairs each incoming target to its nearest source (one source per target)", () => {
    const notes = [
      note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 0, fretIndex: 10, cx: 200, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 1, fretIndex: 5, cx: 110, cy: 0, transitionRole: "departing" }),
      note({ stringIndex: 1, fretIndex: 9, cx: 190, cy: 0, transitionRole: "held" }),
    ];
    const moves = computeVoiceLeadingMoves(notes);
    expect(moves).toHaveLength(2);
    expect(moves.map((m) => m.targetKey).sort()).toEqual(["0-10", "0-5"]);
    const a = moves.find((m) => m.targetKey === "0-5")!;
    expect(a.sourceKey).toBe("1-5");
    expect(a.dx).toBe(10);
    expect(a.dy).toBe(0);
    const b = moves.find((m) => m.targetKey === "0-10")!;
    expect(b.sourceKey).toBe("1-9");
    expect(b.dx).toBe(-10);
  });

  it("does not claim the same source for two targets", () => {
    const notes = [
      note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 0, fretIndex: 6, cx: 101, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 1, fretIndex: 5, cx: 100, cy: 50, transitionRole: "departing" }),
    ];
    const moves = computeVoiceLeadingMoves(notes);
    expect(moves).toHaveLength(1);
    expect(moves[0].targetKey).toBe("0-5");
  });

  it("drops pairings whose travel is below the threshold", () => {
    expect(MIN_VOICE_LEADING_TRAVEL_PX).toBe(8);
    const notes = [
      note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 1, fretIndex: 5, cx: 104, cy: 0, transitionRole: "departing" }),
    ];
    expect(computeVoiceLeadingMoves(notes)).toEqual([]);
  });

  it("ignores out-of-region targets and sources", () => {
    const notes = [
      note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming", isInRegion: false }),
      note({ stringIndex: 1, fretIndex: 5, cx: 130, cy: 0, transitionRole: "departing", isInRegion: false }),
      note({ stringIndex: 2, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming", isInRegion: true }),
      note({ stringIndex: 3, fretIndex: 5, cx: 140, cy: 0, transitionRole: "departing", isInRegion: true }),
    ];
    const moves = computeVoiceLeadingMoves(notes);
    expect(moves).toHaveLength(1);
    expect(moves[0].targetKey).toBe("2-5");
    expect(moves[0].sourceKey).toBe("3-5");
  });

  it("caps at MAX_VOICE_LEADING_MOVES, keeping the SHORTEST travels, and logs the drop", () => {
    expect(MAX_VOICE_LEADING_MOVES).toBe(3);
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const notes: VoiceLeadingNote[] = [];
    // 5 same-fret/adjacent-string pairs (all within the span cap) with increasing
    // pixel travel (20,40,60,80,100). Keep-shortest must keep targets 0-1..0-3.
    for (let i = 1; i <= 5; i++) {
      notes.push(note({ stringIndex: 0, fretIndex: i, cx: i * 10, cy: 0, transitionRole: "incoming" }));
      notes.push(note({ stringIndex: 1, fretIndex: i, cx: i * 10 + i * 20, cy: 0, transitionRole: "departing" }));
    }
    const moves = computeVoiceLeadingMoves(notes);
    expect(moves).toHaveLength(MAX_VOICE_LEADING_MOVES);
    const kept = moves.map((m) => m.targetKey);
    expect(kept).toContain("0-1");      // shortest travel (20) kept
    expect(kept).not.toContain("0-5");  // longest travel (100) dropped
    expect(kept).not.toContain("0-4");  // second-longest (80) dropped
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug.mock.calls[0][0]).toContain("dropped 2");
  });

  it("exposes the span caps", () => {
    expect(MAX_VOICE_LEADING_FRET_SPAN).toBe(3);
    expect(MAX_VOICE_LEADING_STRING_SPAN).toBe(2);
  });

  it("drops a pairing when the source is beyond the fret span (no cross-board slide)", () => {
    const notes = [
      note({ stringIndex: 0, fretIndex: 2, cx: 20, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 0, fretIndex: 12, cx: 120, cy: 0, transitionRole: "departing" }), // Δfret 10 > 3
    ];
    expect(computeVoiceLeadingMoves(notes)).toEqual([]);
  });

  it("drops a pairing when the source is beyond the string span", () => {
    const notes = [
      note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 5, fretIndex: 5, cx: 100, cy: 100, transitionRole: "departing" }), // Δstring 5 > 2
    ];
    expect(computeVoiceLeadingMoves(notes)).toEqual([]);
  });

  it("pairs an in-span source even when a nearer-by-pixels source is out of span", () => {
    const notes = [
      note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming" }),
      // in-span (Δfret 1, Δstring 1), dist 12
      note({ stringIndex: 1, fretIndex: 6, cx: 112, cy: 0, transitionRole: "departing" }),
      // out-of-span (Δfret 6 > 3) even though only 10px away — must be ignored
      note({ stringIndex: 0, fretIndex: 11, cx: 110, cy: 0, transitionRole: "held" }),
    ];
    const moves = computeVoiceLeadingMoves(notes);
    expect(moves).toHaveLength(1);
    expect(moves[0].sourceKey).toBe("1-6");
  });
});
