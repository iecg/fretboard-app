import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { mobileSheetSnapAtom } from "../../store/uiAtoms";
import { MobileSheet } from "./MobileSheet";
import { SNAP_POINTS, snapIdToPoint, pointToSnapId } from "./mobileSheetSnap";

describe("snap mapping", () => {
  it("maps ids to vaul snap points and back", () => {
    expect(snapIdToPoint("peek")).toBe(SNAP_POINTS[0]);
    expect(snapIdToPoint("half")).toBe(SNAP_POINTS[1]);
    expect(snapIdToPoint("full")).toBe(SNAP_POINTS[2]);
    expect(pointToSnapId(SNAP_POINTS[0])).toBe("peek");
    expect(pointToSnapId(SNAP_POINTS[1])).toBe("half");
    expect(pointToSnapId(SNAP_POINTS[2])).toBe("full");
    expect(pointToSnapId(null)).toBe("peek");
  });

  it("falls back to peek for unknown points", () => {
    expect(pointToSnapId(0.123)).toBe("peek");
    expect(pointToSnapId("12px")).toBe("peek");
  });
});

describe("MobileSheet", () => {
  it("renders peek content and sheet body", () => {
    renderWithAtoms(
      <MobileSheet peek={<div data-testid="peek" />}>
        <div data-testid="body" />
      </MobileSheet>,
      [[mobileSheetSnapAtom, "full"]],
    );
    expect(screen.getByTestId("peek")).toBeInTheDocument();
    expect(screen.getByTestId("body")).toBeInTheDocument();
  });

  it("marks the body with the current snap id", () => {
    renderWithAtoms(
      <MobileSheet peek={null}>
        <div data-testid="body" />
      </MobileSheet>,
      [[mobileSheetSnapAtom, "peek"]],
    );
    const body = screen.getByTestId("body").parentElement;
    expect(body).toHaveAttribute("data-snap", "peek");
  });
});
