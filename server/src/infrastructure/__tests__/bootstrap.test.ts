import { describe, it, expect, vi } from 'vitest';
import { ensureInitialTournament } from '../bootstrap.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import { Tournament } from '../../domain/entities/tournament.js';

// ── Helpers ────────────────────────────────────────────────────────

function createTournamentRepoMocks() {
  const repo: TournamentRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    findActive: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn((t: Tournament) => Promise.resolve(t)),
    update: vi.fn((t: Tournament) => Promise.resolve(t)),
    findMatchDateById: vi.fn(),
    findMatchDateByIdForUpdate: vi.fn(),
    findMatchDatesByTournamentId: vi.fn(),
    findOpenMatchDates: vi.fn(),
    saveMatchDate: vi.fn(),
    updateMatchDate: vi.fn(),
  };
  return repo;
}

// ── ensureInitialTournament (T20) ──────────────────────────────────

describe('ensureInitialTournament (boot)', () => {
  it('creates "Torneo 1" with active status and carryover 0 when no tournament exists', async () => {
    const repo = createTournamentRepoMocks();
    vi.mocked(repo.findAll).mockResolvedValue([]);

    await ensureInitialTournament(repo, 15);

    expect(repo.findAll).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(repo.save).mock.calls[0][0].toSnapshot();
    expect(saved.name).toBe('Torneo 1');
    expect(saved.status).toBe('active');
    expect(saved.carryover).toBe(0);
    expect(saved.finishedAt).toBeNull();
  });

  it('uses the system-config commission for the initial tournament', async () => {
    const repo = createTournamentRepoMocks();
    vi.mocked(repo.findAll).mockResolvedValue([]);

    await ensureInitialTournament(repo, 20);

    const saved = vi.mocked(repo.save).mock.calls[0][0].toSnapshot();
    expect(saved.commission).toBe(20);
  });

  it('does not create a duplicate when a tournament already exists', async () => {
    const repo = createTournamentRepoMocks();
    vi.mocked(repo.findAll).mockResolvedValue([
      Tournament.new({ id: 1, name: 'Torneo 1' }),
    ]);

    await ensureInitialTournament(repo, 15);

    expect(repo.findAll).toHaveBeenCalledTimes(1);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
