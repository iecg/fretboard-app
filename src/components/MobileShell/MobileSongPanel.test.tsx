// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { mobilePanelAtom } from "../../store/uiAtoms";
import { MobileSongPanel } from "./MobileSongPanel";

describe("MobileSongPanel", () => {
  it("renders nothing while closed", () => {
    const store = makeAtomStore([[mobilePanelAtom, "none"]]);
    renderWithStore(<MobileSongPanel />, store);
    expect(screen.queryByTestId("mobile-song-panel")).not.toBeInTheDocument();
  });

  it("opens as a modal dialog titled Song hosting the song controls", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "song"]]);
    renderWithStore(<MobileSongPanel />, store);
    const panel = await screen.findByTestId("mobile-song-panel");
    expect(panel).toHaveAttribute("role", "dialog");
    expect(panel).toHaveAttribute("data-placement", "sheet");
    expect(screen.getByText("Song")).toBeInTheDocument();
    // SongControls is lazy — the Preset card arrives async.
    await waitFor(() => {
      expect(screen.getByText(/preset/i)).toBeInTheDocument();
    });
  });

  it("closes via the close button", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "song"]]);
    renderWithStore(<MobileSongPanel />, store);
    await userEvent.click(await screen.findByTestId("song-panel-close"));
    expect(store.get(mobilePanelAtom)).toBe("none");
  });

  it("closes on Escape via Radix", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "song"]]);
    renderWithStore(<MobileSongPanel />, store);
    await screen.findByTestId("mobile-song-panel");
    await userEvent.keyboard("{Escape}");
    expect(store.get(mobilePanelAtom)).toBe("none");
  });

  it("has no axe violations while open", async () => {
    const store = makeAtomStore([[mobilePanelAtom, "song"]]);
    renderWithStore(<MobileSongPanel />, store);
    // Radix Dialog portals to <body>, so scan the document body, not the
    // render container. Wait for the lazy SongControls content first.
    await waitFor(() => {
      expect(screen.getByText(/preset/i)).toBeInTheDocument();
    });
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
