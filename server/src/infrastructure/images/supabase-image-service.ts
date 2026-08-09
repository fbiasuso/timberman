import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImageService } from '../../domain/ports/image-service.js';
import {
  downloadBytes,
  EXTENSIONS,
  MAX_IMAGE_BYTES,
  sniffImageType,
  type ImageType,
  type Logger,
} from './image-validation.js';

/** Bucket holding team shields (must exist and be public — see proposal). */
const DEFAULT_BUCKET = 'logos';

/** Content-Type per sniffed type — sent to Supabase so the object is served correctly. */
const MIME_TYPES: Record<ImageType, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * Supabase Storage team shield pipeline (design D2).
 *
 * Mirrors `LocalFileImageService`: both port methods share the validated
 * write path (1 MiB cap → magic-byte sniff → upload to bucket `logos` →
 * return the full public URL). `downloadAndStore` downloads first, then
 * delegates to `storeFromBuffer` — one write path for uploads, downloads
 * and seeding (spec "Buffer Store Operation").
 *
 * Upload semantics: `upsert: true` replaces a previous object for the same
 * team (no orphans, mirrors the local adapter's overwrite); `cacheControl:
 * '30d'` yields Cache-Control max-age=30d WITHOUT immutable, so browsers
 * revalidate after a re-upload (spec "Shield Serving").
 *
 * Port contract: NEVER throws. Every failure (unreachable, invalid MIME,
 * oversized, upload error) is caught, logged and reported as `null`.
 */
export class SupabaseImageService implements ImageService {
  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger = console,
    private readonly bucket: string = DEFAULT_BUCKET,
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

      const fileName = `team-${teamId}.${EXTENSIONS[type]}`;
      const { error } = await this.client.storage
        .from(this.bucket)
        .upload(fileName, bytes, {
          contentType: MIME_TYPES[type],
          cacheControl: '30d',
          upsert: true,
        });

      if (error) {
        this.logger.error?.({ err: error, teamId, bucket: this.bucket }, 'Team shield upload to Supabase failed');
        return null;
      }

      const { data } = this.client.storage.from(this.bucket).getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) {
      this.logger.error?.({ err, teamId }, 'Team shield store failed');
      return null;
    }
  }
}
