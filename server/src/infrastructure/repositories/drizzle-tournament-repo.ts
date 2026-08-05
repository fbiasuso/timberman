import { eq, and, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import { Tournament } from '../../domain/entities/tournament.js';
import type { TournamentSnapshot } from '../../domain/entities/tournament.js';
import { MatchDate } from '../../domain/entities/match-date.js';
import type { MatchDateSnapshot } from '../../domain/entities/match-date.js';
import {
  TournamentNotFoundError,
  MatchDateNotFoundError,
  TournamentNameAlreadyExistsError,
} from '../../domain/errors/index.js';

// Boot-singleton advisory lock key: serializes concurrent cold-starts on an
// empty tournaments table so exactly one instance inserts "Torneo 1". Fixed
// module-level value — all instances must agree on the same key.
const BOOT_LOCK_KEY = 727001;

// Functional unique index on the normalized name (schema.ts) — PG reports it
// as the constraint name on a 23505 unique violation.
const NAME_NORMALIZED_UNIQUE_CONSTRAINT = 'idx_tournaments_name_normalized_unique';

export class DrizzleTournamentRepo implements TournamentRepo {
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
      throw new TournamentNameAlreadyExistsError(name);
    }
    throw err;
  }

  // ── Tournament ─────────────────────────────────────────────────

  private toTournament(row: any): Tournament {
    return Tournament.create({
      id: row.id,
      name: row.name,
      commission: Number(row.commission),
      status: row.status,
      finishedAt: row.finishedAt,
      carryover: row.carryover,
      createdAt: row.createdAt,
    } as TournamentSnapshot);
  }

  async findById(id: number): Promise<Tournament | null> {
    const [row] = await this.db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, id));
    if (!row) return null;
    return this.toTournament(row);
  }

  async findByIdForUpdate(id: number): Promise<Tournament | null> {
    // Lock the row for the duration of the transaction — serializes the
    // carryover read-modify-write between concurrent date closes.
    const [row] = await this.db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, id))
      .for('update');
    if (!row) return null;
    return this.toTournament(row);
  }

  async findActive(): Promise<Tournament | null> {
    const [row] = await this.db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.status, 'active'));
    if (!row) return null;
    return this.toTournament(row);
  }

  async findAll(): Promise<Tournament[]> {
    const rows = await this.db.select().from(schema.tournaments);
    return rows.map((row) => this.toTournament(row));
  }

  async createInitialTournament(
    tournament: Tournament,
  ): Promise<Tournament | null> {
    // The whole read+insert runs inside ONE transaction so the advisory
    // xact lock is held for the entire check-then-act. Without the
    // transaction wrapping, the lock would release between the statements
    // and the cold-start race would remain.
    return this.db.transaction(async (tx) => {
      // Wait for any concurrent cold-start to finish before checking the
      // table: the second instance blocks here, then sees the row inserted
      // by the first and no-ops below.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOT_LOCK_KEY})`);

      const [existing] = await tx.select().from(schema.tournaments).limit(1);
      if (existing) return null;

      const snap = tournament.toSnapshot();
      // New tournaments carry the id: 0 sentinel — omit it so the serial PK
      // assigns the id. Inserting an explicit 0 would collide on the second
      // row (mirrors save()).
      try {
        const [row] = await tx
          .insert(schema.tournaments)
          .values({
            name: snap.name,
            commission: String(snap.commission),
            status: snap.status,
            finishedAt: snap.finishedAt,
            carryover: snap.carryover,
          })
          .returning();
        return this.toTournament(row);
      } catch (err) {
        // Practically unreachable (advisory lock + select-limit(1) no-op
        // first), but the index is the hard backstop — fail loud at startup.
        return this.mapNameViolation(err, snap.name);
      }
    });
  }

  async save(tournament: Tournament): Promise<Tournament> {
    const snap = tournament.toSnapshot();
    // New tournaments carry the id: 0 sentinel — omit it so the serial PK
    // assigns the id. Inserting an explicit 0 would collide on the second row.
    const { id: _ignored, ...values } = snap;
    try {
      const [row] = await this.db
        .insert(schema.tournaments)
        .values(values as any)
        .returning();
      return this.toTournament(row);
    } catch (err) {
      return this.mapNameViolation(err, snap.name);
    }
  }

  async update(tournament: Tournament): Promise<Tournament> {
    const snap = tournament.toSnapshot();
    try {
      const [row] = await this.db
        .update(schema.tournaments)
        .set({
          name: snap.name,
          commission: String(snap.commission),
          status: snap.status,
          finishedAt: snap.finishedAt,
          carryover: snap.carryover,
        })
        .where(eq(schema.tournaments.id, snap.id))
        .returning();
      if (!row) throw new TournamentNotFoundError(snap.id);
      return this.toTournament(row);
    } catch (err) {
      return this.mapNameViolation(err, snap.name);
    }
  }

  // ── MatchDate ──────────────────────────────────────────────────

  private toMatchDate(row: any): MatchDate {
    return MatchDate.create({
      ...row,
      commission: Number(row.commission),
    } as unknown as MatchDateSnapshot);
  }

  async findMatchDateById(id: number): Promise<MatchDate | null> {
    const [row] = await this.db
      .select()
      .from(schema.matchDates)
      .where(eq(schema.matchDates.id, id));
    if (!row) return null;
    return this.toMatchDate(row);
  }

  async findMatchDateByIdForUpdate(id: number): Promise<MatchDate | null> {
    // Lock the row for the duration of the transaction — serializes
    // concurrent close/publish on the same date so the second request
    // sees the committed status and is rejected, never double-credited.
    const [row] = await this.db
      .select()
      .from(schema.matchDates)
      .where(eq(schema.matchDates.id, id))
      .for('update');
    if (!row) return null;
    return this.toMatchDate(row);
  }

  async findMatchDatesByTournamentId(tournamentId: number): Promise<MatchDate[]> {
    const rows = await this.db
      .select()
      .from(schema.matchDates)
      .where(eq(schema.matchDates.tournamentId, tournamentId));
    return rows.map((row) => this.toMatchDate(row));
  }

  async findOpenMatchDates(tournamentId?: number): Promise<MatchDate[]> {
    const conditions = [eq(schema.matchDates.status, 'open')];
    if (tournamentId !== undefined) {
      conditions.push(eq(schema.matchDates.tournamentId, tournamentId));
    }
    const rows = await this.db
      .select()
      .from(schema.matchDates)
      .where(and(...conditions));
    return rows.map((row) => this.toMatchDate(row));
  }

  async saveMatchDate(matchDate: MatchDate): Promise<MatchDate> {
    const snap = matchDate.toSnapshot();
    const [row] = await this.db
      .insert(schema.matchDates)
      .values({
        tournamentId: snap.tournamentId,
        dateNumber: snap.dateNumber,
        status: snap.status,
        pozo: snap.pozo,
        betAmount: snap.betAmount,
        commission: String(snap.commission),
      })
      .returning();
    return this.toMatchDate(row);
  }

  async updateMatchDate(matchDate: MatchDate): Promise<MatchDate> {
    const snap = matchDate.toSnapshot();
    const [row] = await this.db
      .update(schema.matchDates)
      .set({
        status: snap.status,
        pozo: snap.pozo,
        betAmount: snap.betAmount,
        commission: String(snap.commission),
      })
      .where(eq(schema.matchDates.id, snap.id))
      .returning();
    if (!row) throw new MatchDateNotFoundError(snap.id);
    return this.toMatchDate(row);
  }
}
