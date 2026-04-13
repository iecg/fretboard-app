// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FingeringPatternControls } from './FingeringPatternControls';
import { type CagedShape } from '../shapes';

const defaultProps = {
  fingeringPattern: 'all' as const,
  setFingeringPattern: vi.fn(),
  cagedShapes: new Set<CagedShape>(['C', 'A', 'G', 'E', 'D']),
  setCagedShapes: vi.fn(),
  npsPosition: 0,
  setNpsPosition: vi.fn(),
  shapeLabels: 'none' as const,
  setShapeLabels: vi.fn(),
  displayFormat: 'notes' as const,
  setDisplayFormat: vi.fn(),
};

describe('FingeringPatternControls', () => {
  it('renders all fingering pattern options', () => {
    render(<FingeringPatternControls {...defaultProps} />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('CAGED')).toBeTruthy();
    expect(screen.getByText('3NPS')).toBeTruthy();
  });

  it('calls setFingeringPattern on button click', () => {
    const setFingeringPattern = vi.fn();
    render(
      <FingeringPatternControls
        {...defaultProps}
        setFingeringPattern={setFingeringPattern}
      />,
    );
    fireEvent.click(screen.getByText('CAGED'));
    expect(setFingeringPattern).toHaveBeenCalledWith('caged');
  });

  it('shows Shape and Shape Labels sections only when fingeringPattern === "caged"', () => {
    const { rerender } = render(
      <FingeringPatternControls
        {...defaultProps}
        fingeringPattern="caged"
        cagedShapes={new Set<CagedShape>(['C'])}
      />,
    );
    expect(screen.getByText('Shape')).toBeTruthy();
    expect(screen.getByText('Shape Labels')).toBeTruthy();

    rerender(<FingeringPatternControls {...defaultProps} fingeringPattern="all" />);
    expect(screen.queryByText('Shape')).toBeNull();
    expect(screen.queryByText('Shape Labels')).toBeNull();
  });

  it('shows Position section only when fingeringPattern === "3nps"', () => {
    const { rerender } = render(
      <FingeringPatternControls {...defaultProps} fingeringPattern="3nps" />,
    );
    expect(screen.getByText('Position')).toBeTruthy();

    rerender(<FingeringPatternControls {...defaultProps} fingeringPattern="all" />);
    expect(screen.queryByText('Position')).toBeNull();
  });

  it('handles shift-click multi-select for CAGED shapes', () => {
    const setCagedShapes = vi.fn();
    render(
      <FingeringPatternControls
        {...defaultProps}
        fingeringPattern="caged"
        cagedShapes={new Set<CagedShape>(['C'])}
        setCagedShapes={setCagedShapes}
      />,
    );
    const aButton = screen.getByText('A');
    fireEvent.click(aButton, { shiftKey: true });

    expect(setCagedShapes).toHaveBeenCalledTimes(1);
    const updater = setCagedShapes.mock.calls[0][0];
    expect(typeof updater).toBe('function');
    const result = updater(new Set<CagedShape>(['C']));
    expect(result.has('C')).toBe(true);
    expect(result.has('A')).toBe(true);
  });

  it('calls setDisplayFormat when Note Labels button clicked', () => {
    const setDisplayFormat = vi.fn();
    render(
      <FingeringPatternControls
        {...defaultProps}
        setDisplayFormat={setDisplayFormat}
      />,
    );
    fireEvent.click(screen.getByText('Intervals'));
    expect(setDisplayFormat).toHaveBeenCalledWith('degrees');
  });
});
