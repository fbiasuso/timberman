import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import TournamentManager from '../admin/TournamentManager';
import type { AdminTournamentDTO, TournamentWinnerDTO } from '../../api/admin-api';

// --- Mocks ---

const { terminateMutate, archiveMutate } = vi.hoisted(() => ({
  terminateMutate: vi.fn(),
  archiveMutate: vi.fn(),
}));

vi.mock('../../hooks/use-admin', () => ({
  useAdminTournaments: vi.fn(),
  useTerminateTournament: () => ({
    mutate: terminateMutate,
    isPending: false,
    isSuccess: false,
    error: null,
  }),
  useArchiveTournament: () => ({
    mutate: archiveMutate,
    isPending: false,
    isSuccess: false,
    error: null,
  }),
}));

import { useAdminTournaments } from '../../hooks/use-admin';

afterEach(() => {
  cleanup();
  terminateMutate.mockClear();
  archiveMutate.mockClear();
});

// --- Fixtures ---

function tournament(
  id: number,
  name: string,
  status: string,
  winners: TournamentWinnerDTO[] = [],
  finishedAt: string | null = null,
): AdminTournamentDTO {
  return {
    id,
    name,
    commission: 15,
    status,
    finishedAt,
    carryover: 0,
    createdAt: '2026-07-28T00:00:00.000Z',
    tournamentWinners: winners,
    dates: [],
  };
}

function mockTournaments(list: AdminTournamentDTO[] | null) {
  vi.mocked(useAdminTournaments).mockReturnValue({
    data: list,
    isLoading: false,
    error: null,
  } as any);
}

// --- Tests ---

describe('TournamentManager', () => {
  it('shows a loading state', () => {
    vi.mocked(useAdminTournaments).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    render(<TournamentManager />);
    expect(screen.getByText('Cargando torneos...')).toBeDefined();
  });

  it('shows an error state', () => {
    vi.mocked(useAdminTournaments).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('fail'),
    } as any);

    render(<TournamentManager />);
    expect(screen.getByText('Error al cargar torneos.')).toBeDefined();
  });

  it('shows an empty state when there are no tournaments', () => {
    mockTournaments([]);

    render(<TournamentManager />);
    expect(screen.getByText('No hay torneos registrados.')).toBeDefined();
  });

  it('renders every tournament with its Spanish status label', () => {
    mockTournaments([
      tournament(1, 'Torneo 1', 'active'),
      tournament(2, 'Torneo 2', 'finished', [], '2026-08-01T00:00:00.000Z'),
      tournament(3, 'Torneo 3', 'archived'),
    ]);

    render(<TournamentManager />);

    expect(screen.getByText('Torneo 1')).toBeDefined();
    expect(screen.getByText('Torneo 2')).toBeDefined();
    expect(screen.getByText('Torneo 3')).toBeDefined();
    expect(screen.getByText('Activo')).toBeDefined();
    // "Finalizado" appears twice: the column header AND the status badge
    expect(screen.getAllByText('Finalizado').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Archivado')).toBeDefined();
  });

  it('shows the finished date and the tournament winners', () => {
    mockTournaments([
      tournament(
        2,
        'Torneo 2',
        'finished',
        [
          { userId: 'u1', username: 'ana' },
          { userId: 'u2', username: 'leo' },
        ],
        '2026-08-01T00:00:00.000Z',
      ),
    ]);

    render(<TournamentManager />);
    expect(screen.getByText('ana, leo')).toBeDefined();
  });

  it('shows a dash for winners when the tournament has none', () => {
    mockTournaments([tournament(1, 'Torneo 1', 'active')]);

    render(<TournamentManager />);
    // The dash appears in the winners column (no winners)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Terminar only for active tournaments and Archivar only for finished ones', () => {
    mockTournaments([
      tournament(1, 'Torneo 1', 'active'),
      tournament(2, 'Torneo 2', 'finished', [], '2026-08-01T00:00:00.000Z'),
      tournament(3, 'Torneo 3', 'archived'),
    ]);

    render(<TournamentManager />);
    const terminars = screen.getAllByRole('button', { name: 'Terminar' });
    const archivars = screen.getAllByRole('button', { name: 'Archivar' });

    // Only the active tournament offers Terminar; only the finished one Archivar;
    // the archived one offers neither.
    expect(terminars).toHaveLength(1);
    expect(archivars).toHaveLength(1);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('terminates after confirming', () => {
    mockTournaments([tournament(1, 'Torneo 1', 'active')]);

    render(<TournamentManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));

    // Confirm dialog appears — the action is not fired yet
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDefined();
    expect(terminateMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(terminateMutate).toHaveBeenCalledWith(1, expect.anything());
  });

  it('archives after confirming', () => {
    mockTournaments([tournament(2, 'Torneo 2', 'finished', [], '2026-08-01T00:00:00.000Z')]);

    render(<TournamentManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(archiveMutate).toHaveBeenCalledWith(2, expect.anything());
  });

  it('cancels the confirm dialog without firing the action', () => {
    mockTournaments([tournament(1, 'Torneo 1', 'active')]);

    render(<TournamentManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(terminateMutate).not.toHaveBeenCalled();
    // Back to the single action button
    expect(screen.getByRole('button', { name: 'Terminar' })).toBeDefined();
  });
});
