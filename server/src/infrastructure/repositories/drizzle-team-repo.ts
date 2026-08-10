import { eq, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import type { TeamRepo } from '../../domain/ports/team-repo.js';
import { Team } from '../../domain/entities/team.js';
import type { TeamSnapshot } from '../../domain/entities/team.js';
import {
  TeamNotFoundError,
  TeamNameAlreadyExistsError,
} from '../../domain/errors/index.js';

// Functional unique index on the normalized GLOBAL team name (schema.ts) — PG
// reports it as the constraint name on a 23505 unique violation.
const TEAM_NAME_NORMALIZED_UNIQUE_CONSTRAINT = 'idx_teams_name_normalized_unique';

export class DrizzleTeamRepo implements TeamRepo {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  /**
   * Map a PG unique-violation (23505) on the normalized name index to the
   * typed domain error. Any other 23505 (PK, junction pair) is rethrown
   * untouched: the junction unique pair can only collide when the input
   * leagueIds repeats an id — the use cases dedupe, so mapping it here would
   * only mask a caller bug as a name collision (defensive — design D12).
   */
  private mapNameViolation(err: unknown, name: string): never {
    if (
      (err as { code?: string }).code === '23505' &&
      (err as { constraint?: string }).constraint === TEAM_NAME_NORMALIZED_UNIQUE_CONSTRAINT
    ) {
      throw new TeamNameAlreadyExistsError(name);
    }
    throw err;
  }

  private toTeam(row: any, leagueIds: number[]): Team {
    return Team.create({
      id: row.id,
      name: row.name,
      aliases: row.aliases,
      logo: row.logo,
      // Deterministic membership order (stable responses for tests/clients).
      leagueIds: [...leagueIds].sort((a, b) => a - b),
      createdAt: row.createdAt,
    } as TeamSnapshot);
  }

  private async loadMemberships(teamId: number): Promise<number[]> {
    const rows = await this.db
      .select()
      .from(schema.teamLeagues)
      .where(eq(schema.teamLeagues.teamId, teamId));
    return rows.map((m) => m.leagueId);
  }

  async findAll(): Promise<Team[]> {
    const [rows, memberships] = await Promise.all([
      this.db.select().from(schema.teams).orderBy(schema.teams.name),
      this.db.select().from(schema.teamLeagues),
    ]);
    // Group memberships in memory — registry is small, one extra read beats a
    // join cartesian (design D8 groups the same way for league listing).
    const byTeam = new Map<number, number[]>();
    for (const m of memberships) {
      const ids = byTeam.get(m.teamId) ?? [];
      ids.push(m.leagueId);
      byTeam.set(m.teamId, ids);
    }
    return rows.map((row) => this.toTeam(row, byTeam.get(row.id) ?? []));
  }

  async findById(id: number): Promise<Team | null> {
    const [row] = await this.db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.id, id));
    if (!row) return null;
    return this.toTeam(row, await this.loadMemberships(id));
  }

  async findByLeagueId(leagueId: number): Promise<Team[]> {
    // Join the junction so only teams WITH a membership in this league are
    // returned (spec "Filter teams by league"). UNIQUE(team_id, league_id)
    // guarantees one row per team here, so leagueIds is exactly [leagueId].
    const rows = await this.db
      .select({ team: schema.teams })
      .from(schema.teams)
      .innerJoin(schema.teamLeagues, eq(schema.teamLeagues.teamId, schema.teams.id))
      .where(eq(schema.teamLeagues.leagueId, leagueId))
      .orderBy(schema.teams.name);
    return rows.map((r) => this.toTeam(r.team, [leagueId]));
  }

  async findByName(name: string): Promise<Team | null> {
    // GLOBAL normalized comparison key — matches the unique index so seed
    // idempotency sees the same collisions the index rejects.
    const [row] = await this.db
      .select()
      .from(schema.teams)
      .where(sql`lower(regexp_replace(${schema.teams.name}, '\\s+', '', 'g')) = lower(regexp_replace(${name}, '\\s+', '', 'g'))`);
    if (!row) return null;
    return this.toTeam(row, await this.loadMemberships(row.id));
  }

  async save(team: Team): Promise<Team> {
    const snap = team.toSnapshot();
    // New teams carry the id: 0 sentinel — omit it so the serial PK assigns
    // the id. Memberships insert in the SAME transaction (atomic, design D12).
    const { id: _ignored, leagueIds, ...values } = snap;
    return this.db.transaction(async (tx) => {
      try {
        const [row] = await tx
          .insert(schema.teams)
          .values(values as any)
          .returning();
        if (leagueIds.length > 0) {
          await tx.insert(schema.teamLeagues).values(
            leagueIds.map((leagueId) => ({ teamId: row.id, leagueId })),
          );
        }
        return this.toTeam(row, leagueIds);
      } catch (err) {
        return this.mapNameViolation(err, snap.name);
      }
    });
  }

  async update(team: Team): Promise<Team> {
    const snap = team.toSnapshot();
    return this.db.transaction(async (tx) => {
      try {
        const [row] = await tx
          .update(schema.teams)
          .set({
            name: snap.name,
            aliases: snap.aliases,
            logo: snap.logo,
          })
          .where(eq(schema.teams.id, snap.id))
          .returning();
        if (!row) throw new TeamNotFoundError(snap.id);
        // Replace the membership set atomically with the row update — the
        // last-membership invariant is enforced by the use case beforehand.
        await tx
          .delete(schema.teamLeagues)
          .where(eq(schema.teamLeagues.teamId, snap.id));
        if (snap.leagueIds.length > 0) {
          await tx.insert(schema.teamLeagues).values(
            snap.leagueIds.map((leagueId) => ({ teamId: snap.id, leagueId })),
          );
        }
        return this.toTeam(row, snap.leagueIds);
      } catch (err) {
        return this.mapNameViolation(err, snap.name);
      }
    });
  }

  async delete(id: number): Promise<void> {
    const rows = await this.db
      .delete(schema.teams)
      .where(eq(schema.teams.id, id))
      .returning({ id: schema.teams.id });
    if (rows.length === 0) throw new TeamNotFoundError(id);
    // Memberships are removed by the junction's ON DELETE CASCADE.
  }

  async countMatchesReferencing(teamId: number): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.matches)
      .where(or(
        eq(schema.matches.localTeamId, teamId),
        eq(schema.matches.visitorTeamId, teamId),
      ));
    return Number(row?.count ?? 0);
  }
}
