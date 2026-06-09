import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallBanner } from "./InstallBanner";

describe("InstallBanner", () => {
  it("renders when canInstall is true", () => {
    render(<InstallBanner canInstall={true} onInstall={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/install fretflow/i)).toBeInTheDocument();
  });

  it("renders nothing when canInstall is false", () => {
    const { container } = render(<InstallBanner canInstall={false} onInstall={vi.fn()} onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("calls onInstall when install button clicked", async () => {
    const user = userEvent.setup();
    const onInstall = vi.fn();
    render(<InstallBanner canInstall={true} onInstall={onInstall} onDismiss={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /install/i }));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when dismiss button clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<InstallBanner canInstall={true} onInstall={vi.fn()} onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
