import { Commission } from '../../domain/value-objects/commission.js';
import { Money } from '../../domain/value-objects/money.js';

/**
 * Pozo (prize pool) calculator.
 *
 * The pozo is the total amount wagered minus the house commission:
 *   pozo = (ticketCount × betAmount) - commission
 *
 * All calculations use integer cents to avoid floating-point errors.
 */
export class PozoCalculator {
  /**
   * Calculate the prize pool for a given match date.
   *
   * @param ticketCount - Number of tickets placed
   * @param betAmount   - Bet amount per ticket (Money)
   * @param commission  - Tournament commission rate
   * @returns The pozo as a Money value
   */
  calculate(ticketCount: number, betAmount: Money, commission: Commission): Money {
    const pozoCents = commission.calculatePozo(ticketCount, betAmount.cents);
    return Money.fromCents(pozoCents);
  }
}
