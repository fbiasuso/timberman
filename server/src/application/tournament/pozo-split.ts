/**
 * Split the pozo equally among winners in integer cents.
 *
 * Every winner gets the floored base; the leftover remainder goes to the
 * FIRST winner (index 0) so the full pozo is always paid out.
 *
 * @param pozoCents   - Total pozo in cents
 * @param winnerCount - Number of winning tickets (>= 1)
 * @returns Payout in cents per winner, indexed by winner order (ascending ticket id)
 */
export function splitPozo(pozoCents: number, winnerCount: number): number[] {
  const base = Math.floor(pozoCents / winnerCount);
  const remainder = pozoCents % winnerCount;
  return Array.from({ length: winnerCount }, (_, i) => base + (i === 0 ? remainder : 0));
}
