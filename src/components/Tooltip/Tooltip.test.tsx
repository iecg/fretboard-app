import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("renders the trigger child", () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    expect(screen.getByRole("button", { name: "Trigger" })).toBeTruthy();
  });

  it("shows the tooltip content on focus", async () => {
    render(
      <Tooltip content="Help text" delayDuration={0}>
        <button type="button">Trigger</button>
      </Tooltip>,
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
      <Tooltip content="Help text" delayDuration={0}>
        <button type="button">Trigger</button>
      </Tooltip>,
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
});
