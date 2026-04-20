// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useRef } from "react";
import { HelpModal } from "./HelpModal";

// Wrapper component that renders a trigger button + HelpModal together
// so that the triggerRef can be attached to a real DOM button.
function HelpModalWithTrigger({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} type="button" aria-label="Trigger button">
        Open help
      </button>
      <HelpModal isOpen={isOpen} onClose={onClose} triggerRef={triggerRef} />
    </>
  );
}

describe("HelpModal", () => {
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

  it("lists current lens names matching LENS_REGISTRY labels", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Chord + Color")).toBeTruthy();
    expect(screen.getByText("Chord Tones")).toBeTruthy();
    expect(screen.getByText("Guide Tones")).toBeTruthy();
    expect(screen.getByText("Color Notes")).toBeTruthy();
    expect(screen.getByText("Tension")).toBeTruthy();
  });

  it("restores focus to trigger button when modal closes", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <HelpModalWithTrigger isOpen={true} onClose={onClose} />
    );

    // Focus the close button inside the modal so focus is inside the trap
    const closeBtn = screen.getByLabelText("Close help");
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    // Close the modal (set isOpen=false)
    act(() => {
      rerender(<HelpModalWithTrigger isOpen={false} onClose={onClose} />);
    });

    // Focus should be restored to the trigger button
    expect(document.activeElement).toBe(screen.getByLabelText("Trigger button"));
  });
});
