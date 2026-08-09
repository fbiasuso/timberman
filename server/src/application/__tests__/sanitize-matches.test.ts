import { describe, it, expect } from 'vitest';
import { sanitizeMatches } from '../tournament/sanitize-matches.js';
import type { MatchDTO } from '../tournament/sanitize-matches.js';

// ── Helpers ────────────────────────────────────────────────────────

function makeMatch(overrides: Partial<MatchDTO> = {}): MatchDTO {
  return {
    id: 1,
    matchDateId: 10,
    localTeam: 'River Plate',
    visitorTeam: 'Boca Juniors',
    localImg: null,
    visitorImg: null,
    localTeamId: null,
    visitorTeamId: null,
    scheduledAt: null,
    result: 'L',
    score: '2-1',
    ...overrides,
  };
}

// ── sanitizeMatches ────────────────────────────────────────────────

describe('sanitizeMatches', () => {
  it('nulls result and score for a closed date', () => {
    const matches = [makeMatch(), makeMatch({ id: 2, result: 'E', score: '1-1' })];

    const sanitized = sanitizeMatches('closed', matches);

    expect(sanitized).toHaveLength(2);
    for (const m of sanitized) {
      expect(m.result).toBeNull();
      expect(m.score).toBeNull();
    }
  });

  it('nulls result and score for an open date', () => {
    const sanitized = sanitizeMatches('open', [makeMatch()]);

    expect(sanitized).toHaveLength(1);
    expect(sanitized[0].result).toBeNull();
    expect(sanitized[0].score).toBeNull();
  });

  it('keeps stored results unchanged for a results date', () => {
    const matches = [makeMatch(), makeMatch({ id: 2, result: 'V', score: '0-3' })];

    const sanitized = sanitizeMatches('results', matches);

    expect(sanitized[0].result).toBe('L');
    expect(sanitized[0].score).toBe('2-1');
    expect(sanitized[1].result).toBe('V');
    expect(sanitized[1].score).toBe('0-3');
  });

  it('does not mutate the input DTOs', () => {
    const matches = [makeMatch()];

    sanitizeMatches('closed', matches);

    expect(matches[0].result).toBe('L');
    expect(matches[0].score).toBe('2-1');
    expect(matches[0].localTeam).toBe('River Plate');
  });

  it('returns an empty array when there are no matches', () => {
    expect(sanitizeMatches('closed', [])).toEqual([]);
    expect(sanitizeMatches('results', [])).toEqual([]);
  });
});
