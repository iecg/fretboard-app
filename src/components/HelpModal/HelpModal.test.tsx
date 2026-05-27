// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { HelpModal } from "../HelpModal/HelpModal";
import styles from "./HelpModal.module.css";
import {
  makeAtomStore,
  renderWithStore,
} from "../../test-utils/renderWithAtoms";
import { seenChordModeRemovalNoticeAtom } from "../../store/uiAtoms";

describe("HelpModal/HelpModal", () => {
  it("renders dialog when isOpen=true", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "FretFlow Help" })).toBeInTheDocument();
  });

  it("does not render dialog when isOpen=false", () => {
    render(<HelpModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog", { name: "FretFlow Help" })).not.toBeInTheDocument();
  });

  it("calls onClose when Close help button is clicked", () => {
    const onClose = vi.fn();
    render(<HelpModal isOpen={true} onClose={onClose} />);
    expect(screen.getByLabelText("Close help")).toHaveClass(
      styles["help-modal-close"],
    );
    fireEvent.click(screen.getByLabelText("Close help"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not contain stale Focus-era control section", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    // The old "Focus" UI section should not appear as a section heading or strong label
    // that describes chord-tone narrowing controls (Triad, Shell, Rootless, Custom).
    const allStrong = document.querySelectorAll("strong");
    const focusLabels = Array.from(allStrong).filter(
      (el) => el.textContent === "Focus",
    );
    expect(focusLabels).toHaveLength(0);
  });

  it("does not mention 'Tones' or 'Lead' as lens names", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    // Lens picker was removed; help text should not mention the old lens names.
    expect(screen.queryByText(/Tones lens/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lead lens/i)).not.toBeInTheDocument();
  });

  it("renders the chord-mode-removed notice when not yet seen", () => {
    const store = makeAtomStore([[seenChordModeRemovalNoticeAtom, false]]);
    renderWithStore(<HelpModal isOpen={true} onClose={vi.fn()} />, store);
    expect(
      screen.getByText(/manual chord mode has been removed/i),
    ).toBeInTheDocument();
  });

  it("hides the chord-mode-removed notice when already seen", () => {
    const store = makeAtomStore([[seenChordModeRemovalNoticeAtom, true]]);
    renderWithStore(<HelpModal isOpen={true} onClose={vi.fn()} />, store);
    expect(
      screen.queryByText(/manual chord mode has been removed/i),
    ).not.toBeInTheDocument();
  });

  it("dismissing the notice sets the seen flag and hides the notice", async () => {
    const user = userEvent.setup();
    const store = makeAtomStore([[seenChordModeRemovalNoticeAtom, false]]);
    const { rerender } = renderWithStore(
      <HelpModal isOpen={true} onClose={vi.fn()} />,
      store,
    );
    await user.click(screen.getByRole("button", { name: /got it/i }));
    expect(store.get(seenChordModeRemovalNoticeAtom)).toBe(true);
    rerender(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(
      screen.queryByText(/manual chord mode has been removed/i),
    ).not.toBeInTheDocument();
  });

  it("moves focus to the close button when dialog opens", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByLabelText("Close help"));
  });
});
