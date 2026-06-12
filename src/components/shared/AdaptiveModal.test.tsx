import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdaptiveModal } from "./AdaptiveModal";
import styles from "./AdaptiveModal.module.css";

describe("AdaptiveModal", () => {
  it("renders children in a dialog on desktop", () => {
    render(
      <AdaptiveModal open onOpenChange={() => {}} presentation="dialog" label="Test">
        <p>content</p>
      </AdaptiveModal>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders children in a drawer sheet on mobile", () => {
    render(
      <AdaptiveModal open onOpenChange={() => {}} presentation="sheet" label="Test">
        <p>content</p>
      </AdaptiveModal>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.getByTestId("adaptive-modal-sheet")).toBeInTheDocument();
  });

  it("does not render content when closed (dialog)", () => {
    render(
      <AdaptiveModal open={false} onOpenChange={() => {}} presentation="dialog" label="Test">
        <p>content</p>
      </AdaptiveModal>,
    );
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("does not render content when closed (sheet)", () => {
    render(
      <AdaptiveModal open={false} onOpenChange={() => {}} presentation="sheet" label="Test">
        <p>content</p>
      </AdaptiveModal>,
    );
    expect(screen.queryByText("content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("adaptive-modal-sheet")).not.toBeInTheDocument();
  });

  it("exposes the label as the dialog's accessible name via the sr-only Title", () => {
    render(
      <AdaptiveModal open onOpenChange={() => {}} presentation="dialog" label="Settings">
        <p>content</p>
      </AdaptiveModal>,
    );
    // Radix wires the sr-only Title up as the accessible name via
    // aria-labelledby (there is no aria-label on the content).
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
  });

  it("renders both presentations without Radix/vaul console warnings", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { unmount } = render(
      <AdaptiveModal open onOpenChange={() => {}} presentation="dialog" label="Test">
        <p>content</p>
      </AdaptiveModal>,
    );
    unmount();
    render(
      <AdaptiveModal open onOpenChange={() => {}} presentation="sheet" label="Test">
        <p>content</p>
      </AdaptiveModal>,
    );
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("fires onOpenChange(false) when Escape is pressed (dialog)", async () => {
    const onOpenChange = vi.fn();
    render(
      <AdaptiveModal open onOpenChange={onOpenChange} presentation="dialog" label="Test">
        <p>content</p>
      </AdaptiveModal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("fires onOpenChange(false) when the dialog overlay is clicked", async () => {
    const onOpenChange = vi.fn();
    const { baseElement } = render(
      <AdaptiveModal open onOpenChange={onOpenChange} presentation="dialog" label="Test">
        <p>content</p>
      </AdaptiveModal>,
    );
    // Radix renders the overlay as a sibling of the content inside the portal;
    // it carries no role, so query it by its styles.overlay class. Clicking it
    // (outside the content) dismisses the dialog.
    const overlay = baseElement.querySelector<HTMLElement>(`.${styles.overlay}`);
    expect(overlay).not.toBeNull();
    await userEvent.click(overlay!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
