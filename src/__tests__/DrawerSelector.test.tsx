// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DrawerSelector } from "../DrawerSelector";

const OPTIONS = ["Major", "Minor", "Pentatonic"];

// Helper to open the dropdown
const openDropdown = () => {
  fireEvent.click(screen.getByRole("button", { name: /Scale:/i }));
};

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

  it("has proper ARIA attributes on trigger button", () => {
    render(
      <DrawerSelector
        label="Scale"
        value="Major"
        options={OPTIONS}
        onSelect={() => {}}
      />,
    );
    const trigger = screen.getByRole("button", { name: /Scale:/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-controls", "scale-listbox");
    expect(trigger).toHaveAttribute("aria-label", "Scale: Major");
  });

  it("updates aria-expanded when opened", () => {
    render(
      <DrawerSelector
        label="Scale"
        value="Major"
        options={OPTIONS}
        onSelect={() => {}}
      />,
    );
    const trigger = screen.getByRole("button", { name: /Scale:/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
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
    fireEvent.click(screen.getByRole("button", { name: /Scale:/i }));
    expect(screen.getByText("Minor")).toBeTruthy();
    expect(screen.getByText("Pentatonic")).toBeTruthy();
  });

  it("has listbox role and proper ARIA attributes when opened", () => {
    render(
      <DrawerSelector
        label="Scale"
        value="Major"
        options={OPTIONS}
        onSelect={() => {}}
      />,
    );
    openDropdown();
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-label", "Scale");
  });

  it("has option roles with aria-selected on items", () => {
    render(
      <DrawerSelector
        label="Scale"
        value="Major"
        options={OPTIONS}
        onSelect={() => {}}
      />,
    );
    openDropdown();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
    expect(options[2]).toHaveAttribute("aria-selected", "false");
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
    fireEvent.click(screen.getByRole("button", { name: /Scale:/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /Scale:/i }));
    fireEvent.click(screen.getByText("Minor"));
    expect(screen.queryByText("Pentatonic")).toBeNull();
  });

  it("returns focus to trigger button after selection", () => {
    render(
      <DrawerSelector
        label="Scale"
        value="Major"
        options={OPTIONS}
        onSelect={() => {}}
      />,
    );
    const trigger = screen.getByRole("button", { name: /Scale:/i });
    fireEvent.click(trigger);
    const minorOption = screen.getByRole("option", { name: "Minor" });
    fireEvent.click(minorOption);
    expect(document.activeElement).toBe(trigger);
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
    fireEvent.click(screen.getByRole("button", { name: /Chord:/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /Chord:/i }));
    fireEvent.click(screen.getByText("None"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  describe("keyboard navigation", () => {
    it("opens dropdown with ArrowDown and shows listbox", () => {
      render(
        <DrawerSelector
          label="Scale"
          value="Major"
          options={OPTIONS}
          onSelect={() => {}}
        />,
      );
      const trigger = screen.getByRole("button", { name: /Scale:/i });
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      const listbox = screen.getByRole("listbox");
      expect(listbox).toBeTruthy();
    });

    it("opens dropdown with ArrowUp and shows listbox", () => {
      render(
        <DrawerSelector
          label="Scale"
          value="Major"
          options={OPTIONS}
          onSelect={() => {}}
        />,
      );
      const trigger = screen.getByRole("button", { name: /Scale:/i });
      fireEvent.keyDown(trigger, { key: "ArrowUp" });
      const listbox = screen.getByRole("listbox");
      expect(listbox).toBeTruthy();
    });

    it("navigates options with ArrowDown using aria-activedescendant", () => {
      render(
        <DrawerSelector
          label="Scale"
          value="Major"
          options={OPTIONS}
          onSelect={() => {}}
        />,
      );
      openDropdown();
      const listbox = screen.getByRole("listbox");
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(listbox).toHaveAttribute("aria-activedescendant", "scale-listbox-pentatonic");
    });

    it("navigates options with ArrowUp using aria-activedescendant", () => {
      render(
        <DrawerSelector
          label="Scale"
          value="Major"
          options={OPTIONS}
          onSelect={() => {}}
        />,
      );
      openDropdown();
      const listbox = screen.getByRole("listbox");
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      fireEvent.keyDown(listbox, { key: "ArrowUp" });
      expect(listbox).toHaveAttribute("aria-activedescendant", "scale-listbox-major");
    });

    it("selects option with Enter key", () => {
      const onSelect = vi.fn();
      render(
        <DrawerSelector
          label="Scale"
          value="Major"
          options={OPTIONS}
          onSelect={onSelect}
        />,
      );
      openDropdown();
      const listbox = screen.getByRole("listbox");
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      fireEvent.keyDown(listbox, { key: "Enter" });
      expect(onSelect).toHaveBeenCalledWith("Minor");
    });

    it("closes dropdown with Escape key and returns focus to trigger", () => {
      render(
        <DrawerSelector
          label="Scale"
          value="Major"
          options={OPTIONS}
          onSelect={() => {}}
        />,
      );
      const trigger = screen.getByRole("button", { name: /Scale:/i });
      openDropdown();
      const listbox = screen.getByRole("listbox");
      fireEvent.keyDown(listbox, { key: "Escape" });
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it("jumps to first option with Home key", () => {
      render(
        <DrawerSelector
          label="Scale"
          value="Major"
          options={OPTIONS}
          onSelect={() => {}}
        />,
      );
      openDropdown();
      const listbox = screen.getByRole("listbox");
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      fireEvent.keyDown(listbox, { key: "Home" });
      expect(listbox).toHaveAttribute("aria-activedescendant", "scale-listbox-major");
    });

    it("jumps to last option with End key", () => {
      render(
        <DrawerSelector
          label="Scale"
          value="Major"
          options={OPTIONS}
          onSelect={() => {}}
        />,
      );
      openDropdown();
      const listbox = screen.getByRole("listbox");
      fireEvent.keyDown(listbox, { key: "End" });
      expect(listbox).toHaveAttribute("aria-activedescendant", "scale-listbox-pentatonic");
    });

    it("closes dropdown with Tab key", () => {
      render(
        <DrawerSelector
          label="Scale"
          value="Major"
          options={OPTIONS}
          onSelect={() => {}}
        />,
      );
      openDropdown();
      const listbox = screen.getByRole("listbox");
      fireEvent.keyDown(listbox, { key: "Tab" });
      expect(screen.queryByRole("listbox")).toBeNull();
    });
  });
});
