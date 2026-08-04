import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import MatchEditor from '../admin/MatchEditor';
import type { AdminTournamentDTO, TournamentDateDTO } from '../../api/admin-api';

// --- Mocks ---

const { createDateMutate, createMatchMutate } = vi.hoisted(() => ({
  createDateMutate: vi.fn(),
  createMatchMutate: vi.fn(),
}));

vi.mock('../../hooks/use-admin', () => ({
  useAdminTournaments: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useCreateDate: () => ({
    mutate: createDateMutate,
    isPending: false,
    isError: false,
    error: null,
  }),
  useCreateMatch: () => ({
    mutate: createMatchMutate,
    isPending: false,
    isError: false,
    error: null,
  }),
  useUpdateMatchDetails: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('../../hooks/use-matches', () => ({
  useMatchesByDate: vi.fn(() => ({
    data: { matchDate: null, matches: [] },
    isLoading: false,
    error: null,
  })),
}));

import { useAdminTournaments } from '../../hooks/use-admin';
import { useMatchesByDate } from '../../hooks/use-matches';

afterEach(() => {
  cleanup();
  createDateMutate.mockClear();
  createMatchMutate.mockClear();
  vi.mocked(useMatchesByDate).mockReset();
  vi.mocked(useMatchesByDate).mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useMatchesByDate>);
});

// --- Fixtures ---

const tournament = (dates: TournamentDateDTO[]): AdminTournamentDTO => ({
  id: 1,
  name: 'Torneo 1',
  commission: 15,
  status: 'active',
  finishedAt: null,
  carryover: 0,
  createdAt: '2026-07-28T00:00:00.000Z',
  tournamentWinners: [],
  dates,
});

const closedDate: TournamentDateDTO = {
  id: 1,
  dateNumber: 1,
  status: 'closed',
  pozo: 5700,
  betAmount: 1500,
  commission: 10,
  winners: [],
};

const openDate: TournamentDateDTO = {
  id: 2,
  dateNumber: 2,
  status: 'open',
  pozo: 0,
  betAmount: 2000,
  commission: 10,
  winners: [],
};

const resultsDate: TournamentDateDTO = {
  id: 3,
  dateNumber: 3,
  status: 'results',
  pozo: 1000,
  betAmount: 1500,
  commission: 10,
  winners: [],
};

const openMatches = [
  { id: 11, matchDateId: 2, localTeam: 'River Plate', visitorTeam: 'Boca Juniors', localImg: null, visitorImg: null, scheduledAt: null, result: null, score: null },
  { id: 12, matchDateId: 2, localTeam: 'Racing', visitorTeam: 'Independiente', localImg: null, visitorImg: null, scheduledAt: null, result: null, score: null },
];

const closedMatches = [
  { id: 21, matchDateId: 1, localTeam: 'Gimnasia', visitorTeam: 'Estudiantes', localImg: null, visitorImg: null, scheduledAt: null, result: 'L', score: '2-1' },
];

function mockTournaments(t: AdminTournamentDTO | AdminTournamentDTO[] | null) {
  const list = t === null ? [] : Array.isArray(t) ? t : [t];
  vi.mocked(useAdminTournaments).mockReturnValue({
    data: list,
    isLoading: false,
    error: null,
  } as any);
}

function mockMatchesByDate(matches: unknown[]) {
  vi.mocked(useMatchesByDate).mockReturnValue({
    data: { matchDate: null, matches },
    isLoading: false,
    error: null,
  } as any);
}

// --- Tests ---

describe('MatchEditor', () => {
  it('shows a loading state', () => {
    vi.mocked(useAdminTournaments).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    render(<MatchEditor />);
    expect(screen.getByText('Cargando fechas...')).toBeDefined();
  });

  it('shows an error state', () => {
    vi.mocked(useAdminTournaments).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('fail'),
    } as any);

    render(<MatchEditor />);
    expect(screen.getByText('Error al cargar las fechas.')).toBeDefined();
  });

  it('shows an empty state when there are no tournaments', () => {
    mockTournaments(null);

    render(<MatchEditor />);
    expect(screen.getByText('No hay torneos para gestionar partidos.')).toBeDefined();
  });

  it('lists only the active tournament dates — finished tournament dates are frozen and hidden', () => {
    const finishedTournament: AdminTournamentDTO = {
      id: 2,
      name: 'Torneo 2',
      commission: 15,
      status: 'finished',
      finishedAt: '2026-08-01T00:00:00.000Z',
      carryover: 0,
      createdAt: '2026-07-28T00:00:00.000Z',
      tournamentWinners: [],
      dates: [closedDate],
    };
    mockTournaments([tournament([openDate, resultsDate]), finishedTournament]);

    render(<MatchEditor />);
    // The active tournament's dates render
    expect(screen.getByText(/Fecha 2/)).toBeDefined();
    expect(screen.getByText(/Fecha 3/)).toBeDefined();
    // The finished tournament's date (id 1, Fecha 1) must NOT render
    expect(screen.queryByText(/Fecha 1/)).toBeNull();
  });

  it('renders every date as an accordion row with its status icons and tooltips', () => {
    mockTournaments(tournament([closedDate, openDate, resultsDate]));
    mockMatchesByDate(openMatches);

    render(<MatchEditor />);
    expect(screen.getByText(/^Fecha 1 ·/)).toBeDefined();
    expect(screen.getByText(/^Fecha 2 ·/)).toBeDefined();
    expect(screen.getByText(/^Fecha 3 ·/)).toBeDefined();
    // Lock icon on both closed and results dates, check icon on the paid (results) date
    expect(screen.getAllByText('🔒').length).toBe(2);
    expect(screen.getByText('✅')).toBeDefined();
    // Tooltips: lock on closed + results rows, paid on the results row, chevron on every row
    expect(screen.getAllByTitle('Fecha cerrada').length).toBe(2);
    expect(screen.getByTitle('Fecha pagada')).toBeDefined();
    expect(screen.getAllByTitle('expandir').length).toBe(3);
  });

  it('orders dates with the active (open) date first, then descending', () => {
    mockTournaments(tournament([closedDate, openDate, resultsDate]));
    mockMatchesByDate(openMatches);

    render(<MatchEditor />);
    const order = screen
      .getAllByRole('button')
      .map((b) => b.textContent?.match(/^Fecha (\d+)/)?.[1])
      .filter((n): n is string => !!n);
    // Open date (2) on top, then 3 and 1 descending by dateNumber
    expect(order).toEqual(['2', '3', '1']);
  });

  it('default-expands the open date and shows its matches', () => {
    mockTournaments(tournament([closedDate, openDate, resultsDate]));
    mockMatchesByDate(openMatches);

    render(<MatchEditor />);
    expect(vi.mocked(useMatchesByDate)).toHaveBeenCalledWith(openDate.id);
    // Open-date rows are editable: teams render as input values
    expect(screen.getByDisplayValue('River Plate')).toBeDefined();
    expect(screen.getByDisplayValue('Boca Juniors')).toBeDefined();
    expect(screen.getByDisplayValue('Racing')).toBeDefined();
    expect(screen.getByDisplayValue('Independiente')).toBeDefined();
  });

  it('collapses the open date when its header is clicked again', () => {
    mockTournaments(tournament([closedDate, openDate, resultsDate]));
    mockMatchesByDate(openMatches);

    render(<MatchEditor />);
    // Default-expanded open date
    expect(screen.getByDisplayValue('River Plate')).toBeDefined();

    // Clicking the open-date header collapses it (user interaction wins over default)
    fireEvent.click(screen.getByRole('button', { name: /Fecha 2/ }));

    expect(screen.queryByDisplayValue('River Plate')).toBeNull();
    expect(vi.mocked(useMatchesByDate)).toHaveBeenLastCalledWith(undefined);
  });

  it('does not expand anything when the tournament has no open date', () => {
    mockTournaments(tournament([closedDate, resultsDate]));

    render(<MatchEditor />);
    // No open date → no default expansion → the per-date query stays disabled
    expect(vi.mocked(useMatchesByDate)).toHaveBeenCalledWith(undefined);
    expect(screen.queryByDisplayValue('River Plate')).toBeNull();
    expect(screen.queryByText('Agregar partido')).toBeNull();
  });

  it('creates a date via useCreateDate when Nueva fecha is clicked', () => {
    mockTournaments(tournament([closedDate, resultsDate]));

    render(<MatchEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Nueva fecha/ }));

    expect(createDateMutate).toHaveBeenCalledWith({ tournamentId: 1 });
  });

  it('shows a newly created date in the accordion after the refetch', () => {
    mockTournaments(tournament([closedDate, resultsDate]));

    const view = render(<MatchEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Nueva fecha/ }));

    // The create succeeds server-side; invalidated queries refetch with the new date
    mockTournaments(
      tournament([
        closedDate,
        resultsDate,
        { id: 4, dateNumber: 4, status: 'open', pozo: 0, betAmount: 1500, commission: 10, winners: [] },
      ]),
    );
    view.rerender(<MatchEditor />);

    expect(screen.getByText(/^Fecha 4 ·/)).toBeDefined();
  });

  it('expanding a closed date loads its matches read-only with results', () => {
    mockTournaments(tournament([closedDate, openDate, resultsDate]));
    mockMatchesByDate(openMatches);

    render(<MatchEditor />);
    // Switch from the default open date to the closed date
    mockMatchesByDate(closedMatches);
    fireEvent.click(screen.getByRole('button', { name: /Fecha 1/ }));

    expect(vi.mocked(useMatchesByDate)).toHaveBeenCalledWith(closedDate.id);
    expect(screen.getByText(/Gimnasia/)).toBeDefined();
    expect(screen.getByText(/Estudiantes/)).toBeDefined();
    // Result and score render read-only
    expect(screen.getByText('L (2-1)')).toBeDefined();
    // No add-match form on a closed date
    expect(screen.queryByText('Agregar partido')).toBeNull();
  });

  it('shows the add-match form only on the open date', () => {
    mockTournaments(tournament([closedDate, openDate, resultsDate]));
    mockMatchesByDate(openMatches);

    render(<MatchEditor />);
    expect(screen.getByText('Agregar partido')).toBeDefined();

    // Expanding the results date hides the form
    fireEvent.click(screen.getByRole('button', { name: /Fecha 3/ }));
    expect(screen.queryByText('Agregar partido')).toBeNull();
  });

  it('submits the add-match form via useCreateMatch with the open date id', () => {
    mockTournaments(tournament([closedDate, openDate, resultsDate]));
    mockMatchesByDate(openMatches);

    render(<MatchEditor />);
    // Scope to the add-match form — the editable MatchRow inputs share label names
    const form = screen.getByText('Agregar partido').closest('form') as HTMLElement;
    fireEvent.change(within(form).getByLabelText('Equipo Local'), {
      target: { value: 'San Lorenzo' },
    });
    fireEvent.change(within(form).getByLabelText('Equipo Visitante'), {
      target: { value: 'Huracán' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear partido/ }));

    expect(createMatchMutate).toHaveBeenCalledWith(
      {
        matchDateId: openDate.id,
        localTeam: 'San Lorenzo',
        visitorTeam: 'Huracán',
        localImg: null,
        visitorImg: null,
        scheduledAt: null,
      },
      expect.anything(),
    );
  });

  it('shows a newly created match in the expanded date after the refetch', () => {
    mockTournaments(tournament([closedDate, openDate, resultsDate]));
    mockMatchesByDate(openMatches);

    const view = render(<MatchEditor />);
    const form = screen.getByText('Agregar partido').closest('form') as HTMLElement;
    fireEvent.change(within(form).getByLabelText('Equipo Local'), {
      target: { value: 'San Lorenzo' },
    });
    fireEvent.change(within(form).getByLabelText('Equipo Visitante'), {
      target: { value: 'Huracán' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear partido/ }));

    // The create succeeds server-side; the invalidated per-date query refetches
    mockMatchesByDate([
      ...openMatches,
      { id: 13, matchDateId: 2, localTeam: 'San Lorenzo', visitorTeam: 'Huracán', localImg: null, visitorImg: null, scheduledAt: null, result: null, score: null },
    ]);
    view.rerender(<MatchEditor />);

    // The new match renders as an editable row → team names are input values
    // (scoped to the new row: the add-match form keeps its typed values)
    const newRowLocal = screen.getByLabelText('Equipo Local', {
      selector: '#row-local-13',
    }) as HTMLInputElement;
    const newRowVisitor = screen.getByLabelText('Equipo Visitante', {
      selector: '#row-visitor-13',
    }) as HTMLInputElement;
    expect(newRowLocal.value).toBe('San Lorenzo');
    expect(newRowVisitor.value).toBe('Huracán');
  });

  it('shows a loading message while the expanded date matches are loading', () => {
    mockTournaments(tournament([closedDate, openDate, resultsDate]));
    vi.mocked(useMatchesByDate).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    render(<MatchEditor />);
    expect(screen.getByText('Cargando partidos...')).toBeDefined();
  });

  it('shows the per-date bet amount next to the date number (cents → pesos)', () => {
    mockTournaments(tournament([closedDate, openDate, resultsDate]));
    mockMatchesByDate([]);

    render(<MatchEditor />);
    // 2000 cents → $20,00 ; 1500 cents → $15,00 (Argentine comma decimal)
    expect(screen.getByText('Fecha 2 · $20,00')).toBeDefined();
    expect(screen.getByText('Fecha 3 · $15,00')).toBeDefined();
    expect(screen.getByText('Fecha 1 · $15,00')).toBeDefined();
  });
});
