// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteGrid } from './NoteGrid';
import { NOTES } from '../theory';

describe('NoteGrid', () => {
  it('renders 12 note buttons', () => {
    render(
      <NoteGrid
        notes={NOTES}
        selected="C"
        onSelect={() => {}}
        useFlats={false}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(12);
  });

  it('highlights selected note with "active" class', () => {
    render(
      <NoteGrid
        notes={NOTES}
        selected="C#"
        onSelect={() => {}}
        useFlats={false}
      />,
    );
    const activeButton = screen.getByText('C♯');
    expect(activeButton.className).toContain('active');
    const cButton = screen.getByText('C');
    expect(cButton.className).not.toContain('active');
  });

  it('calls onSelect with note on button click', () => {
    const onSelect = vi.fn();
    render(
      <NoteGrid
        notes={NOTES}
        selected="C"
        onSelect={onSelect}
        useFlats={false}
      />,
    );
    fireEvent.click(screen.getByText('D'));
    expect(onSelect).toHaveBeenCalledWith('D');
  });

  it('displays flats when useFlats is true', () => {
    render(
      <NoteGrid
        notes={NOTES}
        selected="C"
        onSelect={() => {}}
        useFlats={true}
      />,
    );
    expect(screen.getByText('B♭')).toBeTruthy();
    expect(screen.queryByText('A♯')).toBeNull();
  });

  it('displays sharps when useFlats is false', () => {
    render(
      <NoteGrid
        notes={NOTES}
        selected="C"
        onSelect={() => {}}
        useFlats={false}
      />,
    );
    expect(screen.getByText('A♯')).toBeTruthy();
    expect(screen.queryByText('B♭')).toBeNull();
  });
});
