// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { PresetMenu, type PresetMenuProps } from "./PresetMenu";

const baseProps: PresetMenuProps = {
  triggerLabel: "Preset",
  customLabel: "Custom",
  scaleLabel: "Major (Ionian)",
  currentId: "one-five-six-four",
  disabled: false,
  categories: [
    {
      label: "Pop / Rock",
      options: [
        { id: "one-five-six-four", label: "I-V-vi-IV" },
        { id: "vi-iv-i-v", label: "vi-IV-I-V" },
      ],
    },
    { label: "Jazz", options: [{ id: "two-five-one", label: "ii-V-I" }] },
  ],
  suggestionGroups: [
    {
      feel: "cadential",
      label: "Cadential",
      options: [{ id: "suggested-cadential-340", label: "IV-V-I" }],
    },
  ],
  onSelect: vi.fn(),
};

describe("PresetMenu", () => {
  it("shows the current preset label on the trigger", () => {
    render(<PresetMenu {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /Preset/i }),
    ).toHaveTextContent("I-V-vi-IV");
  });

  it("shows the custom label when current id is not found", () => {
    render(<PresetMenu {...baseProps} currentId="custom" />);
    expect(
      screen.getByRole("button", { name: /Preset/i }),
    ).toHaveTextContent("Custom");
  });

  it("selects a static preset from a category submenu", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<PresetMenu {...baseProps} onSelect={onSelect} />);
    // radix opens submenus on pointer-hover, which jsdom does not simulate via
    // click. Drive selection via keyboard navigation (which radix handles in
    // jsdom): open the menu, arrow to the "Jazz" subtrigger, open it, then pick.
    await user.click(screen.getByRole("button", { name: /Preset/i }));
    // Top-level order: Pop / Rock, Jazz, then Suggested (suggestions last).
    await user.keyboard("{ArrowDown}"); // -> Pop / Rock
    await user.keyboard("{ArrowDown}"); // -> Jazz
    await user.keyboard("{ArrowRight}"); // open Jazz submenu
    await user.keyboard("{ArrowDown}"); // -> ii-V-I
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("two-five-one");
  });

  it("selects a suggestion from the suggestions submenu", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<PresetMenu {...baseProps} onSelect={onSelect} />);
    // Keyboard navigation (see category test for rationale). Suggestions are
    // the last top-level group: Pop / Rock, Jazz, then Suggested.
    await user.click(screen.getByRole("button", { name: /Preset/i }));
    await user.keyboard("{ArrowDown}"); // -> Pop / Rock
    await user.keyboard("{ArrowDown}"); // -> Jazz
    await user.keyboard("{ArrowDown}"); // -> Suggested for <scale>
    await user.keyboard("{ArrowRight}"); // open suggestions submenu
    await user.keyboard("{ArrowDown}"); // -> IV-V-I
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("suggested-cadential-340");
  });

  it("disables the trigger when locked", () => {
    render(<PresetMenu {...baseProps} disabled />);
    expect(screen.getByRole("button", { name: /Preset/i })).toBeDisabled();
  });

  it("marks the active option with aria-current", async () => {
    const user = userEvent.setup();
    render(<PresetMenu {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /Preset/i }));
    // Open the Pop / Rock submenu (it's the first top-level group now).
    await user.keyboard("{ArrowDown}{ArrowRight}");
    const active = screen.getByRole("menuitem", { name: "I-V-vi-IV" });
    expect(active).toHaveAttribute("aria-current", "true");
    const other = screen.getByRole("menuitem", { name: "vi-IV-I-V" });
    expect(other).not.toHaveAttribute("aria-current");
  });

  it("has no axe violations", async () => {
    const { container } = render(<PresetMenu {...baseProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders categories as a flat list (no submenu triggers) in compact mode", async () => {
    const user = userEvent.setup();
    render(<PresetMenu {...baseProps} compact />);

    await user.click(screen.getByRole("button", { name: /Preset/i }));

    expect(
      screen.queryByRole("menuitem", { name: "Pop / Rock" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /vi-IV-I-V/ })).toBeInTheDocument();
  });

  it("keeps category submenus in the default (non-compact) mode", async () => {
    const user = userEvent.setup();
    render(<PresetMenu {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /Preset/i }));

    expect(
      screen.getByRole("menuitem", { name: /Pop \/ Rock/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /vi-IV-I-V/ })).not.toBeInTheDocument();
  });
});
