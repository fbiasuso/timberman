import { describe, it, expect } from 'vitest';
import { Commission } from '../value-objects/commission.js';
import { Money } from '../value-objects/money.js';

describe('Commission', () => {
  describe('constructor validation', () => {
    it('creates a commission with a valid value', () => {
      const c = Commission.create(15);
      expect(c.value).toBe(15);
    });

    it('creates a commission with 0', () => {
      const c = Commission.create(0);
      expect(c.value).toBe(0);
    });

    it('creates a commission with 100', () => {
      const c = Commission.create(100);
      expect(c.value).toBe(100);
    });

    it('throws for negative values', () => {
      expect(() => Commission.create(-1)).toThrow('between 0 and 100');
    });

    it('throws for values above 100', () => {
      expect(() => Commission.create(101)).toThrow('between 0 and 100');
    });

    it('throws for non-finite values', () => {
      expect(() => Commission.create(NaN)).toThrow('finite number');
      expect(() => Commission.create(Infinity)).toThrow('finite number');
    });

    it('default() returns 15%', () => {
      const c = Commission.default();
      expect(c.value).toBe(15);
    });
  });

  describe('calculatePozo', () => {
    it('returns correct pozo for 100 tickets at 1500 with 15% commission', () => {
      const commission = Commission.create(15);
      const pozo = commission.calculatePozo(100, 1500);
      // gross = 150000, house = 22500, pozo = 127500
      expect(pozo).toBe(127500);
    });

    it('returns full amount for 0% commission', () => {
      const commission = Commission.create(0);
      const pozo = commission.calculatePozo(50, 1000);
      expect(pozo).toBe(50000);
    });

    it('returns 0 for 100% commission (all to house)', () => {
      const commission = Commission.create(100);
      const pozo = commission.calculatePozo(50, 1000);
      expect(pozo).toBe(0);
    });
  });
});
