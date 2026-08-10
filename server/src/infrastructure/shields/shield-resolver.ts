/**
 * Shield source resolver for the seed-shields script (design D5, spec
 * "Seed Shields Population").
 *
 * Pure module: the only I/O goes through an injectable `fetchFn`, so the
 * whole Wikimedia → TheSportsDB resolution flow is unit-testable without
 * network access (vitest only picks up `src/**\/*.test.ts`, so this logic
 * lives here instead of inside the script).
 *
 * Resolution order per team:
 *   1. PRIMARY — Wikimedia es.wikipedia.org `pageimages` (pithumbsize 256):
 *      queried for the direct name, then each DB alias, then the common
 *      "Club Atlético {name}" and "Club {name}" page-title forms
 *      (redirects=1 resolves page aliases server-side). First page with a
 *      thumbnail wins.
 *   2. FALLBACK — TheSportsDB `searchteams.php?t={name}` → `strTeamBadge`
 *      (full URL, stored as-is).
 *   3. Both miss (or fail) → null; the caller reports the team as
 *      unresolved. The resolver NEVER throws.
 *
 * Rate-limit hardening (Wikipedia throttles anonymous traffic mid-run):
 *   - every request sends a descriptive User-Agent (SHIELD_USER_AGENT,
 *     shared with the image downloader in image-validation.ts);
 *   - 429/503 responses are retried up to `maxRetries` times (default 3)
 *     with exponential backoff (1s, 2s, 4s), honoring `Retry-After`
 *     (clamped to 10s per wait) before giving up.
 */

import { DOWNLOAD_TIMEOUT_MS, SHIELD_USER_AGENT } from '../images/image-validation.js';

/** Pacing between external API attempts — Wikimedia/TheSportsDB rate limits (design D5). */
export const SHIELD_RESOLVER_DELAY_MS = 1000;

/**
 * Backward-compatible alias for the shared User-Agent constant — its home
 * is image-validation.ts so the resolver and the image downloader agree.
 */
export { SHIELD_USER_AGENT as SHIELD_RESOLVER_USER_AGENT } from '../images/image-validation.js';

/** Statuses that trigger retry-with-backoff — Wikimedia/TheSportsDB rate limits. */
const RETRYABLE_STATUSES = new Set([429, 503]);

/** Max retries per URL on a retryable status (total attempts = 1 + retries). */
const SHIELD_RESOLVER_MAX_RETRIES = 3;

/** Backoff waits between retries (ms) — 1s, 2s, 4s (exponential). */
const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000];

/** Upper bound for a single Retry-After wait (ms) — never stall the run on a hostile header. */
const MAX_RETRY_AFTER_MS = 10_000;

/** TheSportsDB free-tier API key — overridable via env THESPORTDB_API_KEY. */
const THESPORTDB_DEFAULT_KEY = '3';

/** The fetch surface the resolver needs — loose enough for easy mocking. */
export type ShieldFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface ShieldResolverOptions {
  /** fetch-compatible function (injectable for tests; defaults to global fetch). */
  fetchFn?: ShieldFetch;
  /** TheSportsDB API key — falls back to THESPORTDB_API_KEY env, then the free key. */
  theSportsDbKey?: string;
  /** Pacing between external API attempts in ms (0 disables — tests use it). */
  delayMs?: number;
  /** Retries on 429/503 before treating the request as a miss (default 3). */
  maxRetries?: number;
  /** Backoff waits between retries in ms (default 1s, 2s, 4s) — injectable so tests stay fast. */
  retryBackoffMs?: readonly number[];
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function buildWikimediaUrl(title: string): string {
  return (
    'https://es.wikipedia.org/w/api.php' +
    '?action=query&format=json&redirects=1' +
    '&prop=pageimages&piprop=thumbnail&pithumbsize=256' +
    `&titles=${encodeURIComponent(title)}`
  );
}

function buildTheSportsDbUrl(name: string, key: string): string {
  return `https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php?t=${encodeURIComponent(name)}`;
}

/**
 * Candidate page titles for a team: the direct name, then the DB aliases,
 * then the common "Club Atlético {name}" and "Club {name}" page-title
 * forms (Wikipedia redirects cover the rest). Deduped, empties removed.
 */
export function buildCandidateTitles(name: string, aliases: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const title of [name, ...aliases, `Club Atlético ${name}`, `Club ${name}`]) {
    const trimmed = title.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    candidates.push(trimmed);
  }
  return candidates;
}

