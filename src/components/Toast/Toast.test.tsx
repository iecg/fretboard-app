import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Toast } from "./Toast";

describe("Toast", () => {
  it("renders the message", () => {
    render(<Toast message="Link copied" onDismiss={() => {}} />);
    expect(screen.getByText("Link copied")).toBeInTheDocument();
  });

  it("has an accessible alert role", () => {
    render(<Toast message="Link copied" onDismiss={() => {}} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("calls onDismiss after the auto-dismiss duration", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast message="Link copied" onDismiss={onDismiss} durationMs={2000} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
