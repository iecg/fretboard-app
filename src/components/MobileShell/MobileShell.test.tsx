import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileShell } from "./MobileShell";

describe("MobileShell", () => {
  it("renders header, track, fretboard stage, and sheet regions", () => {
    render(
      <MobileShell
        layoutTier="mobile"
        layoutVariant="mobile"
        header={<div data-testid="hdr" />}
        track={<div data-testid="trk" />}
        sheet={<div data-testid="sht" />}
      >
        <div data-testid="fret" />
      </MobileShell>,
    );
    expect(screen.getByTestId("hdr")).toBeInTheDocument();
    expect(screen.getByTestId("trk")).toBeInTheDocument();
    expect(screen.getByTestId("fret")).toBeInTheDocument();
    expect(screen.getByTestId("sht")).toBeInTheDocument();
    const shell = screen.getByTestId("mobile-shell");
    expect(shell).toHaveAttribute("data-layout-tier", "mobile");
    expect(shell).toHaveAttribute("data-layout-variant", "mobile");
  });
});
