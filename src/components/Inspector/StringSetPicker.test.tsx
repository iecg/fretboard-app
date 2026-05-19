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
