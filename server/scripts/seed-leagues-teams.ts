/**
 * seed-leagues-teams.ts
 *
 * Seeds the teams/leagues registry with the REAL current Argentine rosters
 * (2026 season):
 *
 *   - "Primera A"  → Liga Profesional de Fútbol   (30 teams)
 *   - "Primera B"  → Primera Nacional             (36 teams)
 *
 * Usage:
 *   npx tsx server/scripts/seed-leagues-teams.ts
 *
 * Behavior:
 *   - Idempotent: re-running never duplicates leagues or teams (lookup by
 *     normalized name; membership via unique (team_id, league_id)).
 *   - Shield download is attempted per team ONLY when a known source URL is
 *     present; failures never block seeding (image-service contract: returns
 *     null, team is kept without a logo — admin can upload later).
 *
 * Roster source: AFA 2026 season — promoted: Gimnasia (Mendoza) + Estudiantes
 * (Río Cuarto) up; Godoy Cruz + San Martín (San Juan) down (verified via
 * Olé / AS / ESPN 2025-12 → 2026-07 reporting).
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../src/infrastructure/db/schema.js';
import { LocalFileImageService } from '../src/infrastructure/images/local-file-image-service.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── DB connection ─────────────────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const queryClient = postgres(databaseUrl);
const db = drizzle(queryClient, { schema });

// ── Helpers ──────────────────────────────────────────────────────
/** Normalize a name the same way the unique indexes do (lower + strip). */
function normalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '').trim();
}

interface TeamSeed {
  name: string;
  aliases?: string[];
  /** Optional known shield URL — download attempted, failure is ignored. */
  logoUrl?: string;
}

interface LeagueSeed {
  name: string;
  country: string;
  format: 'liga' | 'copa';
  teams: TeamSeed[];
}

// ── Rosters (2026 season) ─────────────────────────────────────────

const PRIMERA_A_TEAMS: TeamSeed[] = [
  { name: 'Aldosivi', aliases: ['Aldosivi de Mar del Plata'] },
  { name: 'Argentinos Juniors', aliases: ['Argentinos Jrs', 'Argentinos'] },
  { name: 'Atlético Tucumán', aliases: ['At. Tucumán', 'Atlético Tucuman', 'Tucumán'] },
  { name: 'Banfield', aliases: ['Banfield'] },
  { name: 'Barracas Central', aliases: ['Barracas'] },
  { name: 'Belgrano', aliases: ['Belgrano de Córdoba', 'Belgrano Córdoba'] },
  { name: 'Boca Juniors', aliases: ['Boca'] },
  { name: 'Central Córdoba', aliases: ['Central Córdoba (SdE)', 'Central Córdoba de Santiago del Estero'] },
  { name: 'Defensa y Justicia', aliases: ['Defensa y Justicia (Florencio Varela)'] },
  { name: 'Deportivo Riestra', aliases: ['Riestra'] },
  { name: 'Estudiantes', aliases: ['Estudiantes de La Plata', 'Estudiantes (LP)'] },
  { name: 'Estudiantes de Río Cuarto', aliases: ['Estudiantes (RC)'] },
  { name: 'Gimnasia', aliases: ['Gimnasia de Mendoza', 'Gimnasia y Esgrima (Mendoza)', 'Gimnasia (M)'] },
  { name: 'Gimnasia La Plata', aliases: ['Gimnasia y Esgrima La Plata', 'Gimnasia (LP)'] },
  { name: 'Huracán', aliases: ['Huracán de Parque Patricios'] },
  { name: 'Instituto', aliases: ['Instituto de Córdoba', 'Instituto (Córdoba)', 'Instituto ACC'] },
  { name: 'Independiente', aliases: ['Independiente de Avellaneda'] },
  { name: 'Independiente Rivadavia', aliases: ['Independiente Rivadavia (Mendoza)', 'Independiente Rivadavia de Mendoza'] },
  { name: 'Lanús', aliases: ['Lanús'] },
  { name: "Newell's Old Boys", aliases: ["Newells", 'Newell’s', 'Newell'] },
  { name: 'Platense', aliases: ['Platense (Vicente López)'] },
  { name: 'Racing Club', aliases: ['Racing', 'Racing de Avellaneda'] },
  { name: 'River Plate', aliases: ['River'] },
  { name: 'Rosario Central', aliases: ['Central Rosario'] },
  { name: 'San Lorenzo', aliases: ['San Lorenzo de Almagro', 'San Lorenzo (CABA)'] },
  { name: 'Sarmiento', aliases: ['Sarmiento de Junín', 'Sarmiento (Junín)'] },
  { name: 'Talleres', aliases: ['Talleres de Córdoba', 'Talleres (Córdoba)'] },
  { name: 'Tigre', aliases: ['Tigre (Victoria)'] },
  { name: 'Unión', aliases: ['Unión de Santa Fe', 'Unión (Santa Fe)'] },
  { name: 'Vélez Sarsfield', aliases: ['Vélez', 'Velez Sarsfield', 'Velez'] },
];

