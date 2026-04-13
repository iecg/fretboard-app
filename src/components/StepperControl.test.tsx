// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepperControl } from './StepperControl';

describe('StepperControl', () => {
  it('renders label when provided', () => {
    render(<StepperControl value={5} onChange={vi.fn()} min={0} max={10} label="Zoom" />);
    expect(screen.getByText('Zoom')).toBeTruthy();
  });

  it('omits label span when label not provided', () => {
    const { container } = render(
      <StepperControl value={5} onChange={vi.fn()} min={0} max={10} />
    );
    expect(container.querySelector('.section-label')).toBeNull();
  });

  it('renders formatValue output in stepper-value span', () => {
    render(
      <StepperControl
        value={100}
        onChange={vi.fn()}
        min={100}
        max={300}
        formatValue={(z) => (z <= 100 ? 'Auto' : `${z}%`)}
      />
    );
    expect(screen.getByText('Auto')).toBeTruthy();
  });

  it('decrement button calls onChange with value minus step', () => {
    const onChange = vi.fn();
    render(<StepperControl value={5} onChange={onChange} min={0} max={10} step={2} />);
    fireEvent.click(screen.getByText('−'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('decrement button clamps to min', () => {
    const onChange = vi.fn();
    render(<StepperControl value={1} onChange={onChange} min={0} max={10} step={5} />);
    fireEvent.click(screen.getByText('−'));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('increment button calls onChange with value plus step', () => {
    const onChange = vi.fn();
    render(<StepperControl value={5} onChange={onChange} min={0} max={10} step={2} />);
    fireEvent.click(screen.getByText('+'));
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('increment button clamps to max', () => {
    const onChange = vi.fn();
    render(<StepperControl value={9} onChange={onChange} min={0} max={10} step={5} />);
    fireEvent.click(screen.getByText('+'));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('decrement button disabled when value equals min', () => {
    render(<StepperControl value={0} onChange={vi.fn()} min={0} max={10} />);
    const buttons = screen.getAllByRole('button');
    const decrementBtn = buttons[0];
    expect(decrementBtn.hasAttribute('disabled')).toBe(true);
  });

  it('increment button disabled when value equals max', () => {
    render(<StepperControl value={10} onChange={vi.fn()} min={0} max={10} />);
    const buttons = screen.getAllByRole('button');
    const incrementBtn = buttons[1];
    expect(incrementBtn.hasAttribute('disabled')).toBe(true);
  });

  it('mobile variant applies mobile class to container', () => {
    const { container } = render(
      <StepperControl value={5} onChange={vi.fn()} min={0} max={10} buttonVariant="mobile" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('stepper-control');
    expect(wrapper.className).toContain('mobile');
  });

  it('default step is 1 when not provided', () => {
    const onChange = vi.fn();
    render(<StepperControl value={5} onChange={onChange} min={0} max={10} />);
    fireEvent.click(screen.getByText('+'));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('custom formatValue function is used for display', () => {
    render(
      <StepperControl
        value={150}
        onChange={vi.fn()}
        min={100}
        max={300}
        step={10}
        formatValue={(z) => (z <= 100 ? 'Auto' : `${z}%`)}
      />
    );
    expect(screen.getByText('150%')).toBeTruthy();
  });
});
