/**
 * seed-from-json.ts
 *
 * One-time migration script: reads a localStorage export JSON (from the
 * original Timberman SPA) and inserts every entity into the new Drizzle
 * PostgreSQL schema.
 *
 * Usage:
 *   npx tsx server/scripts/seed-from-json.ts --input backup.json
 *
 * The export format is:
 * {
 *   config: { fechaActual: number },
 *   fechas: { [dateNumber: string]: Match[] },
 *   usuarios: { [username: string]: UserData },
 *   pozo: number
 * }
 *
 * Where Match = { id, l, v, imgL, imgV, fecha, hora, oficial, marcador }
 * and   UserData = { saldo, jugadas, puntos, pass }
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/infrastructure/db/schema.js';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';

// ── CLI arg parsing ───────────────────────────────────────────────
const args = parseArgs({
  options: {
    input: { type: 'string', short: 'i' },
  },
  strict: false,
});

const inputPath = args.values?.input;
if (!inputPath) {
  console.error('❌ Usage: npx tsx server/scripts/seed-from-json.ts --input backup.json');
  process.exit(1);
}

if (!existsSync(inputPath)) {
  console.error(`❌ File not found: ${inputPath}`);
  process.exit(1);
}

// ── Types for the legacy export format ────────────────────────────
interface LegacyMatch {
  id: string;
  l: string;
  v: string;
  imgL: string;
  imgV: string;
  fecha: string;   // '2026-05-15'
  hora: string;    // '20:00'
  oficial: string; // '-' | 'L' | 'E' | 'V'
  marcador: string;
}

interface LegacyJugada {
  fechaTorneo: number;
  predicciones: Record<string, 'L' | 'E' | 'V'>;
}

interface LegacyUserData {
  saldo: number;
  jugadas: LegacyJugada[];
  puntos: number;
  pass: string;
}

interface LegacyExport {
  config: { fechaActual: number };
  fechas: Record<string, LegacyMatch[]>;
  usuarios: Record<string, LegacyUserData>;
  pozo: number;
}

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

function parseScheduledAt(fecha: string, hora: string): Date | null {
  if (!fecha) return null;
  const time = hora || '20:00';
  try {
    return new Date(`${fecha}T${time}:00`);
  } catch {
    return null;
  }
}

function mapResult(oficial: string): 'L' | 'E' | 'V' | null {
  if (oficial === 'L' || oficial === 'E' || oficial === 'V') return oficial;
  return null;
}

function mapScore(marcador: string): string | null {
  const s = marcador.trim();
  return s || null;
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('📂 Reading backup file...');
  const raw = readFileSync(inputPath, 'utf-8');
  const backup: LegacyExport = JSON.parse(raw);

  console.log(`   Found ${Object.keys(backup.fechas).length} date(s), ${Object.keys(backup.usuarios).length} user(s)`);

  // ── 1. Create tournament ───────────────────────────────────────
  console.log('\n🏆 Creating tournament...');
  const [tournament] = await db.insert(schema.tournaments)
    .values({
      name: 'Torneo Importado',
      commission: '15.00',
      status: 'active',
    })
    .returning({ id: schema.tournaments.id });

  console.log(`   Tournament created: id=${tournament.id}`);

  // ── 2. Create match dates and matches ──────────────────────────
  // Collect oldMatchId → newMatchId mapping for ticket predictions
  const matchIdMap = new Map<string, number>();

  for (const [dateNumStr, legacyMatches] of Object.entries(backup.fechas)) {
    const dateNumber = Number(dateNumStr);
    if (Number.isNaN(dateNumber)) continue;

    console.log(`\n📅 Creating match date ${dateNumber} (${legacyMatches.length} matches)...`);

    const [matchDate] = await db.insert(schema.matchDates)
      .values({
        tournamentId: tournament.id,
        dateNumber,
        status: 'open',
        pozo: 0,
        betAmount: 1500,
      })
      .returning({ id: schema.matchDates.id });

    // Insert matches
    for (const lm of legacyMatches) {
      const result = mapResult(lm.oficial);
      const score = mapScore(lm.marcador);

      const [m] = await db.insert(schema.matches)
        .values({
          matchDateId: matchDate.id,
          localTeam: lm.l,
          visitorTeam: lm.v,
          localImg: lm.imgL || null,
          visitorImg: lm.imgV || null,
          scheduledAt: parseScheduledAt(lm.fecha, lm.hora),
          result,
          score,
        })
        .returning({ id: schema.matches.id });

      matchIdMap.set(lm.id, m.id);
    }
  }

  console.log(`\n   Mapped ${matchIdMap.size} match IDs`);

  // ── 3. Create users and tickets ────────────────────────────────
  let userCount = 0;
  let ticketCount = 0;
  let predictionCount = 0;

  // Fetch match dates to map dateNumber → dateId
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const allMatchDates = await db.select().from(schema.matchDates);
  const dateNumberToId = new Map<number, number>();
  for (const md of allMatchDates) {
    if (md.tournamentId === tournament.id) {
      dateNumberToId.set(md.dateNumber, md.id);
    }
  }

  for (const [username, userData] of Object.entries(backup.usuarios)) {
    const passwordHash = await bcrypt.hash(userData.pass, BCRYPT_ROUNDS);

    console.log(`\n👤 Creating user: ${username} (balance: $${(userData.saldo / 100).toFixed(2)})`);

    const [user] = await db.insert(schema.users)
      .values({
        username,
        passwordHash,
        role: 'user',
        balance: userData.saldo,
      })
      .returning({ id: schema.users.id });

    userCount++;

    // ── Create tickets (jugadas) ──────────────────────────────────
    for (const jugada of userData.jugadas) {
      const matchDateId = dateNumberToId.get(jugada.fechaTorneo);
      if (!matchDateId) {
        console.warn(`   ⚠️  Skipping ticket for date ${jugada.fechaTorneo}: not found in DB`);
        continue;
      }

      const [ticket] = await db.insert(schema.tickets)
        .values({
          userId: user.id,
          matchDateId,
          betAmount: 1500,
        })
        .returning({ id: schema.tickets.id });

      ticketCount++;

      // ── Create predictions ──────────────────────────────────────
      for (const [oldMatchId, prediction] of Object.entries(jugada.predicciones)) {
        const newMatchId = matchIdMap.get(oldMatchId);
        if (!newMatchId) {
          console.warn(`   ⚠️  Skipping prediction for match ${oldMatchId}: not found`);
          continue;
        }

        await db.insert(schema.ticketPredictions)
          .values({
            ticketId: ticket.id,
            matchId: newMatchId,
            prediction,
          });

        predictionCount++;
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────');
  console.log('✅ Seed completed successfully');
  console.log(`   Tournament:     1`);
  console.log(`   Match dates:    ${Object.keys(backup.fechas).length}`);
  console.log(`   Matches:        ${matchIdMap.size}`);
  console.log(`   Users:          ${userCount}`);
  console.log(`   Tickets:        ${ticketCount}`);
  console.log(`   Predictions:    ${predictionCount}`);
  console.log('────────────────────────────────────────\n');

  await queryClient.end();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
