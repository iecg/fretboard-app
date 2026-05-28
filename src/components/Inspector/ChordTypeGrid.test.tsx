import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { ChordTypeGrid } from "./ChordTypeGrid";

const OPTIONS = [
  { value: "M", label: "Maj" },
  { value: "m", label: "min" },
  { value: "7", label: "7" },
];

describe("ChordTypeGrid", () => {
  it("renders a labeled group with a button per option", () => {
    render(
      <ChordTypeGrid options={OPTIONS} value="M" onChange={() => {}} label="Chord Type" />,
    );
    expect(screen.getByRole("group", { name: "Chord Type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maj" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "min" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7" })).toBeInTheDocument();
  });

  it("marks the active option as pressed", () => {
    render(
      <ChordTypeGrid options={OPTIONS} value="m" onChange={() => {}} label="Chord Type" />,
    );
    expect(screen.getByRole("button", { name: "min" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Maj" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the option value when a cell is clicked", async () => {
    const user = userEvent.setup();
    let picked = "";
    render(
      <ChordTypeGrid
        options={OPTIONS}
        value="M"
        onChange={(v) => {
          picked = v;
        }}
        label="Chord Type"
      />,
    );
    await user.click(screen.getByRole("button", { name: "7" }));
    expect(picked).toBe("7");
  });

  it("disables an option flagged disabled", () => {
    render(
      <ChordTypeGrid
        options={[{ value: "x", label: "X", disabled: true }]}
        value=""
        onChange={() => {}}
        label="Chord Type"
      />,
    );
    expect(screen.getByRole("button", { name: "X" })).toBeDisabled();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ChordTypeGrid options={OPTIONS} value="M" onChange={() => {}} label="Chord Type" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
