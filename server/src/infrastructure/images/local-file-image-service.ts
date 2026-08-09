import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ImageService } from '../../domain/ports/image-service.js';

// ── Constants ─────────────────────────────────────────────────────

/** Hard cap on shield file size — anything larger is rejected (design D6). */
export const MAX_IMAGE_BYTES = 1024 * 1024; // 1 MiB

/** Download timeout — the shield must arrive fast or the team proceeds without a logo. */
export const DOWNLOAD_TIMEOUT_MS = 10_000;

/** Minimal logger surface the service needs (fastify's logger fits it). */
interface Logger {
  warn?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
  info?: (obj: unknown, msg?: string) => void;
}

type ImageType = 'png' | 'jpg' | 'webp';

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

const EXTENSIONS: Record<ImageType, string> = {
  png: 'png',
  jpg: 'jpg',
  webp: 'webp',
};

// ── Service ────────────────────────────────────────────────────────

/**
 * Self-hosted team shield pipeline (design D5/D6).
 *
 * Download once (global fetch, 10s timeout) → size cap (1 MiB) → magic-byte
 * sniff (PNG/JPEG/WebP) → write `public/logos/{teamId}.{ext}` → return the
 * relative path.
 *
 * Port contract: NEVER throws. Every failure (unreachable, timeout, invalid
 * MIME, oversized, write error) is caught, logged and reported as `null` so
 * team creation/seeding is never blocked by a bad image.
 */
export class LocalFileImageService implements ImageService {
  constructor(
    private readonly logosDir: string,
    private readonly logger: Logger = console,
  ) {}

  async downloadAndStore(sourceUrl: string, teamId: number): Promise<string | null> {
    try {
      const bytes = await this.download(sourceUrl);
      if (bytes === null) return null;

      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        this.logger.warn?.(
          { teamId, bytes: bytes.byteLength, max: MAX_IMAGE_BYTES },
          'Team shield rejected: image exceeds the size cap',
        );
        return null;
      }

      const type = sniffImageType(new Uint8Array(bytes));
      if (!type) {
        this.logger.warn?.(
          { teamId, url: sourceUrl },
          'Team shield rejected: unrecognized image format (must be PNG, JPEG or WebP)',
        );
        return null;
      }

      const fileName = `${teamId}.${EXTENSIONS[type]}`;
      const target = path.join(this.logosDir, fileName);
      await fs.mkdir(this.logosDir, { recursive: true });
      await fs.writeFile(target, Buffer.from(bytes));

      return `logos/${fileName}`;
    } catch (err) {
      this.logger.error?.({ err, teamId, url: sourceUrl }, 'Team shield download/store failed');
      return null;
    }
  }

  /** Fetch the payload; returns null (logged) on any network failure. */
  private async download(sourceUrl: string): Promise<ArrayBuffer | null> {
    let response: Response;
    try {
      response = await fetch(sourceUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    } catch (err) {
      this.logger.warn?.({ err, url: sourceUrl }, 'Team shield download failed (network/timeout)');
      return null;
    }

    if (!response.ok) {
      this.logger.warn?.(
        { url: sourceUrl, status: response.status },
        'Team shield download failed: non-2xx response',
      );
      return null;
    }

    try {
      return await response.arrayBuffer();
    } catch (err) {
      this.logger.warn?.({ err, url: sourceUrl }, 'Team shield download failed: body read error');
      return null;
    }
  }
}
