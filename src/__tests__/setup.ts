import '@testing-library/jest-dom';

// jsdom does not implement ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom does not implement scrollTo on DOM elements
window.HTMLElement.prototype.scrollTo = () => {};
