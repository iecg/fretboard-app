import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { Inspector } from "./Inspector";

describe("Inspector v2.0", () => {
  it("does not render the panelLabel kicker", () => {
    renderWithAtoms(<Inspector />);
    expect(screen.queryByText("Inspector")).not.toBeInTheDocument();
  });

  it("renders exactly two tab triggers: Overlay and Song", () => {
    renderWithAtoms(<Inspector />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent(/overlay/i);
    expect(tabs[1]).toHaveTextContent(/song/i);
  });

  it("defaults to the Overlay tab", () => {
    renderWithAtoms(<Inspector />);
    expect(screen.getByTestId("view-tab")).toBeVisible();
  });

  it("does not mount the Song body until the tab is first opened", () => {
    const { container } = renderWithAtoms(<Inspector />);
    // Overlay is the default tab — the heavy Song subtree should not mount yet
    // (no app-startup cost for a tab the user hasn't visited).
    expect(container.querySelector('[data-inspector-tab="song"]')).toBeNull();
  });

  it("keeps a visited tab body mounted after switching away (keep-alive)", async () => {
    const user = userEvent.setup();
    const { container } = renderWithAtoms(<Inspector />);

    // Visit the Song tab — its body mounts.
    await user.click(screen.getByRole("tab", { name: /song/i }));
    expect(container.querySelector('[data-inspector-tab="song"]')).not.toBeNull();

    // Switch back to Overlay. The Song body must STAY mounted, so returning to
    // it is a cheap visibility toggle rather than a costly remount that blocks
    // the main thread (which desyncs the playhead and glitches audio).
    await user.click(screen.getByRole("tab", { name: /overlay/i }));
    expect(container.querySelector('[data-inspector-tab="song"]')).not.toBeNull();

    // ...and the now-inactive Song panel must be marked inactive so the CSS
    // (.tabPanel[data-state="inactive"] { display: none }) hides it — Radix does
    // NOT auto-hide forceMounted content, so both panels would otherwise show.
    const songPanel = container.querySelector('[data-tab-id="song"]');
    expect(songPanel?.getAttribute("data-state")).toBe("inactive");
    const viewPanel = container.querySelector('[data-tab-id="view"]');
    expect(viewPanel?.getAttribute("data-state")).toBe("active");
  });
});
