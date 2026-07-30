import { Money } from '../value-objects/money.js';

export interface AuditLogSnapshot {
  id: number;
  adminId: string;
  userId: string | null;
  action: string;
  amount: number | null; // cents
  reason: string | null;
  createdAt: Date;
}

export class AuditLog {
  private constructor(
    public readonly id: number,
    public readonly adminId: string,
    public readonly userId: string | null,
    public readonly action: string,
    private readonly _amount: number | null,
    public readonly reason: string | null,
    public readonly createdAt: Date,
  ) {}

  /** Get amount as Money, if present */
  get amount(): Money | null {
    return this._amount !== null ? Money.fromCents(this._amount) : null;
  }

  // ── Factory ──────────────────────────────────────────────────

  static create(snapshot: AuditLogSnapshot): AuditLog {
    return new AuditLog(
      snapshot.id,
      snapshot.adminId,
      snapshot.userId,
      snapshot.action,
      snapshot.amount,
      snapshot.reason,
      snapshot.createdAt,
    );
  }

  static new(props: {
    id: number;
    adminId: string;
    userId?: string | null;
    action: string;
    amount?: number | null;
    reason?: string | null;
  }): AuditLog {
    return new AuditLog(
      props.id,
      props.adminId,
      props.userId ?? null,
      props.action,
      props.amount ?? null,
      props.reason ?? null,
      new Date(),
    );
  }

  toSnapshot(): AuditLogSnapshot {
    return {
      id: this.id,
      adminId: this.adminId,
      userId: this.userId,
      action: this.action,
      amount: this._amount,
      reason: this.reason,
      createdAt: this.createdAt,
    };
  }
}
