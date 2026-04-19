// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFocusTrap } from "./useFocusTrap";

describe("useFocusTrap", () => {
  let container: HTMLDivElement;
  let button1: HTMLButtonElement;
  let button2: HTMLButtonElement;
  let containerRef: { current: HTMLDivElement };

  beforeEach(() => {
    container = document.createElement("div");
    button1 = document.createElement("button");
    button1.textContent = "Button 1";
    button2 = document.createElement("button");
    button2.textContent = "Button 2";
    container.appendChild(button1);
    container.appendChild(button2);
    document.body.appendChild(container);

    containerRef = { current: container };
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it("focuses the first focusable element after rAF tick when active=true", async () => {
    const onEscape = vi.fn();

    vi.useFakeTimers();
    try {
      renderHook(() =>
        useFocusTrap({ containerRef, active: true, onEscape })
      );

      // rAF has not fired yet
      expect(document.activeElement).not.toBe(button1);

      // Flush all pending rAF callbacks
      act(() => {
        vi.runAllTimers();
      });

      expect(document.activeElement).toBe(button1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Tab advances focus from button1 to button2", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();

    renderHook(() =>
      useFocusTrap({ containerRef, active: true, onEscape })
    );

    // Move focus into the trap
    button1.focus();
    expect(document.activeElement).toBe(button1);

    await user.tab();

    expect(document.activeElement).toBe(button2);
  });

  it("Tab wraps from last button back to first button", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();

    renderHook(() =>
      useFocusTrap({ containerRef, active: true, onEscape })
    );

    button2.focus();
    expect(document.activeElement).toBe(button2);

    await user.tab();

    expect(document.activeElement).toBe(button1);
  });

  it("Shift+Tab moves focus from button2 to button1", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();

    renderHook(() =>
      useFocusTrap({ containerRef, active: true, onEscape })
    );

    button2.focus();
    expect(document.activeElement).toBe(button2);

    await user.tab({ shift: true });

    expect(document.activeElement).toBe(button1);
  });

  it("Shift+Tab wraps from first button back to last button", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();

    renderHook(() =>
      useFocusTrap({ containerRef, active: true, onEscape })
    );

    button1.focus();
    expect(document.activeElement).toBe(button1);

    await user.tab({ shift: true });

    expect(document.activeElement).toBe(button2);
  });

  it("Escape calls onEscape and calls event.preventDefault()", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();

    renderHook(() =>
      useFocusTrap({ containerRef, active: true, onEscape })
    );

    button1.focus();

    // Spy on preventDefault via keydown listener
    const preventDefaultSpy = vi.fn();
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") preventDefaultSpy();
      },
      { once: true }
    );

    await user.keyboard("{Escape}");

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
  });

  it("restores focus to restoreFocusRef.current when active flips to false", async () => {
    const restoreTarget = document.createElement("button");
    restoreTarget.textContent = "Restore target";
    document.body.appendChild(restoreTarget);

    const restoreFocusRef = { current: restoreTarget };
    const onEscape = vi.fn();

    const { rerender } = renderHook(
      ({ active: a }: { active: boolean }) =>
        useFocusTrap({ containerRef, active: a, onEscape, restoreFocusRef }),
      { initialProps: { active: true } }
    );

    button1.focus();

    act(() => {
      rerender({ active: false });
    });

    expect(document.activeElement).toBe(restoreTarget);

    document.body.removeChild(restoreTarget);
  });

  it("removes event listener on unmount and does not call onEscape after unmount", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();

    const { unmount } = renderHook(() =>
      useFocusTrap({ containerRef, active: true, onEscape })
    );

    button1.focus();
    unmount();

    // After unmount, pressing Escape should NOT call the old onEscape
    await user.keyboard("{Escape}");

    expect(onEscape).not.toHaveBeenCalled();
  });
});