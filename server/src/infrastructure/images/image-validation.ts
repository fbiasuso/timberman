// ── Constants ─────────────────────────────────────────────────────

/** Hard cap on shield file size — anything larger is rejected (design D1/D6). */
export const MAX_IMAGE_BYTES = 1024 * 1024; // 1 MiB

/** Download timeout — the shield must arrive fast or the team proceeds without a logo. */
export const DOWNLOAD_TIMEOUT_MS = 10_000;

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

/**
 * Fetch the payload with the 10s timeout; returns null (logged) on any
 * network failure (unreachable, non-2xx, body read error). NEVER throws.
 */
export async function downloadBytes(url: string, logger: Logger): Promise<Uint8Array | null> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  } catch (err) {
    logger.warn?.({ err, url }, 'Team shield download failed (network/timeout)');
    return null;
  }

  if (!response.ok) {
    logger.warn?.(
      { url, status: response.status },
      'Team shield download failed: non-2xx response',
    );
    return null;
  }

  try {
    return new Uint8Array(await response.arrayBuffer());
  } catch (err) {
    logger.warn?.({ err, url }, 'Team shield download failed: body read error');
    return null;
  }
}
