import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Tooltip, TooltipProvider } from "./Tooltip";

describe("Tooltip", () => {
  function withProvider(node: React.ReactElement) {
    return <TooltipProvider delayDuration={0}>{node}</TooltipProvider>;
  }

  it("renders the trigger child", () => {
    render(
      withProvider(
        <Tooltip content="Help text">
          <button type="button">Trigger</button>
        </Tooltip>,
      ),
    );
    expect(screen.getByRole("button", { name: "Trigger" })).toBeTruthy();
  });

  it("shows the tooltip content on focus", async () => {
    render(
      withProvider(
        <Tooltip content="Help text" delayDuration={0}>
          <button type="button">Trigger</button>
        </Tooltip>,
      ),
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    await act(async () => {
      trigger.focus();
    });
    const tip = await screen.findByRole("tooltip");
    expect(tip.textContent).toContain("Help text");
  });

  it("hides the tooltip content on blur", async () => {
    render(
      withProvider(
        <Tooltip content="Help text" delayDuration={0}>
          <button type="button">Trigger</button>
        </Tooltip>,
      ),
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    await act(async () => {
      trigger.focus();
    });
    await screen.findByRole("tooltip");
    await act(async () => {
      trigger.blur();
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("two Tooltip instances share their TooltipProvider", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip content="First"><button type="button">A</button></Tooltip>
        <Tooltip content="Second"><button type="button">B</button></Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "A" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "B" })).toBeTruthy();
  });
});
