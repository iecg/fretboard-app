import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "../Tooltip/Tooltip";
import { InspectorCard } from "./InspectorCard";
import type { InspectorCardProps } from "./InspectorCard";

function renderCard(props: Partial<InspectorCardProps> = {}) {
  return render(
    <TooltipProvider>
      <InspectorCard name="Test" labelledById="test-h" {...props}>
        <button data-testid="inner-button">Click me</button>
      </InspectorCard>
    </TooltipProvider>,
  );
}

describe("InspectorCard", () => {
  it("renders the card name as a heading", () => {
    renderCard({ name: "Key" });
    expect(screen.getByRole("heading", { name: "Key" })).toBeInTheDocument();
  });

  it("renders children in the body", () => {
    renderCard();
    expect(screen.getByTestId("inner-button")).toBeInTheDocument();
  });

  it("sets data-locked on the card body when locked=true", () => {
    const { container } = renderCard({ locked: true, lockedHint: "Pause to edit" });
    expect(container.querySelector("[data-locked='true']")).toBeInTheDocument();
  });

  it("makes the body inert when locked=true", () => {
    const { container } = renderCard({ locked: true, lockedHint: "Pause to edit" });
    expect(container.querySelector("[data-locked='true']")).toHaveAttribute("inert");
  });

  it("body is interactive when locked=false (default)", () => {
    const { container, getByTestId } = renderCard();
    expect(getByTestId("inner-button")).toBeEnabled();
    expect(container.querySelector("[data-locked='true']")).toBeNull();
  });

  it("renders a switch when toggle props are provided", () => {
    renderCard({
      active: true,
      onToggle: () => {},
      toggleLabel: "Enable",
    });
    expect(screen.getByRole("switch", { name: "Enable" })).toBeInTheDocument();
  });

  it("renders stateLabel chip when provided", () => {
    renderCard({ stateLabel: "Showing" });
    expect(screen.getByText("Showing")).toBeInTheDocument();
  });
});
