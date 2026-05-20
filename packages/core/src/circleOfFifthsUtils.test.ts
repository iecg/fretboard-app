import { describe, expect, it } from "vitest";
import { getCircleNoteLabels } from "./circleOfFifthsUtils";
import { SCALES } from "./theoryCatalog";

const labels = (
  note: string,
  root: string,
  useFlats: boolean,
  mode: "auto" | "on" | "off",
) => getCircleNoteLabels(note, root, useFlats, SCALES["Major"], mode);

describe("getCircleNoteLabels", () => {
  describe("mode = auto (default)", () => {
    it("sharp note shows flat enharmonic when in foreign key", () => {
      const r = labels("A#", "C", false, "auto");
      expect(r.primary).toBe("A♯"); // A♯
      expect(r.enharmonic).toBe("B♭"); // B♭
    });

    it("natural note has no enharmonic", () => {
      const r = labels("C", "C", false, "auto");
      expect(r.primary).toBe("C");
      expect(r.enharmonic).toBeNull();
    });

    it("respelled note (root uses flats) shows original sharp as enharmonic", () => {
      const r = labels("A#", "A#", true, "auto");
      expect(r.primary).toBe("B♭"); // B♭
      expect(r.enharmonic).toBe("A♯"); // A♯
    });

    it("D# in C major: sharp + enharmonic Eb", () => {
      const r = labels("D#", "C", false, "auto");
      expect(r.primary).toBe("D♯"); // D♯
      expect(r.enharmonic).toBe("E♭"); // E♭
    });

    it("G in C major: no enharmonic", () => {
      const r = labels("G", "C", false, "auto");
      expect(r.primary).toBe("G");
      expect(r.enharmonic).toBeNull();
    });
  });

  describe("mode = on", () => {
    it("sharp note always shows flat enharmonic", () => {
      const r = labels("C#", "C", false, "on");
      expect(r.primary).toBe("C♯"); // C♯
      expect(r.enharmonic).toBe("D♭"); // D♭
    });

    it("natural note with no enharmonic shows primary only", () => {
      const r = labels("C", "C", false, "on");
      expect(r.primary).toBe("C");
      expect(r.enharmonic).toBeNull();
    });

    it("flat-spelled primary shows sharp enharmonic", () => {
      const r = labels("A#", "A#", true, "on");
      expect(r.primary).toBe("B♭"); // B♭
      expect(r.enharmonic).toBe("A♯"); // A♯
    });

    it("every enharmonic pair shows both spellings", () => {
      const pairs: [string, string][] = [
        ["C#", "D♭"],
        ["D#", "E♭"],
        ["F#", "G♭"],
        ["G#", "A♭"],
        ["A#", "B♭"],
      ];
      for (const [note, expectedEnh] of pairs) {
        expect(labels(note, "C", false, "on").enharmonic).toBe(expectedEnh);
      }
    });

    it("all flat-spelled pairs show distinct enharmonics", () => {
      const flatPairs: [string, string, string][] = [
        ["C#", "D♭", "C♯"],
        ["D#", "E♭", "D♯"],
        ["F#", "G♭", "F♯"],
        ["G#", "A♭", "G♯"],
        ["A#", "B♭", "A♯"],
      ];
      for (const [note, expectedPrimary, expectedEnh] of flatPairs) {
        const r = labels(note, note, true, "on");
        expect(r.primary).toBe(expectedPrimary);
        expect(r.enharmonic).toBe(expectedEnh);
        expect(r.primary).not.toBe(r.enharmonic);
      }
    });
  });

  describe("mode = off", () => {
    it("sharp note shows primary only", () => {
      const r = labels("A#", "C", false, "off");
      expect(r.primary).toBe("A♯"); // A♯
      expect(r.enharmonic).toBeNull();
    });

    it("respelled note shows respelled primary only", () => {
      const r = labels("A#", "A#", true, "off");
      expect(r.primary).toBe("B♭"); // B♭
      expect(r.enharmonic).toBeNull();
    });

    it("natural note shows primary only", () => {
      const r = labels("C", "C", false, "off");
      expect(r.primary).toBe("C");
      expect(r.enharmonic).toBeNull();
    });
  });

  describe("default mode (auto)", () => {
    it("uses auto when mode is omitted", () => {
      const r = getCircleNoteLabels("A#", "C", false, SCALES["Major"]);
      expect(r.primary).toBe("A♯");
      expect(r.enharmonic).toBe("B♭");
    });
  });
});