interface FetchJsonRetry {
  /** Retries on 429/503 before treating the request as a miss. */
  maxRetries: number;
  /** Backoff waits between retries in ms (index = retry number). */
  retryBackoffMs: readonly number[];
}

/**
 * `Retry-After` as ms, clamped to MAX_RETRY_AFTER_MS; null when absent or
 * not a non-negative delta-seconds value (HTTP-date form falls back to the
 * schedule backoff).
 */
function retryAfterMs(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (header === null || header.trim() === '') return null;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
}

/**
 * GET + JSON parse with the shared 10s timeout. 429/503 responses are
 * retried up to `maxRetries` times with exponential backoff (honoring
 * `Retry-After`, clamped to 10s per wait). Any other failure → null
 * (never throws). Every attempt carries the descriptive User-Agent — this
 * is the single place the header is attached, so both the default fetchFn
 * and injected test fetchFns see it in `init`.
 */
async function fetchJson(fetchFn: ShieldFetch, url: string, retry: FetchJsonRetry): Promise<unknown | null> {
  const { maxRetries, retryBackoffMs } = retry;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response: Response;
    try {
      response = await fetchFn(url, {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        headers: { 'User-Agent': SHIELD_USER_AGENT },
      });
    } catch {
      return null; // network failure — a miss, never a throw
    }

    if (response.ok) {
      try {
        return await response.json();
      } catch {
        return null;
      }
    }

    // Non-retryable status, or retries exhausted → miss (current behavior).
    if (!RETRYABLE_STATUSES.has(response.status) || attempt >= maxRetries) {
      return null;
    }

    // Retry-After (clamped) beats the schedule backoff.
    await sleep(retryAfterMs(response) ?? retryBackoffMs[attempt] ?? retryBackoffMs[retryBackoffMs.length - 1]);
  }
  return null; // unreachable — kept for the never-throws contract
}

function thumbnailFromWikimedia(data: unknown): string | null {
  const pages = (data as { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } })?.query?.pages;
  if (!pages) return null;
  for (const key of Object.keys(pages)) {
    const source = pages[key]?.thumbnail?.source;
    if (typeof source === 'string' && source.length > 0) return source;
  }
  return null;
}

function badgeFromTheSportsDb(data: unknown): string | null {
  const teams = (data as { teams?: Array<{ strTeamBadge?: string }> | null })?.teams;
  if (!Array.isArray(teams)) return null;
  return teams.find((t) => typeof t?.strTeamBadge === 'string' && t.strTeamBadge.length > 0)?.strTeamBadge ?? null;
}

/**
 * Resolve a team shield source URL: Wikimedia thumbnail, else TheSportsDB
 * badge, else null. NEVER throws — network/parse failures behave as a miss
 * for that source and fall through to the next candidate/fallback.
 *
 * @param name    team name (primary Wikimedia title + TheSportsDB search)
 * @param aliases extra Wikimedia page-title candidates from the DB
 */
export async function resolveShieldUrl(
  name: string,
  aliases: readonly string[] = [],
  options: ShieldResolverOptions = {},
): Promise<string | null> {
  const fetchFn = options.fetchFn ?? ((url: string, init?: RequestInit) => fetch(url, init));
  const delayMs = options.delayMs ?? SHIELD_RESOLVER_DELAY_MS;
  const retry: FetchJsonRetry = {
    maxRetries: options.maxRetries ?? SHIELD_RESOLVER_MAX_RETRIES,
    retryBackoffMs: options.retryBackoffMs ?? RETRY_BACKOFF_MS,
  };

  for (const title of buildCandidateTitles(name, aliases)) {
    const thumbnail = thumbnailFromWikimedia(await fetchJson(fetchFn, buildWikimediaUrl(title), retry));
    if (thumbnail) return thumbnail;
    if (delayMs > 0) await sleep(delayMs);
  }

  if (delayMs > 0) await sleep(delayMs);
  const key = options.theSportsDbKey ?? process.env.THESPORTDB_API_KEY ?? THESPORTDB_DEFAULT_KEY;
  return badgeFromTheSportsDb(await fetchJson(fetchFn, buildTheSportsDbUrl(name, key), retry));
}
