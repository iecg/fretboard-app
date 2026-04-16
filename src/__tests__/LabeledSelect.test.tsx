import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LabeledSelect, type LabeledSelectOption } from '../components/LabeledSelect';
import { axe } from '../test-utils/a11y';

const scaleOptions: LabeledSelectOption[] = [
  { value: 'major-modes', label: 'Major Modes' },
  { value: 'minor-modes', label: 'Minor Modes' },
  { value: 'pentatonic', label: 'Pentatonic' },
  { value: 'blues', label: 'Blues' },
];

describe('LabeledSelect', () => {
  it('renders with label text', () => {
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />
    );
    expect(screen.getAllByText('Scale Family').length).toBeGreaterThanOrEqual(1);
  });

  it('renders trigger button showing current display value', () => {
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />
    );
    const trigger = screen.getByRole('button', { name: /Scale Family/i });
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain('Major Modes');
  });

  it('clicking trigger opens listbox with all options', async () => {
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Scale Family/i }));
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeTruthy();
    for (const opt of scaleOptions) {
      const matches = screen.getAllByText(opt.label);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('selecting an option fires onChange with the value key', async () => {
    const onChange = vi.fn();
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Scale Family/i }));
    const listbox = screen.getByRole('listbox');
    const pentatonicOption = Array.from(listbox.querySelectorAll('[role="option"]'))
      .find(el => el.textContent === 'Pentatonic') as HTMLElement;
    await userEvent.click(pentatonicOption);
    expect(onChange).toHaveBeenCalledWith('pentatonic');
  });

  it('has no accessibility violations (default render)', async () => {
    const { container } = render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations (disabled state)', async () => {
    const { container } = render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
        disabled
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
