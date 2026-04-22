// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from '../../test-utils/a11y';
import { NoteGrid } from './NoteGrid';

describe('NoteGrid/NoteGrid', () => {
  it('has no a11y violations', async () => {
    const { container } = render(
      <NoteGrid
        notes={['C', 'D', 'E', 'F', 'G', 'A', 'B']}
        selected="C"
        onSelect={() => {}}
        useFlats={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
