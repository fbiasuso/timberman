import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CarteleraPage from '../matches/CarteleraPage';

// --- Mocks ---

const mockMatchesData = {
  matchDate: { id: 10, dateNumber: 3, status: 'open', pozo: 0, betAmount: 1500 },
  matches: [
    { id: 1, matchDateId: 10, localTeam: 'River Plate', visitorTeam: 'Boca Juniors', localImg: null, visitorImg: null, scheduledAt: null, result: null, score: null },
    { id: 2, matchDateId: 10, localTeam: 'Racing', visitorTeam: 'Independiente', localImg: null, visitorImg: null, scheduledAt: null, result: null, score: null },
    { id: 3, matchDateId: 10, localTeam: 'San Lorenzo', visitorTeam: 'Huracán', localImg: null, visitorImg: null, scheduledAt: null, result: null, score: null },
  ],
};

vi.mock('../../hooks/use-matches', () => ({
  useCurrentMatches: vi.fn(),
}));

vi.mock('../../hooks/use-bets', () => ({
  usePlaceBet: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../../stores/bet-slip-store', () => ({
  useBetSlipStore: vi.fn((selector: any) => {
    const state = {
      predictions: {},
      setPrediction: vi.fn(),
      removePrediction: vi.fn(),
      reset: vi.fn(),
      getPredictions: () => ({}),
      count: () => 0,
    };
    return selector(state);
  }),
}));

vi.mock('../matches/Filters', () => ({
  default: ({ onChange }: { onChange: (search: string, filter: string) => void }) => (
    <div data-testid="mock-filters">
      <input
        data-testid="search-input"
        placeholder="Buscar equipo..."
        onChange={(e) => onChange(e.target.value, 'todos')}
      />
    </div>
  ),
}));

vi.mock('../matches/MatchCard', () => ({
  default: ({ match, isExpired }: { match: any; isExpired: boolean }) => (
    <div data-testid="match-card" data-matchid={match.id} data-expired={isExpired}>
      {match.localTeam} vs {match.visitorTeam}
    </div>
  ),
}));

vi.mock('../bets/TicketModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="ticket-modal">
      <button data-testid="modal-close" onClick={onClose}>Close</button>
    </div>
  ),
}));

import { useCurrentMatches } from '../../hooks/use-matches';

afterEach(() => cleanup());

describe('CarteleraPage', () => {
  it('shows loading state', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: null, isLoading: true, error: null } as any);

    render(<CarteleraPage />);
    expect(screen.getByText('Cargando cartelera...')).toBeDefined();
  });

  it('shows error state', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: null, isLoading: false, error: new Error('fail') } as any);

    render(<CarteleraPage />);
    expect(screen.getByText('Error al cargar la cartelera. Intenta de nuevo.')).toBeDefined();
  });

  it('shows empty state when no match date available', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({
      data: { matchDate: null, matches: [] },
      isLoading: false,
      error: null,
    } as any);

    render(<CarteleraPage />);
    expect(screen.getByText('No hay cartelera disponible')).toBeDefined();
  });

  it('renders matches when data is available', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);

    render(<CarteleraPage />);
    expect(screen.getByText('River Plate vs Boca Juniors')).toBeDefined();
    expect(screen.getByText('Racing vs Independiente')).toBeDefined();
    expect(screen.getByText('San Lorenzo vs Huracán')).toBeDefined();
  });

  it('shows the date number in the header', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);

    render(<CarteleraPage />);
    expect(screen.getByText(/Cartelera — Fecha 3/)).toBeDefined();
  });

  it('shows the pay button when date is open', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);

    render(<CarteleraPage />);
    expect(screen.getByText(/Pagar Jugada/)).toBeDefined();
  });

  it('shows filters when date is open', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);

    render(<CarteleraPage />);
    const filters = screen.getByTestId('mock-filters');
    expect(filters).toBeDefined();
  });

  it('shows closed status when date is not open', () => {
    const closedData = {
      ...mockMatchesData,
      matchDate: { ...mockMatchesData.matchDate, status: 'closed' },
    };
    vi.mocked(useCurrentMatches).mockReturnValue({ data: closedData, isLoading: false, error: null } as any);

    render(<CarteleraPage />);
    expect(screen.getByText(/Estado: closed/)).toBeDefined();
    // Pay button should NOT be shown when closed
    expect(screen.queryByText(/Pagar Jugada/)).toBeNull();
  });

  it('shows accumulated carryover pozo and clarifies open-date wagers are excluded', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({
      data: { ...mockMatchesData, carryover: 1500 },
      isLoading: false,
      error: null,
    } as any);

    render(<CarteleraPage />);
    expect(screen.getByText('Pozo acumulado de fechas anteriores')).toBeDefined();
    // carryover 1500 → $15.00 (the open date's wagers are NOT included)
    expect(screen.getByText('$15.00')).toBeDefined();
    expect(
      screen.getByText(/No incluye las jugadas de esta fecha/),
    ).toBeDefined();
  });

  it('shows zero accumulated pozo for a fresh tournament', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);

    render(<CarteleraPage />);
    expect(screen.getByText('Pozo acumulado de fechas anteriores')).toBeDefined();
    expect(screen.getByText('$0.00')).toBeDefined();
    expect(
      screen.getByText(/No incluye las jugadas de esta fecha/),
    ).toBeDefined();
  });
});
