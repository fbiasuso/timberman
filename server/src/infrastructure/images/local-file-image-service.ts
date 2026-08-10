import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ImageService } from '../../domain/ports/image-service.js';
import {
  downloadBytes,
  EXTENSIONS,
  MAX_IMAGE_BYTES,
  sniffImageType,
  type Logger,
} from './image-validation.js';

// Re-export the shared validation so existing imports/tests keep working.
export { sniffImageType, MAX_IMAGE_BYTES, DOWNLOAD_TIMEOUT_MS } from './image-validation.js';

// ── Service ────────────────────────────────────────────────────────

/**
 * Self-hosted team shield pipeline (design D1/D5/D6).
 *
 * Both port methods share the validated write path: 1 MiB size cap →
 * magic-byte sniff (PNG/JPEG/WebP) → write `public/logos/{teamId}.{ext}` →
 * return the relative path. `downloadAndStore` downloads first, then
 * delegates to `storeFromBuffer`.
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
      const bytes = await downloadBytes(sourceUrl, this.logger);
      if (bytes === null) return null;
      return await this.storeFromBuffer(bytes, teamId);
    } catch (err) {
      this.logger.error?.({ err, teamId, url: sourceUrl }, 'Team shield download/store failed');
      return null;
    }
  }

  async storeFromBuffer(bytes: Uint8Array, teamId: number): Promise<string | null> {
    try {
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        this.logger.warn?.(
          { teamId, bytes: bytes.byteLength, max: MAX_IMAGE_BYTES },
          'Team shield rejected: image exceeds the size cap',
        );
        return null;
      }

      const type = sniffImageType(bytes);
      if (!type) {
        this.logger.warn?.(
          { teamId },
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
      this.logger.error?.({ err, teamId }, 'Team shield store failed');
      return null;
    }
  }
}
