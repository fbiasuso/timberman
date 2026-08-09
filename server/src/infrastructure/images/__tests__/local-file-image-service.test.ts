import { describe, it, expect, vi, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sniffImageType, LocalFileImageService, MAX_IMAGE_BYTES } from '../local-file-image-service.js';

function bytes(hex: string): Uint8Array {
  return new Uint8Array(hex.split(' ').map((b) => parseInt(b, 16)));
}

// A minimal valid PNG payload (magic bytes + a bit of data) — enough for
// size/mime checks; we never decode pixels in the service.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);

describe('sniffImageType', () => {
  it('detects PNG from magic bytes', () => {
    expect(sniffImageType(bytes('89 50 4E 47 0D 0A 1A 0A 00 00 00 0D'))).toBe('png');
  });

  it('detects JPEG from magic bytes', () => {
    expect(sniffImageType(bytes('FF D8 FF E0 00 10 4A 46 49 46'))).toBe('jpg');
  });

  it('detects WebP from RIFF/WEBP header', () => {
    expect(sniffImageType(bytes('52 49 46 46 24 00 00 00 57 45 42 50 56 50 38'))).toBe('webp');
  });

  it('rejects an HTML page even when served as image/*', () => {
    const html = new TextEncoder().encode('<!DOCTYPE html><html><body>not an image</body></html>');
    expect(sniffImageType(html)).toBeNull();
  });

  it('rejects truncated buffers', () => {
    expect(sniffImageType(bytes('89 50'))).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
  });

  it('rejects unknown binary content', () => {
    expect(sniffImageType(bytes('00 01 02 03 04 05 06 07 08 09'))).toBeNull();
  });
});

describe('LocalFileImageService.downloadAndStore', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  });

  async function makeService() {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'logos-'));
    const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    return { service: new LocalFileImageService(dir, logger), logger, dir };
  }

  it('downloads, validates and stores a PNG, returning the relative path', async () => {
    const { service } = await makeService();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from(PNG_BYTES), { status: 200 })));
    try {
      const logo = await service.downloadAndStore('https://example.com/shield.png', 7);
      expect(logo).toBe('logos/7.png');
      const stored = await fs.readFile(path.join(dir, '7.png'));
      expect(Buffer.from(stored)).toEqual(Buffer.from(PNG_BYTES));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('returns null on non-2xx response and does NOT throw', async () => {
    const { service, logger } = await makeService();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    try {
      await expect(service.downloadAndStore('https://example.com/missing.png', 7)).resolves.toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('returns null on network failure (timeout/abort) and does NOT throw', async () => {
    const { service, logger } = await makeService();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); }));
    try {
      await expect(service.downloadAndStore('https://example.com/slow.png', 7)).resolves.toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects an oversized image (returns null) without writing a file', async () => {
    const { service, logger, dir } = await makeService();
    const oversized = new Uint8Array(MAX_IMAGE_BYTES + 1);
    oversized.set(PNG_BYTES); // starts like an image, but too big
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from(oversized), { status: 200 })));
    try {
      await expect(service.downloadAndStore('https://example.com/big.png', 7)).resolves.toBeNull();
      expect(logger.warn).toHaveBeenCalled();
      await expect(fs.access(path.join(dir, '7.png'))).rejects.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects an HTML page served as image/* (returns null, no file written)', async () => {
    const { service, dir } = await makeService();
    const html = new TextEncoder().encode('<!DOCTYPE html><html><body>not an image</body></html>');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from(html), { status: 200, headers: { 'content-type': 'image/png' } })));
    try {
      await expect(service.downloadAndStore('https://example.com/evil.png', 7)).resolves.toBeNull();
      await expect(fs.access(path.join(dir, '7.png'))).rejects.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('stores JPEG and WebP with the right extensions', async () => {
    const { service, dir } = await makeService();
    const jpeg = bytes('FF D8 FF E0 00 10 4A 46 49 46');
    const webp = bytes('52 49 46 46 24 00 00 00 57 45 42 50 56 50 38');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = url.includes('jpeg') ? jpeg : webp;
      return new Response(Buffer.from(body), { status: 200 });
    }));
    try {
      await expect(service.downloadAndStore('https://example.com/a.jpeg', 1)).resolves.toBe('logos/1.jpg');
      await expect(service.downloadAndStore('https://example.com/b.webp', 2)).resolves.toBe('logos/2.webp');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
