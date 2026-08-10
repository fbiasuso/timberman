import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadBytes, SHIELD_USER_AGENT, type Logger } from '../image-validation.js';

// A minimal valid PNG payload — enough to assert the downloaded bytes round-trip.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);

const logger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };

const pngResponse = () => new Response(Buffer.from(PNG_BYTES), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function stubFetch(fn: (url: string, init?: RequestInit) => unknown) {
  vi.stubGlobal('fetch', fn);
}

describe('downloadBytes — rate-limit retries (429/503)', () => {
  it('retries on 429 and returns the bytes once the download succeeds', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(pngResponse());
    stubFetch(fetchFn);

    const bytes = await downloadBytes('https://upload.wikimedia.org/shield.png', logger, { retryBackoffMs: [1, 2] });

    expect(bytes).not.toBeNull();
    expect(Buffer.from(bytes!)).toEqual(Buffer.from(PNG_BYTES));
    expect(fetchFn).toHaveBeenCalledTimes(3); // 2 × 429, then success
  });

  it('retries on 503 as well', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(pngResponse());
    stubFetch(fetchFn);

    const bytes = await downloadBytes('https://upload.wikimedia.org/shield.png', logger, { retryBackoffMs: [1] });

    expect(Buffer.from(bytes!)).toEqual(Buffer.from(PNG_BYTES));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('gives up after max retries on persistent 429 and returns null (never throws)', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 429 }));
    stubFetch(fetchFn);

    await expect(
      downloadBytes('https://upload.wikimedia.org/shield.png', logger, { maxRetries: 2, retryBackoffMs: [1, 1] }),
    ).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(logger.warn).toHaveBeenCalled();
  });

  it('backs off per the Retry-After header instead of the schedule', async () => {
    vi.useFakeTimers();
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '3' } }))
      .mockResolvedValueOnce(pngResponse());
    stubFetch(fetchFn);

    const promise = downloadBytes('https://upload.wikimedia.org/shield.png', logger, { retryBackoffMs: [1, 2] });

    // Retry-After: 3s — after 2s the retry must NOT have fired yet.
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Past 3s → the retry fires and succeeds.
    await vi.advanceTimersByTimeAsync(1_500);
    await expect(promise).resolves.not.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe('downloadBytes — failure contract', () => {
  it('returns null immediately on a non-retryable status (404) without retrying', async () => {
    const fetchFn = vi.fn(async () => new Response('not found', { status: 404 }));
    stubFetch(fetchFn);

    await expect(downloadBytes('https://upload.wikimedia.org/missing.png', logger)).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns null on network failure without retrying and never throws', async () => {
    const fetchFn = vi.fn(async () => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    stubFetch(fetchFn);

    await expect(downloadBytes('https://upload.wikimedia.org/slow.png', logger)).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('downloadBytes — User-Agent header', () => {
  it('sends the descriptive shared User-Agent on the download request', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedInit = init;
      return pngResponse();
    });
    stubFetch(fetchFn);

    await downloadBytes('https://upload.wikimedia.org/shield.png', logger);

    expect((capturedInit?.headers as Record<string, string>)['User-Agent']).toBe(SHIELD_USER_AGENT);
  });

  it('exposes a descriptive, contactable User-Agent shared with the resolver', () => {
    expect(SHIELD_USER_AGENT).toContain('timberman-shield-seed/1.0');
    expect(SHIELD_USER_AGENT).toContain('https://github.com/fbiasuso/timberman');
  });
});
