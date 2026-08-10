import { eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import type { LeagueRepo } from '../../domain/ports/league-repo.js';
import { League } from '../../domain/entities/league.js';
import type { LeagueSnapshot } from '../../domain/entities/league.js';
import {
  LeagueNotFoundError,
  LeagueNameAlreadyExistsError,
} from '../../domain/errors/index.js';

// Functional unique index on the normalized name (schema.ts) — PG reports it
// as the constraint name on a 23505 unique violation.
const NAME_NORMALIZED_UNIQUE_CONSTRAINT = 'idx_leagues_name_normalized_unique';

export class DrizzleLeagueRepo implements LeagueRepo {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  /**
   * Map a PG unique-violation (23505) on the normalized name index to the
   * typed domain error. Any other 23505 (PK/FK) or non-23505 error is
   * rethrown untouched — this choke point must not mask unrelated failures.
   */
  private mapNameViolation(err: unknown, name: string): never {
    if (
      (err as { code?: string }).code === '23505' &&
      (err as { constraint?: string }).constraint === NAME_NORMALIZED_UNIQUE_CONSTRAINT
    ) {
      throw new LeagueNameAlreadyExistsError(name);
    }
    throw err;
  }

  private toLeague(row: any): League {
    return League.create({
      id: row.id,
      name: row.name,
      country: row.country,
      format: row.format,
      createdAt: row.createdAt,
    } as LeagueSnapshot);
  }

  async findAll(): Promise<League[]> {
    const rows = await this.db
      .select()
      .from(schema.leagues)
      .orderBy(schema.leagues.name);
    return rows.map((row) => this.toLeague(row));
  }

  async findById(id: number): Promise<League | null> {
    const [row] = await this.db
      .select()
      .from(schema.leagues)
      .where(eq(schema.leagues.id, id));
    if (!row) return null;
    return this.toLeague(row);
  }

  async findByName(name: string): Promise<League | null> {
    // Normalized comparison key (case-folded, whitespace stripped) — matches
    // the unique index so seed idempotency sees the same collisions the index
    // rejects.
    const [row] = await this.db
      .select()
      .from(schema.leagues)
      .where(sql`lower(regexp_replace(${schema.leagues.name}, '\\s+', '', 'g')) = lower(regexp_replace(${name}, '\\s+', '', 'g'))`);
    if (!row) return null;
    return this.toLeague(row);
  }

  async save(league: League): Promise<League> {
    const snap = league.toSnapshot();
    // New leagues carry the id: 0 sentinel — omit it so the serial PK assigns
    // the id (mirrors DrizzleTournamentRepo.save).
    const { id: _ignored, ...values } = snap;
    try {
      const [row] = await this.db
        .insert(schema.leagues)
        .values(values as any)
        .returning();
      return this.toLeague(row);
    } catch (err) {
      return this.mapNameViolation(err, snap.name);
    }
  }

  async update(league: League): Promise<League> {
    const snap = league.toSnapshot();
    try {
      const [row] = await this.db
        .update(schema.leagues)
        .set({
          name: snap.name,
          country: snap.country,
          format: snap.format,
        })
        .where(eq(schema.leagues.id, snap.id))
        .returning();
      if (!row) throw new LeagueNotFoundError(snap.id);
      return this.toLeague(row);
    } catch (err) {
      return this.mapNameViolation(err, snap.name);
    }
  }

  async delete(id: number): Promise<void> {
    const rows = await this.db
      .delete(schema.leagues)
      .where(eq(schema.leagues.id, id))
      .returning({ id: schema.leagues.id });
    if (rows.length === 0) throw new LeagueNotFoundError(id);
  }

  async countTeams(leagueId: number): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.teamLeagues)
      .where(eq(schema.teamLeagues.leagueId, leagueId));
    return Number(row?.count ?? 0);
  }
}
