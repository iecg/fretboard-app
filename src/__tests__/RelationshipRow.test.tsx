import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RelationshipRow } from "../components/RelationshipRow";
import type { ChordRowEntry } from "../theory";
import { axe } from "../test-utils/a11y";

const sharedEntry = (note: string, role: ChordRowEntry["role"] = "chord-tone-in-scale"): ChordRowEntry => ({
  internalNote: note,
  displayNote: note,
  memberName: "3",
  role,
  inScale: true,
});

const outsideEntry = (note: string, role: ChordRowEntry["role"] = "chord-tone-outside-scale"): ChordRowEntry => ({
  internalNote: note,
  displayNote: note,
  memberName: "♭7",
  role,
  inScale: false,
});

// C# Minor Triad over C Major: Shared=E, Outside=C#,G#
const shared = [sharedEntry("E")];
const outside = [
  outsideEntry("C#", "chord-root"),
  outsideEntry("G#"),
];

describe("RelationshipRow", () => {
  it("renders role=group with correct aria-label", () => {
    render(<RelationshipRow sharedMembers={shared} outsideMembers={outside} />);
    expect(screen.getByRole("group", { name: "Chord-scale relationship" })).toBeTruthy();
  });

  it("renders Shared group when shared members are present", () => {
    const { container } = render(
      <RelationshipRow sharedMembers={shared} outsideMembers={[]} />
    );
    expect(container.querySelector('[data-group="shared"]')).toBeTruthy();
    expect(screen.getByText("Shared")).toBeTruthy();
  });

  it("renders Outside group when outside members are present", () => {
    const { container } = render(
      <RelationshipRow sharedMembers={[]} outsideMembers={outside} />
    );
    expect(container.querySelector('[data-group="outside"]')).toBeTruthy();
    expect(screen.getByText("Outside")).toBeTruthy();
  });

  it("renders both groups when both have members", () => {
    const { container } = render(
      <RelationshipRow sharedMembers={shared} outsideMembers={outside} />
    );
    expect(container.querySelector('[data-group="shared"]')).toBeTruthy();
    expect(container.querySelector('[data-group="outside"]')).toBeTruthy();
  });

  it("renders correct note text in each group", () => {
    render(<RelationshipRow sharedMembers={shared} outsideMembers={outside} />);
    expect(screen.getByText("E")).toBeTruthy();
    expect(screen.getByText("C#")).toBeTruthy();
    expect(screen.getByText("G#")).toBeTruthy();
  });

  it("pills are capsule-shaped (no circular chip language)", () => {
    const { container } = render(
      <RelationshipRow sharedMembers={shared} outsideMembers={outside} />
    );
    const pills = container.querySelectorAll(".relationship-pill");
    expect(pills.length).toBeGreaterThan(0);
    // Pills should not use the degree-chip class (which is circular)
    expect(container.querySelector(".degree-chip")).toBeNull();
  });

  it("each pill has correct data-role attribute", () => {
    const { container } = render(
      <RelationshipRow sharedMembers={shared} outsideMembers={outside} />
    );
    const sharedPill = container.querySelector('[data-group="shared"] .relationship-pill');
    expect(sharedPill?.getAttribute("data-role")).toBe("chord-tone-in-scale");

    const outsideRootPill = container.querySelector(
      '[data-group="outside"] .relationship-pill[data-role="chord-root"]'
    );
    expect(outsideRootPill).toBeTruthy();
  });

  it("returns null when both groups are empty", () => {
    const { container } = render(
      <RelationshipRow sharedMembers={[]} outsideMembers={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("omits Shared group when sharedMembers is empty", () => {
    const { container } = render(
      <RelationshipRow sharedMembers={[]} outsideMembers={outside} />
    );
    expect(container.querySelector('[data-group="shared"]')).toBeNull();
    expect(container.querySelector('[data-group="outside"]')).toBeTruthy();
  });

  it("omits Outside group when outsideMembers is empty", () => {
    const { container } = render(
      <RelationshipRow sharedMembers={shared} outsideMembers={[]} />
    );
    expect(container.querySelector('[data-group="outside"]')).toBeNull();
    expect(container.querySelector('[data-group="shared"]')).toBeTruthy();
  });

  it("does not duplicate notes between shared and outside groups", () => {
    const { container } = render(
      <RelationshipRow sharedMembers={shared} outsideMembers={outside} />
    );
    const sharedNotes = Array.from(
      container.querySelectorAll('[data-group="shared"] .relationship-pill-note')
    ).map((el) => el.textContent);
    const outsideNotes = Array.from(
      container.querySelectorAll('[data-group="outside"] .relationship-pill-note')
    ).map((el) => el.textContent);
    const allNotes = [...sharedNotes, ...outsideNotes];
    const uniqueNotes = new Set(allNotes);
    expect(uniqueNotes.size).toBe(allNotes.length);
  });

  it("shared aria-label is 'Shared with scale'", () => {
    render(<RelationshipRow sharedMembers={shared} outsideMembers={[]} />);
    expect(screen.getByRole("list", { name: "Shared with scale" })).toBeTruthy();
  });

  it("outside aria-label is 'Outside scale'", () => {
    render(<RelationshipRow sharedMembers={[]} outsideMembers={outside} />);
    expect(screen.getByRole("list", { name: "Outside scale" })).toBeTruthy();
  });

  it("accepts an optional className", () => {
    const { container } = render(
      <RelationshipRow
        sharedMembers={shared}
        outsideMembers={outside}
        className="custom-class"
      />
    );
    expect(container.querySelector(".relationship-row.custom-class")).toBeTruthy();
  });

  it("has no accessibility violations with both groups", async () => {
    const { container } = render(
      <RelationshipRow sharedMembers={shared} outsideMembers={outside} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with only shared group", async () => {
    const { container } = render(
      <RelationshipRow sharedMembers={shared} outsideMembers={[]} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with only outside group", async () => {
    const { container } = render(
      <RelationshipRow sharedMembers={[]} outsideMembers={outside} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  describe("compare mode semantics (C Major + C# Minor Triad)", () => {
    it("shared group contains only E (in-scale chord tone)", () => {
      const { container } = render(
        <RelationshipRow sharedMembers={shared} outsideMembers={outside} />
      );
      const sharedPills = container.querySelectorAll(
        '[data-group="shared"] .relationship-pill-note'
      );
      expect(sharedPills).toHaveLength(1);
      expect(sharedPills[0].textContent).toBe("E");
    });

    it("outside group contains C# (chord root) and G#", () => {
      const { container } = render(
        <RelationshipRow sharedMembers={shared} outsideMembers={outside} />
      );
      const outsidePills = container.querySelectorAll(
        '[data-group="outside"] .relationship-pill-note'
      );
      expect(outsidePills).toHaveLength(2);
      const texts = Array.from(outsidePills).map((el) => el.textContent);
      expect(texts).toContain("C#");
      expect(texts).toContain("G#");
    });
  });
});
