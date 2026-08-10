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
 *      "Club Atlético {name}" page-title form (redirects=1 resolves page
 *      aliases server-side). First page with a thumbnail wins.
 *   2. FALLBACK — TheSportsDB `searchteams.php?t={name}` → `strTeamBadge`
 *      (full URL, stored as-is).
 *   3. Both miss (or fail) → null; the caller reports the team as
 *      unresolved. The resolver NEVER throws.
 */

import { DOWNLOAD_TIMEOUT_MS } from '../images/image-validation.js';

/** Pacing between external API attempts — Wikimedia/TheSportsDB rate limits (design D5). */
export const SHIELD_RESOLVER_DELAY_MS = 300;

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
 * then the common "Club Atlético {name}" page-title form (Wikipedia
 * redirects cover the rest). Deduped, empties removed.
 */
export function buildCandidateTitles(name: string, aliases: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const title of [name, ...aliases, `Club Atlético ${name}`]) {
    const trimmed = title.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    candidates.push(trimmed);
  }
  return candidates;
}

/** GET + JSON parse with the shared 10s timeout; null on any failure (never throws). */
async function fetchJson(fetchFn: ShieldFetch, url: string): Promise<unknown | null> {
  try {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
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

  for (const title of buildCandidateTitles(name, aliases)) {
    const thumbnail = thumbnailFromWikimedia(await fetchJson(fetchFn, buildWikimediaUrl(title)));
    if (thumbnail) return thumbnail;
    if (delayMs > 0) await sleep(delayMs);
  }

  if (delayMs > 0) await sleep(delayMs);
  const key = options.theSportsDbKey ?? process.env.THESPORTDB_API_KEY ?? THESPORTDB_DEFAULT_KEY;
  return badgeFromTheSportsDb(await fetchJson(fetchFn, buildTheSportsDbUrl(name, key)));
}
