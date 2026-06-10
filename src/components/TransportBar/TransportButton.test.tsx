// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransportButton } from "./TransportButton";
import styles from "./TransportBar.module.css";

describe("TransportButton", () => {
  it("renders a type=button with the base faceplate class", () => {
    render(<TransportButton aria-label="Play" />);
    const button = screen.getByRole("button", { name: "Play" });
    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain(styles.transportButton);
    expect(button.className).not.toContain(styles["transportButton--accent"]);
    expect(button.className).not.toContain(styles["transportButton--touch"]);
  });

  it("applies the accent class when active", () => {
    render(<TransportButton aria-label="Loop" active />);
    expect(screen.getByRole("button", { name: "Loop" }).className).toContain(
      styles["transportButton--accent"],
    );
  });

  it("applies the touch-size class for size=touch", () => {
    render(<TransportButton aria-label="Play" size="touch" />);
    expect(screen.getByRole("button", { name: "Play" }).className).toContain(
      styles["transportButton--touch"],
    );
  });

  it("merges a caller className and forwards button props", async () => {
    const onClick = vi.fn();
    render(
      <TransportButton aria-label="Play" className="extra" disabled onClick={onClick} />,
    );
    const button = screen.getByRole("button", { name: "Play" });
    expect(button.className).toContain("extra");
    expect(button).toBeDisabled();
    await userEvent.click(button).catch(() => {});
    expect(onClick).not.toHaveBeenCalled();
  });
});
