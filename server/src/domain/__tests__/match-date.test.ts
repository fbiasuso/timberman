import { describe, it, expect } from 'vitest';
import { MatchDate } from '../entities/match-date.js';
import { DateNotClosedError } from '../errors/index.js';

describe('MatchDate', () => {
  const baseSnapshot = {
    id: 10,
    tournamentId: 1,
    dateNumber: 3,
    status: 'open' as const,
    pozo: 0,
    betAmount: 1500,
    commission: 0,
    createdAt: new Date('2025-01-01'),
  };

  describe('withCommission', () => {
    it('returns a new instance with the commission set', () => {
      const date = MatchDate.create(baseSnapshot);
      const updated = date.withCommission(15);

      expect(updated).not.toBe(date);
      expect(updated.commission).toBe(15);
      expect(updated.id).toBe(date.id);
      expect(updated.status).toBe(date.status);
    });

    it('does not mutate the original instance', () => {
      const date = MatchDate.create(baseSnapshot);
      date.withCommission(20);

      expect(date.commission).toBe(0);
    });
  });

  describe('publishResults', () => {
    it('transitions a closed date to results', () => {
      const closed = MatchDate.create({ ...baseSnapshot, status: 'closed', pozo: 6000 });
      const published = closed.publishResults();

      expect(published.status).toBe('results');
      expect(closed.status).toBe('closed');
    });

    it('throws DateNotClosedError when the date is open', () => {
      const open = MatchDate.create(baseSnapshot);
      expect(() => open.publishResults()).toThrow(DateNotClosedError);
    });

    it('throws DateNotClosedError with code DATE_NOT_CLOSED and 409 status', () => {
      const open = MatchDate.create(baseSnapshot);
      try {
        open.publishResults();
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(DateNotClosedError);
        const domainErr = err as DateNotClosedError;
        expect(domainErr.code).toBe('DATE_NOT_CLOSED');
        expect(domainErr.statusCode).toBe(409);
        expect(domainErr.message).toContain('Match date 10 is not closed');
      }
    });

    it('throws DateNotClosedError when the date already has results', () => {
      const published = MatchDate.create({ ...baseSnapshot, status: 'results' });
      expect(() => published.publishResults()).toThrow(DateNotClosedError);
    });
  });
});
