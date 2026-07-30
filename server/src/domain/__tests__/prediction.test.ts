import { describe, it, expect } from 'vitest';
import { PREDICTIONS, isPrediction, assertPrediction } from '../value-objects/prediction.js';

describe('Prediction', () => {
  it('has valid predictions L, E, V', () => {
    expect(PREDICTIONS).toEqual(['L', 'E', 'V']);
  });

  describe('isPrediction', () => {
    it('returns true for L', () => {
      expect(isPrediction('L')).toBe(true);
    });

    it('returns true for E', () => {
      expect(isPrediction('E')).toBe(true);
    });

    it('returns true for V', () => {
      expect(isPrediction('V')).toBe(true);
    });

    it('returns false for invalid values', () => {
      expect(isPrediction('A')).toBe(false);
      expect(isPrediction('')).toBe(false);
      expect(isPrediction('l')).toBe(false);
      expect(isPrediction(' X ')).toBe(false);
    });
  });

  describe('assertPrediction', () => {
    it('does not throw for valid values', () => {
      expect(() => assertPrediction('L')).not.toThrow();
      expect(() => assertPrediction('E')).not.toThrow();
      expect(() => assertPrediction('V')).not.toThrow();
    });

    it('throws for invalid values', () => {
      expect(() => assertPrediction('X')).toThrow('Invalid prediction');
      expect(() => assertPrediction('')).toThrow('Invalid prediction');
      expect(() => assertPrediction('l')).toThrow('Invalid prediction');
    });
  });
});
