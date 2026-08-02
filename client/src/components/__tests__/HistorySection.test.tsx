import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import HistorySection from '../matches/HistorySection';
import type { MatchDateDTO } from '../../types';

// --- Mocks ---

vi.mock('../../hooks/use-matches', () => ({
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

import { useMatchDates, useMatchHistory } from '../../hooks/use-matches';

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
});

// --- Fixtures ---

const closedDate: MatchDateDTO = {
  id: 1,
  tournamentId: 1,
  dateNumber: 1,
  status: 'closed',
  pozo: 5700,
  betAmount: 1500,
  commission: 10,
  carryover: 0,
  createdAt: '2026-07-20T00:00:00.000Z',
};

const resultsDate: MatchDateDTO = {
  id: 2,
  tournamentId: 1,
  dateNumber: 2,
  status: 'results',
  pozo: 1000,
  betAmount: 1500,
  commission: 10,
  carryover: 0,
  createdAt: '2026-07-27T00:00:00.000Z',
};

const openDate: MatchDateDTO = {
  id: 3,
  tournamentId: 1,
  dateNumber: 3,
  status: 'open',
  pozo: 0,
  betAmount: 1500,
  commission: 10,
  carryover: 0,
  createdAt: '2026-08-02T00:00:00.000Z',
};

const closedMatches = [
  { id: 21, matchDateId: 1, localTeam: 'Gimnasia', visitorTeam: 'Estudiantes', localImg: null, visitorImg: null, scheduledAt: null, result: null, score: null },
];

const resultsMatches = [
  { id: 31, matchDateId: 2, localTeam: 'River Plate', visitorTeam: 'Boca Juniors', localImg: null, visitorImg: null, scheduledAt: null, result: 'L', score: '2-1' },
];

function mockDates(dates: MatchDateDTO[]) {
  vi.mocked(useMatchDates).mockReturnValue({
    data: { dates },
    isLoading: false,
    error: null,
  } as any);
}

function mockHistory(matchDate: MatchDateDTO, matches: unknown[]) {
  vi.mocked(useMatchHistory).mockReturnValue({
    data: { matchDate, matches },
    isLoading: false,
    error: null,
  } as any);
}

// --- Tests ---

describe('HistorySection', () => {
  it('shows a loading state', () => {
    vi.mocked(useMatchDates).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    render(<HistorySection />);
    expect(screen.getByText('Cargando fechas anteriores...')).toBeDefined();
  });

  it('shows an error state', () => {
    vi.mocked(useMatchDates).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('fail'),
    } as any);

    render(<HistorySection />);
    expect(screen.getByText('Error al cargar las fechas anteriores.')).toBeDefined();
  });

  it('renders nothing when there are no previous dates', () => {
    render(<HistorySection />);
    expect(screen.queryByText('Fechas anteriores')).toBeNull();
  });

  it('renders rows with lock and $ icons, hiding the open date', () => {
    mockDates([closedDate, openDate, resultsDate]);

    render(<HistorySection />);
    expect(screen.getByText('Fechas anteriores')).toBeDefined();
    expect(screen.getByText('Fecha 1')).toBeDefined();
    expect(screen.getByText('Fecha 2')).toBeDefined();
    // Lock icon for the closed date, $ icon for the results date
    expect(screen.getByText('🔒')).toBeDefined();
    expect(screen.getByText('$')).toBeDefined();
    // The open (current) date is not a "fecha anterior"
    expect(screen.queryByText('Fecha 3')).toBeNull();
  });

  it('expanding a closed date fetches its history and shows teams only, no results', () => {
    mockDates([closedDate]);
    mockHistory(closedDate, closedMatches);

    render(<HistorySection />);
    fireEvent.click(screen.getByRole('button', { name: /Fecha 1/ }));

    expect(vi.mocked(useMatchHistory)).toHaveBeenCalledWith(closedDate.id);
    expect(screen.getByText(/Gimnasia/)).toBeDefined();
    expect(screen.getByText(/Estudiantes/)).toBeDefined();
    // Closed dates come back with result/score null (server sanitization) →
    // the row renders teams only, no result
    expect(screen.queryByText('L (2-1)')).toBeNull();
  });

  it('expanding a results date shows teams and the full result', () => {
    mockDates([resultsDate]);
    mockHistory(resultsDate, resultsMatches);

    render(<HistorySection />);
    fireEvent.click(screen.getByRole('button', { name: /Fecha 2/ }));

    expect(vi.mocked(useMatchHistory)).toHaveBeenCalledWith(resultsDate.id);
    expect(screen.getByText(/River Plate/)).toBeDefined();
    expect(screen.getByText(/Boca Juniors/)).toBeDefined();
    expect(screen.getByText('L (2-1)')).toBeDefined();
  });

  it('collapses an expanded row when clicked again', () => {
    mockDates([closedDate]);
    mockHistory(closedDate, closedMatches);

    render(<HistorySection />);
    fireEvent.click(screen.getByRole('button', { name: /Fecha 1/ }));
    expect(screen.getByText(/Gimnasia/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Fecha 1/ }));
    expect(screen.queryByText(/Gimnasia/)).toBeNull();
    // The per-date query is disabled again
    expect(vi.mocked(useMatchHistory)).toHaveBeenLastCalledWith(undefined);
  });

  it('shows a loading message while the expanded history is loading', () => {
    mockDates([closedDate]);
    vi.mocked(useMatchHistory).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    render(<HistorySection />);
    fireEvent.click(screen.getByRole('button', { name: /Fecha 1/ }));

    expect(screen.getByText('Cargando partidos...')).toBeDefined();
  });

  it('shows an error message when the history fetch fails', () => {
    mockDates([closedDate]);
    vi.mocked(useMatchHistory).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('fail'),
    } as any);

    render(<HistorySection />);
    fireEvent.click(screen.getByRole('button', { name: /Fecha 1/ }));

    expect(screen.getByText('Error al cargar los partidos.')).toBeDefined();
  });

  it('shows an empty message when the expanded date has no matches', () => {
    mockDates([closedDate]);
    mockHistory(closedDate, []);

    render(<HistorySection />);
    fireEvent.click(screen.getByRole('button', { name: /Fecha 1/ }));

    expect(screen.getByText('No hay partidos en esta fecha.')).toBeDefined();
  });
});
