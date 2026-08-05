import { describe, it, expect } from 'vitest';
import {
  deriveMatchResult,
  MESSAGE_INVALID,
  MESSAGE_ONE_EMPTY,
} from '../derive-match-result.js';
import { InvalidMatchResultError } from '../../../domain/errors/index.js';

/**
 * SHARED MATRIX — the client util mirror (`client/src/utils/match-result.ts`)
 * pins this exact rule table in its own test suite to kill drift.
 *
 * Covers: x/x (both cases), x+number (number ignored), x+invalid (ignored),
 * number+x, 0-0, 2-1, 1-2, 20-20, 0-20, whitespace trim, one side empty,
 * both empty = clear, out-of-range, negative, decimal, letters, leading zero.
 */
describe('deriveMatchResult', () => {
  describe('derives a set result', () => {
    const cases: Array<{
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

    it.each(cases)('$name', ({ local, visitor, expected }) => {
      expect(deriveMatchResult(local, visitor)).toEqual({ kind: 'set', ...expected });
    });
  });

  describe('derives a clear', () => {
    it.each([
      { local: '', visitor: '', name: 'both inputs empty → clear' },
      { local: ' ', visitor: '  ', name: 'both inputs whitespace → clear' },
    ])('$name', ({ local, visitor }) => {
      expect(deriveMatchResult(local, visitor)).toEqual({ kind: 'clear' });
    });
  });

  describe('throws InvalidMatchResultError', () => {
    const cases: Array<{ name: string; local: string; visitor: string; message: string }> = [
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

    it.each(cases)('$name', ({ local, visitor, message }) => {
      const fn = () => deriveMatchResult(local, visitor);
      expect(fn).toThrow(InvalidMatchResultError);
      expect(fn).toThrow(message);
    });

    it('maps to HTTP 422 with INVALID_MATCH_RESULT code', () => {
      try {
        deriveMatchResult('21', '2');
        throw new Error('expected InvalidMatchResultError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidMatchResultError);
        expect((error as InvalidMatchResultError).code).toBe('INVALID_MATCH_RESULT');
        expect((error as InvalidMatchResultError).statusCode).toBe(422);
      }
    });
  });
});
