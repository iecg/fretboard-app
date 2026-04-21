import { configureAxe } from 'vitest-axe';

// color-contrast: disabled in unit tests — axe cannot measure CSS custom property
// values in jsdom (computed styles are not available). Use browser-based tools
// or @axe-core/playwright for contrast checks.
export const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

export { configureAxe };