const PRIMERA_B_TEAMS: TeamSeed[] = [
  { name: 'Acassuso', aliases: ['Acassuso (Boulogne)'] },
  { name: 'Agropecuario', aliases: ['Agropecuario Argentino'] },
  { name: 'All Boys', aliases: ['All Boys (Floresta)'] },
  { name: 'Almagro', aliases: ['Almagro (José Ingenieros)'] },
  { name: 'Almirante Brown', aliases: ['Almirante Brown (Isidro Casanova)', 'Alte. Brown'] },
  { name: 'Atlanta', aliases: ['Atlanta (Villa Crespo)'] },
  { name: 'Atlético de Rafaela', aliases: ['Atlético Rafaela', 'Rafaela'] },
  { name: 'Central Norte', aliases: ['Central Norte de Salta', 'Central Norte (Salta)'] },
  { name: 'Chacarita Juniors', aliases: ['Chacarita', 'Chaca'] },
  { name: 'Chaco For Ever', aliases: ['Chaco For Ever (Resistencia)'] },
  { name: 'Ciudad Bolívar', aliases: ['Ciudad de Bolívar'] },
  { name: 'Colegiales', aliases: ['Colegiales (Munro)'] },
  { name: 'Colón', aliases: ['Colón de Santa Fe', 'Colón (Santa Fe)'] },
  { name: 'Defensores de Belgrano', aliases: ['Defensores de Belgrano (Núñez)', 'Dragón'] },
  { name: 'Deportivo Madryn', aliases: ['Madryn'] },
  { name: 'Deportivo Maipú', aliases: ['Maipú (Mendoza)'] },
  { name: 'Deportivo Morón', aliases: ['Morón'] },
  { name: 'Estudiantes (Caseros)', aliases: ['Estudiantes de Buenos Aires', 'Estudiantes Caseros'] },
  { name: 'Ferro Carril Oeste', aliases: ['Ferro', 'Ferro (Caballito)'] },
  { name: 'Gimnasia y Tiro', aliases: ['Gimnasia y Tiro de Salta', 'Gimnasia y Tiro (Salta)'] },
  { name: 'Gimnasia y Esgrima de Jujuy', aliases: ['Gimnasia de Jujuy', 'Gimnasia (Jujuy)', 'GEJ'] },
  { name: 'Godoy Cruz', aliases: ['Godoy Cruz Antonio Tomba', 'Tomba'] },
  { name: 'Güemes', aliases: ['Güemes de Santiago del Estero', 'Guemes (SdE)'] },
  { name: 'Los Andes', aliases: ['Los Andes (Lomas de Zamora)', 'Milrayitas'] },
  { name: 'Midland', aliases: ['Midland (Libertad)'] },
  { name: 'Mitre', aliases: ['Mitre de Santiago del Estero', 'Mitre (SdE)'] },
  { name: 'Nueva Chicago', aliases: ['Chicago', 'Nva. Chicago'] },
  { name: 'Patronato', aliases: ['Patronato de Paraná', 'Patronato (Paraná)'] },
  { name: 'Quilmes', aliases: ['Quilmes Atlético Club', 'Quilmes (Quilmes)'] },
  { name: 'Racing de Córdoba', aliases: ['Racing (Córdoba)', 'Racing de Nueva Italia'] },
  { name: 'San Martín de San Juan', aliases: ['San Martín (SJ)', 'San Martín de San Juan'] },
  { name: 'San Martín de Tucumán', aliases: ['San Martín (T)', 'San Martín de Tucumán'] },
  { name: 'San Miguel', aliases: ['San Miguel (Los Polvorines)'] },
  { name: 'San Telmo', aliases: ['San Telmo (Barracas)'] },
  { name: 'Temperley', aliases: ['Temperley (Turdera)', 'Gasolero'] },
  { name: 'Tristán Suárez', aliases: ['Tristán Suárez (Ezeiza)', 'Tristan Suarez'] },
];

