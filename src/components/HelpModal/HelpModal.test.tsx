// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { HelpModal } from "./HelpModal";
import styles from "./HelpModal.module.css";
import { en } from "../../i18n/en";
import { CURRENT_WHATS_NEW_ID } from "./helpContent";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { helpWhatsNewSeenAtom } from "../../store/uiAtoms";

describe("HelpModal/HelpModal", () => {
  it("renders dialog when isOpen=true", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: en.help.title })).toBeInTheDocument();
  });

  it("does not render dialog when isOpen=false", () => {
    render(<HelpModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog", { name: en.help.title })).not.toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<HelpModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(en.help.close));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the close button when the dialog opens", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByLabelText(en.help.close));
  });

  it("renders a tab for every help tab and starts on Start", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(screen.getByRole("tab", { name: en.help.tabs.start })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches panels when a tab is clicked", async () => {
    const user = userEvent.setup();
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(en.help.items.introBody)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: en.help.tabs.play }));
    expect(screen.queryByText(en.help.items.introBody)).not.toBeInTheDocument();
    expect(screen.getByText(en.help.items.backingTrackBody)).toBeInTheDocument();
  });

  it("documents the real keyboard shortcuts on the Settings tab", async () => {
    const user = userEvent.setup();
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    await user.click(screen.getByRole("tab", { name: en.help.tabs.settings }));
    expect(screen.getByText(en.help.shortcuts.play)).toBeInTheDocument();
    expect(screen.getByText(en.help.shortcuts.loop)).toBeInTheDocument();
    expect(screen.getByText("Space")).toBeInTheDocument();
  });

  it("does not contain stale Theory/View Inspector labels", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    const strong = Array.from(document.querySelectorAll("strong")).map((el) => el.textContent);
    expect(strong).not.toContain("Theory");
    expect(strong).not.toContain("View");
  });

  it("does not contain a stale Focus section or removed lens names", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    const strong = Array.from(document.querySelectorAll("strong")).map((el) => el.textContent);
    expect(strong).not.toContain("Focus");
    expect(screen.queryByText(/Tones lens/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lead lens/i)).not.toBeInTheDocument();
  });

  it("shows the What's-new notice when the current id has not been seen", () => {
    const store = makeAtomStore([[helpWhatsNewSeenAtom, ""]]);
    renderWithStore(<HelpModal isOpen={true} onClose={vi.fn()} />, store);
    expect(screen.getByTestId("help-modal-whats-new")).toBeInTheDocument();
  });

  it("hides the What's-new notice when the current id has been seen", () => {
    const store = makeAtomStore([[helpWhatsNewSeenAtom, CURRENT_WHATS_NEW_ID]]);
    renderWithStore(<HelpModal isOpen={true} onClose={vi.fn()} />, store);
    expect(screen.queryByTestId("help-modal-whats-new")).not.toBeInTheDocument();
  });

  it("dismissing the notice stores the current id and hides it", async () => {
    const user = userEvent.setup();
    const store = makeAtomStore([[helpWhatsNewSeenAtom, ""]]);
    renderWithStore(<HelpModal isOpen={true} onClose={vi.fn()} />, store);
    await user.click(screen.getByRole("button", { name: en.help.whatsNew.dismiss }));
    expect(store.get(helpWhatsNewSeenAtom)).toBe(CURRENT_WHATS_NEW_ID);
    expect(screen.queryByTestId("help-modal-whats-new")).not.toBeInTheDocument();
  });

  it("renders the close button at the sm icon-button size", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText(en.help.close).className).toMatch(/icon-button--sm/);
    expect(typeof styles["help-modal-close"]).toBe("string");
  });
});
