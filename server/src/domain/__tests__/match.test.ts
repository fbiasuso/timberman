import { describe, it, expect } from 'vitest';
import { Match } from '../entities/match.js';

describe('Match', () => {
  const baseProps = {
    id: 1,
    matchDateId: 10,
    localTeam: 'River Plate',
    visitorTeam: 'Boca Juniors',
  };

  describe('constructor', () => {
    it('creates a match without result', () => {
      const match = Match.new(baseProps);
      expect(match.id).toBe(1);
      expect(match.localTeam).toBe('River Plate');
      expect(match.visitorTeam).toBe('Boca Juniors');
      expect(match.result).toBeNull();
      expect(match.score).toBeNull();
      expect(match.hasResult()).toBe(false);
    });

    it('creates a match from snapshot', () => {
      const snapshot = {
        id: 2,
        matchDateId: 10,
        localTeam: 'Racing',
        visitorTeam: 'Independiente',
        localImg: null,
        visitorImg: null,
        scheduledAt: null,
        result: null,
        score: null,
        createdAt: new Date(),
      };
      const match = Match.create(snapshot);
      expect(match.localTeam).toBe('Racing');
    });
  });

  describe('setResult', () => {
    it('sets result and score on a new match instance', () => {
      const match = Match.new(baseProps);
      const updated = match.setResult('L', '2-1');
      expect(updated.result).toBe('L');
      expect(updated.score).toBe('2-1');
      expect(updated.hasResult()).toBe(true);
      expect(match.hasResult()).toBe(false); // original unchanged
    });
  });

  describe('isCorrect', () => {
    it('returns true when prediction matches result', () => {
      const match = Match.new(baseProps);
      const updated = match.setResult('L', '1-0');
      expect(updated.isCorrect('L')).toBe(true);
    });

    it('returns false when prediction does not match result', () => {
      const match = Match.new(baseProps);
      const updated = match.setResult('L', '1-0');
      expect(updated.isCorrect('E')).toBe(false);
      expect(updated.isCorrect('V')).toBe(false);
    });

    it('returns false when there is no result yet', () => {
      const match = Match.new(baseProps);
      expect(match.isCorrect('L')).toBe(false);
    });
  });
});
