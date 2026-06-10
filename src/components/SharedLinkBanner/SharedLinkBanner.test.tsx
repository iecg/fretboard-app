import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { SharedLinkBanner } from "./SharedLinkBanner";
import { urlOverridesAtom } from "../../store/urlOverrideAtoms";
import { renderWithStore } from "../../test-utils/renderWithAtoms";
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

describe("SharedLinkBanner", () => {
  it("renders nothing when no overrides active", () => {
    const store = createStore();
    const { container } = renderWithStore(<SharedLinkBanner />, store);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner text when overrides active", () => {
    const store = createStore();
    store.set(urlOverridesAtom, OVERRIDE);
    renderWithStore(<SharedLinkBanner />, store);
    expect(screen.getByText(/viewing shared song/i)).toBeInTheDocument();
    expect(screen.getByText(/C major/)).toBeInTheDocument();
  });

  it("clears overrides on dismiss", async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.set(urlOverridesAtom, OVERRIDE);
    renderWithStore(<SharedLinkBanner />, store);
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(store.get(urlOverridesAtom)).toBeNull();
  });

  it("has no accessibility violations when visible", async () => {
    const store = createStore();
    store.set(urlOverridesAtom, OVERRIDE);
    const { container } = renderWithStore(<SharedLinkBanner />, store);
    expect(await axe(container)).toHaveNoViolations();
  });
});
