import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeVoiceLeadingMoves,
  MAX_VOICE_LEADING_MOVES,
  MIN_VOICE_LEADING_TRAVEL_PX,
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

  it("caps at MAX_VOICE_LEADING_MOVES, keeping the longest travels, and logs the drop", () => {
    expect(MAX_VOICE_LEADING_MOVES).toBe(4);
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const notes: VoiceLeadingNote[] = [];
    for (let i = 1; i <= 5; i++) {
      notes.push(note({ stringIndex: 0, fretIndex: i, cx: i * 10, cy: 0, transitionRole: "incoming" }));
      notes.push(note({ stringIndex: 1, fretIndex: i, cx: i * 10 + i * 20, cy: 0, transitionRole: "departing" }));
    }
    const moves = computeVoiceLeadingMoves(notes);
    expect(moves).toHaveLength(MAX_VOICE_LEADING_MOVES);
    expect(moves.map((m) => m.targetKey)).not.toContain("0-1");
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug.mock.calls[0][0]).toContain("dropped 1");
  });
});
