// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { rootNoteAtom, scaleNameAtom } from "../../store/atoms";
import { getScaleFamilyOptions } from "@fretflow/core";
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
    it("renders the Root and Scale Family labels", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(screen.getByText("Root")).toBeInTheDocument();
      expect(screen.getByText("Scale Family", { selector: "span[class*='propLabel']" })).toBeInTheDocument();
    });

    it("renders Prev and Next scale family buttons", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(
        screen.getByRole("button", { name: "Previous scale family" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Next scale family" }),
      ).toBeInTheDocument();
    });

    it("renders Scale Family as a selectable dropdown", async () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const user = userEvent.setup();
      const familySelect = screen.getByRole("combobox", { name: "Scale Family" });
      expect(within(familySelect).getByText("Major Modes")).toBeInTheDocument();
      await user.click(familySelect);
      await user.click(screen.getByRole("option", { name: "Pentatonic" }));
      expect(
        within(screen.getByRole("combobox", { name: "Scale Family" })).getByText(
          "Pentatonic",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Variant" })).toBeInTheDocument();
    });

    it("clicking Next advances to the next family", async () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const familyOptions = getScaleFamilyOptions();
      const secondFamily = familyOptions[1];
      await act(async () => {
        await userEvent.click(
          screen.getByRole("button", { name: "Next scale family" }),
        );
      });
      const familySelect = screen.getByRole("combobox", { name: "Scale Family" });
      expect(within(familySelect).getByText(secondFamily)).toBeInTheDocument();
    });

    it("clicking Prev from first family wraps to last", async () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const familyOptions = getScaleFamilyOptions();
      const lastFamily = familyOptions[familyOptions.length - 1];
      await act(async () => {
        await userEvent.click(
          screen.getByRole("button", { name: "Previous scale family" }),
        );
      });
      const familySelect = screen.getByRole("combobox", { name: "Scale Family" });
      expect(within(familySelect).getByText(lastFamily)).toBeInTheDocument();
    });
  });

  describe("Parallel/relative toggle", () => {
    it("renders the Mode browser label when the scale supports relative browsing", () => {
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
  });

  describe("a11y", () => {
    it("has no accessibility violations", async () => {
      const { container } = renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
