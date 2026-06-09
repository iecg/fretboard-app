import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { type ReactNode } from "react";
import { SharedLinkBanner } from "./SharedLinkBanner";
import { urlOverridesAtom } from "../../store/urlOverrideAtoms";
import type { ShareState } from "../../utils/shareCodec";

const OVERRIDE: ShareState = {
  root: "C",
  scale: "major",
  tempo: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  steps: [
    { degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } },
    { degree: "V", qualityOverride: null, duration: { value: 1, unit: "bar" } },
    { degree: "vi", qualityOverride: null, duration: { value: 1, unit: "bar" } },
    { degree: "IV", qualityOverride: null, duration: { value: 1, unit: "bar" } },
  ],
};

function createWrapper(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

describe("SharedLinkBanner", () => {
  it("renders nothing when no overrides active", () => {
    const store = createStore();
    const { container } = render(<SharedLinkBanner />, { wrapper: createWrapper(store) });
    expect(container.firstChild).toBeNull();
  });

  it("renders banner text when overrides active", () => {
    const store = createStore();
    store.set(urlOverridesAtom, OVERRIDE);
    render(<SharedLinkBanner />, { wrapper: createWrapper(store) });
    expect(screen.getByText(/viewing shared song/i)).toBeInTheDocument();
    expect(screen.getByText(/C major/)).toBeInTheDocument();
  });

  it("clears overrides on dismiss", async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.set(urlOverridesAtom, OVERRIDE);
    render(<SharedLinkBanner />, { wrapper: createWrapper(store) });
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(store.get(urlOverridesAtom)).toBeNull();
  });
});
