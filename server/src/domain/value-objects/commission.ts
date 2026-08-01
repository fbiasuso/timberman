/**
 * Commission value object — represents a percentage (0–100).
 *
 * Used for tournament commission rates when calculating pozo (prize pool).
 * Commission is the house cut: pozo = (bets × betAmount) − commission
 */
export class Commission {
  private constructor(public readonly value: number) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Commission must be a finite number, got ${value}`);
    }
    if (value < 0 || value > 100) {
      throw new Error(
        `Commission must be between 0 and 100, got ${value}`
      );
    }
  }

  static create(value: number): Commission {
    return new Commission(value);
  }

  /** Default commission is 15% */
  static default(): Commission {
    return new Commission(15.0);
  }

  /**
   * Apply this commission rate to a total amount.
   * Returns the commission portion (house cut).
   * The remainder (total - result) is the prize pool (pozo).
   */
  applyTo(total: number): number {
    return Math.round((total * this.value) / 100);
  }

  /** Calculate the pozo from total bets */
  calculatePozo(totalBets: number, betAmount: number): number {
    const gross = totalBets * betAmount;
    const houseCut = this.applyTo(gross);
    return gross - houseCut;
  }

  equals(other: Commission): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return `${this.value}%`;
  }
}
