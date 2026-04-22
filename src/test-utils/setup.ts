import '@testing-library/jest-dom';
import { vi, expect } from 'vitest';
import { configure } from '@testing-library/react';
import { configureAxe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/dist/matchers.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
expect.extend({ toHaveNoViolations } as any);

// vitest-axe: registers toHaveNoViolations matcher globally.
// color-contrast rule disabled — jsdom cannot compute CSS custom property values.
// Use @axe-core/playwright for contrast checks in a real browser environment.
configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

// Nested lazy-loaded components (Suspense fallback={null}) can take >1 s to
// settle in jsdom. Raise the RTL async timeout to prevent spurious failures.
configure({ asyncUtilTimeout: 5000 });

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
