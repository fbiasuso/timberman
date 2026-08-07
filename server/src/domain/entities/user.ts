import { Money } from '../value-objects/money.js';
import { InsufficientBalanceError } from '../errors/index.js';

export type UserRole = 'user' | 'admin';

export interface UserSnapshot {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  balance: number; // cents
  createdAt: Date;
}

export class User {
  private constructor(
    public readonly id: string,
    public readonly username: string,
    public readonly passwordHash: string,
    public readonly role: UserRole,
    private readonly _balance: number, // cents — private to force use of Money
    public readonly createdAt: Date,
  ) {}

  /** Get balance as a Money value object */
  get balance(): Money {
    return Money.fromCents(this._balance);
  }

  // ── Behavior ─────────────────────────────────────────────────

  /** Check if user can afford an amount */
  canDeduct(amount: Money): boolean {
    return this.balance.greaterThanOrEqual(amount);
  }

  /**
   * Deduct balance — returns a NEW User instance (immutable).
   * Throws InsufficientBalanceError if balance is too low.
   */
  deductBalance(amount: Money): User {
    if (!this.canDeduct(amount)) {
      throw new InsufficientBalanceError(this.id, this.username, this._balance, amount.cents);
    }
    return new User(
      this.id,
      this.username,
      this.passwordHash,
      this.role,
      this._balance - amount.cents,
      this.createdAt,
    );
  }

  /** Add balance — returns a NEW User instance (immutable) */
  addBalance(amount: Money): User {
    return new User(
      this.id,
      this.username,
      this.passwordHash,
      this.role,
      this._balance + amount.cents,
      this.createdAt,
    );
  }

  isAdmin(): boolean {
    return this.role === 'admin';
  }

  // ── Factory ──────────────────────────────────────────────────

  static create(snapshot: UserSnapshot): User {
    return new User(
      snapshot.id,
      snapshot.username,
      snapshot.passwordHash,
      snapshot.role,
      snapshot.balance,
      snapshot.createdAt,
    );
  }

  static new(props: {
    id: string;
    username: string;
    passwordHash: string;
    role?: UserRole;
  }): User {
    return new User(
      props.id,
      props.username,
      props.passwordHash,
      props.role ?? 'user',
      0,
      new Date(),
    );
  }

  /** Export snapshot for persistence */
  toSnapshot(): UserSnapshot {
    return {
      id: this.id,
      username: this.username,
      passwordHash: this.passwordHash,
      role: this.role,
      balance: this._balance,
      createdAt: this.createdAt,
    };
  }
}
