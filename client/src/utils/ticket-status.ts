import type { MatchDateStatus } from '../types';

/**
 * Ticket lifecycle status derived from the ticket's prize and its date status.
 *
 * - prizeWon set        → 'Pagado' (the ticket won and was paid)
 * - date in 'results'   → 'Sin premio' (published results, no prize = loser)
 * - anything else       → 'Pendiente' (results not published yet)
 */
export type TicketStatus = 'Pagado' | 'Sin premio' | 'Pendiente';

export function deriveTicketStatus(
  ticket: { prizeWon: number | null },
  dateStatus: MatchDateStatus | null | undefined,
): TicketStatus {
  if (ticket.prizeWon != null) return 'Pagado';
  if (dateStatus === 'results') return 'Sin premio';
  return 'Pendiente';
}
