/**
 * backfill-tournament-points.ts
 *
 * One-time backfill script: persists tournament points for every match date
 * that already has status 'results'.
 *
 * Usage:
 *   npx tsx server/scripts/backfill-tournament-points.ts
 *
 * What it does:
 *   - Finds every match date with status 'results'
 *   - Loads that date's matches + tickets (with predictions)
 *   - Runs PointsCalculator.calculate() to compute points per ticket owner
 *   - Persists one tournament_points row per ticket owner (including 0-point
 *     rows) via TournamentPointsRepo.savePoints()
 *
 * Idempotent: savePoints() uses ON CONFLICT DO NOTHING on the
 * (tournament_id, match_date_id, user_id) unique constraint, so re-running
 * the script never creates duplicate rows.
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../src/infrastructure/db/schema.js';
import { DrizzleMatchRepo } from '../src/infrastructure/repositories/drizzle-match-repo.js';
import { DrizzleTicketRepo } from '../src/infrastructure/repositories/drizzle-ticket-repo.js';
import { DrizzleTournamentPointsRepo } from '../src/infrastructure/repositories/drizzle-tournament-points-repo.js';
import { PointsCalculator } from '../src/application/tournament/points-calculator.js';
import type { TournamentPoint } from '../src/domain/ports/tournament-points-repo.js';

// ── DB connection ─────────────────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const queryClient = postgres(databaseUrl);
const db = drizzle(queryClient, { schema });

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('📊 Backfilling tournament points for published dates...\n');

  const matchRepo = new DrizzleMatchRepo(db);
  const ticketRepo = new DrizzleTicketRepo(db);
  const pointsRepo = new DrizzleTournamentPointsRepo(db);
  const calculator = new PointsCalculator();

  // 1. Find every match date that already has results published
  const resultsDates = await db
    .select()
    .from(schema.matchDates)
    .where(eq(schema.matchDates.status, 'results'));

  console.log(`   Found ${resultsDates.length} match date(s) with status 'results'`);

  if (resultsDates.length === 0) {
    console.log('\n✅ Nothing to backfill — no published dates exist');
    await queryClient.end();
    return;
  }

  // 2. For each date: compute points from matches × tickets and persist
  let totalRows = 0;
  let skippedDates = 0;

  for (const date of resultsDates) {
    // Dates without a tournament cannot be attributed points — skip them
    if (date.tournamentId === null) {
      console.warn(`   ⚠️  Skipping date #${date.dateNumber} (id=${date.id}): no tournament`);
      skippedDates++;
      continue;
    }

    const matches = await matchRepo.findByMatchDateId(date.id);
    const tickets = await ticketRepo.findByMatchDateId(date.id);

    const ticketPoints = calculator.calculate(matches, tickets);

    // One row per ticket owner (0-point rows included). The unique
    // constraint (tournament_id, match_date_id, user_id) makes savePoints
    // idempotent — re-running skips rows that already exist.
    const rows: TournamentPoint[] = ticketPoints.map((p) => ({
      userId: p.userId,
      tournamentId: date.tournamentId!,
      matchDateId: date.id,
      points: p.correct,
    }));

    await pointsRepo.savePoints(rows);

    totalRows += rows.length;
    console.log(
      `   Date #${date.dateNumber} (id=${date.id}): ${tickets.length} ticket(s) → ${rows.length} point row(s)`,
    );
  }

  // ── Summary ─────────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────');
  console.log('✅ Backfill completed successfully');
  console.log(`   Match dates:    ${resultsDates.length}`);
  console.log(`   Point rows:     ${totalRows}`);
  if (skippedDates > 0) {
    console.log(`   Skipped dates:  ${skippedDates} (no tournament)`);
  }
  console.log('────────────────────────────────────────\n');

  await queryClient.end();
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
