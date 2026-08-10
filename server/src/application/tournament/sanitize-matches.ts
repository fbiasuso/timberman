import type { MatchDateStatus } from '../../domain/entities/match-date.js';

// ── DTOs ──────────────────────────────────────────────────────────

/**
 * Public match DTO — same shape the routes produce via `toMatchDTO`
 * (scheduledAt already stringified to ISO by the route layer).
 */
export interface MatchDTO {
  id: number;
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  localImg: string | null;
  visitorImg: string | null;
  localTeamId: number | null;
  visitorTeamId: number | null;
  scheduledAt: string | null;
  result: string | null;
  score: string | null;
}

// ── Sanitization ──────────────────────────────────────────────────

/**
 * Sanitize matches for public (non-admin) consumption based on the parent
 * date's status.
 *
 * Closed dates hold results that are not yet published: a non-admin must
 * never see them. Only dates in 'results' status (published/paid) expose
 * their stored results, so those pass through unchanged.
 *
 * Pure function — no IO, no mutation of the input. The 'results' branch
 * returns the input array by reference (never modified); other statuses
 * build a NEW array with result/score nulled.
 */
export function sanitizeMatches(status: MatchDateStatus, matches: MatchDTO[]): MatchDTO[] {
  if (status === 'results') {
    return matches;
  }
  return matches.map((m) => ({ ...m, result: null, score: null }));
}
