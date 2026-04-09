import '@testing-library/jest-dom';

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
