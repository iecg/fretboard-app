import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithAtoms,
  makeAtomStore,
  renderWithStore,
} from "../../test-utils/renderWithAtoms";
import { isMutedAtom } from "@fretflow/fretboard/store/audioAtoms";
import { themeAtom } from "@fretflow/fretboard/store/uiAtoms";
import { AppHeaderActions } from "./AppHeaderActions";

describe("AppHeaderActions", () => {
  it("buttons variant renders four icon buttons", () => {
    renderWithAtoms(<AppHeaderActions variant="buttons" onShowHelp={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("buttons variant handlers fire from the shared actions array", async () => {
    // Guards against drift between the `actions` array and the rendered
    // buttons: the handlers wired to each button must come from the array.
    const store = makeAtomStore([
      [isMutedAtom, false],
      [themeAtom, "dark"],
    ]);
    renderWithStore(
      <AppHeaderActions variant="buttons" onShowHelp={() => {}} />,
      store,
    );

    // Theme button flips the theme atom.
    await userEvent.click(
      screen.getByRole("button", { name: /switch to light theme/i }),
    );
    expect(store.get(themeAtom)).toBe("light");

    // Mute button toggles the muted atom.
    await userEvent.click(screen.getByRole("button", { name: /mute audio/i }));
    expect(store.get(isMutedAtom)).toBe(true);
  });

  it("buttons variant help button calls onShowHelp", async () => {
    const onShowHelp = vi.fn();
    renderWithAtoms(
      <AppHeaderActions variant="buttons" onShowHelp={onShowHelp} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /open help/i }));
    expect(onShowHelp).toHaveBeenCalledTimes(1);
  });

  it("menu variant opens all actions from one trigger", async () => {
    renderWithAtoms(<AppHeaderActions variant="menu" onShowHelp={() => {}} />);
    await userEvent.click(screen.getByTestId("header-overflow-trigger"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThanOrEqual(4);
  });

  it("menu variant help item calls onShowHelp", async () => {
    const onShowHelp = vi.fn();
    renderWithAtoms(<AppHeaderActions variant="menu" onShowHelp={onShowHelp} />);
    await userEvent.click(screen.getByTestId("header-overflow-trigger"));
    const items = screen.getAllByRole("menuitem");
    const helpItem = items[items.length - 1];
    await userEvent.click(helpItem);
    expect(onShowHelp).toHaveBeenCalledTimes(1);
  });
});
