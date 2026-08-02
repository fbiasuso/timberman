import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
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
  useMatchDates: vi.fn(() => ({
    data: { dates: [] },
    isLoading: false,
    error: null,
  })),
  useMatchHistory: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}));

vi.mock('../../hooks/use-bets', () => ({
  usePlaceBet: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useBets: vi.fn(() => ({
    data: { tickets: [] },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  })),
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

import { useCurrentMatches, useMatchDates, useMatchHistory } from '../../hooks/use-matches';
import { useBets } from '../../hooks/use-bets';

afterEach(() => {
  cleanup();
  vi.mocked(useMatchDates).mockReset();
  vi.mocked(useMatchDates).mockReturnValue({
    data: { dates: [] },
    isLoading: false,
    error: null,
  } as any);
  vi.mocked(useMatchHistory).mockReset();
  vi.mocked(useMatchHistory).mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
  } as any);
  vi.mocked(useBets).mockReset();
  vi.mocked(useBets).mockReturnValue({
    data: { tickets: [] },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  } as any);
});

// --- Fixtures for the Fechas anteriores section ---

const previousDates = [
  { id: 1, tournamentId: 1, dateNumber: 1, status: 'closed', pozo: 5700, betAmount: 1500, commission: 10, carryover: 0, createdAt: '2026-07-20T00:00:00.000Z' },
  { id: 2, tournamentId: 1, dateNumber: 2, status: 'results', pozo: 1000, betAmount: 1500, commission: 10, carryover: 0, createdAt: '2026-07-27T00:00:00.000Z' },
];

function mockPreviousDates(dates: unknown[]) {
  vi.mocked(useMatchDates).mockReturnValue({
    data: { dates },
    isLoading: false,
    error: null,
  } as any);
}

describe('CarteleraPage', () => {
  it('shows loading state', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: null, isLoading: true, error: null } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Cargando cartelera...')).toBeDefined();
  });

  it('shows error state', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: null, isLoading: false, error: new Error('fail') } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Error al cargar la cartelera. Intenta de nuevo.')).toBeDefined();
  });

  it('shows empty state when no match date available', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({
      data: { matchDate: null, matches: [] },
      isLoading: false,
      error: null,
    } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    expect(screen.getByText('No hay cartelera disponible')).toBeDefined();
  });

  it('renders matches when data is available', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    expect(screen.getByText('River Plate vs Boca Juniors')).toBeDefined();
    expect(screen.getByText('Racing vs Independiente')).toBeDefined();
    expect(screen.getByText('San Lorenzo vs Huracán')).toBeDefined();
  });

  it('shows the date number in the header', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Cartelera — Fecha 3/)).toBeDefined();
  });

  it('shows the pay button when date is open', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Pagar Jugada/)).toBeDefined();
  });

  it('shows filters when date is open', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    const filters = screen.getByTestId('mock-filters');
    expect(filters).toBeDefined();
  });

  it('shows closed status when date is not open', () => {
    const closedData = {
      ...mockMatchesData,
      matchDate: { ...mockMatchesData.matchDate, status: 'closed' },
    };
    vi.mocked(useCurrentMatches).mockReturnValue({ data: closedData, isLoading: false, error: null } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
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

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Pozo acumulado de fechas anteriores')).toBeDefined();
    // carryover 1500 → $15.00 (the open date's wagers are NOT included)
    expect(screen.getByText('$15.00')).toBeDefined();
    expect(
      screen.getByText(/No incluye las jugadas de esta fecha/),
    ).toBeDefined();
  });

  it('shows zero accumulated pozo for a fresh tournament', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Pozo acumulado de fechas anteriores')).toBeDefined();
    expect(screen.getByText('$0.00')).toBeDefined();
    expect(
      screen.getByText(/No incluye las jugadas de esta fecha/),
    ).toBeDefined();
  });

  it('renders Fechas anteriores below the active date content', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);
    mockPreviousDates(previousDates);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    // Active content first, then the history section
    expect(screen.getByText(/Cartelera — Fecha 3/)).toBeDefined();
    expect(screen.getByText('Fechas anteriores')).toBeDefined();
    expect(screen.getByText('Fecha 1')).toBeDefined();
    expect(screen.getByText('Fecha 2')).toBeDefined();
    // Lock icon on both closed and results dates, check icon on the results (paid) date
    expect(screen.getAllByText('🔒').length).toBe(2);
    expect(screen.getByText('✅')).toBeDefined();
  });

  it('renders Fechas anteriores below the no-cartelera message', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({
      data: { matchDate: null, matches: [] },
      isLoading: false,
      error: null,
    } as any);
    mockPreviousDates(previousDates);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    expect(screen.getByText('No hay cartelera disponible')).toBeDefined();
    expect(screen.getByText('Fechas anteriores')).toBeDefined();
    expect(screen.getByText('Fecha 1')).toBeDefined();
    expect(screen.getByText('Fecha 2')).toBeDefined();
  });

  it('expands a Fechas anteriores row and fetches its history', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);
    mockPreviousDates(previousDates);
    vi.mocked(useMatchHistory).mockReturnValue({
      data: {
        matchDate: previousDates[0],
        matches: [
          { id: 21, matchDateId: 1, localTeam: 'Gimnasia', visitorTeam: 'Estudiantes', localImg: null, visitorImg: null, scheduledAt: null, result: null, score: null },
        ],
      },
      isLoading: false,
      error: null,
    } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /Fecha 1/ }));

    expect(vi.mocked(useMatchHistory)).toHaveBeenCalledWith(1);
    expect(screen.getByText(/Gimnasia/)).toBeDefined();
    expect(screen.getByText(/Estudiantes/)).toBeDefined();
  });

  it('keeps the pay button when the user has no bet on the active date', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);
    vi.mocked(useBets).mockReturnValue({
      data: { tickets: [] },
      isLoading: false,
      error: null,
    } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Pagar Jugada/)).toBeDefined();
    expect(screen.queryByText(/ver ticket/)).toBeNull();
  });

  it('hides the pay button and shows the ticket link when the user already bet', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);
    vi.mocked(useBets).mockReturnValue({
      data: {
        tickets: [
          { id: 7, userId: 'u1', matchDateId: 10, betAmount: 1500, prizeWon: null, predictions: [], createdAt: '2026-08-02T00:00:00.000Z' },
        ],
      },
      isLoading: false,
      error: null,
    } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    // The date still renders, but no new bet can be picked
    expect(screen.getByText(/Cartelera — Fecha 3/)).toBeDefined();
    expect(screen.queryByText(/Pagar Jugada/)).toBeNull();
    expect(screen.getByText('ya hiciste tu jugada - ver ticket')).toBeDefined();
  });

  it('shows the checking state while the bets query is still loading', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);
    vi.mocked(useBets).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      error: null,
    } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    // Ticket status unknown → no betting/pay flow yet
    expect(screen.queryByText(/Pagar Jugada/)).toBeNull();
    expect(screen.getByText('Verificando tu jugada...')).toBeDefined();
  });

  it('keeps the checking state when the bets query has no data and no error (offline/paused)', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);
    vi.mocked(useBets).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    // Offline/paused fetch: status unknown, pay flow must not render
    expect(screen.queryByText(/Pagar Jugada/)).toBeNull();
    expect(screen.getByText('Verificando tu jugada...')).toBeDefined();
  });

  it('shows the verification error with a retry button that refetches', () => {
    const refetch = vi.fn();
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);
    vi.mocked(useBets).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('fail'),
      refetch,
    } as any);

    render(
      <MemoryRouter>
        <CarteleraPage />
      </MemoryRouter>
    );
    // Query failed → no betting/pay flow, show the error + retry
    expect(screen.queryByText(/Pagar Jugada/)).toBeNull();
    expect(screen.getByText('No se pudo verificar tu jugada')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(refetch).toHaveBeenCalled();
  });

  it('navigates to the tickets page with the active date when clicking the ticket link', () => {
    vi.mocked(useCurrentMatches).mockReturnValue({ data: mockMatchesData, isLoading: false, error: null } as any);
    vi.mocked(useBets).mockReturnValue({
      data: {
        tickets: [
          { id: 7, userId: 'u1', matchDateId: 10, betAmount: 1500, prizeWon: null, predictions: [], createdAt: '2026-08-02T00:00:00.000Z' },
        ],
      },
      isLoading: false,
      error: null,
    } as any);

    function LocationProbe() {
      const location = useLocation();
      return <div data-testid="location">{location.pathname + location.search}</div>;
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<CarteleraPage />} />
          <Route path="/tickets" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /ver ticket/ }));

    expect(screen.getByTestId('location').textContent).toBe('/tickets?matchDateId=10');
  });
});
