import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StringSetPicker } from "./StringSetPicker";

describe("StringSetPicker", () => {
  it("renders all five string-set cards", () => {
    render(<StringSetPicker value="all" onChange={() => {}} />);
    for (const label of ["All", "Bass", "Lower mid", "Upper mid", "Treble"]) {
      expect(screen.getByRole("radio", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("marks the active card as checked", () => {
    render(<StringSetPicker value="low" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: /Bass/ })).toBeChecked();
  });

  it("calls onChange with the card id when a card is clicked", async () => {
    const onChange = vi.fn();
    render(<StringSetPicker value="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: /Treble/ }));
    expect(onChange).toHaveBeenCalledWith("top");
  });
});
