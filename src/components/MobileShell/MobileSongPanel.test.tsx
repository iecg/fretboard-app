// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { mobilePanelAtom } from "@fretflow/fretboard/store/uiAtoms";
import { MobileSongPanel } from "./MobileSongPanel";
import { MobileDock } from "./MobileDock";

describe("MobileSongPanel", () => {
  it("renders nothing while closed", () => {
    const store = makeAtomStore([[mobilePanelAtom, "none"]]);
    renderWithStore(<MobileSongPanel />, store);
    expect(screen.queryByTestId("mobile-song-panel")).not.toBeInTheDocument();
  });

  it("opens as a non-modal dialog titled Song hosting the song controls", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "song"]]);
    renderWithStore(<MobileSongPanel />, store);
    const panel = await screen.findByTestId("mobile-song-panel");
    expect(panel).toHaveAttribute("role", "dialog");
    // Non-modal by design: the transport strip and dock tabs above/below the
    // drawer must stay operable (same contract as the Overlay panel).
    expect(panel).not.toHaveAttribute("aria-modal");
    expect(panel).toHaveAttribute("data-placement", "sheet");
    expect(screen.getByText("Song")).toBeInTheDocument();
    // SongControls is lazy — the Preset card arrives async.
    await waitFor(() => {
      expect(screen.getByText(/preset/i)).toBeInTheDocument();
    });
  });

  it("closes via the close button and returns focus to the dock toggle", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "song"]]);
    renderWithStore(
      <>
        <MobileSongPanel />
        <MobileDock />
      </>,
      store,
    );
    await userEvent.click(await screen.findByTestId("song-panel-close"));
    expect(store.get(mobilePanelAtom)).toBe("none");
    await waitFor(() => {
      expect(screen.getByTestId("dock-toggle-song")).toHaveFocus();
    });
  });

  it("closes on Escape", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "song"]]);
    renderWithStore(<MobileSongPanel />, store);
    const panel = await screen.findByTestId("mobile-song-panel");
    await waitFor(() => expect(panel).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    expect(store.get(mobilePanelAtom)).toBe("none");
  });

  it("has no axe violations while open", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "song"]]);
    const { container } = renderWithStore(<MobileSongPanel />, store);
    // Wait for the lazy SongControls content to mount before scanning.
    await waitFor(() => {
      expect(screen.getByText(/preset/i)).toBeInTheDocument();
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
