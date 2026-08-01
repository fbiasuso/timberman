import { eq } from 'drizzle-orm';
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
} from '../../domain/errors/index.js';

export class DrizzleTournamentRepo implements TournamentRepo {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  // ── Tournament ─────────────────────────────────────────────────

  async findById(id: number): Promise<Tournament | null> {
    const [row] = await this.db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, id));
    if (!row) return null;
    return Tournament.create({
      id: row.id,
      name: row.name,
      commission: Number(row.commission),
      isActive: row.isActive,
      carryover: row.carryover,
      createdAt: row.createdAt,
    } as TournamentSnapshot);
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
    return Tournament.create({
      id: row.id,
      name: row.name,
      commission: Number(row.commission),
      isActive: row.isActive,
      carryover: row.carryover,
      createdAt: row.createdAt,
    } as TournamentSnapshot);
  }

  async findActive(): Promise<Tournament | null> {
    const [row] = await this.db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.isActive, true));
    if (!row) return null;
    return Tournament.create({
      id: row.id,
      name: row.name,
      commission: Number(row.commission),
      isActive: row.isActive,
      carryover: row.carryover,
      createdAt: row.createdAt,
    } as TournamentSnapshot);
  }

  async findAll(): Promise<Tournament[]> {
    const rows = await this.db.select().from(schema.tournaments);
    return rows.map((row) =>
      Tournament.create({
        id: row.id,
        name: row.name,
        commission: Number(row.commission),
        isActive: row.isActive,
        carryover: row.carryover,
        createdAt: row.createdAt,
      } as TournamentSnapshot),
    );
  }

  async save(tournament: Tournament): Promise<Tournament> {
    const snap = tournament.toSnapshot();
    const [row] = await this.db
      .insert(schema.tournaments)
      .values(snap as any)
      .returning();
    return Tournament.create({
      id: row.id,
      name: row.name,
      commission: Number(row.commission),
      isActive: row.isActive,
      carryover: row.carryover,
      createdAt: row.createdAt,
    } as TournamentSnapshot);
  }

  async update(tournament: Tournament): Promise<Tournament> {
    const snap = tournament.toSnapshot();
    const [row] = await this.db
      .update(schema.tournaments)
      .set({
        name: snap.name,
        commission: String(snap.commission),
        isActive: snap.isActive,
        carryover: snap.carryover,
      })
      .where(eq(schema.tournaments.id, snap.id))
      .returning();
    if (!row) throw new TournamentNotFoundError(snap.id);
    return Tournament.create({
      id: row.id,
      name: row.name,
      commission: Number(row.commission),
      isActive: row.isActive,
      carryover: row.carryover,
      createdAt: row.createdAt,
    } as TournamentSnapshot);
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

  async findOpenMatchDates(): Promise<MatchDate[]> {
    const rows = await this.db
      .select()
      .from(schema.matchDates)
      .where(eq(schema.matchDates.status, 'open'));
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
