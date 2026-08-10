// ── Constants ─────────────────────────────────────────────────────

/** Hard cap on shield file size — anything larger is rejected (design D1/D6). */
export const MAX_IMAGE_BYTES = 1024 * 1024; // 1 MiB

/** Download timeout — the shield must arrive fast or the team proceeds without a logo. */
export const DOWNLOAD_TIMEOUT_MS = 10_000;

/**
 * Descriptive User-Agent sent on every Wikimedia/TheSportsDB shield
 * request — Wikipedia throttles or blocks anonymous, UA-less traffic.
 * Shared by the shield resolver (API lookups) and the image downloader
 * (upload.wikimedia.org payloads) so both agree on a single identity.
 */
export const SHIELD_USER_AGENT = 'timberman-shield-seed/1.0 (https://github.com/fbiasuso/timberman)';

/** Minimal logger surface the image services need (fastify's logger fits it). */
export interface Logger {
  warn?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
  info?: (obj: unknown, msg?: string) => void;
}

export type ImageType = 'png' | 'jpg' | 'webp';

/** File extension per sniffed type — the on-disk/object key suffix. */
export const EXTENSIONS: Record<ImageType, string> = {
  png: 'png',
  jpg: 'jpg',
  webp: 'webp',
};

// ── Magic-byte sniffing (pure, exported for unit tests) ───────────

/**
 * Sniff the image type from the leading bytes — NEVER trust the URL
 * extension or the Content-Type header (design D6: an HTML page served as
 * image/* must be rejected).
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }

  // WebP: RIFF (52 49 46 46) .... WEBP (57 45 42 50) at offset 8
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

// ── Download helper (shared by every adapter) ─────────────────────

/** Statuses that trigger retry-with-backoff — Wikimedia throttles 429/503. */
const RETRYABLE_STATUSES = new Set([429, 503]);

/** Max retries per download on a retryable status (total attempts = 1 + retries). */
const IMAGE_DOWNLOAD_MAX_RETRIES = 3;

/** Backoff waits between retries (ms) — 1s, 2s, 4s (exponential). */
const IMAGE_DOWNLOAD_BACKOFF_MS = [1_000, 2_000, 4_000];

/** Upper bound for a single Retry-After wait (ms) — never stall a run on a hostile header. */
const MAX_RETRY_AFTER_MS = 10_000;

/** Additive tuning knobs for the download retry loop (tests keep waits fast). */
export interface ImageDownloadOptions {
  /** Retries on 429/503 before treating the download as a failure (default 3). */
  maxRetries?: number;
  /** Backoff waits between retries in ms (default 1s, 2s, 4s) — injectable so tests stay fast. */
  retryBackoffMs?: readonly number[];
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
 * Fetch the payload with the 10s timeout; returns null (logged) on any
 * network failure (unreachable, non-2xx, body read error). NEVER throws.
 *
 * Rate-limit hardening (matches the shield resolver): 429/503 responses are
 * retried up to `maxRetries` times (default 3) with exponential backoff
 * (1s, 2s, 4s), honoring `Retry-After` (clamped to 10s per wait) —
 * upload.wikimedia.org throttles anonymous traffic mid-seed. Other
 * non-2xx statuses fail the call immediately. Every attempt carries the
 * descriptive User-Agent shared with the resolver.
 */
export async function downloadBytes(
  url: string,
  logger: Logger,
  options: ImageDownloadOptions = {},
): Promise<Uint8Array | null> {
  const maxRetries = options.maxRetries ?? IMAGE_DOWNLOAD_MAX_RETRIES;
  const retryBackoffMs = options.retryBackoffMs ?? IMAGE_DOWNLOAD_BACKOFF_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        headers: { 'User-Agent': SHIELD_USER_AGENT },
      });
    } catch (err) {
      logger.warn?.({ err, url }, 'Team shield download failed (network/timeout)');
      return null;
    }

    if (response.ok) {
      try {
        return new Uint8Array(await response.arrayBuffer());
      } catch (err) {
        logger.warn?.({ err, url }, 'Team shield download failed: body read error');
        return null;
      }
    }

    // Non-retryable status, or retries exhausted → fail this call (current behavior).
    if (!RETRYABLE_STATUSES.has(response.status) || attempt >= maxRetries) {
      logger.warn?.({ url, status: response.status }, 'Team shield download failed: non-2xx response');
      return null;
    }

    // Retry-After (clamped) beats the schedule backoff.
    logger.warn?.(
      { url, status: response.status, attempt: attempt + 1, maxRetries },
      'Team shield download rate-limited; retrying with backoff',
    );
    await sleep(retryAfterMs(response) ?? retryBackoffMs[attempt] ?? retryBackoffMs[retryBackoffMs.length - 1]);
  }
  return null; // unreachable — kept for the never-throws contract
}
