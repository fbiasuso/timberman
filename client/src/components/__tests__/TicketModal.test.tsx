import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import TicketModal from '../bets/TicketModal';
import type { TicketDTO } from '../../types';

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

function makeTicket(overrides: Partial<TicketDTO> = {}): TicketDTO {
  return { ...baseTicket, ...overrides };
}

const baseTicket: TicketDTO = {
  id: 42,
  userId: 'user-1',
  matchDateId: 10, // date 10 → status 'results' in the mock
  betAmount: 1500,
  prizeWon: null,
  createdAt: '2026-07-28T12:00:00.000Z',
  predictions: [
    {
      matchId: 1,
      prediction: 'L' as const,
      match: { localTeam: 'River Plate', visitorTeam: 'Boca Juniors', result: 'L' },
    },
    {
      matchId: 2,
      prediction: 'V' as const,
      match: { localTeam: 'Racing', visitorTeam: 'Independiente', result: null },
    },
  ],
};

describe('TicketModal', () => {
  it('renders the ticket number and close button', () => {
    render(<TicketModal ticket={baseTicket} onClose={vi.fn()} />);
    expect(screen.getByText(/Ticket #42/)).toBeDefined();
    expect(screen.getByLabelText('Cerrar')).toBeDefined();
  });

  it('shows team names from the embedded match instead of "Partido #N"', () => {
    render(<TicketModal ticket={baseTicket} onClose={vi.fn()} />);
    expect(screen.getByText('River Plate vs Boca Juniors')).toBeDefined();
    expect(screen.getByText('Racing vs Independiente')).toBeDefined();
    expect(screen.queryByText(/Partido #/)).toBeNull();
  });

  it('shows Estado and Monto apostado rows', () => {
    render(<TicketModal ticket={baseTicket} onClose={vi.fn()} />);
    expect(screen.getByText('Estado:')).toBeDefined();
    expect(screen.getByText('Monto apostado')).toBeDefined();
    expect(screen.getByText('$15.00')).toBeDefined();
  });

  it('shows "Aciertos x/y" computed from embedded results on a results date', () => {
    render(<TicketModal ticket={baseTicket} onClose={vi.fn()} />);
    // 1 correct of 2 (match 1 'L' = 'L'; match 2 has no result yet)
    expect(screen.getByText('Aciertos')).toBeDefined();
    expect(screen.getByText('1/2')).toBeDefined();
    expect(screen.queryByText('Pendiente de resultados')).toBeNull();
  });

  it('shows "Pendiente de resultados" (no Aciertos) on a non-results date', () => {
    const pendingTicket = makeTicket({ matchDateId: 20 }); // date 20 → status 'open'
    render(<TicketModal ticket={pendingTicket} onClose={vi.fn()} />);
    expect(screen.getByText('Pendiente de resultados')).toBeDefined();
    expect(screen.queryByText('Aciertos')).toBeNull();
    // Monto apostado stays regardless
    expect(screen.getByText('Monto apostado')).toBeDefined();
  });

  it('derives the Estado field from prize and date status', () => {
    const paidTicket = makeTicket({ prizeWon: 334 });
    const { unmount } = render(<TicketModal ticket={paidTicket} onClose={vi.fn()} />);
    expect(screen.getByText('Pagado')).toBeDefined();
    expect(screen.getByText('Premio ganado')).toBeDefined();
    unmount();

    render(<TicketModal ticket={baseTicket} onClose={vi.fn()} />);
    expect(screen.getByText('Sin premio')).toBeDefined();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<TicketModal ticket={baseTicket} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalled();
  });
});
