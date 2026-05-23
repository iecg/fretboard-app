// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StringSetPicker } from "./StringSetPicker";

describe("StringSetPicker", () => {
  it("formats label from strings[] as guitar-numbered '1·2·3·4'", () => {
    render(
      <StringSetPicker
        label="Strings"
        value="0-1-2-3"
        onChange={() => {}}
        options={[
          { id: "all" },
          { id: "0-1-2-3", strings: [0, 1, 2, 3] },
          { id: "1-2-3-4", strings: [1, 2, 3, 4] },
        ]}
      />,
    );
    // The combobox displays the selected value's formatted label
    expect(screen.getByRole("combobox", { name: /strings/i })).toHaveTextContent("1·2·3·4");
  });

  it("uses explicit label when provided", () => {
    render(
      <StringSetPicker
        label="Strings"
        value="0"
        onChange={() => {}}
        options={[
          { id: "0", label: "String 1" },
          { id: "1", label: "String 2" },
        ]}
      />,
    );
    expect(screen.getByRole("combobox", { name: /strings/i })).toHaveTextContent("String 1");
  });

  it("uses allLabel when id === 'all' and no explicit label", () => {
    render(
      <StringSetPicker
        label="Strings"
        value="all"
        onChange={() => {}}
        allLabel="All"
        options={[
          { id: "all" },
          { id: "0-1-2-3", strings: [0, 1, 2, 3] },
        ]}
      />,
    );
    expect(screen.getByRole("combobox", { name: /strings/i })).toHaveTextContent("All");
  });

  it("renders with auto sizing (uses LabeledSelect's fit/auto sizing)", () => {
    const { container } = render(
      <StringSetPicker
        label="Strings"
        value="0"
        onChange={() => {}}
        options={[{ id: "0", label: "String 1" }]}
      />,
    );
    expect(container.querySelector("[data-width='auto']")).toBeTruthy();
  });
});
