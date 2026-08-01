/**
 * seed-dev.ts
 *
 * Creates seed data for local development and testing.
 *
 * Usage:
 *   npx tsx server/scripts/seed-dev.ts
 *
 * What it creates:
 *   - 1 system_config row (15% commission, self-registration on, $15 bets)
 *   - 1 tournament "Torneo Timberman" (active, 15% commission)
 *   - 2 users: test/test123 ($15000 balance) and admin/admin77
 *   - 1 match date (date #1, open) with 5 sample matches
 *   - 2 sample tickets for the test user on date #1
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/infrastructure/db/schema.js';
import { DEFAULT_SYSTEM_CONFIG } from '../src/domain/entities/system-config.js';
import bcrypt from 'bcryptjs';

// ── DB connection ─────────────────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const queryClient = postgres(databaseUrl);
const db = drizzle(queryClient, { schema });

// ── Helpers ──────────────────────────────────────────────────────
const BCRYPT_ROUNDS = 10;

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding development database...\n');

  // ── 0. Seed system config (single row, id=1) ──────────────────
  console.log('⚙️  Seeding system config...');
  await db.insert(schema.systemConfig)
    .values({
      id: 1,
      commission: String(DEFAULT_SYSTEM_CONFIG.commission),
      allowRegistration: DEFAULT_SYSTEM_CONFIG.allowRegistration,
      defaultBetAmount: DEFAULT_SYSTEM_CONFIG.defaultBetAmount,
    })
    .onConflictDoNothing();
  console.log(`   commission=${DEFAULT_SYSTEM_CONFIG.commission}%, allowRegistration=${DEFAULT_SYSTEM_CONFIG.allowRegistration}, defaultBet=$${(DEFAULT_SYSTEM_CONFIG.defaultBetAmount / 100).toFixed(2)}`);

  // ── 1. Create tournament ───────────────────────────────────────
  console.log('🏆 Creating tournament...');
  const [tournament] = await db.insert(schema.tournaments)
    .values({
      name: 'Torneo Timberman',
      commission: '15.00',
      isActive: true,
    })
    .returning({ id: schema.tournaments.id });
  console.log(`   id=${tournament.id}`);

  // ── 2. Create users ────────────────────────────────────────────
  console.log('\n👤 Creating users...');

  const testPassword = await bcrypt.hash('test123', BCRYPT_ROUNDS);
  const [testUser] = await db.insert(schema.users)
    .values({
      username: 'test',
      passwordHash: testPassword,
      role: 'user',
      balance: 15000, // $150.00
    })
    .returning({ id: schema.users.id, username: schema.users.username, balance: schema.users.balance });
  console.log(`   ${testUser.username}: id=${testUser.id}, balance=$${(testUser.balance / 100).toFixed(2)}`);

  const adminPassword = await bcrypt.hash('admin77', BCRYPT_ROUNDS);
  const [adminUser] = await db.insert(schema.users)
    .values({
      username: 'admin',
      passwordHash: adminPassword,
      role: 'admin',
      balance: 0,
    })
    .returning({ id: schema.users.id, username: schema.users.username });
  console.log(`   ${adminUser.username}: id=${adminUser.id} (admin)`);

  // ── 3. Create match date ───────────────────────────────────────
  console.log('\n📅 Creating match date...');
  const [matchDate] = await db.insert(schema.matchDates)
    .values({
      tournamentId: tournament.id,
      dateNumber: 1,
      status: 'open',
      pozo: 0,
      betAmount: 1500, // $15.00
    })
    .returning({ id: schema.matchDates.id });
  console.log(`   Date #1: id=${matchDate.id}`);

  // ── 4. Create sample matches ───────────────────────────────────
  console.log('\n⚽ Creating matches...');
  const sampleMatches = [
    { local: 'River Plate', visitor: 'Boca Juniors', scheduledAt: new Date('2026-08-10T21:00:00') },
    { local: 'Independiente', visitor: 'Racing Club', scheduledAt: new Date('2026-08-10T19:00:00') },
    { local: 'San Lorenzo', visitor: 'Huracán', scheduledAt: new Date('2026-08-11T20:00:00') },
    { local: 'Estudiantes', visitor: 'Gimnasia', scheduledAt: new Date('2026-08-11T18:00:00') },
    { local: 'Newells', visitor: 'Rosario Central', scheduledAt: new Date('2026-08-12T21:00:00') },
  ];

  const matchIds: number[] = [];

  for (const m of sampleMatches) {
    const [inserted] = await db.insert(schema.matches)
      .values({
        matchDateId: matchDate.id,
        localTeam: m.local,
        visitorTeam: m.visitor,
        scheduledAt: m.scheduledAt,
      })
      .returning({ id: schema.matches.id, localTeam: schema.matches.localTeam, visitorTeam: schema.matches.visitorTeam });

    matchIds.push(inserted.id);
    console.log(`   ${inserted.localTeam} vs ${inserted.visitorTeam} — id=${inserted.id}`);
  }

  // ── 5. Create sample tickets for test user ─────────────────────
  console.log('\n🎫 Creating tickets for test user...');

  // Ticket 1: predicts L, E, V, L, E
  const [ticket1] = await db.insert(schema.tickets)
    .values({
      userId: testUser.id,
      matchDateId: matchDate.id,
      betAmount: 1500,
    })
    .returning({ id: schema.tickets.id });

  const predictions1: ('L' | 'E' | 'V')[] = ['L', 'E', 'V', 'L', 'E'];
  for (let i = 0; i < matchIds.length; i++) {
    await db.insert(schema.ticketPredictions).values({
      ticketId: ticket1.id,
      matchId: matchIds[i],
      prediction: predictions1[i],
    });
  }
  console.log(`   Ticket #${ticket1.id}: predictions L, E, V, L, E`);

  // Ticket 2: predicts V, E, L, V, L
  const [ticket2] = await db.insert(schema.tickets)
    .values({
      userId: testUser.id,
      matchDateId: matchDate.id,
      betAmount: 1500,
    })
    .returning({ id: schema.tickets.id });

  const predictions2: ('L' | 'E' | 'V')[] = ['V', 'E', 'L', 'V', 'L'];
  for (let i = 0; i < matchIds.length; i++) {
    await db.insert(schema.ticketPredictions).values({
      ticketId: ticket2.id,
      matchId: matchIds[i],
      prediction: predictions2[i],
    });
  }
  console.log(`   Ticket #${ticket2.id}: predictions V, E, L, V, L`);

  // ── Summary ─────────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────');
  console.log('✅ Dev seed completed successfully');
  console.log(`   System config:  1  (15% commission, self-registration on, $15 bets)`);
  console.log(`   Tournament:     1  (Torneo Timberman)`);
  console.log(`   Match date:     1  (#1, open, $15 bets)`);
  console.log(`   Matches:        ${matchIds.length}`);
  console.log(`   Users:          2  (test/test123, admin/admin77)`);
  console.log(`   Tickets:        2  (both for test user on date #1)`);
  console.log('────────────────────────────────────────\n');

  await queryClient.end();
}

main().catch((err) => {
  console.error('❌ Dev seed failed:', err);
  process.exit(1);
});
