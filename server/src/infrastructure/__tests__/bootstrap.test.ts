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
    createInitialTournament: vi.fn(),
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
  it('asks the repo to create "Torneo 1" with active status, carryover 0, finishedAt null and the config commission', async () => {
    const repo = createTournamentRepoMocks();
    vi.mocked(repo.createInitialTournament).mockResolvedValue(
      Tournament.new({ id: 1, name: 'Torneo 1', commission: 15 }),
    );

    await ensureInitialTournament(repo, 15);

    expect(repo.createInitialTournament).toHaveBeenCalledTimes(1);
    const requested = vi.mocked(repo.createInitialTournament).mock.calls[0][0].toSnapshot();
    expect(requested.name).toBe('Torneo 1');
    expect(requested.status).toBe('active');
    expect(requested.carryover).toBe(0);
    expect(requested.finishedAt).toBeNull();
    expect(requested.commission).toBe(15);
  });

  it('uses the system-config commission for the initial tournament', async () => {
    const repo = createTournamentRepoMocks();
    vi.mocked(repo.createInitialTournament).mockResolvedValue(null);

    await ensureInitialTournament(repo, 20);

    const requested = vi.mocked(repo.createInitialTournament).mock.calls[0][0].toSnapshot();
    expect(requested.commission).toBe(20);
  });

  it('propagates null when a tournament already exists (no-op)', async () => {
    const repo = createTournamentRepoMocks();
    vi.mocked(repo.createInitialTournament).mockResolvedValue(null);

    const result = await ensureInitialTournament(repo, 15);

    expect(repo.createInitialTournament).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it('propagates the created tournament back to the caller', async () => {
    const repo = createTournamentRepoMocks();
    const created = Tournament.new({ id: 7, name: 'Torneo 1', commission: 15 });
    vi.mocked(repo.createInitialTournament).mockResolvedValue(created);

    const result = await ensureInitialTournament(repo, 15);

    expect(result).toBe(created);
  });
});
