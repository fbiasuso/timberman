import { describe, it, expect, vi } from 'vitest';
import { buildCandidateTitles, resolveShieldUrl } from '../shield-resolver.js';

// ── Fake API payloads ──────────────────────────────────────────────

const WIKI_HIT = (source: string) => ({
  query: {
    pages: {
      '123': { pageid: 123, ns: 0, title: 'River Plate', thumbnail: { source, width: 256, height: 256 } },
    },
  },
});

const WIKI_MISS = { query: { pages: { '-1': { ns: 0, title: 'Missing', missing: '' } } } };

const SPORTSDB_HIT = (badge: string) => ({
  teams: [{ idTeam: '1', strTeam: 'River Plate', strTeamBadge: badge }],
});

const SPORTSDB_MISS = { teams: null };

const jsonResponse = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

// ── buildCandidateTitles (pure) ────────────────────────────────────

describe('buildCandidateTitles', () => {
  it('tries the direct name first, then aliases, then the "Club Atlético" form', () => {
    expect(buildCandidateTitles('Gimnasia', ['Gimnasia de Mendoza'])).toEqual([
      'Gimnasia',
      'Gimnasia de Mendoza',
      'Club Atlético Gimnasia',
    ]);
  });

  it('dedupes repeated titles and drops empty strings', () => {
    expect(buildCandidateTitles('Boca', ['Boca', '', '  '])).toEqual(['Boca', 'Club Atlético Boca']);
  });
});

// ── resolveShieldUrl — Wikimedia primary ───────────────────────────

describe('resolveShieldUrl — Wikimedia primary', () => {
  it('returns the Wikimedia thumbnail source when the direct name hits', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(WIKI_HIT('https://upload.wikimedia.org/river.png')));
    const url = await resolveShieldUrl('River Plate', [], { fetchFn, delayMs: 0 });
    expect(url).toBe('https://upload.wikimedia.org/river.png');
    expect(fetchFn).toHaveBeenCalledTimes(1); // fallback must not be reached
  });

  it('requests Wikipedia redirect resolution (redirects=1)', async () => {
    let captured = '';
    const fetchFn = vi.fn(async (url: string) => {
      captured = url;
      return jsonResponse(WIKI_HIT('https://upload.wikimedia.org/river.png'));
    });
    await resolveShieldUrl('Boca', [], { fetchFn, delayMs: 0 });
    expect(captured).toContain('es.wikipedia.org/w/api.php');
    expect(captured).toContain('redirects=1');
    expect(captured).toContain('pithumbsize=256');
  });

  it('encodes accents and spaces in the titles param', async () => {
    let captured = '';
    const fetchFn = vi.fn(async (url: string) => {
      captured = url;
      return jsonResponse(WIKI_HIT('https://upload.wikimedia.org/tucuman.png'));
    });
    await expect(resolveShieldUrl('Atlético Tucumán', [], { fetchFn, delayMs: 0 })).resolves.toBe(
      'https://upload.wikimedia.org/tucuman.png',
    );
    expect(captured).toContain('titles=Atl%C3%A9tico%20Tucum%C3%A1n');
  });

  it('falls back to the first alias when the direct name misses', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes('titles=At.%20Tucum%C3%A1n') ? jsonResponse(WIKI_HIT('https://upload.wikimedia.org/alias.png')) : jsonResponse(WIKI_MISS),
    );
    const url = await resolveShieldUrl('Atlético Tucumán', ['At. Tucumán'], { fetchFn, delayMs: 0 });
    expect(url).toBe('https://upload.wikimedia.org/alias.png');
  });

  it('tries the "Club Atlético {name}" page-title form when name and aliases miss', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes('titles=Club%20Atl%C3%A9tico%20Boca%20Juniors')
        ? jsonResponse(WIKI_HIT('https://upload.wikimedia.org/cabj.png'))
        : jsonResponse(WIKI_MISS),
    );
    const url = await resolveShieldUrl('Boca Juniors', [], { fetchFn, delayMs: 0 });
    expect(url).toBe('https://upload.wikimedia.org/cabj.png');
  });

  it('treats a non-2xx Wikimedia response as a miss and tries the fallback', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes('wikipedia.org') ? new Response('boom', { status: 500 }) : jsonResponse(SPORTSDB_HIT('https://www.thesportsdb.com/badge.png')),
    );
    const url = await resolveShieldUrl('Talleres', [], { fetchFn, delayMs: 0 });
    expect(url).toBe('https://www.thesportsdb.com/badge.png');
  });
});

// ── resolveShieldUrl — TheSportsDB fallback ────────────────────────

describe('resolveShieldUrl — TheSportsDB fallback', () => {
  it('returns the strTeamBadge when Wikimedia misses', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes('wikipedia.org') ? jsonResponse(WIKI_MISS) : jsonResponse(SPORTSDB_HIT('https://www.thesportsdb.com/badge.png')),
    );
    const url = await resolveShieldUrl('Deportivo Riestra', [], { fetchFn, delayMs: 0 });
    expect(url).toBe('https://www.thesportsdb.com/badge.png');
  });

  it('uses the provided TheSportsDB key in the fallback URL', async () => {
    let sportsUrl = '';
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('wikipedia.org')) return jsonResponse(WIKI_MISS);
      sportsUrl = url;
      return jsonResponse(SPORTSDB_HIT('https://www.thesportsdb.com/badge.png'));
    });
    const url = await resolveShieldUrl('Gimnasia', [], { fetchFn, delayMs: 0, theSportsDbKey: '4321' });
    expect(url).toBe('https://www.thesportsdb.com/badge.png');
    expect(sportsUrl).toContain('/json/4321/searchteams.php');
    expect(sportsUrl).toContain('t=Gimnasia');
  });

  it('treats a TheSportsDB list without a badge as a miss', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes('wikipedia.org')
        ? jsonResponse(WIKI_MISS)
        : jsonResponse({ teams: [{ idTeam: '9', strTeam: 'X', strTeamBadge: '' }] }),
    );
    await expect(resolveShieldUrl('X', [], { fetchFn, delayMs: 0 })).resolves.toBeNull();
  });
});

// ── resolveShieldUrl — both miss / failures ────────────────────────

describe('resolveShieldUrl — both miss', () => {
  it('returns null when both sources miss', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes('wikipedia.org') ? jsonResponse(WIKI_MISS) : jsonResponse(SPORTSDB_MISS),
    );
    await expect(resolveShieldUrl('Equipo Inexistente', [], { fetchFn, delayMs: 0 })).resolves.toBeNull();
  });

  it('returns null when both sources are unreachable and never throws', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network down');
    });
    await expect(resolveShieldUrl('River Plate', [], { fetchFn, delayMs: 0 })).resolves.toBeNull();
  });
});
