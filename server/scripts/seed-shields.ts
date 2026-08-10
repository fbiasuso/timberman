/**
 * seed-shields.ts
 *
 * Idempotent shield population for the seeded teams (design D5, spec
 * "Seed Shields Population"). Thin entry: wires env → DB → factory-built
 * image service and delegates the per-team orchestration to
 * `runShieldSeed` (src/infrastructure/shields/seed-shields-run.ts, unit
 * tested there).
 *
 * For every team without a logo (ALL teams with `--force`):
 *   1. resolve a shield source URL — Wikimedia es.wikipedia.org pageimages
 *      (primary; team name → DB aliases → "Club Atlético {name}") with
 *      TheSportsDB strTeamBadge as fallback;
 *   2. download + store through the active image storage backend (local
 *      public/logos or Supabase bucket `logos`, selected by IMAGE_STORAGE);
 *   3. persist teams.logo with the resolved value.
 *
 * Re-runs skip teams that already have a logo unless `--force` is passed.
 * Unresolvable teams are listed in the summary for manual curation — the
 * script still exits 0 (the unresolved list IS the report).
 *
 * With `--dry-run` the script previews what a real run WOULD do: shield
 * URLs are still resolved for every eligible team (so the report shows
 * what would be found), but NOTHING is downloaded, stored, or persisted —
 * no files written, no DB writes. Pairs with `--force` to preview a full
 * re-resolve. The dry-run summary reports a `wouldStore` count instead of
 * `stored`; `storeFailed` is always empty in dry-run (no store attempted).
 *
 * Usage:
 *   npx tsx server/scripts/seed-shields.ts [--force] [--dry-run]
 *
 * Env:
 *   DATABASE_URL                    required
 *   IMAGE_STORAGE / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   optional, via the image-service factory
 *   THESPORTDB_API_KEY              optional TheSportsDB key override
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as schema from '../src/infrastructure/db/schema.js';
import { createImageService } from '../src/infrastructure/images/image-service-factory.js';
import {
  runShieldSeed,
  type ShieldSeedDb,
} from '../src/infrastructure/shields/seed-shields-run.js';

/** Default pacing between teams (design D5, ~300ms — tune if 429s appear). */
const DEFAULT_DELAY_MS = 300;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');
  const queryClient = postgres(databaseUrl);
  const db = drizzle(queryClient, { schema });

  const logosDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'logos');
  const imageService = createImageService({ logosDir, logger: console });

  const dbAdapter: ShieldSeedDb = {
    listTeams: async () =>
      db
        .select({
          id: schema.teams.id,
          name: schema.teams.name,
          aliases: schema.teams.aliases,
          logo: schema.teams.logo,
        })
        .from(schema.teams),
    setLogo: async (teamId, logo) => {
      await db.update(schema.teams).set({ logo }).where(eq(schema.teams.id, teamId));
    },
  };

  if (dryRun) {
    console.log('⚠️  DRY RUN — no data will be written. Preview only.\n');
  }
  console.log(
    `🛡️  Seeding team shields${force ? ' (--force: re-resolving every team)' : ' (skipping teams with a logo)'}${dryRun ? ' (--dry-run: preview only)' : ''}...\n`,
  );

  const summary = await runShieldSeed({
    db: dbAdapter,
    imageService,
    force,
    dryRun,
    delayMs: DEFAULT_DELAY_MS,
  });

  console.log('\n────────────────────────────────────────');
  console.log(`✅ Shield seed completed${dryRun ? ' (dry-run — nothing was written)' : ''}`);
  console.log(`   Teams processed:    ${summary.total}`);
  if (dryRun) {
    console.log(`   Would store:        ${summary.wouldStore ?? 0}`);
  } else {
    console.log(`   Stored:             ${summary.stored}`);
  }
  console.log(`   Skipped (has logo): ${summary.skipped}`);
  if (summary.unresolved.length > 0) {
    console.log(`   Unresolved (${summary.unresolved.length}) — for manual curation:`);
    for (const name of summary.unresolved) console.log(`     - ${name}`);
  }
  if (summary.storeFailed.length > 0) {
    console.log(`   Store failed (${summary.storeFailed.length}) — source found but no valid image:`);
    for (const name of summary.storeFailed) console.log(`     - ${name}`);
  }
  console.log('────────────────────────────────────────\n');

  await queryClient.end();
}

// Run only when executed directly (import-safe).
const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error('❌ Shield seed failed:', err);
    process.exit(1);
  });
}
