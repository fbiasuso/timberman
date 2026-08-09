import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createImageService } from '../image-service-factory.js';
import { LocalFileImageService } from '../local-file-image-service.js';
import { SupabaseImageService } from '../supabase-image-service.js';

const LOGGER = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };

// Each test starts from a clean env so the factory's env fallbacks are deterministic.
beforeEach(() => {
  vi.stubEnv('IMAGE_STORAGE', undefined);
  vi.stubEnv('SUPABASE_URL', undefined);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createImageService', () => {
  it('defaults to the local adapter when nothing is set', () => {
    const service = createImageService({ logosDir: '/tmp/logos', logger: LOGGER });
    expect(service).toBeInstanceOf(LocalFileImageService);
    expect(service).not.toBeInstanceOf(SupabaseImageService);
  });

  it('returns the local adapter for storage=local even when supabase creds exist', () => {
    const service = createImageService({
      storage: 'local',
      supabaseUrl: 'https://xyz.supabase.co',
      supabaseServiceRoleKey: 'secret',
      logosDir: '/tmp/logos',
      logger: LOGGER,
    });
    expect(service).toBeInstanceOf(LocalFileImageService);
  });

  it('returns the supabase adapter when storage=supabase with valid credentials', () => {
    const service = createImageService({
      storage: 'supabase',
      supabaseUrl: 'https://xyz.supabase.co',
      supabaseServiceRoleKey: 'service-role-key',
      logosDir: '/tmp/logos',
      logger: LOGGER,
    });
    expect(service).toBeInstanceOf(SupabaseImageService);
    expect(service).not.toBeInstanceOf(LocalFileImageService);
  });

  it('fails soft to local with a clear error log when supabase credentials are missing', () => {
    const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    const service = createImageService({
      storage: 'supabase',
      supabaseUrl: undefined,
      supabaseServiceRoleKey: undefined,
      logosDir: '/tmp/logos',
      logger,
    });
    expect(service).toBeInstanceOf(LocalFileImageService);
    expect(logger.error).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('falling back to local image storage'),
    );
  });

  it('fails soft to local when only the URL is missing', () => {
    const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    const service = createImageService({
      storage: 'supabase',
      supabaseServiceRoleKey: 'service-role-key',
      logosDir: '/tmp/logos',
      logger,
    });
    expect(service).toBeInstanceOf(LocalFileImageService);
    expect(logger.error).toHaveBeenCalled();
  });

  it('reads IMAGE_STORAGE=supabase plus credentials from the environment', () => {
    vi.stubEnv('IMAGE_STORAGE', 'supabase');
    vi.stubEnv('SUPABASE_URL', 'https://xyz.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');

    const service = createImageService({ logosDir: '/tmp/logos', logger: LOGGER });
    expect(service).toBeInstanceOf(SupabaseImageService);
  });

  it('fails soft to local when env says supabase but credentials are missing', () => {
    vi.stubEnv('IMAGE_STORAGE', 'supabase');
    const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };

    const service = createImageService({ logosDir: '/tmp/logos', logger });
    expect(service).toBeInstanceOf(LocalFileImageService);
    expect(logger.error).toHaveBeenCalled();
  });

  it('treats an unknown IMAGE_STORAGE value as local', () => {
    vi.stubEnv('IMAGE_STORAGE', 's3');
    const service = createImageService({ logosDir: '/tmp/logos', logger: LOGGER });
    expect(service).toBeInstanceOf(LocalFileImageService);
  });
});
