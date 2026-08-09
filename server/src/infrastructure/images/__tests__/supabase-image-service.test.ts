import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseImageService } from '../supabase-image-service.js';
import { MAX_IMAGE_BYTES } from '../image-validation.js';

function bytes(hex: string): Uint8Array {
  return new Uint8Array(hex.split(' ').map((b) => parseInt(b, 16)));
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const JPEG_BYTES = bytes('FF D8 FF E0 00 10 4A 46 49 46');
const WEBP_BYTES = bytes('52 49 46 46 24 00 00 00 57 45 42 50 56 50 38');

const PUBLIC_URL = 'https://xyz.supabase.co/storage/v1/object/public/logos';

function makeClient() {
  const upload = vi.fn();
  const getPublicUrl = vi.fn();
  const from = vi.fn(() => ({ upload, getPublicUrl }));
  const client = { storage: { from } } as unknown as SupabaseClient;
  return { client, from, upload, getPublicUrl };
}

function makeService(client = makeClient()) {
  const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { service: new SupabaseImageService(client.client, logger), logger, ...client };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SupabaseImageService.storeFromBuffer', () => {
  it('uploads a valid PNG to bucket logos and returns the full public URL', async () => {
    const { service, from, upload, getPublicUrl } = makeService();
    upload.mockResolvedValue({ data: { path: 'team-7.png' }, error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: `${PUBLIC_URL}/team-7.png` } });

    const logo = await service.storeFromBuffer(PNG_BYTES, 7);

    expect(logo).toBe(`${PUBLIC_URL}/team-7.png`);
    expect(from).toHaveBeenCalledWith('logos');
    expect(upload).toHaveBeenCalledWith(
      'team-7.png',
      PNG_BYTES,
      { contentType: 'image/png', cacheControl: '30d', upsert: true },
    );
    expect(getPublicUrl).toHaveBeenCalledWith('team-7.png');
  });

  it('maps JPEG and WebP to the right content types and extensions', async () => {
    const { service, upload, getPublicUrl } = makeService();
    upload.mockResolvedValue({ data: { path: 'team-1.jpg' }, error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: `${PUBLIC_URL}/team-1.jpg` } });
    await expect(service.storeFromBuffer(JPEG_BYTES, 1)).resolves.toBe(`${PUBLIC_URL}/team-1.jpg`);
    expect(upload).toHaveBeenCalledWith('team-1.jpg', JPEG_BYTES, expect.objectContaining({ contentType: 'image/jpeg' }));

    upload.mockResolvedValue({ data: { path: 'team-2.webp' }, error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: `${PUBLIC_URL}/team-2.webp` } });
    await expect(service.storeFromBuffer(WEBP_BYTES, 2)).resolves.toBe(`${PUBLIC_URL}/team-2.webp`);
    expect(upload).toHaveBeenCalledWith('team-2.webp', WEBP_BYTES, expect.objectContaining({ contentType: 'image/webp' }));
  });

  it('uses upsert and 30d non-immutable cacheControl (re-upload replaces, browsers revalidate)', async () => {
    const { service, upload, getPublicUrl } = makeService();
    upload.mockResolvedValue({ data: { path: 'team-7.png' }, error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: `${PUBLIC_URL}/team-7.png` } });
    await service.storeFromBuffer(PNG_BYTES, 7);
    expect(upload).toHaveBeenCalledWith('team-7.png', PNG_BYTES, expect.objectContaining({ cacheControl: '30d', upsert: true }));
  });

  it('rejects an oversized buffer (null) without calling upload', async () => {
    const { service, logger, upload } = makeService();
    const oversized = new Uint8Array(MAX_IMAGE_BYTES + 1);
    oversized.set(PNG_BYTES);

    await expect(service.storeFromBuffer(oversized, 7)).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('rejects non-image bytes (null) without calling upload', async () => {
    const { service, logger, upload } = makeService();
    const html = new TextEncoder().encode('<!DOCTYPE html><html><body>not an image</body></html>');

    await expect(service.storeFromBuffer(html, 7)).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('returns null when the upload fails and logs the error', async () => {
    const { service, logger, upload } = makeService();
    upload.mockResolvedValue({ data: null, error: { message: 'Bucket logos not found' } });

    await expect(service.storeFromBuffer(PNG_BYTES, 7)).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns null when upload throws and never throws back', async () => {
    const { service, logger, upload } = makeService();
    upload.mockRejectedValue(new Error('network down'));

    await expect(service.storeFromBuffer(PNG_BYTES, 7)).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('SupabaseImageService.downloadAndStore', () => {
  it('downloads, validates and stores through the same write path, returning the public URL', async () => {
    const { service, upload, getPublicUrl } = makeService();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from(PNG_BYTES), { status: 200 })));
    upload.mockResolvedValue({ data: { path: 'team-7.png' }, error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: `${PUBLIC_URL}/team-7.png` } });

    const logo = await service.downloadAndStore('https://example.com/shield.png', 7);

    expect(logo).toBe(`${PUBLIC_URL}/team-7.png`);
    expect(upload).toHaveBeenCalledWith('team-7.png', PNG_BYTES, expect.anything());
  });

  it('returns null on download failure without calling upload', async () => {
    const { service, logger, upload } = makeService();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); }));

    await expect(service.downloadAndStore('https://example.com/slow.png', 7)).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('returns null on invalid downloaded content without calling upload', async () => {
    const { service, upload } = makeService();
    const html = new TextEncoder().encode('<!DOCTYPE html><html><body>not an image</body></html>');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from(html), { status: 200 })));

    await expect(service.downloadAndStore('https://example.com/evil.png', 7)).resolves.toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });
});
