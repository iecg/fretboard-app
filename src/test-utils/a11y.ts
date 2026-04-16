/**
 * Shared a11y test utility for vitest-axe.
 *
 * Usage in component test files:
 *   import { axe } from '../test-utils/a11y';
 *   it('has no a11y violations', async () => {
 *     const { container } = render(<MyComponent />);
 *     expect(await axe(container)).toHaveNoViolations();
 *   });
 *
 * The toHaveNoViolations matcher is registered globally in vitest.setup.ts.
 */
import { configureAxe } from 'vitest-axe';

export const axe = configureAxe({
  rules: {
    // color-contrast: disabled in unit tests — axe cannot measure CSS custom property
    // values in jsdom (computed styles are not available). Contrast must be checked
    // via browser-based tools or @axe-core/playwright integration.
    'color-contrast': { enabled: false },
  },
});

export { configureAxe };
