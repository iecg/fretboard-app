// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from '../../test-utils/a11y';
import { Fretboard } from './Fretboard';
import { STANDARD_TUNING } from '../../core/guitar';

describe('Fretboard/Fretboard', () => {
  const defaultProps = {
    tuning: STANDARD_TUNING,
    maxFret: 24,
    highlightNotes: ['E', 'G', 'B'],
    rootNote: 'C',
    displayFormat: 'notes' as const,
    scaleName: 'C Major',
  };

  it('has no a11y violations', async () => {
    const { container } = render(
      <Fretboard {...defaultProps} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
