// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { rootNoteAtom, scaleNameAtom } from "../../store/atoms";
import { getScaleFamilyOptions } from "../../core/theoryCatalog";
import { ScaleSelector } from "./ScaleSelector";

beforeEach(() => {
  localStorage.clear();
});

const BASE_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
] as const;

describe("ScaleSelector/ScaleSelector", () => {
  describe("Scale Family browser", () => {
    it("renders Scale Family label", () => {
      const { container } = renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const labels = container.querySelectorAll(".section-label");
      const scaleFamilyLabel = Array.from(labels).find(
        (el) => el.textContent === "Scale Family",
      );
      expect(scaleFamilyLabel).toBeInTheDocument();
    });

    it("renders Prev and Next scale family buttons", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(screen.getByRole("button", { name: "Previous scale family" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next scale family" })).toBeInTheDocument();
    });

    it("renders Scale Family as a selectable dropdown", async () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const familySelect = screen.getByRole("combobox", { name: "Scale Family" });

      expect((familySelect as HTMLSelectElement).value).toBe("Major Modes");

      await userEvent.selectOptions(familySelect, "Pentatonic");

      expect((familySelect as HTMLSelectElement).value).toBe("Pentatonic");
      expect(screen.getByRole("combobox", { name: "Variant" })).toBeInTheDocument();
    });

    it("clicking Next advances to the next family", async () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const familyOptions = getScaleFamilyOptions();
      const secondFamily = familyOptions[1];

      await act(async () => {
        await userEvent.click(screen.getByRole("button", { name: "Next scale family" }));
      });

      const familySelect = screen.getByRole("combobox", { name: "Scale Family" }) as HTMLSelectElement;
      expect(familySelect.value).toBe(secondFamily);
    });

    it("clicking Prev from first family wraps to last (Blues)", async () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const familyOptions = getScaleFamilyOptions();
      const lastFamily = familyOptions[familyOptions.length - 1];

      await act(async () => {
        await userEvent.click(screen.getByRole("button", { name: "Previous scale family" }));
      });

      const familySelect = screen.getByRole("combobox", { name: "Scale Family" }) as HTMLSelectElement;
      expect(familySelect.value).toBe(lastFamily);
    });

    it("clicking Next from last family wraps to first (Major Modes)", async () => {
      renderWithAtoms(<ScaleSelector />, [
        [rootNoteAtom, "C"],
        [scaleNameAtom, "Minor Blues"],
      ]);
      const familyOptions = getScaleFamilyOptions();
      const firstFamily = familyOptions[0];

      await act(async () => {
        await userEvent.click(screen.getByRole("button", { name: "Next scale family" }));
      });

      const familySelect = screen.getByRole("combobox", { name: "Scale Family" }) as HTMLSelectElement;
      expect(familySelect.value).toBe(firstFamily);
    });
  });

  describe("Mode card flatten", () => {
    it("renders mode browser without panel-surface card wrapper", () => {
      const { container } = renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const modeBrowser = container.querySelector(".theory-mode-browser");
      expect(modeBrowser).toBeInTheDocument();
      expect(modeBrowser?.classList.contains("panel-surface")).toBe(false);
    });
  });

  describe("Parallel/relative toggle", () => {
    it("renders Mode label when scale supports relative browsing", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(screen.getAllByText("Mode").length).toBeGreaterThan(0);
    });

    it("renders Parallel and Relative toggle buttons", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(screen.getByRole("button", { name: "Parallel" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Relative" })).toBeInTheDocument();
    });

    it("shows a short hint for Parallel/Relative behavior", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(
        screen.getByText("Cycle modes that share the current root note."),
      ).toBeInTheDocument();
    });

    it("does not render a help button for Parallel/Relative", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(
        screen.queryByRole("button", { name: /show help for mode/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("a11y", () => {
    it("has no accessibility violations", async () => {
      const { container } = renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
