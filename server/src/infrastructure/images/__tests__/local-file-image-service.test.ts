import { describe, it, expect } from 'vitest';
import { sniffImageType } from '../local-file-image-service.js';

function bytes(hex: string): Uint8Array {
  return new Uint8Array(hex.split(' ').map((b) => parseInt(b, 16)));
}

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
