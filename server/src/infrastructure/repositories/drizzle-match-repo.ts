import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import { Match } from '../../domain/entities/match.js';
import type { MatchSnapshot } from '../../domain/entities/match.js';

export class DrizzleMatchRepo implements MatchRepo {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  async findById(id: number): Promise<Match | null> {
    const [row] = await this.db
      .select()
      .from(schema.matches)
      .where(eq(schema.matches.id, id));
    if (!row) return null;
    return Match.create(row as unknown as MatchSnapshot);
  }

  async findByMatchDateId(matchDateId: number): Promise<Match[]> {
    const rows = await this.db
      .select()
      .from(schema.matches)
      .where(eq(schema.matches.matchDateId, matchDateId));
    return rows.map((row) => Match.create(row as unknown as MatchSnapshot));
  }

  async save(match: Match): Promise<Match> {
    const snap = match.toSnapshot();
    // New records carry the id: 0 sentinel — omit it so the serial PK
    // assigns the id. Inserting an explicit 0 would collide on the second row.
    const values = snap.id <= 0 ? { ...snap, id: undefined } : snap;
    const [row] = await this.db
      .insert(schema.matches)
      .values(values as any)
      .returning();
    return Match.create(row as unknown as MatchSnapshot);
  }

  async update(match: Match): Promise<Match> {
    const snap = match.toSnapshot();
    const [row] = await this.db
      .update(schema.matches)
      .set({
        localTeam: snap.localTeam,
        visitorTeam: snap.visitorTeam,
        localImg: snap.localImg,
        visitorImg: snap.visitorImg,
        scheduledAt: snap.scheduledAt,
        result: snap.result,
        score: snap.score,
      })
      .where(eq(schema.matches.id, snap.id))
      .returning();
    return Match.create(row as unknown as MatchSnapshot);
  }

  async saveMany(matches: Match[]): Promise<Match[]> {
    if (matches.length === 0) return [];
    // All saved matches are new records — omit the id: 0 sentinel (see save()).
    const snapshots = matches.map((m) => ({ ...m.toSnapshot(), id: undefined }));
    const rows = await this.db
      .insert(schema.matches)
      .values(snapshots as any)
      .returning();
    return rows.map((row) => Match.create(row as unknown as MatchSnapshot));
  }
}
