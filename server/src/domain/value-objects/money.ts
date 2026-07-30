/**
 * Money value object — represents currency amounts in cents.
 *
 * All monetary values are stored and manipulated as integer cents
 * to avoid floating-point precision issues.
 */
export class Money {
  private constructor(public readonly cents: number) {
    if (!Number.isInteger(cents)) {
      throw new Error(`Money must be in whole cents, got ${cents}`);
    }
  }

  /** Create from cents (internal representation) */
  static fromCents(cents: number): Money {
    return new Money(cents);
  }

  /** Create from a dollar amount (e.g. 15.50 → 1550 cents) */
  static fromDollars(amount: number): Money {
    return new Money(Math.round(amount * 100));
  }

  /** Create a zero-money value */
  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    const result = this.cents - other.cents;
    if (result < 0) {
      throw new Error(
        `Insufficient funds: cannot subtract ${other.cents} from ${this.cents}`
      );
    }
    return new Money(result);
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this.cents * factor));
  }

  toDollars(): number {
    return this.cents / 100;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.cents >= other.cents;
  }

  lessThan(other: Money): boolean {
    return this.cents < other.cents;
  }

  toString(): string {
    return `$${(this.cents / 100).toFixed(2)}`;
  }
}
