import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LocalFileImageService } from './local-file-image-service.js';
import { SupabaseImageService } from './supabase-image-service.js';
import type { Logger } from './image-validation.js';

export type ImageStorageBackend = 'local' | 'supabase';

export interface CreateImageServiceOptions {
  /** Backend to use — falls back to `IMAGE_STORAGE` env, then `local`. */
  storage?: ImageStorageBackend | string;
  /** Falls back to `SUPABASE_URL` env. */
  supabaseUrl?: string;
  /** Falls back to `SUPABASE_SERVICE_ROLE_KEY` env. */
  supabaseServiceRoleKey?: string;
  /** Local adapter target directory (relative `logos/` results are served from here). */
  logosDir: string;
  logger: Logger;
}

function readStorage(storage?: string): ImageStorageBackend {
  const value = (storage ?? process.env.IMAGE_STORAGE ?? 'local').toLowerCase();
  return value === 'supabase' ? 'supabase' : 'local';
}

function readSupabaseUrl(url?: string): string | undefined {
  return url ?? process.env.SUPABASE_URL;
}

function readServiceRoleKey(key?: string): string | undefined {
  return key ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function buildSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Build the image service for the active storage backend (design D2).
 *
 * Selection:
 * - `IMAGE_STORAGE=supabase` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
 *   → `SupabaseImageService` on bucket `logos`.
 * - anything else (unset, `local`, or `supabase` with missing credentials)
 *   → `LocalFileImageService` writing under `logosDir`.
 *
 * Fail-soft (spec "Storage Backend Selection"): an invalid `supabase`
 * configuration — missing URL or service-role key — logs a clear error and
 * falls back to the local adapter instead of crashing the server.
 */
export function createImageService(options: CreateImageServiceOptions): LocalFileImageService | SupabaseImageService {
  const { logosDir, logger } = options;
  const storage = readStorage(options.storage);
  const supabaseUrl = readSupabaseUrl(options.supabaseUrl);
  const supabaseServiceRoleKey = readServiceRoleKey(options.supabaseServiceRoleKey);

  if (storage === 'supabase') {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      logger.error?.(
        {
          storage: 'supabase',
          hasUrl: Boolean(supabaseUrl),
          hasKey: Boolean(supabaseServiceRoleKey),
        },
        'IMAGE_STORAGE=supabase but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing — falling back to local image storage',
      );
      return new LocalFileImageService(logosDir, logger);
    }
    return new SupabaseImageService(buildSupabaseClient(supabaseUrl, supabaseServiceRoleKey), logger);
  }

  return new LocalFileImageService(logosDir, logger);
}
