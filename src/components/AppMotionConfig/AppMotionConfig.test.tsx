// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppMotionConfig } from "./AppMotionConfig";

describe("AppMotionConfig", () => {
  it("renders children", () => {
    render(
      <AppMotionConfig>
        <span data-testid="child">hello</span>
      </AppMotionConfig>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders a single child element without extra wrapper nodes", () => {
    const { container } = render(
      <AppMotionConfig>
        <div data-testid="inner" />
      </AppMotionConfig>,
    );
    // The MotionConfig from motion/react is a context-only provider that adds
    // no DOM node of its own — the inner div should be a direct child of root.
    expect(container.firstChild).toBe(screen.getByTestId("inner"));
  });
});
