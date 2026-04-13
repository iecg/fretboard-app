// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToggleBar } from './ToggleBar';

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

describe('ToggleBar', () => {
  it('renders all option labels', () => {
    render(<ToggleBar options={options} value="a" onChange={vi.fn()} />);
    expect(screen.getByText('Option A')).toBeTruthy();
    expect(screen.getByText('Option B')).toBeTruthy();
    expect(screen.getByText('Option C')).toBeTruthy();
  });

  it('calls onChange with correct value on click', () => {
    const onChange = vi.fn();
    render(<ToggleBar options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByText('Option B'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('applies active class to the currently selected option', () => {
    render(<ToggleBar options={options} value="b" onChange={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).not.toContain('active');
    expect(buttons[1].className).toContain('active');
    expect(buttons[2].className).not.toContain('active');
  });

  it('default variant applies toggle-group container class', () => {
    const { container } = render(
      <ToggleBar options={options} value="a" onChange={vi.fn()} variant="default" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('toggle-group');
  });

  it('tabs variant applies mobile-tab-bar container class', () => {
    const { container } = render(
      <ToggleBar options={options} value="a" onChange={vi.fn()} variant="tabs" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('mobile-tab-bar');
  });

  it('variant defaults to default when omitted', () => {
    const { container } = render(
      <ToggleBar options={options} value="a" onChange={vi.fn()} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('toggle-group');
    expect(wrapper.className).not.toContain('mobile-tab-bar');
  });

  it('works with numeric values', () => {
    const numericOptions = [
      { value: 0, label: 'All' },
      { value: 1, label: '1' },
      { value: 2, label: '2' },
    ];
    const onChange = vi.fn();
    render(<ToggleBar options={numericOptions} value={0} onChange={onChange} />);
    fireEvent.click(screen.getByText('1'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('tabs variant applies mobile-tab class to buttons', () => {
    render(
      <ToggleBar options={options} value="a" onChange={vi.fn()} variant="tabs" />
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn.className).toContain('mobile-tab');
    });
  });

  it('default variant applies toggle-btn class to buttons', () => {
    render(
      <ToggleBar options={options} value="a" onChange={vi.fn()} variant="default" />
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn.className).toContain('toggle-btn');
    });
  });
});
