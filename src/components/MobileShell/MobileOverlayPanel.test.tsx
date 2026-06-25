// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { mobilePanelAtom } from "@fretflow/fretboard/store/uiAtoms";
import { MobileOverlayPanel } from "./MobileOverlayPanel";
import { MobileDock } from "./MobileDock";

describe("MobileOverlayPanel", () => {
  it("renders nothing while closed", () => {
    const store = makeAtomStore([[mobilePanelAtom, "none"]]);
    renderWithStore(<MobileOverlayPanel />, store);
    expect(screen.queryByTestId("mobile-overlay-panel")).not.toBeInTheDocument();
  });

  it("opens as a non-modal dialog hosting the Overlay controls", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "overlay"]]);
    renderWithStore(<MobileOverlayPanel />, store);
    const panel = screen.getByTestId("mobile-overlay-panel");
    expect(panel).toHaveAttribute("role", "dialog");
    // Non-modal by design: the board behind must stay operable.
    expect(panel).not.toHaveAttribute("aria-modal");
    expect(panel).toHaveAttribute("data-placement", "sheet");
    // ViewTab is lazy — its Scale card arrives async.
    await waitFor(() => {
      expect(screen.getAllByText(/scale/i).length).toBeGreaterThan(0);
    });
  });

  it("closes via the close button and returns focus to the dock toggle", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "overlay"]]);
    renderWithStore(
      <>
        <MobileOverlayPanel />
        <MobileDock />
      </>,
      store,
    );
    await userEvent.click(screen.getByTestId("overlay-panel-close"));
    expect(store.get(mobilePanelAtom)).toBe("none");
    await waitFor(() => {
      expect(screen.getByTestId("dock-toggle-overlay")).toHaveFocus();
    });
  });

  it("closes on Escape", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "overlay"]]);
    renderWithStore(<MobileOverlayPanel />, store);
    const panel = screen.getByTestId("mobile-overlay-panel");
    await waitFor(() => expect(panel).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    expect(store.get(mobilePanelAtom)).toBe("none");
  });

  it("has no axe violations while open", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "overlay"]]);
    const { container } = renderWithStore(<MobileOverlayPanel />, store);
    // Wait for the lazy ViewTab content to mount before scanning.
    await waitFor(() => {
      expect(screen.getAllByText(/scale/i).length).toBeGreaterThan(0);
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
