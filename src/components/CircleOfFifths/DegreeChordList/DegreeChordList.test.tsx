// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, within } from "@testing-library/react";
import { renderWithAtoms } from "../../../test-utils/renderWithAtoms";
import { axe } from "../../../test-utils/a11y";
import { DegreeChordList } from "./DegreeChordList";

function getRows(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLLIElement>("li"));
}

function rowCells(row: HTMLLIElement) {
  const button = row.querySelector("button")!;
  // Row structure: [span.numeral, span.chord > [span.root, span.quality], span.notes]
  const [numeralEl, chordEl, notesEl] = Array.from(button.children) as HTMLElement[];
  return {
    button,
    numeral: numeralEl?.textContent ?? "",
    root: chordEl?.children[0]?.textContent ?? "",
    quality: chordEl?.children[1]?.textContent ?? "",
    notes: notesEl?.textContent ?? "",
  };
}

describe("DegreeChordList", () => {
  it("renders all seven Major-key Roman numerals with correct case + ° suffix", () => {
    const { container } = renderWithAtoms(
      <DegreeChordList rootNote="C" scaleName="Major" />,
    );
    const rows = getRows(container);
    expect(rows).toHaveLength(7);

    const numerals = rows.map((r) => rowCells(r).numeral);
    expect(numerals).toEqual(["I", "ii", "iii", "IV", "V", "vi", "vii°"]);

    const roots = rows.map((r) => rowCells(r).root);
    expect(roots).toEqual(["C", "D", "E", "F", "G", "A", "B"]);

    const qualities = rows.map((r) => rowCells(r).quality);
    expect(qualities).toEqual([
      "Maj",
      "min",
      "min",
      "Maj",
      "Maj",
      "min",
      "dim",
    ]);
  });

  it("resolves flat-key display for F Major (IV = B♭, V = C)", () => {
    const { container } = renderWithAtoms(
      <DegreeChordList rootNote="F" scaleName="Major" preferFlats={true} />,
    );
    const rows = getRows(container);
    const cells = rows.map(rowCells);
    const ivRow = cells.find((c) => c.numeral === "IV");
    const vRow = cells.find((c) => c.numeral === "V");
    expect(ivRow?.root).toBe("B♭");
    expect(vRow?.root).toBe("C");
  });

  it("renders Phrygian mode degrees in scale-step order", () => {
    const { container } = renderWithAtoms(
      <DegreeChordList rootNote="E" scaleName="Phrygian" />,
    );
    const rows = getRows(container);
    expect(rows).toHaveLength(7);
    const numerals = rows.map((r) => rowCells(r).numeral);
    expect(numerals[0]).toBe("i");
    expect(numerals).toContain("II");
    expect(numerals).toContain("III");
    expect(numerals).toContain("iv");
    expect(numerals).toContain("v°");
    expect(numerals).toContain("VI");
    expect(numerals).toContain("vii");
  });

  it("invokes onSelect with the DegreeId when a row button is clicked", () => {
    const onSelect = vi.fn();
    const { container } = renderWithAtoms(
      <DegreeChordList rootNote="C" scaleName="Major" onSelect={onSelect} />,
    );
    const rows = getRows(container);
    const vRow = rows.find((r) => rowCells(r).numeral === "V")!;
    fireEvent.click(within(vRow).getByRole("button"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("V");
  });

  it("marks the active row with aria-pressed and the active CSS class", () => {
    const { container } = renderWithAtoms(
      <DegreeChordList
        rootNote="C"
        scaleName="Major"
        activeDegreeId="IV"
        onSelect={() => {}}
      />,
    );
    const rows = getRows(container);
    const activeRow = rows.find((r) => rowCells(r).numeral === "IV")!;
    const inactiveRow = rows.find((r) => rowCells(r).numeral === "V")!;
    const activeButton = within(activeRow).getByRole("button");
    const inactiveButton = within(inactiveRow).getByRole("button");

    expect(activeButton.getAttribute("aria-pressed")).toBe("true");
    expect(inactiveButton.getAttribute("aria-pressed")).toBe("false");
    // CSS modules hash the class — match by suffix
    expect(activeButton.className).toMatch(/row-active/);
    expect(inactiveButton.className).not.toMatch(/row-active/);
  });

  it("has no axe-core a11y violations", async () => {
    const { container } = renderWithAtoms(
      <DegreeChordList
        rootNote="C"
        scaleName="Major"
        activeDegreeId="V"
        onSelect={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
