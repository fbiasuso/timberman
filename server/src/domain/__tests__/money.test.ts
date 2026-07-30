import { describe, it, expect } from 'vitest';
import { Money } from '../value-objects/money.js';

describe('Money', () => {
  describe('fromCents', () => {
    it('creates a Money instance from whole cents', () => {
      const m = Money.fromCents(1500);
      expect(m.cents).toBe(1500);
    });

    it('throws on non-integer cents', () => {
      expect(() => Money.fromCents(15.5)).toThrow('whole cents');
    });
  });

  describe('zero', () => {
    it('creates a Money instance with 0 cents', () => {
      const z = Money.zero();
      expect(z.cents).toBe(0);
    });
  });

  describe('add', () => {
    it('adds two Money amounts', () => {
      const a = Money.fromCents(1000);
      const b = Money.fromCents(500);
      const result = a.add(b);
      expect(result.cents).toBe(1500);
    });

    it('does not mutate the originals', () => {
      const a = Money.fromCents(1000);
      const b = Money.fromCents(500);
      a.add(b);
      expect(a.cents).toBe(1000);
      expect(b.cents).toBe(500);
    });
  });

  describe('subtract', () => {
    it('subtracts a smaller amount from a larger one', () => {
      const a = Money.fromCents(1000);
      const b = Money.fromCents(300);
      const result = a.subtract(b);
      expect(result.cents).toBe(700);
    });

    it('throws when subtracting more than available', () => {
      const a = Money.fromCents(100);
      const b = Money.fromCents(500);
      expect(() => a.subtract(b)).toThrow('Insufficient funds');
    });
  });

  describe('compareTo', () => {
    it('equals returns true for same cents', () => {
      expect(Money.fromCents(100).equals(Money.fromCents(100))).toBe(true);
    });

    it('equals returns false for different cents', () => {
      expect(Money.fromCents(100).equals(Money.fromCents(200))).toBe(false);
    });

    it('greaterThanOrEqual returns true when equal', () => {
      expect(Money.fromCents(100).greaterThanOrEqual(Money.fromCents(100))).toBe(true);
    });

    it('lessThan returns true when smaller', () => {
      expect(Money.fromCents(50).lessThan(Money.fromCents(100))).toBe(true);
    });
  });

  describe('toNumber', () => {
    it('toDollars returns the correct dollar amount', () => {
      const m = Money.fromCents(1550);
      expect(m.toDollars()).toBe(15.5);
    });
  });
});
