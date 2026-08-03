import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ResultsEntry from '../admin/ResultsEntry';
import type { TournamentDateDTO } from '../../api/admin-api';

// --- Mocks ---

vi.mock('../../hooks/use-matches', () => ({
  useCurrentMatches: vi.fn(),
  // Default: no matches loaded for a specific date until a test sets them
  useMatchesByDate: vi.fn(() => ({
    data: { matchDate: null, matches: [] },
    isLoading: false,
    error: null,
  })),
}));

const { publishMutate } = vi.hoisted(() => ({ publishMutate: vi.fn() }));

vi.mock('../../hooks/use-admin', () => ({
  useAdminTournaments: vi.fn(),
  useSetMatchResult: () => ({
    mutate: vi.fn(),
    isSuccess: false,
    isError: false,
    variables: null,
  }),
  useCloseDate: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
  }),
  usePublishResults: vi.fn(() => ({
    mutate: publishMutate,
    isPending: false,
    isSuccess: false,
    error: null,
  })),
}));

import { useCurrentMatches, useMatchesByDate } from '../../hooks/use-matches';
import { useAdminTournaments, usePublishResults } from '../../hooks/use-admin';

afterEach(() => {
  cleanup();
  publishMutate.mockClear();
  vi.mocked(useMatchesByDate).mockClear();
});

const openDate: TournamentDateDTO = {
  id: 1,
  dateNumber: 3,
  status: 'open',
  pozo: 0,
  betAmount: 1500,
  commission: 15,
  winners: [],
};

const closedDate: TournamentDateDTO = {
  id: 2,
  dateNumber: 4,
  status: 'closed',
  pozo: 5700,
  betAmount: 1500,
  commission: 10,
  winners: [],
};

const resultsDate: TournamentDateDTO = {
  id: 3,
  dateNumber: 5,
  status: 'results',
  pozo: 1000,
  betAmount: 1500,
  commission: 15,
  winners: [
    { ticketId: 7, userId: 'u1', username: 'ana', prize: 334 },
    { ticketId: 8, userId: 'u2', username: 'leo', prize: 333 },
  ],
};

const openMatches = [
  { id: 11, matchDateId: 1, localTeam: 'River Plate', visitorTeam: 'Boca Juniors', result: null, score: null },
  { id: 12, matchDateId: 1, localTeam: 'Racing', visitorTeam: 'Independiente', result: null, score: null },
];

function mockTournaments(dates: TournamentDateDTO[]) {
  vi.mocked(useAdminTournaments).mockReturnValue({
    data: [
      {
        id: 1,
        name: 'Torneo 1',
        commission: 15,
        isActive: true,
        carryover: 0,
        createdAt: '2026-07-28T00:00:00.000Z',
        dates,
      },
    ],
    isLoading: false,
    error: null,
  } as any);
}

