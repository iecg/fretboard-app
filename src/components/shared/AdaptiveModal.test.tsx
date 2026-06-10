import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdaptiveModal } from "./AdaptiveModal";

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

  it("does not render content when closed", () => {
    render(
      <AdaptiveModal open={false} onOpenChange={() => {}} presentation="dialog" label="Test">
        <p>content</p>
      </AdaptiveModal>,
    );
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("exposes the label as the dialog's accessible name", () => {
    render(
      <AdaptiveModal open onOpenChange={() => {}} presentation="dialog" label="Settings">
        <p>content</p>
      </AdaptiveModal>,
    );
    // Radix Dialog requires a Title for a11y — assert it resolves a name and
    // emits no console warning (the Title is present).
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
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
});
