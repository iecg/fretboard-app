// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from '../../test-utils/a11y';
import { ToggleBar } from './ToggleBar';

describe('ToggleBar/ToggleBar', () => {
  it('default variant has no a11y violations', async () => {
    const { container } = render(
      <ToggleBar
        label="Display mode"
        options={[{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }]}
        value="a"
        onChange={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('tabs variant has no a11y violations', async () => {
    const { container } = render(
      <ToggleBar
        variant="tabs"
        label="Panel tabs"
        options={[{ label: 'Scale', value: 'scale' }, { label: 'Key', value: 'key' }]}
        value="scale"
        onChange={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
