// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MainLayoutWrapper } from "./MainLayoutWrapper";

const baseProps = {
  children: <div data-testid="kids" />,
  header: <div />,
  layoutTier: "desktop",
  layoutVariant: "desktop-split",
  isChordActive: false,
  showSummary: false,
  showControlsPanel: false,
  showMobileTabs: false,
} as const;

describe("MainLayoutWrapper status-bar slot", () => {
  it("renders the status-bar shell when showStatusBar is true and a node is provided", () => {
    render(
      <MainLayoutWrapper
        {...baseProps}
        showStatusBar
        statusBar={<div data-testid="status-content" />}
      />,
    );
    const shell = screen.getByTestId("status-bar-shell");
    expect(shell).toBeInTheDocument();
    expect(shell).toContainElement(screen.getByTestId("status-content"));
  });

  it("omits the status-bar shell when showStatusBar is false", () => {
    render(
      <MainLayoutWrapper
        {...baseProps}
        showStatusBar={false}
        statusBar={<div data-testid="status-content" />}
      />,
    );
    expect(screen.queryByTestId("status-bar-shell")).toBeNull();
  });

  it("omits the status-bar shell when no statusBar node is provided", () => {
    render(<MainLayoutWrapper {...baseProps} showStatusBar />);
    expect(screen.queryByTestId("status-bar-shell")).toBeNull();
  });
});
