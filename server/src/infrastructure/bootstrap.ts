import type { TournamentRepo } from '../domain/ports/tournament-repo.js';
import { Tournament } from '../domain/entities/tournament.js';

/**
 * Boot bootstrap: guarantee the database always has an active tournament.
 *
 * A fresh database has no tournament row; without one, every active flow
 * (ranking resolution, /matches/current, /matches/dates, bet-amount
 * propagation, Cartelera) resolves to nothing. This mirrors the lifecycle
 * model where archiving the last tournament auto-creates "Torneo N+1":
 * on an empty table we auto-create "Torneo 1" (status 'active', carryover
 * 0, commission from the live system config).
 *
 * Idempotent and race-safe by design: the repo's `createInitialTournament`
 * runs the whole check-then-act inside one transaction guarded by a
 * Postgres advisory lock, so concurrent cold-starts of multiple instances
 * never double-insert — the second instance waits, sees the existing row,
 * and no-ops (spec tournament-management: "Boot keeps existing
 * tournaments"). No-op when at least one tournament exists.
 *
 * @param repo        tournament repository (unit-testable — no DB here)
 * @param commission  commission percent from the boot-loaded system config
 * @returns the created tournament, or null when one already existed (no-op)
 */
export async function ensureInitialTournament(
  repo: TournamentRepo,
  commission: number,
): Promise<Tournament | null> {
  return repo.createInitialTournament(
    Tournament.new({ id: 0, name: 'Torneo 1', commission }),
  );
}
