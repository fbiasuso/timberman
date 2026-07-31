import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import RankingPage from '../ranking/RankingPage';

// Mock the ranking hooks
const mockRankingData = [
  { userId: 'u1', username: 'Alice', totalPoints: 10, position: 1 },
  { userId: 'u2', username: 'Bob', totalPoints: 5, position: 2 },
  { userId: 'u3', username: 'Charlie', totalPoints: 3, position: 3 },
];

vi.mock('../../hooks/use-ranking', () => ({
  useRanking: vi.fn(),
  useUserDetail: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}));

import { useRanking, useUserDetail } from '../../hooks/use-ranking';

afterEach(() => cleanup());

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
});
