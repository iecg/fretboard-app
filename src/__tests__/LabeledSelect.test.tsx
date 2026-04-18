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

  it('renders a native combobox showing the current display value', () => {
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />
    );
    const select = screen.getByRole('combobox', { name: /Scale Family/i }) as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('major-modes');
    expect(select.selectedOptions[0]?.textContent).toBe('Major Modes');
  });

  it('renders all options in the native select', () => {
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />
    );
    const select = screen.getByRole('combobox', { name: /Scale Family/i }) as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((option) => option.textContent);
    for (const opt of scaleOptions) {
      expect(optionLabels).toContain(opt.label);
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
    const select = screen.getByRole('combobox', { name: /Scale Family/i });
    await userEvent.selectOptions(select, 'pentatonic');
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
