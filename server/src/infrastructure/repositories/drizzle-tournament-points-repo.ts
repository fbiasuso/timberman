import { eq, and } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import type {
  TournamentPointsRepo,
  TournamentPoint,
} from '../../domain/ports/tournament-points-repo.js';

/**
 * Drizzle implementation of the tournament points/winners port (design D2).
 *
 * `savePoints` and `saveWinners` are idempotent via `ON CONFLICT DO NOTHING`:
 * re-running a publish or the backfill script never duplicates rows (the
 * unique constraints are `(tournament_id, match_date_id, user_id)` for points
 * and `(tournament_id, user_id)` for winners).
 */
export class DrizzleTournamentPointsRepo implements TournamentPointsRepo {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  async savePoints(rows: TournamentPoint[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db
      .insert(schema.tournamentPoints)
      .values(
        rows.map((row) => ({
          userId: row.userId,
          tournamentId: row.tournamentId,
          matchDateId: row.matchDateId,
          points: row.points,
        })),
      )
      .onConflictDoNothing();
  }

  async findByTournamentId(tournamentId: number): Promise<TournamentPoint[]> {
    const rows = await this.db
      .select()
      .from(schema.tournamentPoints)
      .where(eq(schema.tournamentPoints.tournamentId, tournamentId));
    return rows.map((row) => ({
      userId: row.userId,
      tournamentId: row.tournamentId,
      matchDateId: row.matchDateId,
      points: row.points,
    }));
  }

  async findByUserAndTournament(
    userId: string,
    tournamentId: number,
  ): Promise<TournamentPoint[]> {
    const rows = await this.db
      .select()
      .from(schema.tournamentPoints)
      .where(
        and(
          eq(schema.tournamentPoints.userId, userId),
          eq(schema.tournamentPoints.tournamentId, tournamentId),
        ),
      );
    return rows.map((row) => ({
      userId: row.userId,
      tournamentId: row.tournamentId,
      matchDateId: row.matchDateId,
      points: row.points,
    }));
  }

  async saveWinners(tournamentId: number, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await this.db
      .insert(schema.tournamentWinners)
      .values(userIds.map((userId) => ({ tournamentId, userId })))
      .onConflictDoNothing();
  }

  async findWinnersByTournamentId(
    tournamentId: number,
  ): Promise<{ userId: string }[]> {
    const rows = await this.db
      .select()
      .from(schema.tournamentWinners)
      .where(eq(schema.tournamentWinners.tournamentId, tournamentId));
    return rows.map((row) => ({ userId: row.userId }));
  }
}
