import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ErrorBoundary, ErrorFallback } from "./ErrorBoundary";
import { axe } from "../../test-utils/a11y";

const ThrowingChild = () => {
  throw new Error("Test error");
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary fallback={<div>Fallback</div>}>
        <div>Safe content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Safe content")).toBeTruthy();
  });

  it("renders fallback UI when child throws", () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("Custom fallback")).toBeTruthy();
  });

  it("does not render children when error occurs", () => {
    const SafeChild = () => <div>Safe content</div>;
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <SafeChild />
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("Custom fallback")).toBeTruthy();
    expect(screen.queryByText("Safe content")).toBeNull();
  });
});

describe("ErrorFallback", () => {
  it("renders 'Something went wrong' title", () => {
    render(<ErrorFallback />);
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
  });

  it("renders 'Try Again' button", () => {
    render(<ErrorFallback />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("shows version when __APP_VERSION__ is set", () => {
    window.__APP_VERSION__ = "1.2.3";
    render(<ErrorFallback />);
    expect(screen.getByText("Version 1.2.3")).toBeTruthy();
    delete window.__APP_VERSION__;
  });

  it("shows fallback message when __APP_VERSION__ is not set", () => {
    delete window.__APP_VERSION__;
    render(<ErrorFallback />);
    expect(
      screen.getByText("An error occurred while rendering the app")
    ).toBeTruthy();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ErrorFallback />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("calls window.location.reload when Try Again is clicked", () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadMock },
      writable: true,
    });
    render(<ErrorFallback />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reloadMock).toHaveBeenCalledOnce();
  });
});
