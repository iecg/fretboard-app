import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { makeAtomStore, renderWithStore, renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { mobilePanelAtom } from "../../store/uiAtoms";
import { MobileShell } from "./MobileShell";

describe("MobileShell", () => {
  it("renders header, track, fretboard stage, panel, and dock regions", () => {
    renderWithAtoms(
      <MobileShell
        layoutTier="mobile"
        layoutVariant="mobile"
        header={<div data-testid="hdr" />}
        track={<div data-testid="trk" />}
        panel={<div data-testid="pnl" />}
        dock={<div data-testid="dck" />}
      >
        <div data-testid="fret" />
      </MobileShell>,
    );
    expect(screen.getByTestId("hdr")).toBeInTheDocument();
    expect(screen.getByTestId("trk")).toBeInTheDocument();
    expect(screen.getByTestId("fret")).toBeInTheDocument();
    expect(screen.getByTestId("pnl")).toBeInTheDocument();
    expect(screen.getByTestId("dck")).toBeInTheDocument();
    const shell = screen.getByTestId("mobile-shell");
    expect(shell).toHaveAttribute("data-layout-tier", "mobile");
    expect(shell).toHaveAttribute("data-layout-variant", "mobile");
    expect(shell).toHaveAttribute("data-mobile-panel", "none");
    expect(
      screen.getByRole("main", { name: "Fretboard stage" }),
    ).toBeInTheDocument();
  });

  it("stamps the open panel id for the stage spacing CSS", () => {
    const store = makeAtomStore([[mobilePanelAtom, "overlay"]]);
    renderWithStore(
      <MobileShell
        layoutTier="mobile"
        layoutVariant="mobile"
        header={null}
        track={null}
        panel={null}
        dock={null}
      >
        <div />
      </MobileShell>,
      store,
    );
    expect(screen.getByTestId("mobile-shell")).toHaveAttribute(
      "data-mobile-panel",
      "overlay",
    );
  });
});
