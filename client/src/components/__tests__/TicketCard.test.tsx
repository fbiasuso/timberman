import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TicketCard from '../bets/TicketCard';

// Mock the matches hook for team name lookup
vi.mock('../../hooks/use-matches', () => ({
  useCurrentMatches: () => ({
    data: {
      matchDate: { id: 10, dateNumber: 1, status: 'results', pozo: 5000, betAmount: 1500 },
      matches: [
        { id: 1, localTeam: 'River Plate', visitorTeam: 'Boca Juniors', result: 'L' },
        { id: 2, localTeam: 'Racing', visitorTeam: 'Independiente', result: null },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

afterEach(() => cleanup());

const baseTicket = {
  id: 42,
  userId: 'user-1',
  matchDateId: 10,
  betAmount: 1500,
  createdAt: '2026-07-28T12:00:00.000Z',
  predictions: [
    { matchId: 1, prediction: 'L' as const },
    { matchId: 2, prediction: 'V' as const },
  ],
};

describe('TicketCard', () => {
  it('renders ticket ID and date', () => {
    render(<TicketCard ticket={baseTicket} onSelect={vi.fn()} />);
    expect(screen.getByText(/Ticket #42/)).toBeDefined();
  });

  it('renders predictions with team names when matches are available', () => {
    render(<TicketCard ticket={baseTicket} onSelect={vi.fn()} />);
    expect(screen.getByText(/River Plate vs Boca Juniors/)).toBeDefined();
    expect(screen.getByText(/Racing vs Independiente/)).toBeDefined();
  });

  it('shows prediction letters', () => {
    render(<TicketCard ticket={baseTicket} onSelect={vi.fn()} />);
    // Both prediction letters should be visible
    const lElements = screen.getAllByText('L');
    expect(lElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('V')).toBeDefined();
  });

  it('shows status badge', () => {
    render(<TicketCard ticket={baseTicket} onSelect={vi.fn()} />);
    expect(screen.getByText('Pendiente')).toBeDefined();
  });

  it('shows the bet amount', () => {
    render(<TicketCard ticket={baseTicket} onSelect={vi.fn()} />);
    expect(screen.getByText('$15.00')).toBeDefined();
  });

  it('calls onSelect when clicked', async () => {
    const onSelect = vi.fn();
    const { container } = render(<TicketCard ticket={baseTicket} onSelect={onSelect} />);
    const card = container.firstChild as HTMLElement;
    card.click();
    expect(onSelect).toHaveBeenCalledWith(baseTicket);
  });
});
