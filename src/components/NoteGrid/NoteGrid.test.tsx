// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteGrid, NOTE_GRID_COLUMNS } from "../NoteGrid/NoteGrid";
import { NOTES } from "@fretflow/core";
import { axe } from "../../test-utils/a11y";

describe("NoteGrid/NoteGrid", () => {
  it("uses 12 grid columns", () => {
    expect(NOTE_GRID_COLUMNS).toBe(12);
  });

  it("renders 12 note buttons", () => {
    render(
      <NoteGrid
        notes={NOTES}
        selected="C"
        onSelect={() => {}}
        preferFlats={false}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(12);
  });

  it('highlights selected note with "active" class', () => {
    render(
      <NoteGrid
        notes={NOTES}
        selected="C#"
        onSelect={() => {}}
        preferFlats={false}
      />,
    );
    const activeButton = screen.getByRole("button", { name: /C♯/ });
    expect(activeButton).toHaveClass("active");
    const cButton = screen.getByRole("button", { name: /^C$/ });
    expect(cButton).not.toHaveClass("active");
  });

  it("calls onSelect with note on button click", () => {
    const onSelect = vi.fn();
    render(
      <NoteGrid
        notes={NOTES}
        selected="C"
        onSelect={onSelect}
        preferFlats={false}
      />,
    );
    fireEvent.click(screen.getByText("D"));
    expect(onSelect).toHaveBeenCalledWith("D");
  });

  it("displays flats when preferFlats is true", () => {
    render(
      <NoteGrid
        notes={NOTES}
        selected="C"
        onSelect={() => {}}
        preferFlats={true}
      />,
    );
    expect(screen.getByText("B♭")).toBeInTheDocument();
    expect(screen.queryByText("A♯")).not.toBeInTheDocument();
  });

  it("displays sharps when preferFlats is false", () => {
    render(
      <NoteGrid
        notes={NOTES}
        selected="C"
        onSelect={() => {}}
        preferFlats={false}
      />,
    );
    expect(screen.getByText("A♯")).toBeInTheDocument();
    expect(screen.queryByText("B♭")).not.toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <NoteGrid
        notes={NOTES}
        selected="C"
        onSelect={() => {}}
        preferFlats={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
