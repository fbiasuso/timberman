import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import RankingPage from '../ranking/RankingPage';

// Mock the ranking hooks
const mockRankingData = [
  { userId: 'u1', username: 'Alice', totalPoints: 10, position: 1 },
  { userId: 'u2', username: 'Bob', totalPoints: 5, position: 2 },
  { userId: 'u3', username: 'Charlie', totalPoints: 3, position: 3 },
];

const mockTournaments = [
  { id: 1, name: 'Torneo 1', status: 'active', finishedAt: null, createdAt: '2026-01-01' },
  { id: 2, name: 'Torneo 2', status: 'finished', finishedAt: '2026-02-01', createdAt: '2026-02-01' },
];

vi.mock('../../hooks/use-ranking', () => ({
  useRanking: vi.fn(),
  useUserDetail: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}));

vi.mock('../../hooks/use-tournaments', () => ({
  useTournaments: vi.fn(() => ({
    data: mockTournaments,
    isLoading: false,
    error: null,
  })),
}));

import { useRanking, useUserDetail } from '../../hooks/use-ranking';
import { useTournaments } from '../../hooks/use-tournaments';

afterEach(() => {
  cleanup();
  vi.mocked(useRanking).mockClear();
  vi.mocked(useUserDetail).mockClear();
  vi.mocked(useTournaments).mockClear();
});

describe('RankingPage', () => {
  it('shows loading state', () => {
    vi.mocked(useRanking).mockReturnValue({ data: null, isLoading: true, error: null } as any);

    render(<RankingPage />);
    expect(screen.getByText('Cargando ranking...')).toBeDefined();
  });

  it('shows error state', () => {
    vi.mocked(useRanking).mockReturnValue({ data: null, isLoading: false, error: new Error('fail') } as any);

    render(<RankingPage />);
    expect(screen.getByText('Error al cargar el ranking. Intenta de nuevo.')).toBeDefined();
  });

  it('shows empty state when no ranking data', () => {
    vi.mocked(useRanking).mockReturnValue({ data: [], isLoading: false, error: null } as any);

    render(<RankingPage />);
    expect(screen.getByText('No hay datos de ranking todavía.')).toBeDefined();
  });

  it('renders ranking entries', () => {
    vi.mocked(useRanking).mockReturnValue({ data: mockRankingData, isLoading: false, error: null } as any);

    render(<RankingPage />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Charlie')).toBeDefined();
  });

  it('shows points for each entry', () => {
    vi.mocked(useRanking).mockReturnValue({ data: mockRankingData, isLoading: false, error: null } as any);

    render(<RankingPage />);
    // Check that points text appears (e.g., "10 pts")
    const pointsElements = screen.getAllByText(/pts/);
    expect(pointsElements.length).toBeGreaterThanOrEqual(3);
  });

  it('shows title and subtitle', () => {
    vi.mocked(useRanking).mockReturnValue({ data: mockRankingData, isLoading: false, error: null } as any);

    render(<RankingPage />);
    expect(screen.getByText('Ranking')).toBeDefined();
    expect(screen.getByText('Clasificación del torneo')).toBeDefined();
  });

  it('shows header columns', () => {
    vi.mocked(useRanking).mockReturnValue({ data: mockRankingData, isLoading: false, error: null } as any);

    render(<RankingPage />);
    expect(screen.getByText('Posición')).toBeDefined();
    expect(screen.getByText('Usuario')).toBeDefined();
    expect(screen.getByText('Puntos')).toBeDefined();
  });

  it('shows match prediction breakdown when a row is expanded', () => {
    vi.mocked(useRanking).mockReturnValue({ data: mockRankingData, isLoading: false, error: null } as any);
    vi.mocked(useUserDetail).mockReturnValue({
      data: [{ dateNumber: 1, points: 5, totalMatches: 3, correctPredictions: 2 }],
      isLoading: false,
      error: null,
    } as any);

    render(<RankingPage />);
    fireEvent.click(screen.getByText('Alice'));

    expect(screen.getByText('Fecha 1')).toBeDefined();
    expect(screen.getByText(/acertó 2 de 3 partidos/)).toBeDefined();
  });

  describe('tournament selector', () => {
    it('renders the tournament selector with the active tournament preselected', () => {
      vi.mocked(useRanking).mockReturnValue({ data: mockRankingData, isLoading: false, error: null } as any);

      render(<RankingPage />);

      const select = screen.getByLabelText('Torneo') as HTMLSelectElement;
      expect(select).toBeDefined();
      // Active tournament (id 1) is the default view
      expect(select.value).toBe('1');
      expect(select.options.length).toBe(2);
      expect(screen.getByText('Torneo 1')).toBeDefined();
      expect(screen.getByText('Torneo 2')).toBeDefined();
    });

    it('refetches ranking with the selected tournamentId', () => {
      vi.mocked(useRanking).mockReturnValue({ data: mockRankingData, isLoading: false, error: null } as any);

      render(<RankingPage />);
      fireEvent.change(screen.getByLabelText('Torneo'), { target: { value: '2' } });

      // useRanking is called again with the selected tournament id (2)
      expect(vi.mocked(useRanking)).toHaveBeenCalledWith(2);
    });

    it('shows the activo badge on the active tournament', () => {
      vi.mocked(useRanking).mockReturnValue({ data: mockRankingData, isLoading: false, error: null } as any);

      render(<RankingPage />);

      expect(screen.getByText('activo')).toBeDefined();
    });

    it('passes the selected tournamentId to the user detail hook', () => {
      vi.mocked(useRanking).mockReturnValue({ data: mockRankingData, isLoading: false, error: null } as any);

      render(<RankingPage />);
      fireEvent.change(screen.getByLabelText('Torneo'), { target: { value: '2' } });
      fireEvent.click(screen.getByText('Alice'));

      expect(vi.mocked(useUserDetail)).toHaveBeenCalledWith('u1', 2);
    });
  });
});
