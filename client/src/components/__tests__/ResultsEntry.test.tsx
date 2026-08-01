import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ResultsEntry from '../admin/ResultsEntry';
import type { TournamentDateDTO } from '../../api/admin-api';

// --- Mocks ---

vi.mock('../../hooks/use-matches', () => ({
  useCurrentMatches: vi.fn(),
}));

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
  usePublishResults: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
  }),
}));

import { useCurrentMatches } from '../../hooks/use-matches';
import { useAdminTournaments } from '../../hooks/use-admin';

afterEach(() => cleanup());

const openDate: TournamentDateDTO = {
  id: 1,
  dateNumber: 3,
  status: 'open',
  pozo: 0,
  commission: 15,
  winners: [],
};

const closedDate: TournamentDateDTO = {
  id: 2,
  dateNumber: 4,
  status: 'closed',
  pozo: 5700,
  commission: 10,
  winners: [],
};

const resultsDate: TournamentDateDTO = {
  id: 3,
  dateNumber: 5,
  status: 'results',
  pozo: 1000,
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

describe('ResultsEntry', () => {
  it('shows match cards and close button when the date is open', () => {
    mockTournaments([openDate]);
    vi.mocked(useCurrentMatches).mockReturnValue({
      data: { matchDate: openDate, matches: openMatches, carryover: 0 },
      isLoading: false,
      error: null,
    } as any);

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
    vi.mocked(useCurrentMatches).mockReturnValue({
      data: { matchDate: null, matches: [], carryover: 0 },
      isLoading: false,
      error: null,
    } as any);

    render(<ResultsEntry />);
    expect(screen.getByText(/Publicar resultados y pagar/)).toBeDefined();
    expect(screen.getByText('Pozo')).toBeDefined();
    expect(screen.getByText('$57.00')).toBeDefined();
    expect(screen.getByText('Comisión de la casa')).toBeDefined();
    expect(screen.getByText('10%')).toBeDefined();
    // Close button must NOT be shown while closed
    expect(screen.queryByText(/Procesar y Cerrar Puntos de la Fecha/)).toBeNull();
  });

  it('shows winners breakdown and commission when results are published', () => {
    mockTournaments([resultsDate]);
    vi.mocked(useCurrentMatches).mockReturnValue({
      data: { matchDate: null, matches: [], carryover: 0 },
      isLoading: false,
      error: null,
    } as any);

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
    vi.mocked(useCurrentMatches).mockReturnValue({
      data: { matchDate: null, matches: [], carryover: 0 },
      isLoading: false,
      error: null,
    } as any);

    render(<ResultsEntry />);
    expect(screen.getByText(/Sin ganadores/)).toBeDefined();
    expect(screen.getByText(/se acumuló para la próxima fecha/)).toBeDefined();
  });
});