const LEAGUES: LeagueSeed[] = [
  { name: 'Primera A', country: 'Argentina', format: 'liga', teams: PRIMERA_A_TEAMS },
  { name: 'Primera B', country: 'Argentina', format: 'liga', teams: PRIMERA_B_TEAMS },
];

// ── Main ─────────────────────────────────────────────────────────
const logosDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'logos');
const imageService = new LocalFileImageService(logosDir);

async function upsertLeague(seed: LeagueSeed): Promise<number> {
  const key = normalize(seed.name);
  const existing = await db.query.leagues.findFirst({
    where: (l, { sql }) => sql`lower(${l.name}) = ${key}`,
  });
  if (existing) return existing.id;

  const [inserted] = await db.insert(schema.leagues)
    .values({ name: seed.name, country: seed.country, format: seed.format })
    .returning({ id: schema.leagues.id });
  console.log(`   🏆 League created: ${seed.name} (id=${inserted.id})`);
  return inserted.id;
}

async function upsertTeam(seed: TeamSeed, leagueId: number): Promise<number> {
  const key = normalize(seed.name);
  const existing = await db.query.teams.findFirst({
    where: (t, { sql }) => sql`lower(${t.name}) = ${key}`,
  });
  const teamId = existing?.id;

  if (!teamId) {
    const [inserted] = await db.insert(schema.teams)
      .values({ name: seed.name, aliases: seed.aliases ?? [] })
      .returning({ id: schema.teams.id });
    console.log(`   ⚽ Team created: ${seed.name} (id=${inserted.id})`);
    return inserted.id;
  }

  // Team already exists — make sure aliases are present (idempotent enrich).
  if (seed.aliases?.length && (!existing.aliases || existing.aliases.length === 0)) {
    await db.update(schema.teams).set({ aliases: seed.aliases }).where(eq(schema.teams.id, teamId));
  }
  return teamId;
}

async function ensureMembership(teamId: number, leagueId: number): Promise<void> {
  await db.insert(schema.teamLeagues)
    .values({ teamId, leagueId })
    .onConflictDoNothing();
}

async function main() {
  console.log('🌱 Seeding leagues & teams (2026 Argentine rosters)...\n');

  for (const league of LEAGUES) {
    console.log(`\n📌 ${league.name} (${league.country}, ${league.format}) — ${league.teams.length} teams`);
    const leagueId = await upsertLeague(league);

    for (const team of league.teams) {
      const teamId = await upsertTeam(team, leagueId);
      await ensureMembership(teamId, leagueId);

      if (team.logoUrl) {
        const logo = await imageService.downloadAndStore(team.logoUrl, teamId);
        if (logo) {
          await db.update(schema.teams).set({ logo }).where(eq(schema.teams.id, teamId));
          console.log(`      🛡️  shield: ${logo}`);
        }
      }
    }
  }

  const totalTeams = await db.select({ count: sql<number>`count(*)::int` }).from(schema.teams);
  const totalMemberships = await db.select({ count: sql<number>`count(*)::int` }).from(schema.teamLeagues);
  console.log('\n────────────────────────────────────────');
  console.log('✅ League/team seed completed');
  console.log(`   Leagues:     ${LEAGUES.length}`);
  console.log(`   Teams:       ${totalTeams[0].count}`);
  console.log(`   Memberships: ${totalMemberships[0].count}`);
  console.log('────────────────────────────────────────\n');

  await queryClient.end();
}

main().catch((err) => {
  console.error('❌ League/team seed failed:', err);
  process.exit(1);
});
