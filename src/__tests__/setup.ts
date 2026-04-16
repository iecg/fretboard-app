import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { configureAxe } from 'vitest-axe';
import 'vitest-axe/extend-expect';

// vitest-axe: registers toHaveNoViolations matcher globally.
// color-contrast rule disabled — jsdom cannot compute CSS custom property values.
// Use @axe-core/playwright for contrast checks in a real browser environment.
configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

// Fix __APP_VERSION__ to prevent snapshot breakage on version bumps
(globalThis as Record<string, unknown>).__APP_VERSION__ = '0.0.0-test';

// jsdom does not implement ResizeObserver
(globalThis as typeof globalThis & { ResizeObserver: unknown }).ResizeObserver =
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

// jsdom does not implement scrollTo on DOM elements
window.HTMLElement.prototype.scrollTo = () => {};

// jsdom does not implement scrollIntoView on DOM elements
window.HTMLElement.prototype.scrollIntoView = () => {};

// jsdom does not implement matchMedia
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));
