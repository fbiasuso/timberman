import { InvalidMatchResultError } from '../../domain/errors/index.js';
import type { Prediction } from '../../domain/value-objects/prediction.js';

// ── Types ──────────────────────────────────────────────────────────

export type DerivedMatchResult =
  | { kind: 'clear' }
  | { kind: 'set'; result: Prediction; score: string | null };

// ── Derivation rules ───────────────────────────────────────────────

const SCORE_REGEX = /^(0|[1-9]\d{0,1})$/;
const MAX_SCORE = 20;

export const MESSAGE_ONE_EMPTY = "Usá números o 'x' para ganador sin marcador";
export const MESSAGE_INVALID = 'Ingresá un marcador válido (0 a 20)';

/**
 * Derive the match result and score from two raw score inputs.
 *
 * Rule table (applied in order, after whitespace trimming):
 * - 'x'/'X' on both sides        → draw without score (`{ set, 'E', null }`)
 * - 'x'/'X' on the local side    → local win (`{ set, 'L', null }`, visitor ignored)
 * - 'x'/'X' on the visitor side  → visitor win (`{ set, 'V', null }`, local ignored)
 * - both valid numbers 0..20     → compare and compose score `"l-v"`
 * - both empty/whitespace        → clear (`{ kind: 'clear' }`)
 * - one side empty without 'x'   → throws InvalidMatchResultError
 * - anything else                → throws InvalidMatchResultError
 *
 * Throws {@link InvalidMatchResultError} (HTTP 422) on any semantic violation.
 */
export function deriveMatchResult(localScore: string, visitorScore: string): DerivedMatchResult {
  const local = localScore.trim();
  const visitor = visitorScore.trim();

  const localIsX = local.toLowerCase() === 'x';
  const visitorIsX = visitor.toLowerCase() === 'x';

  if (localIsX && visitorIsX) {
    return { kind: 'set', result: 'E', score: null };
  }

  if (localIsX) {
    return { kind: 'set', result: 'L', score: null };
  }

  if (visitorIsX) {
    return { kind: 'set', result: 'V', score: null };
  }

  if (local === '' && visitor === '') {
    return { kind: 'clear' };
  }

  if (local === '' || visitor === '') {
    throw new InvalidMatchResultError(MESSAGE_ONE_EMPTY);
  }

  if (!SCORE_REGEX.test(local) || !SCORE_REGEX.test(visitor)) {
    throw new InvalidMatchResultError(MESSAGE_INVALID);
  }

  const localNum = Number(local);
  const visitorNum = Number(visitor);

  if (localNum > MAX_SCORE || visitorNum > MAX_SCORE) {
    throw new InvalidMatchResultError(MESSAGE_INVALID);
  }

  const result: Prediction = localNum > visitorNum ? 'L' : localNum < visitorNum ? 'V' : 'E';
  return { kind: 'set', result, score: `${local}-${visitor}` };
}
