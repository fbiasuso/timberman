/**
 * seed-shields run orchestration (design D5, spec "Seed Shields Population").
 *
 * Lives under `src/` — not in the `scripts/` entry — so vitest
 * (`src/**\/*.test.ts`) and tsc (`rootDir: src`) can reach it for unit
 * testing. The entry script `scripts/seed-shields.ts` stays thin: env → DB →
 * factory-built image service → `runShieldSeed` → summary.
 *
 * Flow per team (skip teams with a logo unless `force`):
 *   1. resolve a shield source URL (resolver: Wikimedia → TheSportsDB);
 *   2. download + store through the injected image service (validated
 *      write path — 1 MiB cap + magic-byte sniff);
 *   3. persist `teams.logo` with the resolved value.
 * Unresolvable teams are reported in the summary — the run never throws on
 * them (spec "Unresolved reported") and the caller exits 0 (the list IS the
 * report).
 */

import type { ImageService } from '../../domain/ports/image-service.js';
import { resolveShieldUrl } from './shield-resolver.js';

// ── Types ─────────────────────────────────────────────────────────

export interface SeedTeamRow {
  id: number;
  name: string;
  aliases: string[] | null;
  logo: string | null;
}

export interface ShieldSeedDb {
  /** All teams in the registry — the run decides skip-vs-process from `logo`. */
  listTeams(): Promise<SeedTeamRow[]>;
  /** Persist the resolved logo value. */
  setLogo(teamId: number, logo: string): Promise<void>;
}

export interface ShieldSeedSummary {
  total: number;
  stored: number;
  skipped: number;
  /** Teams with no resolvable shield source — for manual curation. */
  unresolved: string[];
  /** Teams whose source resolved but the store rejected/failed the image. */
  storeFailed: string[];
}

export interface RunShieldSeedOptions {
  db: ShieldSeedDb;
  imageService: Pick<ImageService, 'downloadAndStore'>;
  /** Shield source resolution — injectable for tests. */
  resolveShield?: (name: string, aliases: string[] | null) => Promise<string | null>;
  /** Re-resolve/re-store even for teams that already have a logo. */
  force?: boolean;
  /** Pacing between teams in ms (0 disables) — Wikimedia/TheSportsDB rate limits. */
  delayMs?: number;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Default pacing between teams (design D5, ~300ms — tune if 429s appear). */
const DEFAULT_DELAY_MS = 300;

// ── Orchestration ─────────────────────────────────────────────────

/**
 * Seed shields for the whole registry. Skips teams with a logo unless
 * `force`; reports stored/skipped/unresolved/storeFailed counts and names.
 */
export async function runShieldSeed(options: RunShieldSeedOptions): Promise<ShieldSeedSummary> {
  const {
    db,
    imageService,
    resolveShield = (name: string, aliases: string[] | null) => resolveShieldUrl(name, aliases ?? []),
    force = false,
    delayMs = DEFAULT_DELAY_MS,
    logger = console,
  } = options;

  const teams = await db.listTeams();
  const summary: ShieldSeedSummary = {
    total: teams.length,
    stored: 0,
    skipped: 0,
    unresolved: [],
    storeFailed: [],
  };

  for (const team of teams) {
    if (team.logo && !force) {
      summary.skipped += 1;
      continue;
    }

    const sourceUrl = await resolveShield(team.name, team.aliases);
    if (!sourceUrl) {
      summary.unresolved.push(team.name);
    } else {
      const logo = await imageService.downloadAndStore(sourceUrl, team.id);
      if (!logo) {
        summary.storeFailed.push(team.name);
      } else {
        await db.setLogo(team.id, logo);
        summary.stored += 1;
        logger.log(`   🛡️  ${team.name} → ${logo}`);
      }
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  return summary;
}
