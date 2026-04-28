// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { rootNoteAtom, scaleNameAtom, baseScaleNameAtom } from "../../store/atoms";
import { getScaleFamilyOptions, resolveScaleCatalogEntry } from "../../core/theoryCatalog";
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
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(screen.getByText("Scale Family")).toBeInTheDocument();
    });

    it("renders Prev and Next scale family buttons", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(screen.getByRole("button", { name: "Previous scale family" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next scale family" })).toBeInTheDocument();
    });

    it("clicking Next advances to the next family", async () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const familyOptions = getScaleFamilyOptions();
      const secondFamily = familyOptions[1]; // "Harmonic Minor"

      await act(async () => {
        await userEvent.click(screen.getByRole("button", { name: "Next scale family" }));
      });

      expect(screen.getByText(secondFamily)).toBeInTheDocument();
    });

    it("clicking Prev from first family wraps to last (Blues) — atom check", async () => {
      const familyOptions = getScaleFamilyOptions();
      const store = makeAtomStore([
        [rootNoteAtom, "C"],
        [scaleNameAtom, "Major"],
      ]);
      renderWithStore(<ScaleSelector />, store);

      await userEvent.click(screen.getByRole("button", { name: "Previous scale family" }));

      const newScale = store.get(baseScaleNameAtom);
      const newFamilyLabel = resolveScaleCatalogEntry(newScale).family.selectorLabel;
      // From index 0 (Major Modes), Prev should wrap to last (Blues)
      expect(newFamilyLabel).toBe(familyOptions[familyOptions.length - 1]);
    });

    it("clicking Next from last family wraps to first — atom check", async () => {
      const familyOptions = getScaleFamilyOptions();
      const store = makeAtomStore([
        [rootNoteAtom, "C"],
        [scaleNameAtom, "Minor Blues"],
      ]);
      renderWithStore(<ScaleSelector />, store);

      await userEvent.click(screen.getByRole("button", { name: "Next scale family" }));

      const newScale = store.get(baseScaleNameAtom);
      const newFamilyLabel = resolveScaleCatalogEntry(newScale).family.selectorLabel;
      // From last (Blues), Next should wrap to first (Major Modes)
      expect(newFamilyLabel).toBe(familyOptions[0]);
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

    it("help-button opens popover with parallel/relative explanation", async () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const helpBtn = screen.getByRole("button", { name: "Show help for Mode" });
      await userEvent.click(helpBtn);
      expect(screen.getByText(/Parallel.*same root/i)).toBeInTheDocument();
    });

    it("help-button aria-expanded toggles on click", async () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const helpBtn = screen.getByRole("button", { name: "Show help for Mode" });
      expect(helpBtn).toHaveAttribute("aria-expanded", "false");
      await userEvent.click(helpBtn);
      expect(screen.getByRole("button", { name: "Hide help for Mode" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });
  });

  describe("a11y", () => {
    it("has no accessibility violations", async () => {
      const { container } = renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