function mockCurrent(matchDate: TournamentDateDTO | null, matches: unknown[] = []) {
  vi.mocked(useCurrentMatches).mockReturnValue({
    data: { matchDate, matches, carryover: 0 },
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

describe('ResultsEntry', () => {
  it('shows match cards and close button when the date is open', () => {
    mockTournaments([openDate]);
    mockCurrent(openDate, openMatches);

    render(<ResultsEntry />);
    expect(screen.getByText('Resultados — Fecha 3')).toBeDefined();
    expect(screen.getByText(/Procesar y Cerrar Puntos de la Fecha/)).toBeDefined();
    // Team names render across nested nodes ("River Plate" <span>vs</span> "Boca Juniors")
    expect(screen.getByText(/River Plate/)).toBeDefined();
    expect(screen.getByText(/Boca Juniors/)).toBeDefined();
    expect(screen.getByText(/Racing/)).toBeDefined();
    expect(screen.getByText(/Independiente/)).toBeDefined();
    // Publish button must NOT be shown while open
    expect(screen.queryByText(/Publicar resultados y pagar/)).toBeNull();
  });

  it('shows publish button and financials when the date is closed', () => {
    mockTournaments([closedDate]);
    mockCurrent(null);

    render(<ResultsEntry />);
    expect(screen.getByText(/Publicar resultados y pagar/)).toBeDefined();
    expect(screen.getByText('Pozo')).toBeDefined();
    expect(screen.getByText('$57.00')).toBeDefined();
    expect(screen.getByText('Comisión de la casa')).toBeDefined();
    expect(screen.getByText('10%')).toBeDefined();
    // Close button must NOT be shown while closed
    expect(screen.queryByText(/Procesar y Cerrar Puntos de la Fecha/)).toBeNull();
  });

  it('loads a closed date\'s matches so results can be corrected before publishing', () => {
    mockTournaments([closedDate]);
    mockCurrent(null);
    const closedMatches = [
      { id: 21, matchDateId: 2, localTeam: 'River Plate', visitorTeam: 'Boca Juniors', result: 'L', score: '2-1' },
      { id: 22, matchDateId: 2, localTeam: 'Racing', visitorTeam: 'Independiente', result: null, score: null },
    ];
    mockMatchesByDate(closedMatches);

    render(<ResultsEntry />);
    // The closed date's matches come from the per-date endpoint, not /current
    expect(useMatchesByDate).toHaveBeenCalledWith(closedDate.id);
    expect(screen.getByText(/River Plate/)).toBeDefined();
    expect(screen.getByText(/Racing/)).toBeDefined();
    // The admin can still review and publish after correcting results
    expect(screen.getByText(/Publicar resultados y pagar/)).toBeDefined();
  });

  it('shows winners breakdown and commission when results are published', () => {
    mockTournaments([resultsDate]);
    mockCurrent(null);

    render(<ResultsEntry />);
    expect(screen.getByText('Ganadores')).toBeDefined();
    expect(screen.getByText(/Ticket #7 — ana/)).toBeDefined();
    expect(screen.getByText('$3.34')).toBeDefined();
    expect(screen.getByText(/Ticket #8 — leo/)).toBeDefined();
    expect(screen.getByText('$3.33')).toBeDefined();
    expect(screen.getByText('15%')).toBeDefined();
    expect(screen.queryByText(/Publicar resultados y pagar/)).toBeNull();
  });

  it('shows a carryover note when a published date had no winners', () => {
    mockTournaments([{ ...resultsDate, winners: [] }]);
    mockCurrent(null);

    render(<ResultsEntry />);
    expect(screen.getByText(/Sin ganadores/)).toBeDefined();
    expect(screen.getByText(/se acumuló para la próxima fecha/)).toBeDefined();
  });

  it('asks for confirmation before publishing and aborts when declined', () => {
    mockTournaments([closedDate]);
    mockCurrent(null);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ResultsEntry />);
    fireEvent.click(screen.getByRole('button', { name: /Publicar resultados y pagar/ }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Confirmation shows the pozo snapshot
    expect(confirmSpy.mock.calls[0][0]).toContain('$57.00');
    // Declined → no mutation fired
    expect(publishMutate).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('publishes after the admin confirms', () => {
    mockTournaments([closedDate]);
    mockCurrent(null);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ResultsEntry />);
    fireEvent.click(screen.getByRole('button', { name: /Publicar resultados y pagar/ }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(publishMutate).toHaveBeenCalledWith(2); // closedDate.id

    confirmSpy.mockRestore();
  });

  it('disables the publish button once results are published', () => {
    mockTournaments([closedDate]);
    mockCurrent(null);
    vi.mocked(usePublishResults).mockReturnValue({
      mutate: publishMutate,
      isPending: false,
      isSuccess: true,
      error: null,
      variables: 2, // closedDate.id — the keyed guard only disables for the published date
    } as any);

    render(<ResultsEntry />);
    const button = screen.getByRole('button', { name: /Publicar resultados y pagar/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('does not list open dates from other tournaments in the selector', () => {
    const otherOpenDate: TournamentDateDTO = {
      id: 5,
      dateNumber: 1,
      status: 'open',
      pozo: 0,
      betAmount: 1500,
      commission: 15,
      winners: [],
    };
    vi.mocked(useAdminTournaments).mockReturnValue({
      data: [
        {
          id: 1,
          name: 'Torneo 1',
          commission: 15,
          isActive: true,
          carryover: 0,
          createdAt: '2026-07-28T00:00:00.000Z',
          dates: [openDate],
        },
        {
          id: 2,
          name: 'Torneo 2',
          commission: 15,
          isActive: true,
          carryover: 0,
          createdAt: '2026-07-28T00:00:00.000Z',
          dates: [otherOpenDate],
        },
      ],
      isLoading: false,
      error: null,
    } as any);
    mockCurrent(openDate, openMatches);

    render(<ResultsEntry />);
    // First combobox is the date selector (result selects come after it)
    const select = screen.getAllByRole('combobox')[0];
    // The current open date is listed; the other tournament's open date is NOT
    // (its matches cannot be shown and saving would patch the wrong date).
    expect(select.textContent).toContain('Fecha 3');
    expect(select.textContent).not.toContain('Fecha 1');
    // Matches rendered belong to the current open date
    expect(screen.getByText(/River Plate/)).toBeDefined();
  });

  it('keeps a manual date selection when the current date changes', () => {
    mockTournaments([openDate, closedDate]);
    mockCurrent(openDate, openMatches);

    const { rerender } = render(<ResultsEntry />);
    // First combobox is the date selector (result selects come after it)
    const dateSelect = screen.getAllByRole('combobox')[0];
    // Admin picks the closed date manually
    fireEvent.change(dateSelect, { target: { value: String(closedDate.id) } });
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe(String(closedDate.id));

    // /matches/current resolves again with a different open date
    mockCurrent({ ...openDate, id: 99 });
    rerender(<ResultsEntry />);

    // Manual selection survives — it is NOT reset to the new open date
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe(String(closedDate.id));
  });
});
