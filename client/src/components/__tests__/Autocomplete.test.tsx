import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import Autocomplete from '../Autocomplete';

interface TeamOption {
  id: number;
  name: string;
}

const teams: TeamOption[] = [
  { id: 1, name: 'River Plate' },
  { id: 2, name: 'Boca Juniors' },
  { id: 3, name: 'Racing Club' },
];

function Harness({
  onSelect,
  unmatchedText,
}: {
  onSelect?: (team: TeamOption) => void;
  unmatchedText?: string;
}) {
  const [value, setValue] = useState('');
  return (
    <div>
      <Autocomplete
        options={teams}
        getKey={(t) => String(t.id)}
        getLabel={(t) => t.name}
        value={value}
        onChange={setValue}
        onSelect={onSelect ?? vi.fn()}
        ariaLabel="Equipo"
        unmatchedText={unmatchedText}
      />
      <button>fuera</button>
    </div>
  );
}

function getInput(): HTMLInputElement {
  return screen.getByRole('combobox') as HTMLInputElement;
}

describe('Autocomplete', () => {
  beforeEach(() => cleanup());

  it('filters options by the typed text (case-insensitive substring)', () => {
    render(<Harness />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'boca' } });

    const listbox = screen.getByRole('listbox');
    expect(listbox.textContent).toContain('Boca Juniors');
    expect(listbox.textContent).not.toContain('River Plate');
    expect(listbox.textContent).not.toContain('Racing Club');
  });

  it('shows every option while the query is empty', () => {
    render(<Harness />);
    fireEvent.focus(getInput());

    const listbox = screen.getByRole('listbox');
    expect(listbox.textContent).toContain('River Plate');
    expect(listbox.textContent).toContain('Boca Juniors');
    expect(listbox.textContent).toContain('Racing Club');
  });

  it('shows the empty message when nothing matches', () => {
    render(<Harness />);
    fireEvent.focus(getInput());
    fireEvent.change(getInput(), { target: { value: 'zzz' } });

    expect(screen.getByRole('listbox').textContent).toContain('Sin resultados');
  });

  it('selects the active option with Enter after ArrowDown navigation', () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const input = getInput();
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(teams[0]);
    // The dropdown closes after a selection
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('moves the active option with ArrowDown/ArrowUp (with wrap-around)', () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const input = getInput();
    fireEvent.focus(input);

    // Down twice → second option; up once → first option again (wraps)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(teams[1]);

    onSelect.mockClear();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    // ArrowUp from a fresh open wraps to the LAST option
    expect(onSelect).toHaveBeenCalledWith(teams[2]);
  });

  it('selects an option on click', () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.focus(getInput());

    fireEvent.mouseDown(screen.getByText('Boca Juniors'));
    expect(onSelect).toHaveBeenCalledWith(teams[1]);
  });

  it('closes the dropdown on Escape', () => {
    render(<Harness />);
    fireEvent.focus(getInput());
    expect(screen.getByRole('listbox')).toBeDefined();

    fireEvent.keyDown(getInput(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes the dropdown when clicking outside the combobox', () => {
    render(<Harness />);
    fireEvent.focus(getInput());
    expect(screen.getByRole('listbox')).toBeDefined();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'fuera' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps the dropdown open when clicking inside the combobox', () => {
    render(<Harness />);
    const input = getInput();
    fireEvent.focus(input);

    fireEvent.mouseDown(input);
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('exposes ARIA combobox attributes (expanded, controls, autocomplete)', () => {
    render(<Harness />);
    const input = getInput();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');

    fireEvent.focus(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBeTruthy();
  });

  it('marks options with listbox/option roles and the active option with aria-activedescendant', () => {
    render(<Harness />);
    const input = getInput();
    fireEvent.focus(input);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(teams.length);
    expect(screen.getByRole('listbox')).toBeDefined();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // The active option carries aria-selected and is referenced by the input
    const activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    expect(activeId).toMatch(/-1$/); // key of the first option (River Plate id)
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[1].getAttribute('aria-selected')).toBe('false');
  });

  it('renders the unmatched-text hint only for legacy values that match no option', () => {
    render(<Harness unmatchedText="Texto libre sin equipo registrado" />);
    const input = getInput();

    // No value yet → no hint
    expect(screen.queryByText(/Texto libre sin equipo registrado/)).toBeNull();

    // Legacy string not in the registry → hint shown
    fireEvent.change(input, { target: { value: 'Gimnasia' } });
    expect(screen.getByText('Texto libre sin equipo registrado')).toBeDefined();

    // Typing an exact registry name → the value is matched, hint hides
    fireEvent.change(input, { target: { value: 'Boca Juniors' } });
    expect(screen.queryByText(/Texto libre sin equipo registrado/)).toBeNull();
  });
});
