// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from '../../test-utils/a11y';
import StepperControl from './StepperControl';

describe('StepperControl/StepperControl', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <StepperControl label="Fret count" value={5} min={1} max={24} onChange={() => {}} />,
    );
    expect(container).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <StepperControl label="Fret count" value={5} min={1} max={24} onChange={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
