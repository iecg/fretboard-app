import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../test-utils/a11y";
import { StringSetPicker } from "./StringSetPicker";
import { buildStringSetOptions } from "../../store/voicingStringSets";

const triadOptions = buildStringSetOptions(3);
const seventhOptions = buildStringSetOptions(4);

describe("StringSetPicker", () => {
  it("renders the options it is given (triad → 5 cards)", () => {
    render(
      <StringSetPicker options={triadOptions} value="all" onChange={() => {}} />,
    );
    for (const label of ["All", "Bass", "Lower mid", "Upper mid", "Treble"]) {
      expect(
        screen.getByRole("radio", { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("renders four cards for a seventh chord", () => {
    render(
      <StringSetPicker options={seventhOptions} value="all" onChange={() => {}} />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("radio", { name: /Middle/ })).toBeInTheDocument();
  });

  it("marks the active card as checked", () => {
    render(
      <StringSetPicker options={triadOptions} value="4·5·6" onChange={() => {}} />,
    );
    expect(screen.getByRole("radio", { name: /Bass/ })).toBeChecked();
  });

  it("calls onChange with the option id when a card is clicked", async () => {
    const onChange = vi.fn();
    render(
      <StringSetPicker options={triadOptions} value="all" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("radio", { name: /Treble/ }));
    expect(onChange).toHaveBeenCalledWith("1·2·3");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <StringSetPicker options={triadOptions} value="all" onChange={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("StringSetPicker — diagram orientation and thickness", () => {
  it("renders bars top-to-bottom as high E (index 0) → low E (index 5)", () => {
    const triadOptions = buildStringSetOptions(3);
    render(
      <StringSetPicker options={triadOptions} value="all" onChange={() => {}} />,
    );
    // Bass card highlights string indices [3, 4, 5] — the BOTTOM three bars.
    const bassCard = screen.getByRole("radio", { name: /Bass/ });
    const bars = bassCard.querySelectorAll("[data-string-index]");
    expect(bars).toHaveLength(6);
    bars.forEach((bar, i) => {
      expect(bar.getAttribute("data-string-index")).toBe(String(i));
    });
    [0, 1, 2].forEach((i) => {
      expect(bars[i].className).not.toMatch(/stringOn/);
    });
    [3, 4, 5].forEach((i) => {
      expect(bars[i].className).toMatch(/stringOn/);
    });
  });

  it("uses the boosted taper thicknesses (low E thickest)", () => {
    const triadOptions = buildStringSetOptions(3);
    const { container } = render(
      <StringSetPicker options={triadOptions} value="all" onChange={() => {}} />,
    );
    const firstCard = container.querySelector('[role="radio"]') as HTMLElement;
    const bars = firstCard.querySelectorAll<HTMLElement>("[data-string-index]");
    const heights = Array.from(bars).map((b) => b.style.height);
    expect(heights).toEqual([
      "1.5px", "2.1px", "2.7px", "3.6px", "4.5px", "5.4px",
    ]);
  });
});
