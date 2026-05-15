import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { Inspector } from "./Inspector";

function renderInspector() {
  return render(
    <Provider store={createStore()}>
      <Inspector />
    </Provider>,
  );
}

describe("Inspector", () => {
  it("renders View, Scale, and Chord tabs", () => {
    renderInspector();
    expect(screen.getByRole("tab", { name: "View" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Scale" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Chord" })).toBeTruthy();
  });

  it("activates View tab by default", () => {
    renderInspector();
    expect(screen.getByRole("tab", { name: "View" }).getAttribute("aria-selected")).toBe("true");
  });

  it("renders one tabpanel for the active tab and tags it with the tab id", () => {
    renderInspector();
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("data-tab-id")).toBe("view");
  });
});
