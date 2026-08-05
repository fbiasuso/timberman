import type { Prediction } from '../types';

/**
 * Pure client mirror of the server's match result derivation
 * (`server/src/application/admin/derive-match-result.ts`).
 *
 * The server is the source of truth; this util re-implements its exact rule
 * table locally so the results entry view can validate in real time (design
 * D5). Drift is killed by pinning the same matrix in both test suites (design
 * D8): `server/src/application/admin/__tests__/derive-match-result.test.ts`
 * and `client/src/utils/__tests__/match-result.test.ts`.
 */

// ── Types ──────────────────────────────────────────────────────────

export type DerivedMatchResult =
  | { kind: 'clear' }
  | { kind: 'set'; result: Prediction; score: string | null };

// ── Derivation rules (mirror of the server rule table) ─────────────

const SCORE_REGEX = /^(0|[1-9]\d{0,1})$/;
const MAX_SCORE = 20;

/** Exact mirror of the server's `MESSAGE_ONE_EMPTY` constant. */
export const MESSAGE_ONE_EMPTY = "Usá números o 'x' para ganador sin marcador";
/** Exact mirror of the server's `MESSAGE_INVALID` constant. */
export const MESSAGE_INVALID = 'Ingresá un marcador válido (0 a 20)';

/** Trimmed, case-insensitive 'x' check — the "winner without score" marker. */
export function isX(input: string): boolean {
  return input.trim().toLowerCase() === 'x';
}

/**
 * Derive the match result and score from two raw score inputs.
 *
 * Rule table (applied in order, after whitespace trimming) — identical to the
 * server's `deriveMatchResult`:
 * - 'x'/'X' on both sides        → draw without score (`{ set, 'E', null }`)
 * - 'x'/'X' on the local side    → local win (`{ set, 'L', null }`, visitor ignored)
 * - 'x'/'X' on the visitor side  → visitor win (`{ set, 'V', null }`, local ignored)
 * - both valid numbers 0..20     → compare and compose score `"l-v"`
 * - both empty/whitespace        → clear (`{ kind: 'clear' }`)
 * - one side empty without 'x'   → throws `MESSAGE_ONE_EMPTY`
 * - anything else                → throws `MESSAGE_INVALID`
 *
 * Throws on semantic violations (mirroring the server's `InvalidMatchResultError`
 * messages) so `isValidInput` and `validationMessage` share the exact table.
 */
export function deriveMatchResult(localScore: string, visitorScore: string): DerivedMatchResult {
  const local = localScore.trim();
  const visitor = visitorScore.trim();

  if (isX(local) && isX(visitor)) {
    return { kind: 'set', result: 'E', score: null };
  }

  if (isX(local)) {
    return { kind: 'set', result: 'L', score: null };
  }

  if (isX(visitor)) {
    return { kind: 'set', result: 'V', score: null };
  }

  if (local === '' && visitor === '') {
    return { kind: 'clear' };
  }

  if (local === '' || visitor === '') {
    throw new Error(MESSAGE_ONE_EMPTY);
  }

  if (!SCORE_REGEX.test(local) || !SCORE_REGEX.test(visitor)) {
    throw new Error(MESSAGE_INVALID);
  }

  const localNum = Number(local);
  const visitorNum = Number(visitor);

  if (localNum > MAX_SCORE || visitorNum > MAX_SCORE) {
    throw new Error(MESSAGE_INVALID);
  }

  const result: Prediction = localNum > visitorNum ? 'L' : localNum < visitorNum ? 'V' : 'E';
  return { kind: 'set', result, score: `${local}-${visitor}` };
}

/**
 * True when the pair derives to a valid result or a clear; false when it
 * would throw (one side empty without 'x', or invalid/out-of-range input).
 */
export function isValidInput(local: string, visitor: string): boolean {
  try {
    deriveMatchResult(local, visitor);
    return true;
  } catch {
    return false;
  }
}

/**
 * Inline validation message mirroring the server's exact Spanish copy.
 * Returns null when the pair is valid or clears; otherwise the exact message
 * the server would return for the same input.
 */
export function validationMessage(local: string, visitor: string): string | null {
  try {
    deriveMatchResult(local, visitor);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : MESSAGE_INVALID;
  }
}

/**
 * Prefill the two score inputs from a persisted match result/score.
 * - score `'3-2'`        → `{ local: '3', visitor: '2' }` (split on '-')
 * - result 'L', no score → `{ local: 'x', visitor: '' }`
 * - result 'E', no score → `{ local: 'x', visitor: 'x' }`
 * - result 'V', no score → `{ local: '', visitor: 'x' }`
 * - no result/score      → `{ local: '', visitor: '' }`
 */
export function parseScoreToInputs(match: {
  result: string | null;
  score: string | null;
}): { local: string; visitor: string } {
  if (match.score != null && match.score !== '') {
    const [local, visitor] = match.score.split('-');
    return { local, visitor };
  }

  switch (match.result) {
    case 'L':
      return { local: 'x', visitor: '' };
    case 'E':
      return { local: 'x', visitor: 'x' };
    case 'V':
      return { local: '', visitor: 'x' };
    default:
      return { local: '', visitor: '' };
  }
}
