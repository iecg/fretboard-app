// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DrawerSelector } from "../DrawerSelector";

const OPTIONS = ["Major", "Minor", "Pentatonic"];

describe("DrawerSelector", () => {
  it("renders the label and is closed by default", () => {
    render(
      <DrawerSelector
        label="Scale"
        value="Major"
        options={OPTIONS}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Scale")).toBeTruthy();
    expect(screen.queryByText("Minor")).toBeNull();
  });

  it("opens the options list on trigger click", () => {
    render(
      <DrawerSelector
        label="Scale"
        value="Major"
        options={OPTIONS}
        onSelect={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Scale/i }));
    expect(screen.getByText("Minor")).toBeTruthy();
    expect(screen.getByText("Pentatonic")).toBeTruthy();
  });

  it("calls onSelect with the correct value when an option is clicked", () => {
    const onSelect = vi.fn();
    render(
      <DrawerSelector
        label="Scale"
        value="Major"
        options={OPTIONS}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Scale/i }));
    fireEvent.click(screen.getByText("Minor"));
    expect(onSelect).toHaveBeenCalledWith("Minor");
  });

  it("closes after an option is selected", () => {
    render(
      <DrawerSelector
        label="Scale"
        value="Major"
        options={OPTIONS}
        onSelect={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Scale/i }));
    fireEvent.click(screen.getByText("Minor"));
    expect(screen.queryByText("Pentatonic")).toBeNull();
  });

  it("shows None button when nullable=true", () => {
    render(
      <DrawerSelector
        label="Chord"
        value={null}
        options={OPTIONS}
        onSelect={() => {}}
        nullable
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Chord/i }));
    const noneButtons = screen.getAllByText("None");
    expect(noneButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSelect(null) when None is clicked", () => {
    const onSelect = vi.fn();
    render(
      <DrawerSelector
        label="Chord"
        value="Major"
        options={OPTIONS}
        onSelect={onSelect}
        nullable
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Chord/i }));
    fireEvent.click(screen.getByText("None"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
