import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { openModalSheetCountAtom } from "../../store/uiAtoms";
import { useUnhideMobileShell } from "./useUnhideMobileShell";

/**
 * Minimal harness: a shell root with a "stage" child, wired to the hook. The
 * tests drive the same DOM mutation Radix's `hideOthers` performs — setting
 * `aria-hidden` + `data-aria-hidden` — and assert the hook's behavior without
 * pulling in vaul (which doesn't run in jsdom).
 */
function Harness() {
  const shellRef = useRef<HTMLDivElement>(null);
  useUnhideMobileShell(shellRef);
  return (
    <div ref={shellRef} data-testid="shell">
      <main data-testid="stage" />
    </div>
  );
}

function hide(el: HTMLElement) {
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("data-aria-hidden", "true");
}

describe("useUnhideMobileShell", () => {
  it("strips spurious aria-hidden the moment it appears on a shell descendant", async () => {
    const store = makeAtomStore();
    const { getByTestId } = renderWithStore(<Harness />, store);
    const stage = getByTestId("stage");

    act(() => hide(stage));

    await waitFor(() => {
      expect(stage.getAttribute("aria-hidden")).toBeNull();
      expect(stage.getAttribute("data-aria-hidden")).toBeNull();
    });
  });

  it("strips spurious aria-hidden on the shell root itself", async () => {
    const store = makeAtomStore();
    const { getByTestId } = renderWithStore(<Harness />, store);
    const shell = getByTestId("shell");

    act(() => hide(shell));

    await waitFor(() => {
      expect(shell.getAttribute("aria-hidden")).toBeNull();
    });
  });

  it("stands down while a modal sheet is open, leaving the background hidden", async () => {
    // A genuine modal (Settings/Help) is open — it SHOULD hide the background.
    const store = makeAtomStore([[openModalSheetCountAtom, 1]]);
    const { getByTestId } = renderWithStore(<Harness />, store);
    const stage = getByTestId("stage");

    act(() => hide(stage));

    // Give any (non-existent) observer a chance to run; it must NOT strip.
    await new Promise((r) => setTimeout(r, 20));
    expect(stage.getAttribute("aria-hidden")).toBe("true");
  });

  it("re-asserts and sweeps lingering hiding when the modal closes", async () => {
    const store = makeAtomStore([[openModalSheetCountAtom, 1]]);
    const { getByTestId } = renderWithStore(<Harness />, store);
    const stage = getByTestId("stage");

    // While modal is open, the background is (correctly) hidden.
    act(() => hide(stage));
    await new Promise((r) => setTimeout(r, 20));
    expect(stage.getAttribute("aria-hidden")).toBe("true");

    // Modal closes. Closing does not itself re-mutate the stage (aria-hidden's
    // reference counter just drops), so the hook must sweep on the transition.
    act(() => {
      store.set(openModalSheetCountAtom, 0);
    });

    await waitFor(() => {
      expect(stage.getAttribute("aria-hidden")).toBeNull();
      expect(stage.getAttribute("data-aria-hidden")).toBeNull();
    });
  });
});
