import { describe, it, expect } from 'vitest';
import {
  deriveMatchResult,
  isValidInput,
  validationMessage,
  parseScoreToInputs,
  MESSAGE_INVALID,
  MESSAGE_ONE_EMPTY,
} from '../match-result';

/**
 * SHARED MATRIX — mirrors the server rule table pinned in
 * `server/src/application/admin/__tests__/derive-match-result.test.ts` exactly,
 * so both sides of the derivation (server source of truth + this client mirror,
 * design D5/D8) pin the same cases and kill drift.
 *
 * Covers: x/x (both cases), x+number (number ignored), x+invalid (ignored),
 * x+empty, number+x, whitespace trim, 0-0, 2-1, 1-2, 20-20, 0-20, one side
 * empty, both empty = clear, out-of-range, negative, decimal, letters,
 * leading zero.
 */
describe('match-result util mirror', () => {
  const setCases: Array<{
    name: string;
    local: string;
    visitor: string;
    expected: { result: 'L' | 'E' | 'V'; score: string | null };
  }> = [
    { name: "'x' on both sides → draw without score", local: 'x', visitor: 'x', expected: { result: 'E', score: null } },
    { name: "'X' uppercase on both sides → draw without score", local: 'X', visitor: 'X', expected: { result: 'E', score: null } },
    { name: "local 'x' with numeric visitor → local win, number ignored", local: 'x', visitor: '4', expected: { result: 'L', score: null } },
    { name: "local 'x' with invalid visitor → local win, value ignored", local: 'x', visitor: 'abc', expected: { result: 'L', score: null } },
    { name: "local 'x' with empty visitor → local win", local: 'x', visitor: '', expected: { result: 'L', score: null } },
    { name: "visitor 'x' with numeric local → visitor win, number ignored", local: '4', visitor: 'x', expected: { result: 'V', score: null } },
    { name: 'whitespace around x is trimmed', local: ' x ', visitor: 'x', expected: { result: 'E', score: null } },
    { name: '2-1 → local win with composed score', local: '2', visitor: '1', expected: { result: 'L', score: '2-1' } },
    { name: '1-2 → visitor win with composed score', local: '1', visitor: '2', expected: { result: 'V', score: '1-2' } },
    { name: '0-0 → draw with score', local: '0', visitor: '0', expected: { result: 'E', score: '0-0' } },
    { name: '20-20 → draw at upper boundary', local: '20', visitor: '20', expected: { result: 'E', score: '20-20' } },
    { name: '0-20 → visitor win at boundary', local: '0', visitor: '20', expected: { result: 'V', score: '0-20' } },
    { name: 'whitespace around numbers is trimmed', local: ' 2 ', visitor: ' 1 ', expected: { result: 'L', score: '2-1' } },
  ];

  const clearCases: Array<{ name: string; local: string; visitor: string }> = [
    { name: 'both inputs empty → clear', local: '', visitor: '' },
    { name: 'both inputs whitespace → clear', local: ' ', visitor: '  ' },
  ];

  const invalidCases: Array<{ name: string; local: string; visitor: string; message: string }> = [
    { name: 'one side empty without x', local: '', visitor: '2', message: MESSAGE_ONE_EMPTY },
    { name: 'whitespace one side without x', local: '  ', visitor: '2', message: MESSAGE_ONE_EMPTY },
    { name: 'visitor side empty without x', local: '2', visitor: '', message: MESSAGE_ONE_EMPTY },
    { name: 'out of range 21', local: '21', visitor: '2', message: MESSAGE_INVALID },
    { name: 'visitor out of range 21', local: '2', visitor: '21', message: MESSAGE_INVALID },
    { name: 'out of range 99', local: '99', visitor: '2', message: MESSAGE_INVALID },
    { name: 'negative -1', local: '-1', visitor: '2', message: MESSAGE_INVALID },
    { name: 'decimal 3.5', local: '3.5', visitor: '2', message: MESSAGE_INVALID },
    { name: "letter 'L' is not a score", local: 'L', visitor: '2', message: MESSAGE_INVALID },
    { name: 'non-numeric abc', local: 'abc', visitor: 'abc', message: MESSAGE_INVALID },
    { name: 'leading zero 03', local: '03', visitor: '2', message: MESSAGE_INVALID },
    { name: 'visitor leading zero 03', local: '2', visitor: '03', message: MESSAGE_INVALID },
  ];

  describe('deriveMatchResult mirrors the server rule table', () => {
    it.each(setCases)('derives a set result: $name', ({ local, visitor, expected }) => {
      expect(deriveMatchResult(local, visitor)).toEqual({ kind: 'set', ...expected });
    });

    it.each(clearCases)('derives a clear: $name', ({ local, visitor }) => {
      expect(deriveMatchResult(local, visitor)).toEqual({ kind: 'clear' });
    });

    it.each(invalidCases)('throws on invalid input: $name', ({ local, visitor, message }) => {
      expect(() => deriveMatchResult(local, visitor)).toThrow(message);
    });
  });

  describe('isValidInput', () => {
    it.each([...setCases, ...clearCases])('returns true for: $name', ({ local, visitor }) => {
      expect(isValidInput(local, visitor)).toBe(true);
    });

    it.each(invalidCases)('returns false for: $name', ({ local, visitor }) => {
      expect(isValidInput(local, visitor)).toBe(false);
    });
  });

  describe('validationMessage', () => {
    it('returns null for a valid score pair', () => {
      expect(validationMessage('3', '2')).toBeNull();
    });

    it('returns null for both empty (clear)', () => {
      expect(validationMessage('', '')).toBeNull();
    });

    it('returns null for x on both sides', () => {
      expect(validationMessage('x', 'X')).toBeNull();
    });

    it("returns the exact one-empty message", () => {
      expect(validationMessage('', '2')).toBe("Usá números o 'x' para ganador sin marcador");
      expect(validationMessage('2', '')).toBe("Usá números o 'x' para ganador sin marcador");
      expect(validationMessage('  ', '2')).toBe("Usá números o 'x' para ganador sin marcador");
    });

    it('returns the exact invalid message', () => {
      expect(validationMessage('21', '2')).toBe('Ingresá un marcador válido (0 a 20)');
      expect(validationMessage('03', '2')).toBe('Ingresá un marcador válido (0 a 20)');
      expect(validationMessage('-1', '2')).toBe('Ingresá un marcador válido (0 a 20)');
      expect(validationMessage('abc', 'abc')).toBe('Ingresá un marcador válido (0 a 20)');
    });
  });

  describe('parseScoreToInputs', () => {
    it("splits a composed score '3-2' into both inputs", () => {
      expect(parseScoreToInputs({ result: 'L', score: '3-2' })).toEqual({ local: '3', visitor: '2' });
    });

    it("maps result 'L' without score to local 'x'", () => {
      expect(parseScoreToInputs({ result: 'L', score: null })).toEqual({ local: 'x', visitor: '' });
    });

    it("maps result 'E' without score to both 'x'", () => {
      expect(parseScoreToInputs({ result: 'E', score: null })).toEqual({ local: 'x', visitor: 'x' });
    });

    it("maps result 'V' without score to visitor 'x'", () => {
      expect(parseScoreToInputs({ result: 'V', score: null })).toEqual({ local: '', visitor: 'x' });
    });

    it('maps no result/score to both empty inputs', () => {
      expect(parseScoreToInputs({ result: null, score: null })).toEqual({ local: '', visitor: '' });
    });
  });
});
