import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DegreeGrid } from "./DegreeGrid";
import styles from "./DegreeGrid.module.css";

describe("DegreeGrid", () => {
  const baseProps = {
    scaleName: "major",
    tonicNote: "C",
    selectedNote: "C",
    onSelectInKey: vi.fn(),
    onSelectBorrowed: vi.fn(),
    preferFlats: false,
  };

  it("renders 12 cells (one per chromatic note)", () => {
    render(<DegreeGrid {...baseProps} />);
    const cells = screen.getAllByRole("button");
    expect(cells).toHaveLength(12);
  });

  it("shows in-key notes with their Roman numeral (i, IV, V, …)", () => {
    render(<DegreeGrid {...baseProps} />);
    const c = screen.getByRole("button", { name: /^C/ });
    expect(c).toHaveTextContent("I");
  });

  it("shows borrowed notes with ♭/♯-prefixed numerals and a muted style", () => {
    render(<DegreeGrid {...baseProps} />);
    const cSharp = screen.getByRole("button", { name: /^C#|C♯/ });
    expect(cSharp).toHaveAttribute("data-in-key", "false");
    expect(cSharp.textContent).toMatch(/[♭♯]/);
  });

  it("calls onSelectInKey when an in-key cell is clicked", () => {
    const onSelectInKey = vi.fn();
    render(<DegreeGrid {...baseProps} onSelectInKey={onSelectInKey} />);
    fireEvent.click(screen.getByRole("button", { name: /^F\s/i }));
    expect(onSelectInKey).toHaveBeenCalledWith("F", "IV");
  });

  it("calls onSelectBorrowed when a borrowed cell is clicked", () => {
    const onSelectBorrowed = vi.fn();
    render(<DegreeGrid {...baseProps} onSelectBorrowed={onSelectBorrowed} />);
    fireEvent.click(screen.getByRole("button", { name: /^C#|C♯/ }));
    // C major defaults to sharps (preferFlats=false), so the numeral spells the
    // root with a sharp too: ♯i (not ♭ii).
    expect(onSelectBorrowed).toHaveBeenCalledWith("C#", "♯i");
  });

  describe("borrowed numerals across modes", () => {
    it("labels A Natural Minor's borrowed cells with parent-major-relative numerals", () => {
      const onSelectBorrowed = vi.fn();
      render(
        <DegreeGrid
          {...baseProps}
          scaleName="minor"
          tonicNote="A"
          selectedNote="A"
          onSelectBorrowed={onSelectBorrowed}
        />,
      );
      // In A Natural Minor: in-key = A B C D E F G;
      // borrowed offsets {1,4,6,9,11} → A#, C#, D#, F#, G#.
      // A natural minor resolves to preferFlats=false, so chromatic offsets (1, 6)
      // pick the sharp form (♯i, ♯iv); natural-position offsets (4, 9, 11) have
      // no accidental and are unchanged.
      const cases: Array<[string, string]> = [
        ["A#", "♯i"],
        ["C#", "iii"],
        ["D#", "♯iv"],
        ["F#", "vi"],
        ["G#", "vii"],
      ];
      for (const [note, expectedNumeral] of cases) {
        const btn = screen.getByRole("button", {
          name: new RegExp(`${expectedNumeral} `),
        });
        expect(btn).toHaveAttribute("data-in-key", "false");
        expect(btn.textContent).toContain(expectedNumeral);
        fireEvent.click(btn);
        expect(onSelectBorrowed).toHaveBeenCalledWith(note, expectedNumeral);
      }
    });

    it("labels D Dorian's borrowed cells with parent-major-relative numerals", () => {
      render(
        <DegreeGrid
          {...baseProps}
          scaleName="dorian"
          tonicNote="D"
          selectedNote="D"
        />,
      );
      // In D Dorian: in-key = D E F G A B C;
      // borrowed offsets {1,4,6,8,11} → D#, F#, G#, A#, C#.
      // D Dorian resolves to preferFlats=false, so chromatic offsets (1, 6, 8)
      // pick the sharp form; natural-position offsets (4, 11) are unchanged.
      const expected: Record<string, string> = {
        "D#": "♯i",
        "F#": "iii",
        "G#": "♯iv",
        "A#": "♯v",
        "C#": "vii",
      };
      for (const [note, numeral] of Object.entries(expected)) {
        const btn = screen.getByRole("button", {
          name: new RegExp(`^${numeral} `),
        });
        expect(btn).toHaveAttribute("data-in-key", "false");
        expect(btn.textContent).toContain(numeral);
        expect(btn.getAttribute("aria-label")).toContain(note.replace("#", "♯"));
      }
    });

    it("flips spelling to flats when preferFlats=true overrides a sharp-default tonic", () => {
      const { container } = render(
        <DegreeGrid
          {...baseProps}
          scaleName="major"
          tonicNote="G"
          selectedNote="G"
          preferFlats={true}
        />,
      );
      // G major defaults to sharps — without the override, the C♯ chromatic
      // slot would display "C♯". With preferFlats=true it must render as "D♭",
      // and no note-display span should contain a ♯.
      const noteSpans = Array.from(
        container.querySelectorAll<HTMLElement>(`.${styles.note}`),
      );
      expect(noteSpans).not.toHaveLength(0);
      const displays = noteSpans.map((n) => n.textContent ?? "");
      expect(displays).toContain("D♭");
      expect(displays).not.toContain("C♯");
      for (const d of displays) expect(d).not.toMatch(/♯/);

      // Numeral accidentals must follow the same preferFlats=true preference —
      // the C#/D♭ chromatic cell (offset 6 from G) reads ♭v, not ♯iv.
      const numeralSpans = Array.from(
        container.querySelectorAll<HTMLElement>(`.${styles.numeral}`),
      );
      const numerals = numeralSpans.map((n) => n.textContent ?? "");
      expect(numerals).toContain("♭v");
      for (const n of numerals) expect(n).not.toMatch(/♯/);
    });

    it("never renders a raw integer numeral as a borrowed label", () => {
      render(
        <DegreeGrid
          {...baseProps}
          scaleName="minor"
          tonicNote="A"
          selectedNote="A"
        />,
      );
      const buttons = screen.getAllByRole("button");
      for (const btn of buttons) {
        expect(btn.textContent).not.toMatch(/\b\d{1,2}\b/);
      }
    });
  });

  describe("keyboard navigation (roving tabindex)", () => {
    it("starts with only the selected cell as tabIndex=0", () => {
      render(<DegreeGrid {...baseProps} selectedNote="E" />);
      const buttons = screen.getAllByRole("button");
      const tabbable = buttons.filter((b) => b.tabIndex === 0);
      expect(tabbable).toHaveLength(1);
      expect(tabbable[0].getAttribute("aria-label")).toMatch(/^E/);
    });

    it("falls back to the first cell when selectedNote is not in the chromatic set", () => {
      render(<DegreeGrid {...baseProps} selectedNote="Zz" />);
      const buttons = screen.getAllByRole("button");
      expect(buttons[0].tabIndex).toBe(0);
      expect(buttons.slice(1).every((b) => b.tabIndex === -1)).toBe(true);
    });

    it("moves focus to the next cell on ArrowRight", () => {
      render(<DegreeGrid {...baseProps} selectedNote="C" />);
      const buttons = screen.getAllByRole("button");
      buttons[0].focus();
      fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
      expect(document.activeElement).toBe(buttons[1]);
      expect(buttons[1].tabIndex).toBe(0);
      expect(buttons[0].tabIndex).toBe(-1);
    });

    it("moves focus to the previous cell on ArrowLeft", () => {
      render(<DegreeGrid {...baseProps} selectedNote="C" />);
      const buttons = screen.getAllByRole("button");
      buttons[2].focus();
      fireEvent.keyDown(buttons[2], { key: "ArrowLeft" });
      expect(document.activeElement).toBe(buttons[1]);
      expect(buttons[1].tabIndex).toBe(0);
    });

    it("wraps focus from last cell to first on ArrowRight", () => {
      render(<DegreeGrid {...baseProps} />);
      const buttons = screen.getAllByRole("button");
      buttons[11].focus();
      fireEvent.keyDown(buttons[11], { key: "ArrowRight" });
      expect(document.activeElement).toBe(buttons[0]);
    });

    it("wraps focus from first cell to last on ArrowLeft", () => {
      render(<DegreeGrid {...baseProps} />);
      const buttons = screen.getAllByRole("button");
      buttons[0].focus();
      fireEvent.keyDown(buttons[0], { key: "ArrowLeft" });
      expect(document.activeElement).toBe(buttons[11]);
    });

    it("jumps to first cell on Home and last cell on End", () => {
      render(<DegreeGrid {...baseProps} />);
      const buttons = screen.getAllByRole("button");
      buttons[5].focus();
      fireEvent.keyDown(buttons[5], { key: "End" });
      expect(document.activeElement).toBe(buttons[11]);
      fireEvent.keyDown(buttons[11], { key: "Home" });
      expect(document.activeElement).toBe(buttons[0]);
    });

    it("keeps exactly one tabbable cell at any time", () => {
      render(<DegreeGrid {...baseProps} />);
      const buttons = screen.getAllByRole("button");
      buttons[0].focus();
      fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
      fireEvent.keyDown(buttons[1], { key: "ArrowRight" });
      fireEvent.keyDown(buttons[2], { key: "ArrowRight" });
      const tabbable = buttons.filter((b) => b.tabIndex === 0);
      expect(tabbable).toHaveLength(1);
    });

  });

  describe("borrowed cell styling (Plan H-T9a)", () => {
    it("borrowed.selected cell has opacity 1 (selection wins over dim)", () => {
      const { container } = render(
        <DegreeGrid
          {...baseProps}
          scaleName="major"
          tonicNote="C"
          selectedNote="C#"
          preferFlats={false}
        />,
      );
      // C# is borrowed (not in C major)
      const selected = container.querySelector(
        `button[data-in-key="false"].${styles.selected}`,
      );
      expect(selected).toBeTruthy();
      const computedOpacity = getComputedStyle(selected as Element).opacity;
      expect(computedOpacity).toBe("1");
    });

    it("borrowed (unselected) cell has opacity 0.7", () => {
      const { container } = render(
        <DegreeGrid
          {...baseProps}
          scaleName="major"
          tonicNote="C"
          selectedNote="C"
          preferFlats={false}
        />,
      );
      // C is in-key, so any other note (e.g., C#) is borrowed and unselected
      const borrowed = container.querySelector(
        `button[data-in-key="false"]:not(.${styles.selected})`,
      );
      expect(borrowed).toBeTruthy();
      const computedOpacity = parseFloat(
        getComputedStyle(borrowed as Element).opacity,
      );
      expect(computedOpacity).toBeCloseTo(0.7);
    });

    it("borrowed.selected cell has solid accent border", () => {
      const { container } = render(
        <DegreeGrid
          {...baseProps}
          scaleName="major"
          tonicNote="C"
          selectedNote="C#"
          preferFlats={false}
        />,
      );
      const selected = container.querySelector(
        `button[data-in-key="false"].${styles.selected}`,
      );
      expect(selected).toBeTruthy();
      const borderStyle = getComputedStyle(selected as Element).borderStyle;
      // Should be solid, not dashed
      expect(borderStyle).toBe("solid");
    });

    it("borrowed (unselected) cell has dashed border", () => {
      const { container } = render(
        <DegreeGrid
          {...baseProps}
          scaleName="major"
          tonicNote="C"
          selectedNote="C"
          preferFlats={false}
        />,
      );
      const borrowed = container.querySelector(
        `button[data-in-key="false"]:not(.${styles.selected})`,
      );
      expect(borrowed).toBeTruthy();
      const borderStyle = getComputedStyle(borrowed as Element).borderStyle;
      expect(borderStyle).toBe("dashed");
    });
  });
});

describe("DegreeGrid quality tag on borrowed cells (Plan H-T9b)", () => {
  it("renders a quality tag (e.g. 'M') under the note name on borrowed cells", () => {
    const { container } = render(
      <DegreeGrid
        scaleName="major"
        tonicNote="C"
        selectedNote="C"
        onSelectInKey={() => {}}
        onSelectBorrowed={() => {}}
        preferFlats
      />,
    );
    // Find a borrowed cell — Eb in C major.
    const cells = Array.from(container.querySelectorAll("[class*='cell']"));
    const ebCell = cells.find((c) => /Eb|E♭/.test(c.textContent ?? ""));
    expect(ebCell).toBeTruthy();
    const tag = ebCell?.querySelector("[class*='qualityTag']");
    expect(tag).toBeTruthy();
    // Default guess is "Major Triad" → "M". Allow any short form to keep
    // the test resilient if the resolver changes the default.
    expect(tag?.textContent).toMatch(/^(M|m|°|7|M7|m7|ø7|°7|sus2|sus4|5|6|m6|mM7|\+)$/);
  });

  it("does NOT render a quality tag on in-key cells (quality is implicit in the Roman numeral)", () => {
    const { container } = render(
      <DegreeGrid
        scaleName="major"
        tonicNote="C"
        selectedNote="C"
        onSelectInKey={() => {}}
        onSelectBorrowed={() => {}}
        preferFlats
      />,
    );
    // In-key C cell: data-in-key="true" and text contains "C" and "I" (the numeral)
    const inKeyCCell = container.querySelector('button[data-in-key="true"][aria-label*="C I"]');
    expect(inKeyCCell).toBeTruthy();
    expect(inKeyCCell?.querySelector("[class*='qualityTag']")).toBeNull();
  });
});
