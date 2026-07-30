import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { AuditLogRepo } from '../../domain/ports/audit-log-repo.js';
import { UserNotFoundError } from '../../domain/errors/index.js';
import { Money } from '../../domain/value-objects/money.js';
import { AuditLog } from '../../domain/entities/audit-log.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface AdjustBalanceInput {
  userId: string;
  adminId: string;
  amount: number; // cents — positive to add, negative to deduct
  reason: string;
}

export interface AdjustBalanceResult {
  userId: string;
  username: string;
  previousBalance: number;
  newBalance: number;
  adjustedAmount: number;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Admin adjusts a user's balance (positive = deposit, negative = charge).
 * Creates an AuditLog entry for the adjustment.
 */
export class AdjustBalanceUseCase {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly auditLogRepo: AuditLogRepo,
  ) {}

  async execute(input: AdjustBalanceInput): Promise<AdjustBalanceResult> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    const previousBalance = user.balance.cents;

    // Apply the adjustment
    const adjustment = Money.fromCents(Math.abs(input.amount));
    let updatedUser = user;

    if (input.amount >= 0) {
      updatedUser = user.addBalance(adjustment);
    } else {
      updatedUser = user.deductBalance(adjustment);
    }

    // Persist updated user
    const saved = await this.userRepo.update(updatedUser);

    // Create audit log
    const auditLog = AuditLog.new({
      id: 0,
      adminId: input.adminId,
      userId: input.userId,
      action: input.amount >= 0 ? 'BALANCE_ADJUSTMENT_ADD' : 'BALANCE_ADJUSTMENT_DEDUCT',
      amount: input.amount,
      reason: input.reason,
    });
    await this.auditLogRepo.save(auditLog);

    const snap = saved.toSnapshot();

    return {
      userId: snap.id,
      username: snap.username,
      previousBalance,
      newBalance: snap.balance,
      adjustedAmount: input.amount,
    };
  }
}
