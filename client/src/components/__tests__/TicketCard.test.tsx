import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TicketCard from '../bets/TicketCard';

// Mock the match-dates hook for the ticket's date status lookup
vi.mock('../../hooks/use-matches', () => ({
  useMatchDates: () => ({
    data: {
      dates: [
        { id: 10, dateNumber: 1, status: 'results' },
        { id: 20, dateNumber: 2, status: 'open' },
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
  matchDateId: 20, // date 20 → status 'open' in the mock (not published yet)
  betAmount: 1500,
  prizeWon: null,
  createdAt: '2026-07-28T12:00:00.000Z',
  predictions: [
    {
      matchId: 1,
      prediction: 'L' as const,
      match: { localTeam: 'River Plate', visitorTeam: 'Boca Juniors', result: null },
    },
    {
      matchId: 2,
      prediction: 'V' as const,
      match: { localTeam: 'Racing', visitorTeam: 'Independiente', result: null },
    },
  ],
};

describe('TicketCard', () => {
  it('renders ticket ID and date', () => {
    render(<TicketCard ticket={baseTicket} onSelect={vi.fn()} />);
    expect(screen.getByText(/Ticket #42/)).toBeDefined();
  });

  it('renders predictions with team names from the embedded match', () => {
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

  it('shows an "Estado:" field with the derived status', () => {
    render(<TicketCard ticket={baseTicket} onSelect={vi.fn()} />);
    expect(screen.getByText('Estado:')).toBeDefined();
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

  it('shows "Pagado" plus the prize badge when the ticket has a prize', () => {
    const winningTicket = { ...baseTicket, prizeWon: 334 };
    render(<TicketCard ticket={winningTicket} onSelect={vi.fn()} />);
    expect(screen.getByText('Pagado')).toBeDefined();
    expect(screen.getByText('Premio ganado: $3.34')).toBeDefined();
    // Pending badge is replaced by the paid status
    expect(screen.queryByText('Pendiente')).toBeNull();
  });

  it('does not show the prize badge on a pending ticket', () => {
    render(<TicketCard ticket={baseTicket} onSelect={vi.fn()} />);
    expect(screen.queryByText(/Premio ganado/)).toBeNull();
    expect(screen.getByText('Pendiente')).toBeDefined();
  });

  it('shows "Sin premio" on a loser ticket whose date has published results', () => {
    const loserTicket = { ...baseTicket, matchDateId: 10 }; // date 10 → status 'results'
    render(<TicketCard ticket={loserTicket} onSelect={vi.fn()} />);
    expect(screen.getByText('Sin premio')).toBeDefined();
    expect(screen.queryByText('Pendiente')).toBeNull();
    expect(screen.queryByText(/Premio ganado/)).toBeNull();
  });

  it('keeps "Pendiente" on a ticket whose date is not published yet', () => {
    const pendingTicket = { ...baseTicket, matchDateId: 20 }; // date 20 → status 'open'
    render(<TicketCard ticket={pendingTicket} onSelect={vi.fn()} />);
    expect(screen.getByText('Pendiente')).toBeDefined();
    expect(screen.queryByText('Sin premio')).toBeNull();
  });

  it('keeps the winner badge on a paid ticket of a published date', () => {
    const winningTicket = { ...baseTicket, matchDateId: 10, prizeWon: 334 };
    render(<TicketCard ticket={winningTicket} onSelect={vi.fn()} />);
    expect(screen.getByText('Premio ganado: $3.34')).toBeDefined();
    expect(screen.queryByText('Sin premio')).toBeNull();
    expect(screen.queryByText('Pendiente')).toBeNull();
  });
});
