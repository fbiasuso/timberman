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
 * Idempotent by design: when at least one tournament exists, nothing is
 * written — boot never duplicates an existing tournament (spec
 * tournament-management: "Boot keeps existing tournaments").
 *
 * @param repo        tournament repository (unit-testable — no DB here)
 * @param commission  commission percent from the boot-loaded system config
 */
export async function ensureInitialTournament(
  repo: TournamentRepo,
  commission: number,
): Promise<void> {
  const existing = await repo.findAll();
  if (existing.length > 0) {
    return;
  }
  await repo.save(
    Tournament.new({ id: 0, name: 'Torneo 1', commission }),
  );
}
