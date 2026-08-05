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

  describe('clearResult', () => {
    it('clears result and score on a new match instance', () => {
      const match = Match.new(baseProps).setResult('L', '2-1');
      const cleared = match.clearResult();
      expect(cleared.result).toBeNull();
      expect(cleared.score).toBeNull();
      expect(cleared.hasResult()).toBe(false);
    });

    it('keeps the other fields intact', () => {
      const match = Match.new({
        ...baseProps,
        localTeam: 'Racing',
        localImg: 'racing.png',
        scheduledAt: new Date('2026-08-02T20:00:00Z'),
      }).setResult('E', '1-1');

      const cleared = match.clearResult();

      expect(cleared.id).toBe(1);
      expect(cleared.matchDateId).toBe(10);
      expect(cleared.localTeam).toBe('Racing');
      expect(cleared.visitorTeam).toBe('Boca Juniors');
      expect(cleared.localImg).toBe('racing.png');
      expect(cleared.scheduledAt).toEqual(new Date('2026-08-02T20:00:00Z'));
    });

    it('is immutable — the original match is unchanged', () => {
      const match = Match.new(baseProps).setResult('V', '0-3');
      const cleared = match.clearResult();
      expect(cleared).not.toBe(match);
      expect(match.result).toBe('V');
      expect(match.score).toBe('0-3');
      expect(match.hasResult()).toBe(true);
    });
  });

  describe('withDetails', () => {
    it('merges provided fields and keeps the rest unchanged', () => {
      const match = Match.new({
        ...baseProps,
        localImg: 'river.png',
        visitorImg: 'boca.png',
        scheduledAt: new Date('2026-08-02T20:00:00Z'),
      });

      const updated = match.withDetails({ visitorTeam: 'Gimnasia' });

      expect(updated.localTeam).toBe('River Plate'); // unchanged
      expect(updated.visitorTeam).toBe('Gimnasia'); // edited
      expect(updated.localImg).toBe('river.png'); // unchanged
      expect(updated.visitorImg).toBe('boca.png'); // unchanged
      expect(updated.scheduledAt).toEqual(new Date('2026-08-02T20:00:00Z')); // unchanged
      expect(updated.result).toBeNull();
      expect(updated.score).toBeNull();
    });

    it('clears images and scheduledAt when null is passed', () => {
      const match = Match.new({
        ...baseProps,
        localImg: 'river.png',
        visitorImg: 'boca.png',
        scheduledAt: new Date('2026-08-02T20:00:00Z'),
      });

      const updated = match.withDetails({
        localImg: null,
        visitorImg: null,
        scheduledAt: null,
      });

      expect(updated.localImg).toBeNull();
      expect(updated.visitorImg).toBeNull();
      expect(updated.scheduledAt).toBeNull();
    });

    it('never touches result or score', () => {
      const match = Match.new(baseProps).setResult('L', '2-1');

      const updated = match.withDetails({ localTeam: 'Racing' });

      expect(updated.result).toBe('L');
      expect(updated.score).toBe('2-1');
      expect(updated.hasResult()).toBe(true);
    });

    it('is immutable — the original match is unchanged', () => {
      const match = Match.new({
        ...baseProps,
        localImg: 'river.png',
        scheduledAt: new Date('2026-08-02T20:00:00Z'),
      });

      const updated = match.withDetails({
        localTeam: 'Racing',
        localImg: null,
        scheduledAt: null,
      });

      expect(updated).not.toBe(match);
      expect(match.localTeam).toBe('River Plate');
      expect(match.localImg).toBe('river.png');
      expect(match.scheduledAt).not.toBeNull();
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
