// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { mobilePanelAtom } from "../../store/uiAtoms";
import { MobileDock } from "./MobileDock";

describe("MobileDock", () => {
  it("renders both panel toggles and no transport (it lives in ShellTransport)", () => {
    const store = makeAtomStore([]);
    renderWithStore(<MobileDock />, store);
    expect(screen.getByTestId("dock-toggle-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("dock-toggle-song")).toBeInTheDocument();
    expect(screen.queryByTestId("shell-transport")).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-dock")).toHaveAttribute("data-placement", "sheet");
  });

  it("opens a panel on tap and closes it on a second tap", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "none"]]);
    renderWithStore(<MobileDock />, store);
    const overlayToggle = screen.getByTestId("dock-toggle-overlay");

    await userEvent.click(overlayToggle);
    expect(store.get(mobilePanelAtom)).toBe("overlay");
    expect(overlayToggle).toHaveAttribute("aria-expanded", "true");
    expect(overlayToggle).toHaveAttribute("data-state", "open");

    await userEvent.click(overlayToggle);
    expect(store.get(mobilePanelAtom)).toBe("none");
    expect(overlayToggle).toHaveAttribute("aria-expanded", "false");
  });

  it("switches panels when the other toggle is pressed", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "overlay"]]);
    renderWithStore(<MobileDock />, store);

    await userEvent.click(screen.getByTestId("dock-toggle-song"));
    expect(store.get(mobilePanelAtom)).toBe("song");
    expect(screen.getByTestId("dock-toggle-overlay")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("dock-toggle-song")).toHaveAttribute("aria-expanded", "true");
  });

  it("wires panel semantics: overlay controls the in-tree panel, song announces a dialog", () => {
    const store = makeAtomStore([]);
    renderWithStore(<MobileDock />, store);
    expect(screen.getByTestId("dock-toggle-overlay")).toHaveAttribute(
      "aria-controls",
      "mobile-overlay-panel",
    );
    expect(screen.getByTestId("dock-toggle-song")).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("has no axe violations", async () => {
    const store = makeAtomStore([]);
    const { container } = renderWithStore(<MobileDock />, store);
    expect(await axe(container)).toHaveNoViolations();
  });
});
